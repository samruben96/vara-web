import { Worker, Job } from 'bullmq';
import type { Prisma, ImageMatchType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { supabaseAdmin } from '../config/supabase';
import { createWorkerConnectionOptions } from '../config/redis';
import { QUEUE_NAMES, ImageScanJobData, ImageScanType } from '../queues';
import {
  clipService,
  ClipService,
  perceptualHashService,
  reverseImageService,
  deepfakeService,
  faceEmbeddingService,
} from '../services/ai';
import type { PersonDiscoveryScanResult } from '../services/ai/reverse-image.service';
import {
  isPersonDiscoveryEnabled,
  getPersonDiscoveryConfig,
} from '../config/person-discovery.config';
import { createAlertFromMatch } from '../utils/alert-creator';
import { preprocessImageForFaceDetection } from '../utils/image-preprocessing';

// Supabase Storage bucket name
const STORAGE_BUCKET = 'protected-images';

// Deepfake confidence threshold
const DEEPFAKE_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Match type configuration for tiered confidence filtering.
 * 
 * This configuration works with both scan engines:
 * 
 * TinEye (primary engine):
 * - Uses score-based confidence mapping (0-100 scale)
 * - HIGH confidence (score >= 80) → fullMatchingImages
 * - MEDIUM confidence (score 50-79) → partialMatchingImages
 * - LOW confidence (score < 50) → visuallySimilarImages
 * - TinEye scores are highly reliable; HIGH confidence matches can skip verification
 * 
 * Google Vision (fallback):
 * - Returns 4 match types with different reliability levels
 * - fullMatchingImages, partialMatchingImages, pagesWithMatchingImages, visuallySimilarImages
 * - Requires more verification due to higher false positive rate
 * 
 * The thresholds and verification requirements below are optimized for TinEye's
 * reliable scoring while maintaining compatibility with Google Vision results.
 */
const MATCH_TYPE_CONFIG = {
  fullMatchingImages: {
    confidence: 'HIGH' as const,
    requireFaceVerification: false, // TinEye HIGH confidence is very reliable - skip verification
    requireClipVerification: false,
    minSimilarityThreshold: 0.75, // TinEye score >= 80 maps to similarity >= 0.80
    autoCreateAlert: true,
  },
  partialMatchingImages: {
    confidence: 'MEDIUM_HIGH' as const,
    requireFaceVerification: true, // Verify identity for modified/partial matches
    requireClipVerification: false,
    minSimilarityThreshold: 0.50, // TinEye medium range starts at score 50
    autoCreateAlert: true,
  },
  pagesWithMatchingImages: {
    confidence: 'MEDIUM' as const,
    requireFaceVerification: true,
    requireClipVerification: true,
    minSimilarityThreshold: 0.8,
    autoCreateAlert: true,
  },
  visuallySimilarImages: {
    confidence: 'LOW' as const,
    requireFaceVerification: true,
    requireClipVerification: true,
    minSimilarityThreshold: 0.40, // TinEye low confidence requires stricter CLIP/face verification
    autoCreateAlert: false, // Flag for review instead of auto-alert
  },
} as const;

type MatchTypeKey = keyof typeof MATCH_TYPE_CONFIG;

/**
 * Formats an embedding array as a PostgreSQL vector literal.
 * Used for inserting embeddings into pgvector columns.
 *
 * @param embedding - The embedding array
 * @returns A string formatted for pgvector (e.g., "[0.1,0.2,0.3]")
 */
function formatForPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Result structure for image scan jobs.
 */
interface ImageScanResult {
  scannedAt: string;
  imagesProcessed: number;
  matchesFound: number;
  alertsCreated: number;
  duration: number;
  details: {
    reverseImageSearch: boolean;
    reverseImageSearchEngine: string; // 'tineye', 'google-vision', 'mock', etc.
    deepfakeAnalysis: boolean;
    similarityCheck: boolean;
    embeddingsGenerated: number;
    hashesGenerated: number;
    faceEmbeddingsGenerated: number;
    faceVerifiedMatches: number;
    matchBreakdown: {
      highConfidence: number; // fullMatchingImages - no verification needed
      mediumConfidence: number; // partialMatchingImages - face verification
      pagesMatches: number; // pagesWithMatchingImages - face+CLIP verification
      lowConfidence: number; // visuallySimilarImages - flagged for review
      skippedBelowThreshold: number;
      skippedFaceMismatch: number;
      skippedClipMismatch: number;
    };
    // Person discovery metrics (when enabled)
    personDiscovery?: {
      enabled: boolean;
      candidatesFound: number;
      candidatesExpanded: number;
      expansionMatches: number;
      originalImageMatches: number;
      candidateGroupId: string;
      discoveryDurationMs: number;
      expansionDurationMs: number;
      providersUsed: string[];
      warnings: string[];
    };
  };
  errors: string[];
}

/**
 * Represents an image record from the database with the fields needed for scanning.
 */
interface ImageRecord {
  id: string;
  storageUrl: string;
  hash: string | null;
  faceEmbedding?: number[] | null;
  faceDetected?: boolean;
}

/**
 * Face verification status enum values.
 */
type FaceVerificationStatus = 'VERIFIED' | 'NO_FACE_DETECTED' | 'MISMATCH';

/**
 * Represents an extended match with face and CLIP verification data.
 */
interface ExtendedMatch {
  domain: string;
  sourceUrl: string;
  similarity: number;
  isMock?: boolean;
  matchSourceType?: MatchTypeKey;
  faceVerified?: FaceVerificationStatus;
  faceSimilarity?: number;
  faceConfidence?: 'high' | 'medium' | 'low';
  clipVerified?: boolean;
  clipSimilarity?: number;
  confidenceTier?: typeof MATCH_TYPE_CONFIG[MatchTypeKey]['confidence'];
}

/**
 * Extracts the storage path from a full storage URL.
 * URL format: supabase_url/storage/v1/object/bucket/path
 */
function extractStoragePath(storageUrl: string): string | null {
  const prefix = `/storage/v1/object/${STORAGE_BUCKET}/`;
  const index = storageUrl.indexOf(prefix);
  if (index === -1) return null;
  return storageUrl.substring(index + prefix.length);
}

/**
 * Downloads an image from Supabase Storage.
 *
 * @param storageUrl - The full storage URL of the image
 * @returns The image data as a Buffer, or null if download fails
 */
async function downloadImage(storageUrl: string): Promise<Buffer | null> {
  const path = extractStoragePath(storageUrl);
  if (!path) {
    console.error(`[ImageScanWorker] Invalid storage URL format: ${storageUrl}`);
    return null;
  }

  const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(path);

  if (error) {
    console.error(`[ImageScanWorker] Failed to download image: ${error.message}`);
    return null;
  }

  // Convert Blob to Buffer
  const arrayBuffer = await data.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);

  // DEBUG: Log image details before preprocessing
  const magicBytes = rawBuffer.slice(0, 8).toString('hex');
  console.log('[FaceDetection] Debug - Downloaded protected image (raw):', {
    storagePath: path,
    byteLength: rawBuffer.byteLength,
    magicBytes,
    contentType: data.type || 'unknown',
  });

  // Preprocess image: normalize EXIF orientation and ensure minimum dimensions for face detection
  try {
    const preprocessed = await preprocessImageForFaceDetection(rawBuffer);
    console.log('[FaceDetection] Debug - Preprocessed protected image:', {
      storagePath: path,
      originalSize: `${preprocessed.originalWidth}x${preprocessed.originalHeight}`,
      finalSize: `${preprocessed.finalWidth}x${preprocessed.finalHeight}`,
      wasRotated: preprocessed.wasRotated,
      wasResized: preprocessed.wasResized,
      resizeOperation: preprocessed.resizeOperation,
      processingTimeMs: preprocessed.processingTimeMs,
    });
    return preprocessed.buffer;
  } catch (preprocessError) {
    console.warn(
      `[ImageScanWorker] Image preprocessing failed, using raw buffer: ${preprocessError instanceof Error ? preprocessError.message : 'Unknown error'}`
    );
    return rawBuffer;
  }
}

/**
 * Downloads an image from an external URL for face verification.
 *
 * @param url - The external URL of the image to download
 * @returns The image data as a Buffer, or null if download fails
 */
async function downloadMatchedImage(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vara-Safety-Scanner/1.0',
        Accept: 'image/*',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[ImageScanWorker] Failed to download matched image: HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.warn(`[ImageScanWorker] Invalid content type for matched image: ${contentType}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    // Limit image size to 10MB
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
      console.warn(`[ImageScanWorker] Matched image too large: ${arrayBuffer.byteLength} bytes`);
      return null;
    }

    const rawBuffer = Buffer.from(arrayBuffer);

    // DEBUG: Log image details before preprocessing
    const magicBytes = rawBuffer.slice(0, 8).toString('hex');
    const truncatedUrl = url.length > 80 ? url.substring(0, 80) + '...' : url;
    console.log('[FaceDetection] Debug - Downloaded matched image (raw):', {
      contentType,
      byteLength: rawBuffer.byteLength,
      magicBytes,
      sourceUrl: truncatedUrl,
    });

    // Preprocess image: normalize EXIF orientation and ensure minimum dimensions for face detection
    try {
      const preprocessed = await preprocessImageForFaceDetection(rawBuffer);
      console.log('[FaceDetection] Debug - Preprocessed matched image:', {
        sourceUrl: truncatedUrl,
        originalSize: `${preprocessed.originalWidth}x${preprocessed.originalHeight}`,
        finalSize: `${preprocessed.finalWidth}x${preprocessed.finalHeight}`,
        wasRotated: preprocessed.wasRotated,
        wasResized: preprocessed.wasResized,
        resizeOperation: preprocessed.resizeOperation,
        processingTimeMs: preprocessed.processingTimeMs,
      });
      return preprocessed.buffer;
    } catch (preprocessError) {
      console.warn(
        `[ImageScanWorker] Image preprocessing failed for matched image, using raw buffer: ${preprocessError instanceof Error ? preprocessError.message : 'Unknown error'}`
      );
      return rawBuffer;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[ImageScanWorker] Timeout downloading matched image: ${url}`);
    } else {
      console.warn(
        `[ImageScanWorker] Error downloading matched image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    return null;
  }
}

/**
 * Determines the match type based on similarity and deepfake analysis.
 */
function determineMatchType(
  similarity: number,
  isDeepfake: boolean
): ImageMatchType {
  if (isDeepfake) {
    return 'DEEPFAKE';
  }
  if (similarity >= 0.95) {
    return 'EXACT';
  }
  if (similarity >= 0.85) {
    return 'SIMILAR';
  }
  return 'MODIFIED';
}

/**
 * Identifies the platform from a domain name.
 */
function identifyPlatform(domain: string): string | null {
  const platformMap: Record<string, string> = {
    'instagram.com': 'INSTAGRAM',
    'facebook.com': 'FACEBOOK',
    'fb.com': 'FACEBOOK',
    'twitter.com': 'TWITTER',
    'x.com': 'TWITTER',
    'tiktok.com': 'TIKTOK',
    'linkedin.com': 'LINKEDIN',
    'youtube.com': 'YOUTUBE',
    'reddit.com': 'REDDIT',
    'pinterest.com': 'PINTEREST',
    'tumblr.com': 'TUMBLR',
  };

  const lowerDomain = domain.toLowerCase();
  for (const [key, value] of Object.entries(platformMap)) {
    if (lowerDomain.includes(key)) {
      return value;
    }
  }

  return null;
}

/**
 * Stores person discovery results with the new schema fields.
 *
 * Creates ImageMatch records for:
 * 1. Person candidates (PERSON_CANDIDATE) from SerpAPI
 * 2. TinEye expansion results (EXACT_COPY, ALTERED_COPY) linked to their parent candidates
 * 3. Original image matches from TinEye
 *
 * @param protectedImageId - The protected image ID
 * @param userId - The user ID who owns the image
 * @param scanJobId - The scan job ID for linking matches
 * @param result - The person discovery scan result
 * @param deepfakeResult - Optional deepfake analysis result
 * @returns Storage result with counts
 */
async function storePersonDiscoveryResults(
  protectedImageId: string,
  userId: string,
  scanJobId: string,
  result: PersonDiscoveryScanResult,
  deepfakeResult: { isDeepfake: boolean; confidence: number }
): Promise<{
  matchesCreated: number;
  alertsCreated: number;
  matchBreakdown: {
    personCandidates: number;
    faceMatches: number;
    exactCopies: number;
    alteredCopies: number;
    originalImageMatches: number;
  };
}> {
  let matchesCreated = 0;
  let alertsCreated = 0;
  let personCandidatesStored = 0;
  let exactCopiesStored = 0;
  let alteredCopiesStored = 0;
  let originalMatchesStored = 0;
  let faceMatchesStored = 0;

  const isDeepfakeDetected = deepfakeResult.isDeepfake && deepfakeResult.confidence >= DEEPFAKE_CONFIDENCE_THRESHOLD;

  // Collect alerts to create AFTER transaction commits (avoids connection contention)
  const alertsToCreate: Array<{
    matchId: string;
    sourceUrl: string;
    platform: string | null;
    similarity: number;
    matchType: ImageMatchType;
  }> = [];

  // Calculate total operations for timeout planning
  const totalTineyeMatches = result.candidates.reduce(
    (sum, c) => sum + c.tineyeMatches.length,
    0
  );
  const estimatedOperations =
    result.candidates.length + totalTineyeMatches + result.originalImageMatches.length;

  // Log warning for large batches that may take longer
  if (estimatedOperations > 500) {
    console.warn(
      `[ImageScanWorker] Large batch detected: ${estimatedOperations} operations ` +
      `(${result.candidates.length} candidates, ${totalTineyeMatches} tineye matches, ` +
      `${result.originalImageMatches.length} original matches). Transaction may take longer.`
    );
  }

  // Use a transaction to ensure atomicity for database writes only
  await prisma.$transaction(async (tx) => {
    // 1. Store each person discovery candidate
    for (const expandedCandidate of result.candidates) {
      const candidate = expandedCandidate.candidate;
      const platform = identifyPlatform(new URL(candidate.sourcePageUrl).hostname);

      // Determine match type based on discovery engine
      const isFaceCheckCandidate = candidate.engine === 'facecheck';
      const matchType: ImageMatchType = isFaceCheckCandidate ? 'FACE_MATCH' : 'PERSON_CANDIDATE';

      // FaceCheck candidates come with a score (0-100) and are already face-verified
      const faceCheckScore = candidate.score ?? null;
      const faceSimilarityValue = isFaceCheckCandidate && faceCheckScore !== null
        ? faceCheckScore / 100
        : expandedCandidate.faceSimilarity ?? null;
      const faceVerifiedValue = isFaceCheckCandidate ? 'VERIFIED' : null;

      try {
        const candidateMatch = await tx.imageMatch.upsert({
          where: {
            protectedImageId_sourceUrl: {
              protectedImageId,
              sourceUrl: candidate.sourcePageUrl,
            },
          },
          create: {
            protectedImageId,
            scanJobId,
            sourceUrl: candidate.sourcePageUrl,
            platform,
            matchType,
            similarity: isFaceCheckCandidate ? (faceCheckScore !== null ? faceCheckScore / 100 : 0) : 0,
            status: 'NEW',
            discoveryEngine: candidate.engine,
            candidateGroupId: result.candidateGroupId,
            faceSimilarity: faceSimilarityValue,
            faceVerified: faceVerifiedValue,
            discoveryScore: faceCheckScore,
          },
          update: {
            scanJobId,
            lastSeenAt: new Date(),
            candidateGroupId: result.candidateGroupId,
            ...(isFaceCheckCandidate && {
              faceSimilarity: faceSimilarityValue,
              faceVerified: faceVerifiedValue,
              discoveryScore: faceCheckScore,
            }),
          },
        });

        matchesCreated++;
        personCandidatesStored++;
        if (isFaceCheckCandidate) {
          faceMatchesStored++;
        }

        // 2. Store TinEye expansion matches for this candidate
        for (const tineyeMatch of expandedCandidate.tineyeMatches) {
          const tineyePlatform = identifyPlatform(tineyeMatch.domain);

          // Determine match type based on TinEye confidence
          const matchType: ImageMatchType =
            tineyeMatch.confidence === 'HIGH' ? 'EXACT_COPY' : 'ALTERED_COPY';

          try {
            const tineyeMatchRecord = await tx.imageMatch.upsert({
              where: {
                protectedImageId_sourceUrl: {
                  protectedImageId,
                  sourceUrl: tineyeMatch.imageUrl,
                },
              },
              create: {
                protectedImageId,
                scanJobId,
                sourceUrl: tineyeMatch.imageUrl,
                platform: tineyePlatform,
                matchType,
                similarity: tineyeMatch.score / 100, // Convert 0-100 to 0.0-1.0
                status: 'NEW',
                discoveryEngine: 'tineye',
                verificationEngine: 'tineye',
                candidateGroupId: result.candidateGroupId,
                parentCandidateId: candidateMatch.id,
              },
              update: {
                scanJobId,
                similarity: tineyeMatch.score / 100,
                lastSeenAt: new Date(),
                candidateGroupId: result.candidateGroupId,
                parentCandidateId: candidateMatch.id,
              },
            });

            matchesCreated++;
            if (matchType === 'EXACT_COPY') {
              exactCopiesStored++;
            } else {
              alteredCopiesStored++;
            }

            // Queue alert for high-confidence TinEye matches (created after tx commits)
            if (tineyeMatch.confidence === 'HIGH') {
              alertsToCreate.push({
                matchId: tineyeMatchRecord.id,
                sourceUrl: tineyeMatch.imageUrl,
                platform: tineyePlatform,
                similarity: tineyeMatch.score / 100,
                matchType,
              });
            }
          } catch (err) {
            console.error(
              `[ImageScanWorker] Failed to store TinEye expansion match ${tineyeMatch.imageUrl}:`,
              err instanceof Error ? err.message : String(err)
            );
          }
        }

        // Queue alert for high-score FaceCheck matches (score >= 80)
        if (isFaceCheckCandidate && faceCheckScore !== null && faceCheckScore >= 80) {
          alertsToCreate.push({
            matchId: candidateMatch.id,
            sourceUrl: candidate.sourcePageUrl,
            platform,
            similarity: faceCheckScore / 100,
            matchType: 'FACE_MATCH',
          });
        }
      } catch (err) {
        console.error(
          `[ImageScanWorker] Failed to store PERSON_CANDIDATE ${candidate.sourcePageUrl}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    // 3. Store original image matches (TinEye on the protected image itself)
    for (const match of result.originalImageMatches) {
      const platform = identifyPlatform(match.domain);

      // Use existing match type determination
      const matchType: ImageMatchType =
        match.confidence === 'HIGH' ? 'EXACT' : match.confidence === 'MEDIUM' ? 'SIMILAR' : 'MODIFIED';

      try {
        const imageMatch = await tx.imageMatch.upsert({
          where: {
            protectedImageId_sourceUrl: {
              protectedImageId,
              sourceUrl: match.imageUrl,
            },
          },
          create: {
            protectedImageId,
            scanJobId,
            sourceUrl: match.imageUrl,
            platform,
            matchType,
            similarity: match.score / 100,
            status: 'NEW',
            discoveryEngine: 'tineye',
            candidateGroupId: result.candidateGroupId,
            // No parentCandidateId - this is from the original image
          },
          update: {
            scanJobId,
            similarity: match.score / 100,
            lastSeenAt: new Date(),
            candidateGroupId: result.candidateGroupId,
          },
        });

        matchesCreated++;
        originalMatchesStored++;

        // Queue alert for high-confidence original image matches (created after tx commits)
        if (match.confidence === 'HIGH') {
          alertsToCreate.push({
            matchId: imageMatch.id,
            sourceUrl: match.imageUrl,
            platform,
            similarity: match.score / 100,
            matchType,
          });
        }
      } catch (err) {
        console.error(
          `[ImageScanWorker] Failed to store original image match ${match.imageUrl}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }, {
    // Timeout for database writes - increased to handle large batches (500+ upserts)
    // Sequential upserts can take 100-200ms each under load
    timeout: 120000, // 2 minutes for large batches
    maxWait: 15000, // 15 seconds max wait to acquire connection
  });

  // Create alerts AFTER transaction commits (avoids connection contention)
  if (alertsToCreate.length > 0) {
    console.log(`[ImageScanWorker] Creating ${alertsToCreate.length} alerts after transaction...`);

    for (const alertData of alertsToCreate) {
      try {
        await createAlertFromMatch(
          userId,
          {
            id: alertData.matchId,
            protectedImageId,
            sourceUrl: alertData.sourceUrl,
            platform: alertData.platform,
            similarity: alertData.similarity,
            matchType: alertData.matchType,
            isMock: false,
          },
          isDeepfakeDetected
            ? {
                isDeepfake: true,
                confidence: deepfakeResult.confidence,
                analysisMethod: 'person-discovery',
                details: { candidateGroupId: result.candidateGroupId },
              }
            : undefined
        );
        alertsCreated++;
      } catch (alertError) {
        console.error(
          `[ImageScanWorker] Failed to create alert for match ${alertData.matchId}:`,
          alertError
        );
      }
    }
  }

  console.log(
    `[ImageScanWorker] Person discovery storage complete: ` +
    `${matchesCreated} matches (${personCandidatesStored} candidates, ` +
    `${faceMatchesStored} face matches, ` +
    `${exactCopiesStored} exact copies, ${alteredCopiesStored} altered copies, ` +
    `${originalMatchesStored} original matches), ${alertsCreated} alerts`
  );

  return {
    matchesCreated,
    alertsCreated,
    matchBreakdown: {
      personCandidates: personCandidatesStored,
      faceMatches: faceMatchesStored,
      exactCopies: exactCopiesStored,
      alteredCopies: alteredCopiesStored,
      originalImageMatches: originalMatchesStored,
    },
  };
}

/**
 * Result type for processImage function.
 */
interface ProcessImageResult {
  matchesCreated: number;
  alertsCreated: number;
  embeddingGenerated: boolean;
  hashGenerated: boolean;
  faceEmbeddingGenerated: boolean;
  faceVerifiedMatches: number;
  scanEngine?: string;
  matchBreakdown?: {
    highConfidence: number;
    mediumConfidence: number;
    pagesMatches: number;
    lowConfidence: number;
    skippedBelowThreshold: number;
    skippedFaceMismatch: number;
    skippedClipMismatch: number;
  };
  personDiscovery?: {
    enabled: boolean;
    candidatesFound: number;
    candidatesExpanded: number;
    expansionMatches: number;
    originalImageMatches: number;
    candidateGroupId: string;
    discoveryDurationMs: number;
    expansionDurationMs: number;
    providersUsed: string[];
    warnings: string[];
  };
  error?: string;
}

/**
 * Processes a single image through the AI scanning pipeline.
 *
 * Supports two scanning modes:
 * 1. Person Discovery (when enabled): Uses SerpAPI to find visually similar persons,
 *    then expands each candidate with TinEye to find exact/altered copies.
 * 2. TinEye Only (fallback): Direct reverse image search on the protected image.
 *
 * @param image - The image record to process
 * @param userId - The user ID who owns the image
 * @param scanJobId - The scan job ID for linking matches
 * @param scanType - Controls which scan pipeline to use ('auto', 'person_discovery', 'tineye_only')
 * @returns Processing result with counts and metrics
 */
async function processImage(
  image: ImageRecord,
  userId: string,
  scanJobId: string,
  scanType: ImageScanType = 'auto'
): Promise<ProcessImageResult> {
  const result: ProcessImageResult = {
    matchesCreated: 0,
    alertsCreated: 0,
    embeddingGenerated: false,
    hashGenerated: false,
    faceEmbeddingGenerated: false,
    faceVerifiedMatches: 0,
    scanEngine: undefined,
    matchBreakdown: undefined,
    personDiscovery: undefined,
    error: undefined,
  };

  try {
    // Download image from Supabase Storage
    const imageBuffer = await downloadImage(image.storageUrl);
    if (!imageBuffer) {
      result.error = `Failed to download image ${image.id}`;
      return result;
    }

    // Generate embeddings and hash
    const clipResult = await clipService.generateEmbeddingFromBase64(imageBuffer.toString('base64'));
    const embeddingVector = formatForPgVector(clipResult.embedding);
    result.embeddingGenerated = true;

    const hashResult = await perceptualHashService.generateHash(imageBuffer);
    result.hashGenerated = true;
    const faceResult = await faceEmbeddingService.extractEmbedding(imageBuffer);

    // Store the user's face embedding for later verification
    let userFaceEmbedding: number[] | null = null;

    if (faceResult.embedding) {
      // Face detected - store embedding
      userFaceEmbedding = faceResult.embedding;
      const faceEmbeddingForPg = formatForPgVector(faceResult.embedding);
      await prisma.$executeRaw`
        UPDATE "protected_images"
        SET
          embedding = ${embeddingVector}::vector,
          hash = ${hashResult.hash},
          "faceEmbedding" = ${faceEmbeddingForPg}::vector,
          "faceDetected" = true,
          "faceConfidence" = ${faceResult.faceConfidence},
          "faceMetadata" = ${JSON.stringify({
            facialArea: faceResult.facialArea,
            processingTimeMs: faceResult.processingTimeMs
          })}::jsonb,
          "lastScanned" = NOW(),
          "scanCount" = COALESCE("scanCount", 0) + 1
        WHERE id = ${image.id}
      `;
      result.faceEmbeddingGenerated = true;
    } else {
      // No face detected - update other fields
      await prisma.$executeRaw`
        UPDATE "protected_images"
        SET
          embedding = ${embeddingVector}::vector,
          hash = ${hashResult.hash},
          "faceDetected" = false,
          "lastScanned" = NOW(),
          "scanCount" = COALESCE("scanCount", 0) + 1
        WHERE id = ${image.id}
      `;
    }

    // Run deepfake detection
    const deepfakeResult = await deepfakeService.analyze(imageBuffer);

    // Determine which scan pipeline to use
    const shouldUsePersonDiscovery =
      scanType === 'person_discovery' ||
      (scanType === 'auto' && isPersonDiscoveryEnabled());

    // Variables for match breakdown tracking
    let highConfidence = 0;
    let mediumConfidence = 0;
    let pagesMatches = 0;
    let lowConfidence = 0;

    if (shouldUsePersonDiscovery) {
      // === PERSON DISCOVERY PIPELINE ===
      const config = getPersonDiscoveryConfig();

      const personDiscoveryResult = await reverseImageService.scanWithPersonDiscovery(
        { id: image.id, storageUrl: image.storageUrl },
        {
          maxCandidates: config.maxCandidates,
          maxTineyeExpansions: config.maxTineyeExpansions,
        }
      );

      // Store person discovery metrics
      const candidatesWithMatches = personDiscoveryResult.candidates.filter(c => c.tineyeMatches.length > 0);
      const totalExpansionMatches = personDiscoveryResult.candidates.reduce(
        (sum, c) => sum + c.tineyeMatches.length,
        0
      );

      result.personDiscovery = {
        enabled: true,
        candidatesFound: personDiscoveryResult.candidates.length,
        candidatesExpanded: candidatesWithMatches.length,
        expansionMatches: totalExpansionMatches,
        originalImageMatches: personDiscoveryResult.originalImageMatches.length,
        candidateGroupId: personDiscoveryResult.candidateGroupId,
        discoveryDurationMs: personDiscoveryResult.discoveryDurationMs,
        expansionDurationMs: personDiscoveryResult.expansionDurationMs,
        providersUsed: personDiscoveryResult.providersUsed,
        warnings: personDiscoveryResult.warnings,
      };

      result.scanEngine = personDiscoveryResult.personDiscoveryUsed
        ? `person-discovery:${personDiscoveryResult.providersUsed.join(',')}`
        : 'tineye';

      // Store results using the person discovery schema
      const personDiscoveryStorageResult = await storePersonDiscoveryResults(
        image.id,
        userId,
        scanJobId,
        personDiscoveryResult,
        deepfakeResult
      );

      result.matchesCreated = personDiscoveryStorageResult.matchesCreated;
      result.alertsCreated = personDiscoveryStorageResult.alertsCreated;

      // Set match breakdown from person discovery results
      highConfidence = personDiscoveryStorageResult.matchBreakdown.exactCopies;
      mediumConfidence = personDiscoveryStorageResult.matchBreakdown.alteredCopies;
      pagesMatches = 0; // Not applicable for person discovery
      lowConfidence = personDiscoveryStorageResult.matchBreakdown.personCandidates;

    } else {
      // === TRADITIONAL TINEYE-ONLY PIPELINE ===
      const searchResult = await reverseImageService.search(imageBuffer);
      result.scanEngine = searchResult.provider;

      // Calculate match breakdown by confidence tier
      highConfidence = searchResult.matches.filter(m => m.matchSourceType === 'fullMatchingImages').length;
      mediumConfidence = searchResult.matches.filter(m => m.matchSourceType === 'partialMatchingImages').length;
      pagesMatches = searchResult.matches.filter(m => m.matchSourceType === 'pagesWithMatchingImages').length;
      lowConfidence = searchResult.matches.filter(m => m.matchSourceType === 'visuallySimilarImages').length;

      let skippedBelowThreshold = 0;
      let skippedFaceMismatch = 0;
      let skippedClipMismatch = 0;
      let flaggedForReview = 0;

      for (const match of searchResult.matches) {
      // Get match type config for tiered filtering
      const matchSourceType = match.matchSourceType || 'visuallySimilarImages'; // Default to most restrictive
      const matchConfig = MATCH_TYPE_CONFIG[matchSourceType];

      // Skip matches below type-specific threshold
      if (match.similarity < matchConfig.minSimilarityThreshold) {
        skippedBelowThreshold++;
        continue;
      }

      // Extended match data for verification
      const extendedMatch: ExtendedMatch = {
        domain: match.domain,
        sourceUrl: match.sourceUrl,
        similarity: match.similarity,
        isMock: match.isMock,
        matchSourceType,
        confidenceTier: matchConfig.confidence,
      };

      // Face verification: If required by config and user's image has a face
      if (matchConfig.requireFaceVerification && userFaceEmbedding && match.sourceUrl) {
        try {
          const matchedImageBuffer = await downloadMatchedImage(match.sourceUrl);

          if (matchedImageBuffer) {
            const matchFaceResult = await faceEmbeddingService.extractEmbedding(matchedImageBuffer);

            if (matchFaceResult.embedding) {
              // Compare faces
              const comparison = await faceEmbeddingService.compareFaces(
                userFaceEmbedding,
                matchFaceResult.embedding
              );

              if (comparison.isSamePerson) {
                extendedMatch.faceVerified = 'VERIFIED';
                extendedMatch.faceSimilarity = comparison.similarity;
                extendedMatch.faceConfidence = comparison.confidence;
                result.faceVerifiedMatches++;
              } else {
                skippedFaceMismatch++;
                continue;
              }
            } else {
              extendedMatch.faceVerified = 'NO_FACE_DETECTED';
            }
          }
        } catch {
          // Failed to verify face, proceed with original match logic
        }
      }

      // CLIP verification: If required by config, compare image embeddings
      if (matchConfig.requireClipVerification && match.sourceUrl) {
        try {
          const matchedImageBuffer = await downloadMatchedImage(match.sourceUrl);

          if (matchedImageBuffer) {
            const matchClipResult = await clipService.generateEmbeddingFromBase64(matchedImageBuffer.toString('base64'));

            // Get the protected image's CLIP embedding (use the one we just generated)
            const protectedClipResult = await clipService.generateEmbeddingFromBase64(imageBuffer.toString('base64'));

            // Compare CLIP embeddings using static method
            const clipSimilarity = ClipService.cosineSimilarity(
              protectedClipResult.embedding,
              matchClipResult.embedding
            );

            extendedMatch.clipSimilarity = clipSimilarity;

            // CLIP similarity threshold (0.8 = strong visual similarity)
            const clipThreshold = 0.8;
            if (clipSimilarity >= clipThreshold) {
              extendedMatch.clipVerified = true;
            } else {
              skippedClipMismatch++;
              continue;
            }
          }
        } catch {
          if (matchConfig.requireClipVerification) {
            skippedClipMismatch++;
            continue;
          }
        }
      }

      const platform = identifyPlatform(match.domain);
      const isDeepfake =
        deepfakeResult.isDeepfake && deepfakeResult.confidence >= DEEPFAKE_CONFIDENCE_THRESHOLD;
      const matchType = determineMatchType(match.similarity, isDeepfake);

      // Check if this match already exists (to avoid duplicate alerts on re-scans)
      const existingMatch = await prisma.imageMatch.findUnique({
        where: {
          protectedImageId_sourceUrl: {
            protectedImageId: image.id,
            sourceUrl: match.sourceUrl,
          },
        },
      });

      const isNewMatch = !existingMatch;

      // Determine status based on autoCreateAlert config
      const matchStatus = matchConfig.autoCreateAlert ? 'NEW' : 'FLAGGED_FOR_REVIEW';

      // Create or update ImageMatch record (upsert to handle duplicates from re-scans)
      const imageMatch = await prisma.imageMatch.upsert({
        where: {
          protectedImageId_sourceUrl: {
            protectedImageId: image.id,
            sourceUrl: match.sourceUrl,
          },
        },
        create: {
          protectedImageId: image.id,
          scanJobId,
          sourceUrl: match.sourceUrl,
          platform,
          similarity: match.similarity,
          matchType,
          status: matchStatus,
        },
        update: {
          // Update fields for re-detected matches
          scanJobId,
          similarity: match.similarity,
          matchType,
          lastSeenAt: new Date(),
        },
      });

      if (isNewMatch) {
        result.matchesCreated++;
        if (!matchConfig.autoCreateAlert) {
          flaggedForReview++;
        }
      }

      // Only create alert for NEW matches with autoCreateAlert=true
      if (isNewMatch && matchConfig.autoCreateAlert) {
        try {
          await createAlertFromMatch(
            userId,
            {
              id: imageMatch.id,
              protectedImageId: image.id,
              sourceUrl: match.sourceUrl,
              platform,
              similarity: match.similarity,
              matchType,
              isMock: match.isMock,
              faceVerified: extendedMatch.faceVerified,
              faceSimilarity: extendedMatch.faceSimilarity,
              faceConfidence: extendedMatch.faceConfidence,
            },
            isDeepfake
              ? {
                  isDeepfake: true,
                  confidence: deepfakeResult.confidence,
                  analysisMethod: deepfakeResult.analysisDetails.modelVersion,
                  details: deepfakeResult.analysisDetails as unknown as Record<string, unknown>,
                }
              : undefined
          );
          result.alertsCreated++;
        } catch (alertError) {
          console.error(
            `[ImageScanWorker] Failed to create alert for match ${imageMatch.id}:`,
            alertError
          );
          // Continue processing - don't fail the entire scan for an alert creation failure
        }
        }
      }

      // Log filter summary (single line)
      const filtered = skippedBelowThreshold + skippedFaceMismatch + skippedClipMismatch;
      if (filtered > 0 || flaggedForReview > 0) {
        console.log(`[ImageScanWorker] Filtered: ${filtered} (threshold: ${skippedBelowThreshold}, face: ${skippedFaceMismatch}, clip: ${skippedClipMismatch}), flagged: ${flaggedForReview}`);
      }

      // Store match breakdown in result for job statistics
      result.matchBreakdown = {
        highConfidence,
        mediumConfidence,
        pagesMatches,
        lowConfidence,
        skippedBelowThreshold,
        skippedFaceMismatch,
        skippedClipMismatch,
      };

      // If deepfake detected but no matches found, still create an alert for the original
      if (
        deepfakeResult.isDeepfake &&
        deepfakeResult.confidence >= DEEPFAKE_CONFIDENCE_THRESHOLD &&
        searchResult.matches.length === 0
      ) {
        console.log(
          `[ImageScanWorker] Deepfake detected in original image ${image.id} with confidence ${deepfakeResult.confidence}`
        );
        // Note: This would typically only happen if someone uploaded a deepfake
        // For now we log but don't alert since the image was uploaded by the user
      }
    } // End of traditional TinEye-only pipeline else block

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ImageScanWorker] Error processing image ${image.id}:`, result.error);
    return result;
  }
}

/**
 * Processes an image scan job.
 *
 * This function:
 * 1. Updates job status to RUNNING
 * 2. Downloads images from Supabase Storage
 * 3. Generates CLIP embeddings and perceptual hashes
 * 4. Performs reverse image search
 * 5. Runs deepfake detection
 * 6. Creates ImageMatch records for findings
 * 7. Creates alerts for concerning matches
 * 8. Updates job progress throughout
 */
async function processImageScan(job: Job<ImageScanJobData>): Promise<ImageScanResult> {
  const { scanJobId, userId, targetId, scanType = 'auto' } = job.data;
  const startTime = Date.now();
  const errors: string[] = [];

  console.log(`[ImageScanWorker] Starting job ${job.id} for scan ${scanJobId}`);

  // Update scan job status to RUNNING
  await prisma.scanJob.update({
    where: { id: scanJobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  try {
    // Get images to scan
    const images = await prisma.protectedImage.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        ...(targetId ? { id: targetId } : {}),
      },
      select: {
        id: true,
        storageUrl: true,
        hash: true,
      },
    });

    if (images.length === 0) {
      console.log(`[ImageScanWorker] No active images found for user ${userId}`);
    }

    // Update job progress - starting
    await job.updateProgress(10);

    let totalMatches = 0;
    let totalAlerts = 0;
    let embeddingsGenerated = 0;
    let hashesGenerated = 0;
    let faceEmbeddingsGenerated = 0;
    let faceVerifiedMatches = 0;
    let lastScanEngine = 'unknown';
    
    // Aggregated match breakdown across all images
    const aggregatedBreakdown = {
      highConfidence: 0,
      mediumConfidence: 0,
      pagesMatches: 0,
      lowConfidence: 0,
      skippedBelowThreshold: 0,
      skippedFaceMismatch: 0,
      skippedClipMismatch: 0,
    };

    // Aggregated person discovery metrics (when enabled)
    let aggregatedPersonDiscovery: ImageScanResult['details']['personDiscovery'] = undefined;

    // Calculate progress increments per image
    // Progress: 10% (start) -> 90% (processing) -> 100% (complete)
    const progressPerImage = images.length > 0 ? 80 / images.length : 0;

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const image = images[i]!;
      const imageResult = await processImage(image, userId, scanJobId, scanType);

      totalMatches += imageResult.matchesCreated;
      totalAlerts += imageResult.alertsCreated;

      if (imageResult.embeddingGenerated) {
        embeddingsGenerated++;
      }
      if (imageResult.hashGenerated) {
        hashesGenerated++;
      }
      if (imageResult.faceEmbeddingGenerated) {
        faceEmbeddingsGenerated++;
      }
      faceVerifiedMatches += imageResult.faceVerifiedMatches;
      
      // Aggregate scan engine (use the last one processed)
      if (imageResult.scanEngine) {
        lastScanEngine = imageResult.scanEngine;
      }
      
      // Aggregate match breakdown statistics
      if (imageResult.matchBreakdown) {
        aggregatedBreakdown.highConfidence += imageResult.matchBreakdown.highConfidence;
        aggregatedBreakdown.mediumConfidence += imageResult.matchBreakdown.mediumConfidence;
        aggregatedBreakdown.pagesMatches += imageResult.matchBreakdown.pagesMatches;
        aggregatedBreakdown.lowConfidence += imageResult.matchBreakdown.lowConfidence;
        aggregatedBreakdown.skippedBelowThreshold += imageResult.matchBreakdown.skippedBelowThreshold;
        aggregatedBreakdown.skippedFaceMismatch += imageResult.matchBreakdown.skippedFaceMismatch;
        aggregatedBreakdown.skippedClipMismatch += imageResult.matchBreakdown.skippedClipMismatch;
      }

      // Aggregate person discovery metrics (use last result since they share candidateGroupId)
      if (imageResult.personDiscovery) {
        if (!aggregatedPersonDiscovery) {
          // First person discovery result - initialize
          aggregatedPersonDiscovery = { ...imageResult.personDiscovery };
        } else {
          // Merge subsequent results
          aggregatedPersonDiscovery.candidatesFound += imageResult.personDiscovery.candidatesFound;
          aggregatedPersonDiscovery.candidatesExpanded += imageResult.personDiscovery.candidatesExpanded;
          aggregatedPersonDiscovery.expansionMatches += imageResult.personDiscovery.expansionMatches;
          aggregatedPersonDiscovery.originalImageMatches += imageResult.personDiscovery.originalImageMatches;
          aggregatedPersonDiscovery.discoveryDurationMs += imageResult.personDiscovery.discoveryDurationMs;
          aggregatedPersonDiscovery.expansionDurationMs += imageResult.personDiscovery.expansionDurationMs;
          aggregatedPersonDiscovery.warnings.push(...imageResult.personDiscovery.warnings);
          // Merge unique providers
          for (const provider of imageResult.personDiscovery.providersUsed) {
            if (!aggregatedPersonDiscovery.providersUsed.includes(provider)) {
              aggregatedPersonDiscovery.providersUsed.push(provider);
            }
          }
        }
      }

      if (imageResult.error) {
        errors.push(`Image ${image.id}: ${imageResult.error}`);
      }

      // Update progress
      const progress = Math.min(90, 10 + Math.round((i + 1) * progressPerImage));
      await job.updateProgress(progress);
    }

    // Final progress update
    await job.updateProgress(90);

    const now = new Date();
    const duration = Date.now() - startTime;

    const result: ImageScanResult = {
      scannedAt: now.toISOString(),
      imagesProcessed: images.length,
      matchesFound: totalMatches,
      alertsCreated: totalAlerts,
      duration,
      details: {
        reverseImageSearch: true,
        reverseImageSearchEngine: lastScanEngine,
        deepfakeAnalysis: true,
        similarityCheck: true,
        embeddingsGenerated,
        hashesGenerated,
        faceEmbeddingsGenerated,
        faceVerifiedMatches,
        matchBreakdown: aggregatedBreakdown,
        personDiscovery: aggregatedPersonDiscovery,
      },
      errors,
    };

    // Update scan job with success result
    await prisma.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
      },
    });

    // Final progress
    await job.updateProgress(100);

    console.log(
      `[ImageScanWorker] Completed job ${job.id}: processed ${images.length} images, ` +
        `found ${totalMatches} matches, created ${totalAlerts} alerts in ${duration}ms`
    );

    return result;
  } catch (error) {
    // Update scan job with failure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage,
      },
    });

    console.error(`[ImageScanWorker] Failed job ${job.id}:`, errorMessage);
    throw error;
  }
}

/**
 * Creates and starts the image scan worker.
 * Returns null if Redis is not configured.
 */
export function createImageScanWorker(): Worker<ImageScanJobData, ImageScanResult> | null {
  const connectionOptions = createWorkerConnectionOptions();

  if (!connectionOptions) {
    console.warn('[ImageScanWorker] Worker disabled - Redis not configured');
    return null;
  }

  const worker = new Worker<ImageScanJobData, ImageScanResult>(
    QUEUE_NAMES.IMAGE_SCAN,
    processImageScan,
    {
      connection: connectionOptions,
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 10, // Max 10 jobs per duration
        duration: 60000, // Per minute
      },
    }
  );

  worker.on('ready', () => {
    console.log('[ImageScanWorker] Worker is ready and listening for jobs');
  });

  worker.on('completed', (job, result) => {
    console.log(
      `[ImageScanWorker] Job ${job.id} completed: ${result.imagesProcessed} images processed, ` +
        `${result.matchesFound} matches found`
    );
  });

  worker.on('failed', (job, error) => {
    console.error(`[ImageScanWorker] Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[ImageScanWorker] Worker error:', error.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[ImageScanWorker] Job ${jobId} stalled`);
  });

  return worker;
}
