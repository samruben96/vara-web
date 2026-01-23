import { Worker, Job } from 'bullmq';
import type { Prisma, ImageMatchType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { supabaseAdmin } from '../config/supabase';
import { createWorkerConnectionOptions } from '../config/redis';
import { QUEUE_NAMES, ImageScanJobData } from '../queues';
import {
  clipService,
  ClipService,
  perceptualHashService,
  reverseImageService,
  deepfakeService,
  faceEmbeddingService,
} from '../services/ai';
import { createAlertFromMatch } from '../utils/alert-creator';

// Supabase Storage bucket name
const STORAGE_BUCKET = 'protected-images';

// Deepfake confidence threshold
const DEEPFAKE_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Match type configuration for tiered confidence filtering.
 * Google Vision returns 4 match types with different reliability levels.
 * This config determines how strictly each type is filtered.
 */
const MATCH_TYPE_CONFIG = {
  fullMatchingImages: {
    confidence: 'HIGH' as const,
    requireFaceVerification: false, // Trust exact matches
    requireClipVerification: false,
    minSimilarityThreshold: 0.7,
    autoCreateAlert: true,
  },
  partialMatchingImages: {
    confidence: 'MEDIUM_HIGH' as const,
    requireFaceVerification: true,
    requireClipVerification: false,
    minSimilarityThreshold: 0.75,
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
    minSimilarityThreshold: 0.85,
    autoCreateAlert: false, // Flag for review instead
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
    deepfakeAnalysis: boolean;
    similarityCheck: boolean;
    embeddingsGenerated: number;
    hashesGenerated: number;
    faceEmbeddingsGenerated: number;
    faceVerifiedMatches: number;
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
  return Buffer.from(arrayBuffer);
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

    return Buffer.from(arrayBuffer);
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
 * Processes a single image through the AI scanning pipeline.
 *
 * @param image - The image record to process
 * @param userId - The user ID who owns the image
 * @param scanJobId - The scan job ID for linking matches
 * @returns Processing result with counts
 */
async function processImage(
  image: ImageRecord,
  userId: string,
  scanJobId: string
): Promise<{
  matchesCreated: number;
  alertsCreated: number;
  embeddingGenerated: boolean;
  hashGenerated: boolean;
  faceEmbeddingGenerated: boolean;
  faceVerifiedMatches: number;
  error?: string;
}> {
  const result = {
    matchesCreated: 0,
    alertsCreated: 0,
    embeddingGenerated: false,
    hashGenerated: false,
    faceEmbeddingGenerated: false,
    faceVerifiedMatches: 0,
    error: undefined as string | undefined,
  };

  try {
    // Download image from Supabase Storage
    const imageBuffer = await downloadImage(image.storageUrl);
    if (!imageBuffer) {
      result.error = `Failed to download image ${image.id}`;
      return result;
    }

    // Generate CLIP embedding
    console.log(`[ImageScanWorker] Generating CLIP embedding for image ${image.id}`);
    const clipResult = await clipService.generateEmbeddingFromBase64(imageBuffer.toString('base64'));
    const embeddingVector = formatForPgVector(clipResult.embedding);
    result.embeddingGenerated = true;

    // Generate perceptual hash
    console.log(`[ImageScanWorker] Generating perceptual hash for image ${image.id}`);
    const hashResult = await perceptualHashService.generateHash(imageBuffer);
    result.hashGenerated = true;

    // Extract face embedding for identity verification
    console.log(`[ImageScanWorker] Extracting face embedding for image ${image.id}`);
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
      console.log(`[ImageScanWorker] Face detected in image ${image.id} with confidence ${faceResult.faceConfidence}`);
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
      console.log(`[ImageScanWorker] No face detected in image ${image.id}`);
    }

    // Perform reverse image search
    console.log(`[ImageScanWorker] Running reverse image search for image ${image.id}`);
    const searchResult = await reverseImageService.search(imageBuffer);

    // Run deepfake detection on original image
    console.log(`[ImageScanWorker] Running deepfake detection for image ${image.id}`);
    const deepfakeResult = await deepfakeService.analyze(imageBuffer);

    // Process matches from reverse image search
    console.log(`[ImageScanWorker] Processing ${searchResult.matches.length} matches from ${searchResult.provider}`);

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
        console.log(
          `[ImageScanWorker] Skipping ${matchSourceType} - below threshold: ${match.similarity} < ${matchConfig.minSimilarityThreshold}`
        );
        skippedBelowThreshold++;
        continue;
      }

      console.log(
        `[ImageScanWorker] Match [${matchSourceType}/${matchConfig.confidence}]: ${match.domain} - similarity: ${match.similarity}`
      );

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
          // Download the matched image and extract its face
          console.log(`[ImageScanWorker] Verifying face in matched image: ${match.sourceUrl}`);
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
                // Face matches - this is a verified identity match
                extendedMatch.faceVerified = 'VERIFIED';
                extendedMatch.faceSimilarity = comparison.similarity;
                extendedMatch.faceConfidence = comparison.confidence;
                result.faceVerifiedMatches++;
                console.log(
                  `[ImageScanWorker] Face VERIFIED for ${match.sourceUrl}: ` +
                  `similarity=${comparison.similarity}, confidence=${comparison.confidence}`
                );
              } else {
                // Face doesn't match - this is a false positive, skip it
                console.log(
                  `[ImageScanWorker] Skipping ${matchSourceType} - face mismatch: ` +
                  `similarity=${comparison.similarity}, distance=${comparison.distance}`
                );
                skippedFaceMismatch++;
                continue; // Skip this match entirely
              }
            } else {
              // No face in matched image - for types requiring face verification, this is suspicious
              console.log(`[ImageScanWorker] No face detected in matched image ${match.sourceUrl}`);
              // Allow to proceed but mark as not face verified
              extendedMatch.faceVerified = 'NO_FACE_DETECTED';
            }
          }
        } catch (err) {
          // Failed to verify face, proceed with original match logic
          console.log(
            `[ImageScanWorker] Could not verify face for ${match.sourceUrl}: ` +
            `${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }

      // CLIP verification: If required by config, compare image embeddings
      if (matchConfig.requireClipVerification && match.sourceUrl) {
        try {
          console.log(`[ImageScanWorker] Verifying CLIP similarity for ${match.sourceUrl}`);
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
              console.log(
                `[ImageScanWorker] CLIP VERIFIED for ${match.sourceUrl}: similarity=${clipSimilarity.toFixed(3)}`
              );
            } else {
              // CLIP similarity too low - skip for low confidence match types
              console.log(
                `[ImageScanWorker] Skipping ${matchSourceType} - CLIP similarity too low: ${clipSimilarity.toFixed(3)} < ${clipThreshold}`
              );
              skippedClipMismatch++;
              continue;
            }
          }
        } catch (err) {
          console.log(
            `[ImageScanWorker] Could not verify CLIP for ${match.sourceUrl}: ` +
            `${err instanceof Error ? err.message : 'Unknown error'}`
          );
          // For types requiring CLIP verification, skip if we can't verify
          if (matchConfig.requireClipVerification) {
            console.log(`[ImageScanWorker] Skipping ${matchSourceType} - CLIP verification required but failed`);
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
          console.log(
            `[ImageScanWorker] Flagging ${matchSourceType} for review - low confidence: ${match.sourceUrl}`
          );
        } else {
          console.log(`[ImageScanWorker] New match created: ${match.sourceUrl}`);
        }
      } else {
        console.log(`[ImageScanWorker] Existing match updated: ${match.sourceUrl}`);
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

    // Log summary of skipped matches
    if (skippedBelowThreshold > 0) {
      console.log(`[ImageScanWorker] Skipped ${skippedBelowThreshold} matches below similarity threshold`);
    }
    if (skippedFaceMismatch > 0) {
      console.log(`[ImageScanWorker] Skipped ${skippedFaceMismatch} matches due to face mismatch`);
    }
    if (skippedClipMismatch > 0) {
      console.log(`[ImageScanWorker] Skipped ${skippedClipMismatch} matches due to low CLIP similarity`);
    }
    if (flaggedForReview > 0) {
      console.log(`[ImageScanWorker] Flagged ${flaggedForReview} low-confidence matches for review`);
    }

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
  const { scanJobId, userId, targetId } = job.data;
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

    // Calculate progress increments per image
    // Progress: 10% (start) -> 90% (processing) -> 100% (complete)
    const progressPerImage = images.length > 0 ? 80 / images.length : 0;

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const image = images[i]!;
      console.log(
        `[ImageScanWorker] Processing image ${i + 1}/${images.length}: ${image.id}`
      );

      const imageResult = await processImage(image, userId, scanJobId);

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
        deepfakeAnalysis: true,
        similarityCheck: true,
        embeddingsGenerated,
        hashesGenerated,
        faceEmbeddingsGenerated,
        faceVerifiedMatches,
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
