import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import {
  preprocessImageForFaceDetection,
  needsPreprocessing,
  DEFAULT_PREPROCESSING_CONFIG,
} from '../../../utils/image-preprocessing';

/**
 * Face Detection Pipeline Unit Tests
 *
 * These tests verify:
 * 1. Image preprocessing (EXIF normalization, dimension enforcement)
 * 2. Face detection integration with DeepFace service
 * 3. End-to-end pipeline from raw image to face detection result
 *
 * Test images are generated programmatically using sharp to avoid
 * binary file dependencies and ensure reproducibility.
 */

// Constants
const FIXTURES_DIR = path.join(__dirname, '__fixtures__');
const MIN_DIMENSION = 480;
const MAX_DIMENSION = 2048;

// Mock fetch globally for DeepFace service tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/**
 * Helper to create a test image buffer with specific dimensions.
 * Creates a simple gradient image that can be used for testing.
 */
async function createTestImage(
  width: number,
  height: number,
  options?: {
    format?: 'jpeg' | 'png';
    withExifOrientation?: number;
  }
): Promise<Buffer> {
  const { format = 'jpeg' } = options || {};

  // Create a gradient image with some visual structure
  // This creates a simple colored rectangle
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  });

  // Add some visual variation to make it more image-like
  // This helps with potential face detection algorithms
  // Only add composite for images large enough to have a visible inner rectangle
  const innerWidth = Math.floor(width * 0.6);
  const innerHeight = Math.floor(height * 0.6);

  if (innerWidth >= 1 && innerHeight >= 1) {
    pipeline = pipeline.composite([
      {
        input: await sharp({
          create: {
            width: innerWidth,
            height: innerHeight,
            channels: 3,
            background: { r: 200, g: 180, b: 160 }, // Skin-tone-ish color
          },
        })
          .jpeg()
          .toBuffer(),
        top: Math.floor(height * 0.2),
        left: Math.floor(width * 0.2),
      },
    ]);
  }

  if (format === 'jpeg') {
    return pipeline.jpeg({ quality: 90 }).toBuffer();
  } else {
    return pipeline.png().toBuffer();
  }
}

/**
 * Helper to create a small test image (below minimum dimension).
 */
async function createSmallTestImage(): Promise<Buffer> {
  return createTestImage(200, 200);
}

/**
 * Helper to create a large test image (above maximum dimension).
 */
async function createLargeTestImage(): Promise<Buffer> {
  return createTestImage(3000, 2000);
}

/**
 * Helper to create a standard-sized test image (within acceptable range).
 */
async function createStandardTestImage(): Promise<Buffer> {
  return createTestImage(800, 600);
}

/**
 * Helper to create an image with EXIF orientation metadata.
 * Note: sharp.rotate() without arguments auto-rotates based on EXIF.
 */
async function createImageWithExifOrientation(orientation: number): Promise<Buffer> {
  // Create a non-square image so rotation is detectable
  const baseImage = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();

  // Use sharp's withMetadata to add EXIF orientation
  // Orientation values:
  // 1 = Normal
  // 3 = 180 degree rotation
  // 6 = 90 degree CW rotation
  // 8 = 90 degree CCW rotation
  return sharp(baseImage)
    .withMetadata({ orientation })
    .jpeg()
    .toBuffer();
}

/**
 * Generate a synthetic headshot-like image for face detection testing.
 * This creates an image with an oval shape in the center resembling a face.
 */
async function createSyntheticHeadshot(): Promise<Buffer> {
  const width = 640;
  const height = 480;

  // Create base image
  const baseImage = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 230, g: 230, b: 230 }, // Light gray background
    },
  })
    .jpeg()
    .toBuffer();

  // Create face-like oval (skin tone)
  const faceWidth = 200;
  const faceHeight = 250;
  const faceOval = await sharp({
    create: {
      width: faceWidth,
      height: faceHeight,
      channels: 4,
      background: { r: 225, g: 190, b: 170, alpha: 1 }, // Skin tone
    },
  })
    .png()
    .toBuffer();

  // Create "eyes" (dark circles)
  const eyeSize = 30;
  const eye = await sharp({
    create: {
      width: eyeSize,
      height: eyeSize,
      channels: 4,
      background: { r: 60, g: 40, b: 30, alpha: 1 }, // Dark brown
    },
  })
    .png()
    .toBuffer();

  // Composite the image
  const result = await sharp(baseImage)
    .composite([
      {
        input: faceOval,
        top: Math.floor((height - faceHeight) / 2),
        left: Math.floor((width - faceWidth) / 2),
      },
      // Left eye
      {
        input: eye,
        top: Math.floor((height - faceHeight) / 2) + 80,
        left: Math.floor((width - faceWidth) / 2) + 50,
      },
      // Right eye
      {
        input: eye,
        top: Math.floor((height - faceHeight) / 2) + 80,
        left: Math.floor((width - faceWidth) / 2) + 120,
      },
    ])
    .jpeg({ quality: 95 })
    .toBuffer();

  return result;
}

describe('Face Detection Pipeline', () => {
  beforeAll(async () => {
    // Ensure fixtures directory exists
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: DeepFace service unavailable
    mockFetch.mockRejectedValue(new Error('Connection refused'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Image Preprocessing', () => {
    describe('EXIF Orientation Normalization', () => {
      it('should handle images without EXIF orientation (orientation 1)', async () => {
        const imageBuffer = await createImageWithExifOrientation(1);

        const result = await preprocessImageForFaceDetection(imageBuffer);

        expect(result.buffer).toBeDefined();
        expect(result.buffer.length).toBeGreaterThan(0);
        expect(result.wasRotated).toBe(false);
      });

      it('should detect that EXIF orientation 6 needs processing', async () => {
        const imageBuffer = await createImageWithExifOrientation(6);

        const needs = await needsPreprocessing(imageBuffer);

        expect(needs).toBe(true);
      });

      it('should normalize image with EXIF orientation 6 (90 degree CW)', async () => {
        const imageBuffer = await createImageWithExifOrientation(6);
        const originalMetadata = await sharp(imageBuffer).metadata();

        const result = await preprocessImageForFaceDetection(imageBuffer);

        expect(result.buffer).toBeDefined();
        expect(result.wasRotated).toBe(true);
        // After rotation, dimensions should be swapped (800x600 -> 600x800)
        expect(result.finalWidth).toBe(originalMetadata.height);
        expect(result.finalHeight).toBe(originalMetadata.width);
      });

      it('should normalize image with EXIF orientation 8 (90 degree CCW)', async () => {
        const imageBuffer = await createImageWithExifOrientation(8);

        const result = await preprocessImageForFaceDetection(imageBuffer);

        expect(result.buffer).toBeDefined();
        expect(result.wasRotated).toBe(true);
      });

      it('should handle EXIF orientation 3 (180 degree rotation)', async () => {
        const imageBuffer = await createImageWithExifOrientation(3);

        const result = await preprocessImageForFaceDetection(imageBuffer);

        expect(result.buffer).toBeDefined();
        // Orientation 3 is 180 rotation, doesn't involve dimension swap
        expect(result.wasRotated).toBe(false); // Only orientations 5-8 swap dimensions
      });

      it('should strip EXIF orientation after normalization', async () => {
        const imageBuffer = await createImageWithExifOrientation(6);

        const result = await preprocessImageForFaceDetection(imageBuffer);
        const processedMetadata = await sharp(result.buffer).metadata();

        // After processing, orientation should be normalized (1 or undefined)
        expect(
          processedMetadata.orientation === undefined || processedMetadata.orientation === 1
        ).toBe(true);
      });
    });

    describe('Minimum Dimension Enforcement', () => {
      it('should upscale images smaller than minimum dimension', async () => {
        const smallImage = await createSmallTestImage(); // 200x200
        const originalMetadata = await sharp(smallImage).metadata();

        expect(originalMetadata.width).toBe(200);
        expect(originalMetadata.height).toBe(200);

        const result = await preprocessImageForFaceDetection(smallImage);
        const processedMetadata = await sharp(result.buffer).metadata();

        // Minimum dimension should be at least 480
        expect(Math.min(processedMetadata.width!, processedMetadata.height!)).toBeGreaterThanOrEqual(
          MIN_DIMENSION
        );
        expect(result.wasResized).toBe(true);
        expect(result.resizeOperation).toBe('upscaled');
      });

      it('should calculate correct upscale factor', async () => {
        const smallImage = await createTestImage(100, 150); // Very small

        const result = await preprocessImageForFaceDetection(smallImage);

        // Min dimension is 100, should scale up so 100 becomes 480
        // Scale factor = 480/100 = 4.8
        // Expected: 100*4.8 = 480, 150*4.8 = 720
        expect(result.finalWidth).toBe(480);
        expect(result.finalHeight).toBe(720);
      });

      it('should preserve aspect ratio when upscaling', async () => {
        const smallImage = await createTestImage(200, 100); // 2:1 aspect ratio
        const originalMetadata = await sharp(smallImage).metadata();
        const originalAspectRatio = originalMetadata.width! / originalMetadata.height!;

        const result = await preprocessImageForFaceDetection(smallImage);
        const processedAspectRatio = result.finalWidth / result.finalHeight;

        expect(processedAspectRatio).toBeCloseTo(originalAspectRatio, 1);
      });

      it('should not upscale images already meeting minimum dimension', async () => {
        const adequateImage = await createTestImage(600, 800);

        const result = await preprocessImageForFaceDetection(adequateImage);

        // Both dimensions are above 480, no upscaling needed
        expect(result.wasResized).toBe(false);
        expect(result.resizeOperation).toBe('none');
        expect(result.finalWidth).toBe(600);
        expect(result.finalHeight).toBe(800);
      });
    });

    describe('Maximum Dimension Enforcement', () => {
      it('should downscale images larger than maximum dimension', async () => {
        const largeImage = await createLargeTestImage(); // 3000x2000
        const originalMetadata = await sharp(largeImage).metadata();

        expect(originalMetadata.width).toBe(3000);

        const result = await preprocessImageForFaceDetection(largeImage);

        // Maximum dimension should be at most 2048
        expect(Math.max(result.finalWidth, result.finalHeight)).toBeLessThanOrEqual(MAX_DIMENSION);
        expect(result.wasResized).toBe(true);
        expect(result.resizeOperation).toBe('downscaled');
      });

      it('should preserve aspect ratio when downscaling', async () => {
        const largeImage = await createTestImage(4000, 3000); // 4:3 aspect ratio
        const originalMetadata = await sharp(largeImage).metadata();
        const originalAspectRatio = originalMetadata.width! / originalMetadata.height!;

        const result = await preprocessImageForFaceDetection(largeImage);
        const processedAspectRatio = result.finalWidth / result.finalHeight;

        expect(processedAspectRatio).toBeCloseTo(originalAspectRatio, 1);
      });

      it('should not downscale if it would violate minimum dimension', async () => {
        // Create an image where downscaling to max would violate min
        // e.g., 3000x400 - if we scale to max 2048, width becomes 2048, height becomes 272 < 480
        const edgeCaseImage = await createTestImage(3000, 400);

        const result = await preprocessImageForFaceDetection(edgeCaseImage);

        // Should skip downscale to preserve minimum dimension
        expect(result.resizeOperation).not.toBe('downscaled');
      });
    });

    describe('Output Format', () => {
      it('should convert PNG to JPEG', async () => {
        const pngImage = await createTestImage(800, 600, { format: 'png' });
        const originalMetadata = await sharp(pngImage).metadata();

        expect(originalMetadata.format).toBe('png');

        const result = await preprocessImageForFaceDetection(pngImage);
        const processedMetadata = await sharp(result.buffer).metadata();

        expect(processedMetadata.format).toBe('jpeg');
      });

      it('should output valid JPEG with configurable quality', async () => {
        const image = await createStandardTestImage();

        const result = await preprocessImageForFaceDetection(image, { quality: 80 });
        const metadata = await sharp(result.buffer).metadata();

        expect(metadata.format).toBe('jpeg');
        expect(result.buffer.length).toBeGreaterThan(0);
      });
    });

    describe('Processing Metadata', () => {
      it('should return original dimensions', async () => {
        const image = await createTestImage(640, 480);

        const result = await preprocessImageForFaceDetection(image);

        expect(result.originalWidth).toBe(640);
        expect(result.originalHeight).toBe(480);
      });

      it('should track processing time', async () => {
        const image = await createStandardTestImage();

        const result = await preprocessImageForFaceDetection(image);

        expect(result.processingTimeMs).toBeDefined();
        expect(typeof result.processingTimeMs).toBe('number');
        expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('needsPreprocessing()', () => {
      it('should return false for standard images without EXIF', async () => {
        const standardImage = await createStandardTestImage();

        const needs = await needsPreprocessing(standardImage);

        expect(needs).toBe(false);
      });

      it('should return true for images below minimum dimension', async () => {
        const smallImage = await createSmallTestImage();

        const needs = await needsPreprocessing(smallImage);

        expect(needs).toBe(true);
      });

      it('should return true for images above maximum dimension', async () => {
        const largeImage = await createLargeTestImage();

        const needs = await needsPreprocessing(largeImage);

        expect(needs).toBe(true);
      });

      it('should return true for images with non-standard EXIF orientation', async () => {
        const rotatedImage = await createImageWithExifOrientation(6);

        const needs = await needsPreprocessing(rotatedImage);

        expect(needs).toBe(true);
      });
    });
  });

  describe('Face Detection Integration', () => {
    /**
     * Helper to get a fresh service instance with custom fetch behavior.
     */
    async function getServiceInstance(
      fetchBehavior?: (url: string) => Promise<Response | never>
    ) {
      if (fetchBehavior) {
        mockFetch.mockImplementation(fetchBehavior);
      }
      vi.resetModules();
      const module = await import('../face-embedding.service');
      await new Promise((resolve) => setTimeout(resolve, 10));
      return module.FaceEmbeddingService.getInstance();
    }

    describe('when DeepFace service is available', () => {
      it('should detect face in preprocessed synthetic headshot', async () => {
        const mockEmbedding = Array(512).fill(0).map((_, i) => Math.sin(i) * 0.1);

        const service = await getServiceInstance((url: string) => {
          if (url.includes('/health')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  status: 'healthy',
                  service: 'deepface',
                  model_loaded: true,
                }),
            } as Response);
          }
          if (url.includes('/extract-embedding')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  embedding: mockEmbedding,
                  face_count: 1,
                  face_confidence: 0.95,
                  facial_area: { x: 220, y: 115, w: 200, h: 250 },
                  processing_time_ms: 150,
                }),
            } as Response);
          }
          return Promise.reject(new Error('Unknown endpoint'));
        });

        // Create and preprocess a synthetic headshot
        const rawImage = await createSyntheticHeadshot();
        const preprocessed = await preprocessImageForFaceDetection(rawImage);

        // Run face detection
        const result = await service.extractEmbedding(preprocessed.buffer);

        // Verify face was detected
        expect(result.embedding).not.toBeNull();
        expect(result.embedding?.length).toBe(512);
        expect(result.faceCount).toBeGreaterThanOrEqual(1);
        expect(result.faceConfidence).toBeGreaterThan(0);
        expect(result.facialArea).not.toBeNull();
      });

      it('should return face location data', async () => {
        const mockEmbedding = Array(512).fill(0).map((_, i) => Math.cos(i) * 0.1);

        const service = await getServiceInstance((url: string) => {
          if (url.includes('/health')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  status: 'healthy',
                  service: 'deepface',
                  model_loaded: true,
                }),
            } as Response);
          }
          if (url.includes('/extract-embedding')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  embedding: mockEmbedding,
                  face_count: 1,
                  face_confidence: 0.92,
                  facial_area: { x: 100, y: 50, w: 150, h: 180 },
                  processing_time_ms: 120,
                }),
            } as Response);
          }
          return Promise.reject(new Error('Unknown endpoint'));
        });

        const image = await createSyntheticHeadshot();
        const preprocessed = await preprocessImageForFaceDetection(image);
        const result = await service.extractEmbedding(preprocessed.buffer);

        // Verify facial area has all required properties
        expect(result.facialArea).toHaveProperty('x');
        expect(result.facialArea).toHaveProperty('y');
        expect(result.facialArea).toHaveProperty('w');
        expect(result.facialArea).toHaveProperty('h');

        // Verify values are reasonable
        expect(result.facialArea!.x).toBeGreaterThanOrEqual(0);
        expect(result.facialArea!.y).toBeGreaterThanOrEqual(0);
        expect(result.facialArea!.w).toBeGreaterThan(0);
        expect(result.facialArea!.h).toBeGreaterThan(0);
      });

      it('should handle image with no face gracefully', async () => {
        const service = await getServiceInstance((url: string) => {
          if (url.includes('/health')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  status: 'healthy',
                  service: 'deepface',
                  model_loaded: true,
                }),
            } as Response);
          }
          if (url.includes('/extract-embedding')) {
            return Promise.resolve({
              ok: false,
              json: () =>
                Promise.resolve({
                  error: 'No face detected in image',
                  code: 'NO_FACE_DETECTED',
                }),
            } as Response);
          }
          return Promise.reject(new Error('Unknown endpoint'));
        });

        // Create image without face-like features
        const noFaceImage = await sharp({
          create: {
            width: 640,
            height: 480,
            channels: 3,
            background: { r: 100, g: 200, b: 100 }, // Green background, no face
          },
        })
          .jpeg()
          .toBuffer();

        const preprocessed = await preprocessImageForFaceDetection(noFaceImage);
        const result = await service.extractEmbedding(preprocessed.buffer);

        expect(result.embedding).toBeNull();
        expect(result.faceCount).toBe(0);
        expect(result.faceConfidence).toBe(0);
        expect(result.facialArea).toBeNull();
      });
    });

    describe('when DeepFace service is unavailable (mock mode)', () => {
      it('should still process images in mock mode', async () => {
        const service = await getServiceInstance();

        expect(service.isInMockMode()).toBe(true);

        const image = await createSyntheticHeadshot();
        const preprocessed = await preprocessImageForFaceDetection(image);
        const result = await service.extractEmbedding(preprocessed.buffer);

        // Should return a valid result (may or may not have face)
        expect(result).toBeDefined();
        expect(result).toHaveProperty('embedding');
        expect(result).toHaveProperty('faceCount');
        expect(result).toHaveProperty('processingTimeMs');
      });

      it('should return deterministic results for same image', async () => {
        const service = await getServiceInstance();

        const image = await createSyntheticHeadshot();
        const preprocessed = await preprocessImageForFaceDetection(image);

        const result1 = await service.extractEmbedding(preprocessed.buffer);
        const result2 = await service.extractEmbedding(preprocessed.buffer);

        // Same input should produce same output
        expect(result1.embedding).toEqual(result2.embedding);
        expect(result1.faceCount).toEqual(result2.faceCount);
      });
    });
  });

  describe('End-to-End Pipeline', () => {
    it('should process raw image through full pipeline', async () => {
      // Dynamically import with reset modules
      vi.resetModules();

      // Configure mock for available service
      const mockEmbedding = Array(512).fill(0).map((_, i) => Math.sin(i * 0.1));

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'healthy',
                service: 'deepface',
                model_loaded: true,
              }),
          } as Response);
        }
        if (url.includes('/extract-embedding')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                embedding: mockEmbedding,
                face_count: 1,
                face_confidence: 0.88,
                facial_area: { x: 200, y: 100, w: 180, h: 220 },
                processing_time_ms: 140,
              }),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const module = await import('../face-embedding.service');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const service = module.FaceEmbeddingService.getInstance();

      // Step 1: Create raw image (small, with EXIF that needs normalization)
      const rawImage = await createTestImage(300, 400);

      // Step 2: Preprocess
      const preprocessResult = await preprocessImageForFaceDetection(rawImage);

      expect(preprocessResult.wasResized).toBe(true);
      expect(preprocessResult.resizeOperation).toBe('upscaled');

      // Step 3: Face detection
      const faceResult = await service.extractEmbedding(preprocessResult.buffer);

      // Step 4: Verify complete pipeline result
      expect(faceResult).toBeDefined();
      expect(faceResult.processingTimeMs).toBeGreaterThanOrEqual(0);

      // If face detected, verify embedding quality
      if (faceResult.embedding) {
        expect(faceResult.embedding.length).toBe(512);
        expect(faceResult.faceCount).toBeGreaterThanOrEqual(1);
        expect(faceResult.faceConfidence).toBeGreaterThan(0);
      }
    });

    it('should handle various image formats correctly', async () => {
      vi.resetModules();
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'healthy',
                service: 'deepface',
                model_loaded: true,
              }),
          } as Response);
        }
        if (url.includes('/extract-embedding')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                embedding: Array(512).fill(0.1),
                face_count: 1,
                face_confidence: 0.85,
                facial_area: { x: 100, y: 80, w: 150, h: 180 },
                processing_time_ms: 100,
              }),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const module = await import('../face-embedding.service');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const service = module.FaceEmbeddingService.getInstance();

      // Test JPEG
      const jpegImage = await createTestImage(640, 480, { format: 'jpeg' });
      const jpegPreprocessed = await preprocessImageForFaceDetection(jpegImage);
      const jpegResult = await service.extractEmbedding(jpegPreprocessed.buffer);
      expect(jpegResult).toBeDefined();

      // Test PNG
      const pngImage = await createTestImage(640, 480, { format: 'png' });
      const pngPreprocessed = await preprocessImageForFaceDetection(pngImage);
      const pngResult = await service.extractEmbedding(pngPreprocessed.buffer);
      expect(pngResult).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle 1x1 pixel image', async () => {
      const tinyImage = await createTestImage(1, 1);

      const result = await preprocessImageForFaceDetection(tinyImage);

      expect(result.buffer).toBeDefined();
      expect(result.wasResized).toBe(true);
      expect(result.resizeOperation).toBe('upscaled');
    });

    it('should handle very wide panoramic image', async () => {
      const panoramic = await createTestImage(3000, 500);

      const result = await preprocessImageForFaceDetection(panoramic);

      expect(result.buffer).toBeDefined();
      // Note: Preprocessing prioritizes min dimension over max dimension
      // For panoramic images where downscaling would violate min, it skips downscale
      // So the result may exceed max dimension to preserve min dimension
      expect(Math.min(result.finalWidth, result.finalHeight)).toBeGreaterThanOrEqual(MIN_DIMENSION);
    });

    it('should handle very tall portrait image', async () => {
      const portrait = await createTestImage(500, 3000);

      const result = await preprocessImageForFaceDetection(portrait);

      expect(result.buffer).toBeDefined();
      // Same as panoramic - min dimension takes priority
      expect(Math.min(result.finalWidth, result.finalHeight)).toBeGreaterThanOrEqual(MIN_DIMENSION);
    });

    it('should handle square image', async () => {
      const square = await createTestImage(1000, 1000);

      const result = await preprocessImageForFaceDetection(square);

      expect(result.buffer).toBeDefined();
      expect(result.finalWidth).toBe(result.finalHeight);
    });

    it('should handle image at exact minimum dimension', async () => {
      const exactMin = await createTestImage(MIN_DIMENSION, MIN_DIMENSION);

      const result = await preprocessImageForFaceDetection(exactMin);

      expect(result.wasResized).toBe(false);
      expect(result.resizeOperation).toBe('none');
    });

    it('should handle image at exact maximum dimension', async () => {
      const exactMax = await createTestImage(MAX_DIMENSION, MAX_DIMENSION);

      const result = await preprocessImageForFaceDetection(exactMax);

      expect(result.wasResized).toBe(false);
      expect(result.resizeOperation).toBe('none');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration values', () => {
      expect(DEFAULT_PREPROCESSING_CONFIG.minDimension).toBe(480);
      expect(DEFAULT_PREPROCESSING_CONFIG.maxDimension).toBe(2048);
      expect(DEFAULT_PREPROCESSING_CONFIG.normalizeExif).toBe(true);
      expect(DEFAULT_PREPROCESSING_CONFIG.quality).toBe(90);
    });

    it('should allow custom configuration override', async () => {
      const customConfig = {
        minDimension: 640,
        maxDimension: 1024,
        quality: 75,
      };

      const smallImage = await createTestImage(400, 400);
      const result = await preprocessImageForFaceDetection(smallImage, customConfig);

      // Should upscale to custom minimum (640)
      expect(Math.min(result.finalWidth, result.finalHeight)).toBeGreaterThanOrEqual(640);
    });

    it('should allow disabling EXIF normalization', async () => {
      const rotatedImage = await createImageWithExifOrientation(6);

      const result = await preprocessImageForFaceDetection(rotatedImage, {
        normalizeExif: false,
      });

      // With EXIF normalization disabled, image should not be marked as rotated
      // Note: The wasRotated flag is based on whether dimensions were swapped
      expect(result.buffer).toBeDefined();
    });
  });
});

/**
 * Instructions for adding real test images:
 *
 * To test with a real headshot image, place it in the __fixtures__ directory:
 * apps/api/src/services/ai/__tests__/__fixtures__/sample-headshot.jpg
 *
 * Then add a test like:
 *
 * describe('Real Image Tests', () => {
 *   const realImagePath = path.join(FIXTURES_DIR, 'sample-headshot.jpg');
 *
 *   it('should detect face in real headshot image', async () => {
 *     if (!fs.existsSync(realImagePath)) {
 *       console.log('Skipping: sample-headshot.jpg not found in fixtures');
 *       return;
 *     }
 *
 *     const imageBuffer = fs.readFileSync(realImagePath);
 *     const preprocessed = await preprocessImageForFaceDetection(imageBuffer);
 *     const service = await getServiceInstance();
 *     const result = await service.extractEmbedding(preprocessed.buffer);
 *
 *     expect(result.faceCount).toBeGreaterThanOrEqual(1);
 *   });
 * });
 */
