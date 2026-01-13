import { Worker, Job } from 'bullmq';
import type { Prisma, ImageMatchType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { supabaseAdmin } from '../config/supabase';
import { createWorkerConnectionOptions } from '../config/redis';
import { QUEUE_NAMES, ImageScanJobData } from '../queues';
import {
  clipService,
  perceptualHashService,
  reverseImageService,
  deepfakeService,
} from '../services/ai';
import { createAlertFromMatch } from '../utils/alert-creator';

// Supabase Storage bucket name
const STORAGE_BUCKET = 'protected-images';

// Minimum similarity threshold for creating matches
const MIN_SIMILARITY_THRESHOLD = 0.85;

// Deepfake confidence threshold
const DEEPFAKE_CONFIDENCE_THRESHOLD = 0.7;

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
  error?: string;
}> {
  const result = {
    matchesCreated: 0,
    alertsCreated: 0,
    embeddingGenerated: false,
    hashGenerated: false,
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
    const clipResult = await clipService.generateEmbedding(imageBuffer);
    const embeddingVector = formatForPgVector(clipResult.embedding);
    result.embeddingGenerated = true;

    // Generate perceptual hash
    console.log(`[ImageScanWorker] Generating perceptual hash for image ${image.id}`);
    const hashResult = await perceptualHashService.generateHash(imageBuffer);
    result.hashGenerated = true;

    // Update protected_images with embedding and hash using raw SQL for pgvector
    await prisma.$executeRaw`
      UPDATE "protected_images"
      SET embedding = ${embeddingVector}::vector,
          hash = ${hashResult.hash},
          "lastScanned" = NOW(),
          "scanCount" = COALESCE("scanCount", 0) + 1
      WHERE id = ${image.id}
    `;

    // Perform reverse image search
    console.log(`[ImageScanWorker] Running reverse image search for image ${image.id}`);
    const searchResult = await reverseImageService.search(imageBuffer);

    // Run deepfake detection on original image
    console.log(`[ImageScanWorker] Running deepfake detection for image ${image.id}`);
    const deepfakeResult = await deepfakeService.analyze(imageBuffer);

    // Process matches from reverse image search
    console.log(`[ImageScanWorker] Processing ${searchResult.matches.length} matches from ${searchResult.provider}`);

    let skippedBelowThreshold = 0;
    for (const match of searchResult.matches) {
      // Skip matches below threshold
      if (match.similarity < MIN_SIMILARITY_THRESHOLD) {
        skippedBelowThreshold++;
        continue;
      }

      console.log(`[ImageScanWorker] Match: ${match.domain} - similarity: ${match.similarity}`);

      const platform = identifyPlatform(match.domain);
      const isDeepfake =
        deepfakeResult.isDeepfake && deepfakeResult.confidence >= DEEPFAKE_CONFIDENCE_THRESHOLD;
      const matchType = determineMatchType(match.similarity, isDeepfake);

      // Create ImageMatch record
      const imageMatch = await prisma.imageMatch.create({
        data: {
          protectedImageId: image.id,
          scanJobId,
          sourceUrl: match.sourceUrl,
          platform,
          similarity: match.similarity,
          matchType,
          status: 'NEW',
        },
      });

      result.matchesCreated++;

      // Create alert for this match
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

    if (skippedBelowThreshold > 0) {
      console.log(`[ImageScanWorker] Skipped ${skippedBelowThreshold} matches below ${MIN_SIMILARITY_THRESHOLD} threshold`);
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
