/**
 * Image Preprocessing Utilities
 *
 * Handles EXIF orientation normalization and dimension constraints
 * to improve face detection success rates.
 */

import sharp from 'sharp';
import { getConfig as getFaceDetectionConfig } from '../config/face-detection.config';

/**
 * Configuration for image preprocessing.
 */
export interface ImagePreprocessingConfig {
  /**
   * Minimum dimension (width or height) for the image.
   * Images smaller than this will be upscaled.
   * Default: 480
   */
  minDimension: number;

  /**
   * Maximum dimension (width or height) for the image.
   * Images larger than this will be downscaled.
   * Default: 2048
   */
  maxDimension: number;

  /**
   * Whether to normalize EXIF orientation.
   * Default: true
   */
  normalizeExif: boolean;

  /**
   * Output quality for JPEG compression (1-100).
   * Default: 90
   */
  quality: number;
}

/**
 * Get default preprocessing configuration from centralized face detection config.
 */
function getDefaultConfig(): ImagePreprocessingConfig {
  const faceConfig = getFaceDetectionConfig();
  return {
    minDimension: faceConfig.minImageDimension,
    maxDimension: faceConfig.maxImageDimension,
    normalizeExif: faceConfig.normalizeExifOrientation,
    quality: faceConfig.preprocessingQuality,
  };
}

/**
 * Default preprocessing configuration optimized for face detection.
 * Uses centralized configuration from face-detection.config.ts
 */
export const DEFAULT_PREPROCESSING_CONFIG: ImagePreprocessingConfig = {
  minDimension: 480,   // Ensure faces are large enough to detect
  maxDimension: 2048,  // Prevent excessive memory usage
  normalizeExif: true,
  quality: 90,
};

/**
 * Metadata about the preprocessing operation.
 */
export interface PreprocessingResult {
  /** The processed image buffer */
  buffer: Buffer;

  /** Original image dimensions */
  originalWidth: number;
  originalHeight: number;

  /** Final image dimensions after processing */
  finalWidth: number;
  finalHeight: number;

  /** Whether the image was rotated due to EXIF orientation */
  wasRotated: boolean;

  /** Whether the image was resized */
  wasResized: boolean;

  /** Resize operation applied (if any) */
  resizeOperation: 'upscaled' | 'downscaled' | 'none';

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Preprocesses an image for face detection.
 *
 * Operations performed:
 * 1. EXIF orientation normalization (auto-rotate based on metadata)
 * 2. Minimum dimension enforcement (upscale if too small)
 * 3. Maximum dimension enforcement (downscale if too large)
 *
 * @param imageBuffer - The raw image buffer
 * @param config - Optional preprocessing configuration
 * @returns The processed image buffer with metadata
 */
export async function preprocessImageForFaceDetection(
  imageBuffer: Buffer,
  config: Partial<ImagePreprocessingConfig> = {}
): Promise<PreprocessingResult> {
  const startTime = Date.now();
  // Use centralized config as base, then override with any provided config
  const defaultCfg = getDefaultConfig();
  const cfg = { ...defaultCfg, ...config };

  // Get original metadata
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;
  const orientation = metadata.orientation;

  console.log('[ImagePreprocessing] Original image:', {
    width: originalWidth,
    height: originalHeight,
    format: metadata.format,
    orientation: orientation || 'none',
  });

  // Start with EXIF normalization if enabled
  // sharp.rotate() without arguments auto-rotates based on EXIF orientation
  let pipeline = sharp(imageBuffer);

  let wasRotated = false;
  if (cfg.normalizeExif) {
    // Auto-rotate based on EXIF orientation data
    pipeline = pipeline.rotate();
    // Orientation values 5-8 involve rotation
    wasRotated = orientation !== undefined && orientation >= 5;
  }

  // After rotation, get the actual dimensions
  // For orientations 5-8, width and height are swapped
  let effectiveWidth = originalWidth;
  let effectiveHeight = originalHeight;
  if (wasRotated && orientation && orientation >= 5) {
    effectiveWidth = originalHeight;
    effectiveHeight = originalWidth;
  }

  // Calculate min and max of current dimensions
  const minCurrentDim = Math.min(effectiveWidth, effectiveHeight);
  const maxCurrentDim = Math.max(effectiveWidth, effectiveHeight);

  let wasResized = false;
  let resizeOperation: PreprocessingResult['resizeOperation'] = 'none';
  let finalWidth = effectiveWidth;
  let finalHeight = effectiveHeight;

  // Apply dimension constraints
  if (minCurrentDim < cfg.minDimension && minCurrentDim > 0) {
    // Upscale: ensure smallest dimension is at least minDimension
    const scaleFactor = cfg.minDimension / minCurrentDim;
    finalWidth = Math.round(effectiveWidth * scaleFactor);
    finalHeight = Math.round(effectiveHeight * scaleFactor);
    wasResized = true;
    resizeOperation = 'upscaled';
    console.log('[ImagePreprocessing] Upscaling image:', {
      from: `${effectiveWidth}x${effectiveHeight}`,
      to: `${finalWidth}x${finalHeight}`,
      scaleFactor: scaleFactor.toFixed(2),
    });
  } else if (maxCurrentDim > cfg.maxDimension) {
    // Downscale: ensure largest dimension is at most maxDimension
    const scaleFactor = cfg.maxDimension / maxCurrentDim;
    finalWidth = Math.round(effectiveWidth * scaleFactor);
    finalHeight = Math.round(effectiveHeight * scaleFactor);

    // Double-check min dimension after downscaling
    const newMinDim = Math.min(finalWidth, finalHeight);
    if (newMinDim < cfg.minDimension) {
      // Don't downscale if it would violate min dimension
      console.log('[ImagePreprocessing] Skipping downscale - would violate min dimension');
      finalWidth = effectiveWidth;
      finalHeight = effectiveHeight;
    } else {
      wasResized = true;
      resizeOperation = 'downscaled';
      console.log('[ImagePreprocessing] Downscaling image:', {
        from: `${effectiveWidth}x${effectiveHeight}`,
        to: `${finalWidth}x${finalHeight}`,
        scaleFactor: scaleFactor.toFixed(2),
      });
    }
  }

  // Apply resize if needed
  if (wasResized) {
    pipeline = pipeline.resize(finalWidth, finalHeight, {
      fit: 'inside',
      withoutEnlargement: resizeOperation === 'downscaled',
    });
  }

  // Convert to JPEG for consistent format
  const buffer = await pipeline
    .jpeg({ quality: cfg.quality })
    .toBuffer();

  const processingTimeMs = Date.now() - startTime;

  console.log('[ImagePreprocessing] Processing complete:', {
    finalDimensions: `${finalWidth}x${finalHeight}`,
    wasRotated,
    wasResized,
    resizeOperation,
    processingTimeMs,
    outputSize: buffer.length,
  });

  return {
    buffer,
    originalWidth,
    originalHeight,
    finalWidth,
    finalHeight,
    wasRotated,
    wasResized,
    resizeOperation,
    processingTimeMs,
  };
}

/**
 * Quick check if an image needs preprocessing.
 *
 * @param imageBuffer - The raw image buffer
 * @returns Whether the image needs preprocessing
 */
export async function needsPreprocessing(imageBuffer: Buffer): Promise<boolean> {
  const metadata = await sharp(imageBuffer).metadata();
  const cfg = getDefaultConfig();

  // Check for EXIF orientation that needs correction
  if (cfg.normalizeExif && metadata.orientation && metadata.orientation !== 1) {
    return true;
  }

  // Check dimensions
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  if (minDim < cfg.minDimension) {
    return true;
  }

  if (maxDim > cfg.maxDimension) {
    return true;
  }

  return false;
}
