/**
 * Face Detection Configuration
 *
 * Centralized configuration for face detection pipeline settings.
 * These settings can be overridden via environment variables.
 */

import { z } from 'zod';

/**
 * Configuration schema for face detection
 */
const faceDetectionConfigSchema = z.object({
  /**
   * Minimum image dimension for face detection.
   * Images smaller than this will be upscaled to improve detection.
   * Default: 480px
   */
  minImageDimension: z.coerce.number().min(100).max(1000).default(480),

  /**
   * Maximum image dimension for face detection.
   * Images larger than this will be downscaled to prevent memory issues.
   * Default: 2048px
   */
  maxImageDimension: z.coerce.number().min(500).max(4096).default(2048),

  /**
   * Whether to normalize EXIF orientation before face detection.
   * This ensures rotated images are processed correctly.
   * Default: true
   */
  normalizeExifOrientation: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('true'),

  /**
   * JPEG quality for preprocessed images (1-100).
   * Higher quality = better face detection but larger files.
   * Default: 90
   */
  preprocessingQuality: z.coerce.number().min(50).max(100).default(90),

  /**
   * Minimum face detection confidence threshold (0.0 - 1.0).
   * Lower values = more faces detected but potentially more false positives.
   * Default: 0.5 (relaxed from typical 0.8)
   */
  minFaceConfidence: z.coerce.number().min(0).max(1).default(0.5),

  /**
   * Minimum face size as a percentage of the smallest image dimension.
   * Faces smaller than this percentage may not be detected.
   * Default: 0.05 (5% of image dimension)
   */
  minFaceSizePercent: z.coerce.number().min(0.01).max(0.5).default(0.05),
});

export type FaceDetectionConfig = z.infer<typeof faceDetectionConfigSchema>;

/**
 * Load face detection configuration from environment variables.
 */
export function getFaceDetectionConfig(): FaceDetectionConfig {
  const rawConfig = {
    minImageDimension: process.env.FACE_MIN_IMAGE_DIMENSION || '480',
    maxImageDimension: process.env.FACE_MAX_IMAGE_DIMENSION || '2048',
    normalizeExifOrientation: process.env.FACE_NORMALIZE_EXIF || 'true',
    preprocessingQuality: process.env.FACE_PREPROCESSING_QUALITY || '90',
    minFaceConfidence: process.env.FACE_MIN_CONFIDENCE || '0.5',
    minFaceSizePercent: process.env.FACE_MIN_SIZE_PERCENT || '0.05',
  };

  const parsed = faceDetectionConfigSchema.safeParse(rawConfig);

  if (!parsed.success) {
    console.error('[FaceDetection] Invalid configuration:', parsed.error.format());

    // Return safe defaults
    return {
      minImageDimension: 480,
      maxImageDimension: 2048,
      normalizeExifOrientation: true,
      preprocessingQuality: 90,
      minFaceConfidence: 0.5,
      minFaceSizePercent: 0.05,
    };
  }

  return parsed.data;
}

/**
 * Get a human-readable status of face detection configuration.
 */
export function getFaceDetectionStatus(): {
  config: FaceDetectionConfig;
  summary: string;
} {
  const config = getFaceDetectionConfig();

  const summary = [
    `Image dimensions: ${config.minImageDimension}px - ${config.maxImageDimension}px`,
    `EXIF normalization: ${config.normalizeExifOrientation ? 'enabled' : 'disabled'}`,
    `Min face confidence: ${(config.minFaceConfidence * 100).toFixed(0)}%`,
    `Min face size: ${(config.minFaceSizePercent * 100).toFixed(0)}% of image`,
  ].join(', ');

  return { config, summary };
}

// Cached config instance
let _configInstance: FaceDetectionConfig | null = null;

/**
 * Get cached face detection config.
 */
export function getConfig(): FaceDetectionConfig {
  if (!_configInstance) {
    _configInstance = getFaceDetectionConfig();
  }
  return _configInstance;
}

/**
 * Reset cached config (useful for testing).
 */
export function resetConfigCache(): void {
  _configInstance = null;
}
