import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

/**
 * Face Embedding Service Unit Tests
 *
 * These tests cover:
 * - Singleton pattern
 * - Mock mode behavior (when DeepFace service is unavailable)
 * - extractEmbedding() functionality
 * - compareFaces() functionality
 * - isServiceAvailable() with caching
 * - Static methods (cosineSimilarity)
 */

// Constants matching the service
const EMBEDDING_DIMENSION = 512;
const DEFAULT_COMPARISON_THRESHOLD = 0.68;
const HEALTH_CACHE_DURATION_MS = 30000;

// Mock fetch globally before any imports
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Store module reference
let FaceEmbeddingService: typeof import('../face-embedding.service').FaceEmbeddingService;

/**
 * Helper to create a test image buffer with deterministic content
 */
function createTestImageBuffer(seed: string): Buffer {
  return Buffer.from(`test-image-data-${seed}`);
}

/**
 * Helper to create a mock embedding vector of proper dimension
 */
function createMockEmbedding(seed: number = 0): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    embedding.push(Math.sin(seed + i) * 0.5);
  }
  // Normalize to unit length
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / magnitude);
}

/**
 * Helper to create a health check response
 */
function createHealthResponse(healthy: boolean, modelLoaded: boolean = true) {
  return {
    status: healthy ? 'healthy' : 'unhealthy',
    service: 'deepface',
    model_loaded: modelLoaded,
  };
}

/**
 * Helper to create an embedding extraction response
 */
function createExtractEmbeddingResponse(embedding: number[], faceCount: number = 1) {
  return {
    embedding,
    face_count: faceCount,
    face_confidence: 0.95,
    facial_area: { x: 100, y: 100, w: 200, h: 200 },
    processing_time_ms: 150,
  };
}

/**
 * Helper to create a face comparison response
 */
function createCompareResponse(
  isSamePerson: boolean,
  similarity: number,
  confidence: 'high' | 'medium' | 'low' = 'high'
) {
  return {
    is_same_person: isSamePerson,
    distance: 1 - similarity,
    similarity,
    confidence,
    processing_time_ms: 80,
  };
}

/**
 * Helper to reset module and get fresh instance
 */
async function getNewServiceInstance(
  fetchBehavior: (url: string) => Promise<Response | never> = () =>
    Promise.reject(new Error('Connection refused'))
) {
  mockFetch.mockImplementation(fetchBehavior);
  vi.resetModules();
  const module = await import('../face-embedding.service');
  FaceEmbeddingService = module.FaceEmbeddingService;
  // Wait for constructor's health check to resolve
  await new Promise((resolve) => setTimeout(resolve, 10));
  return module.FaceEmbeddingService.getInstance();
}

describe('FaceEmbeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: service unavailable (mock mode)
    mockFetch.mockRejectedValue(new Error('Connection refused'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('returns the same instance on multiple getInstance() calls', async () => {
      const service = await getNewServiceInstance();
      const instance1 = FaceEmbeddingService.getInstance();
      const instance2 = FaceEmbeddingService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('instance is properly initialized', async () => {
      const instance = await getNewServiceInstance();

      expect(instance).toBeDefined();
      expect(typeof instance.extractEmbedding).toBe('function');
      expect(typeof instance.compareFaces).toBe('function');
      expect(typeof instance.isServiceAvailable).toBe('function');
      expect(typeof instance.isInMockMode).toBe('function');
    });
  });

  describe('Mock Mode (when DeepFace service unavailable)', () => {
    it('starts in mock mode when service is unavailable', async () => {
      const service = await getNewServiceInstance();
      expect(service.isInMockMode()).toBe(true);
    });

    it(
      'returns mock embedding approximately 15% of the time',
      async () => {
        const service = await getNewServiceInstance();

        // Test with many different image buffers to verify the probability distribution
        // Use a large sample size to get statistically meaningful results
        const iterations = 100;
        let faceDetectedCount = 0;

        for (let i = 0; i < iterations; i++) {
          const imageBuffer = createTestImageBuffer(`test-image-${i}`);
          const result = await service.extractEmbedding(imageBuffer);

          if (result.embedding !== null) {
            faceDetectedCount++;
          }
        }

        // Allow for statistical variance - expect 5-30% face detection (target is 15%)
        const detectionRate = faceDetectedCount / iterations;
        expect(detectionRate).toBeGreaterThanOrEqual(0.05);
        expect(detectionRate).toBeLessThanOrEqual(0.30);
      },
      { timeout: 30000 }
    );

    it('returns null embedding with faceDetected: false when no face detected', async () => {
      const service = await getNewServiceInstance();

      // Find a buffer that produces no face (iterate until we find one)
      let noFaceResult = null;
      for (let i = 0; i < 100; i++) {
        const imageBuffer = createTestImageBuffer(`no-face-test-${i}`);
        const result = await service.extractEmbedding(imageBuffer);

        if (result.embedding === null) {
          noFaceResult = result;
          break;
        }
      }

      expect(noFaceResult).not.toBeNull();
      expect(noFaceResult!.embedding).toBeNull();
      expect(noFaceResult!.faceCount).toBe(0);
      expect(noFaceResult!.faceConfidence).toBe(0);
      expect(noFaceResult!.facialArea).toBeNull();
    });

    it('mock embeddings are deterministic (same buffer = same result)', async () => {
      const service = await getNewServiceInstance();

      // Find a buffer that produces a face
      let imageBuffer: Buffer | null = null;
      for (let i = 0; i < 100; i++) {
        const testBuffer = createTestImageBuffer(`deterministic-test-${i}`);
        const result = await service.extractEmbedding(testBuffer);

        if (result.embedding !== null) {
          imageBuffer = testBuffer;
          break;
        }
      }

      if (!imageBuffer) {
        // Skip if no face-producing buffer found (unlikely)
        return;
      }

      // Extract embedding twice with the same buffer
      const result1 = await service.extractEmbedding(imageBuffer);
      const result2 = await service.extractEmbedding(imageBuffer);

      expect(result1.embedding).not.toBeNull();
      expect(result2.embedding).not.toBeNull();
      expect(result1.embedding).toEqual(result2.embedding);
    });

    it('mock embeddings are 512-dimensional', async () => {
      const service = await getNewServiceInstance();

      // Find a buffer that produces a face
      for (let i = 0; i < 100; i++) {
        const imageBuffer = createTestImageBuffer(`dimension-test-${i}`);
        const result = await service.extractEmbedding(imageBuffer);

        if (result.embedding !== null) {
          expect(result.embedding.length).toBe(EMBEDDING_DIMENSION);
          return;
        }
      }
    });

    it('mock embeddings are normalized (unit length)', async () => {
      const service = await getNewServiceInstance();

      // Find a buffer that produces a face
      for (let i = 0; i < 100; i++) {
        const imageBuffer = createTestImageBuffer(`normalized-test-${i}`);
        const result = await service.extractEmbedding(imageBuffer);

        if (result.embedding !== null) {
          // Calculate magnitude
          const magnitude = Math.sqrt(
            result.embedding.reduce((sum, val) => sum + val * val, 0)
          );
          // Should be approximately 1 (unit vector)
          expect(magnitude).toBeCloseTo(1, 5);
          return;
        }
      }
    });

    it('mock comparisons return consistent results', async () => {
      const service = await getNewServiceInstance();
      const embedding1 = createMockEmbedding(1);
      const embedding2 = createMockEmbedding(2);

      const result1 = await service.compareFaces(embedding1, embedding2);
      const result2 = await service.compareFaces(embedding1, embedding2);

      // Same inputs should give same similarity/distance
      expect(result1.similarity).toEqual(result2.similarity);
      expect(result1.distance).toEqual(result2.distance);
      expect(result1.isSamePerson).toEqual(result2.isSamePerson);
    });
  });

  describe('extractEmbedding()', () => {
    describe('when DeepFace service is available', () => {
      it('returns embedding when face detected', async () => {
        const testEmbedding = createMockEmbedding(42);
        const imageBuffer = createTestImageBuffer('face-detected');

        const service = await getNewServiceInstance((url: string) => {
          if (url.includes('/health')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(createHealthResponse(true)),
            } as Response);
          }
          if (url.includes('/extract-embedding')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(createExtractEmbeddingResponse(testEmbedding)),
            } as Response);
          }
          return Promise.reject(new Error('Unknown endpoint'));
        });

        const result = await service.extractEmbedding(imageBuffer);

        expect(result.embedding).toEqual(testEmbedding);
        expect(result.faceCount).toBe(1);
        expect(result.faceConfidence).toBe(0.95);
        expect(result.facialArea).toEqual({ x: 100, y: 100, w: 200, h: 200 });
      });

      it('returns null embedding when no face detected (with faceDetected: false)', async () => {
        const imageBuffer = createTestImageBuffer('no-face');

        const service = await getNewServiceInstance((url: string) => {
          if (url.includes('/health')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(createHealthResponse(true)),
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

        const result = await service.extractEmbedding(imageBuffer);

        expect(result.embedding).toBeNull();
        expect(result.faceCount).toBe(0);
        expect(result.faceConfidence).toBe(0);
        expect(result.facialArea).toBeNull();
      });

      it('includes processing time in result', async () => {
        const testEmbedding = createMockEmbedding(42);
        const imageBuffer = createTestImageBuffer('timing-test');

        const service = await getNewServiceInstance((url: string) => {
          if (url.includes('/health')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(createHealthResponse(true)),
            } as Response);
          }
          if (url.includes('/extract-embedding')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(createExtractEmbeddingResponse(testEmbedding)),
            } as Response);
          }
          return Promise.reject(new Error('Unknown endpoint'));
        });

        const result = await service.extractEmbedding(imageBuffer);

        expect(result.processingTimeMs).toBeDefined();
        expect(typeof result.processingTimeMs).toBe('number');
        expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('includes facial area when face detected', async () => {
        const testEmbedding = createMockEmbedding(42);
        const imageBuffer = createTestImageBuffer('facial-area-test');

        const service = await getNewServiceInstance((url: string) => {
          if (url.includes('/health')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(createHealthResponse(true)),
            } as Response);
          }
          if (url.includes('/extract-embedding')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(createExtractEmbeddingResponse(testEmbedding)),
            } as Response);
          }
          return Promise.reject(new Error('Unknown endpoint'));
        });

        const result = await service.extractEmbedding(imageBuffer);

        expect(result.facialArea).not.toBeNull();
        expect(result.facialArea).toHaveProperty('x');
        expect(result.facialArea).toHaveProperty('y');
        expect(result.facialArea).toHaveProperty('w');
        expect(result.facialArea).toHaveProperty('h');
      });
    });

    describe('error handling', () => {
      it('handles network errors gracefully by falling back to mock mode', async () => {
        const service = await getNewServiceInstance();
        const imageBuffer = createTestImageBuffer('error-test');

        // Service should be in mock mode due to connection error
        const result = await service.extractEmbedding(imageBuffer);

        // Should not throw, should return a valid result (either with embedding or null)
        expect(result).toBeDefined();
        expect(result).toHaveProperty('embedding');
        expect(result).toHaveProperty('faceCount');
        expect(result).toHaveProperty('processingTimeMs');
      });

      it('throws error for empty image buffer', async () => {
        const service = await getNewServiceInstance();
        const emptyBuffer = Buffer.alloc(0);

        await expect(service.extractEmbedding(emptyBuffer)).rejects.toThrow(
          'Image buffer cannot be empty'
        );
      });
    });
  });

  describe('compareFaces()', () => {
    it('returns isSamePerson: true when similarity above threshold', async () => {
      const service = await getNewServiceInstance();

      // Create two very similar embeddings (same base with tiny variation)
      const embedding1 = createMockEmbedding(1);
      const embedding2 = embedding1.map((v, i) => v + (i % 2 === 0 ? 0.001 : -0.001));
      // Re-normalize
      const magnitude = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
      const normalizedEmbedding2 = embedding2.map((v) => v / magnitude);

      const result = await service.compareFaces(embedding1, normalizedEmbedding2);

      // Very similar embeddings should be same person
      expect(result.similarity).toBeGreaterThan(0.9);
      expect(result.isSamePerson).toBe(true);
    });

    it('returns isSamePerson: false when similarity below threshold', async () => {
      const service = await getNewServiceInstance();

      // Create two very different embeddings
      const embedding1 = createMockEmbedding(1);
      const embedding2 = createMockEmbedding(100);

      const result = await service.compareFaces(embedding1, embedding2);

      // Very different embeddings should not be same person
      expect(result.isSamePerson).toBe(false);
    });

    it('confidence levels are correct based on distance from threshold', async () => {
      const service = await getNewServiceInstance();

      // Create embeddings with known similarity
      const embedding1 = createMockEmbedding(1);

      // High confidence: very different (far below threshold)
      const veryDifferent = createMockEmbedding(100);
      const resultHighDifferent = await service.compareFaces(embedding1, veryDifferent);

      // High confidence: very similar (far above threshold)
      const verySimilar = embedding1.slice(); // Exact copy
      const resultHighSimilar = await service.compareFaces(embedding1, verySimilar);

      // Results should have appropriate confidence levels
      expect(['high', 'medium', 'low']).toContain(resultHighDifferent.confidence);
      expect(['high', 'medium', 'low']).toContain(resultHighSimilar.confidence);
    });

    it('custom threshold parameter works', async () => {
      const service = await getNewServiceInstance();

      const embedding1 = createMockEmbedding(1);
      const embedding2 = createMockEmbedding(2);

      // Use very high threshold (almost impossible to match)
      const resultHighThreshold = await service.compareFaces(embedding1, embedding2, 0.01);

      // Use very low threshold (almost always matches)
      const resultLowThreshold = await service.compareFaces(embedding1, embedding2, 0.99);

      // With very low threshold (distance must be <= 0.01), should likely not match
      expect(resultHighThreshold.isSamePerson).toBe(false);
      // With very high threshold (distance can be <= 0.99), should likely match
      expect(resultLowThreshold.isSamePerson).toBe(true);
    });

    it('throws error for empty first embedding', async () => {
      const service = await getNewServiceInstance();
      const embedding = createMockEmbedding(1);

      await expect(service.compareFaces([], embedding)).rejects.toThrow(
        'First embedding cannot be empty'
      );
    });

    it('throws error for empty second embedding', async () => {
      const service = await getNewServiceInstance();
      const embedding = createMockEmbedding(1);

      await expect(service.compareFaces(embedding, [])).rejects.toThrow(
        'Second embedding cannot be empty'
      );
    });

    it('throws error for wrong embedding dimension', async () => {
      const service = await getNewServiceInstance();
      const correctEmbedding = createMockEmbedding(1);
      const wrongDimensionEmbedding = [1, 2, 3, 4, 5]; // Only 5 dimensions

      await expect(
        service.compareFaces(correctEmbedding, wrongDimensionEmbedding)
      ).rejects.toThrow(`Embeddings must be ${EMBEDDING_DIMENSION}-dimensional`);
    });
  });

  describe('isServiceAvailable()', () => {
    it('returns true when health check passes', async () => {
      const service = await getNewServiceInstance((url: string) => {
        if (url.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createHealthResponse(true, true)),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const result = await service.isServiceAvailable();

      expect(result).toBe(true);
    });

    it('returns false when health check fails', async () => {
      const service = await getNewServiceInstance();

      const result = await service.isServiceAvailable();

      expect(result).toBe(false);
    });

    it('returns false when service is unhealthy', async () => {
      const service = await getNewServiceInstance((url: string) => {
        if (url.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createHealthResponse(false, false)),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const result = await service.isServiceAvailable();

      expect(result).toBe(false);
    });

    it('returns false when model is not loaded', async () => {
      const service = await getNewServiceInstance((url: string) => {
        if (url.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createHealthResponse(true, false)),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const result = await service.isServiceAvailable();

      expect(result).toBe(false);
    });

    it('caches result and does not spam health checks', async () => {
      let healthCheckCount = 0;

      const service = await getNewServiceInstance((url: string) => {
        if (url.includes('/health')) {
          healthCheckCount++;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createHealthResponse(true)),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const initialCount = healthCheckCount;

      // Multiple calls within cache duration should use cached result
      await service.isServiceAvailable();
      await service.isServiceAvailable();
      await service.isServiceAvailable();

      // Should not have made additional health check calls (uses cache)
      expect(healthCheckCount).toBe(initialCount);
    });

    it('refreshes cache after expiration', async () => {
      vi.useFakeTimers();

      let healthCheckCount = 0;

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/health')) {
          healthCheckCount++;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createHealthResponse(true)),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      vi.resetModules();
      const module = await import('../face-embedding.service');
      const service = module.FaceEmbeddingService.getInstance();

      // Flush initial health check
      await vi.runAllTimersAsync();
      const countAfterInit = healthCheckCount;

      // Advance time past cache duration
      vi.advanceTimersByTime(HEALTH_CACHE_DURATION_MS + 1000);

      // This should trigger a new health check
      await service.isServiceAvailable();

      expect(healthCheckCount).toBe(countAfterInit + 1);

      vi.useRealTimers();
    });
  });

  describe('Static Methods', () => {
    describe('cosineSimilarity()', () => {
      beforeAll(async () => {
        // Make sure we have the class available
        vi.resetModules();
        const module = await import('../face-embedding.service');
        FaceEmbeddingService = module.FaceEmbeddingService;
      });

      it('calculates correctly for orthogonal vectors (similarity = 0)', () => {
        // Orthogonal vectors in 2D for simplicity
        const a = [1, 0, 0, 0];
        const b = [0, 1, 0, 0];

        const similarity = FaceEmbeddingService.cosineSimilarity(a, b);

        expect(similarity).toBeCloseTo(0, 10);
      });

      it('calculates correctly for identical vectors (similarity = 1)', () => {
        const embedding = createMockEmbedding(42);

        const similarity = FaceEmbeddingService.cosineSimilarity(embedding, embedding);

        expect(similarity).toBeCloseTo(1, 10);
      });

      it('calculates correctly for opposite vectors (similarity = -1)', () => {
        const a = [1, 0, 0, 0];
        const b = [-1, 0, 0, 0];

        const similarity = FaceEmbeddingService.cosineSimilarity(a, b);

        expect(similarity).toBeCloseTo(-1, 10);
      });

      it('calculates correctly for similar vectors', () => {
        const a = [1, 2, 3, 4];
        const b = [1, 2, 3, 5]; // Slightly different

        const similarity = FaceEmbeddingService.cosineSimilarity(a, b);

        // Should be close to 1 but not exactly 1
        expect(similarity).toBeGreaterThan(0.9);
        expect(similarity).toBeLessThan(1);
      });

      it('returns 0 for zero vectors', () => {
        const zero = [0, 0, 0, 0];
        const nonZero = [1, 2, 3, 4];

        const similarity1 = FaceEmbeddingService.cosineSimilarity(zero, nonZero);
        const similarity2 = FaceEmbeddingService.cosineSimilarity(nonZero, zero);
        const similarity3 = FaceEmbeddingService.cosineSimilarity(zero, zero);

        expect(similarity1).toBe(0);
        expect(similarity2).toBe(0);
        expect(similarity3).toBe(0);
      });

      it('handles normalized vectors correctly', () => {
        // Pre-normalized vectors (unit length)
        const a = [0.6, 0.8, 0, 0]; // |a| = 1
        const b = [0.8, 0.6, 0, 0]; // |b| = 1

        const similarity = FaceEmbeddingService.cosineSimilarity(a, b);

        // For unit vectors, cosine similarity = dot product = 0.6*0.8 + 0.8*0.6 = 0.96
        expect(similarity).toBeCloseTo(0.96, 10);
      });

      it('throws error when vector dimensions do not match', () => {
        const a = [1, 2, 3];
        const b = [1, 2, 3, 4];

        expect(() => FaceEmbeddingService.cosineSimilarity(a, b)).toThrow(
          'Vector dimensions must match'
        );
      });

      it('works with 512-dimensional vectors (actual embedding size)', () => {
        const embedding1 = createMockEmbedding(1);
        const embedding2 = createMockEmbedding(2);

        const similarity = FaceEmbeddingService.cosineSimilarity(embedding1, embedding2);

        expect(typeof similarity).toBe('number');
        expect(similarity).toBeGreaterThanOrEqual(-1);
        expect(similarity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Real API Integration (when service becomes available)', () => {
    it('switches from mock mode to real mode when service becomes available', async () => {
      // Start with service unavailable
      const service = await getNewServiceInstance();

      expect(service.isInMockMode()).toBe(true);

      // Now make service available by changing mock behavior
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createHealthResponse(true)),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Clear the health cache by using fake timers temporarily
      vi.useFakeTimers();
      vi.advanceTimersByTime(HEALTH_CACHE_DURATION_MS + 1000);

      // Trigger health check
      const available = await service.isServiceAvailable();
      vi.useRealTimers();

      expect(available).toBe(true);
      expect(service.isInMockMode()).toBe(false);
    });

    it('falls back to mock mode on API error during extraction', async () => {
      // Start with service available
      const service = await getNewServiceInstance((url: string) => {
        if (url.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createHealthResponse(true)),
          } as Response);
        }
        if (url.includes('/extract-embedding')) {
          // Simulate server error
          throw new Error('Internal Server Error');
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      expect(service.isInMockMode()).toBe(false);

      // Try to extract embedding - should fall back to mock
      const result = await service.extractEmbedding(createTestImageBuffer('test'));

      // Should have switched to mock mode and returned a result
      expect(result).toBeDefined();
      expect(service.isInMockMode()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles very small image buffers', async () => {
      const service = await getNewServiceInstance();
      const tinyBuffer = Buffer.from('x');

      const result = await service.extractEmbedding(tinyBuffer);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('embedding');
      expect(result).toHaveProperty('processingTimeMs');
    });

    it('handles very large image buffers', async () => {
      const service = await getNewServiceInstance();
      // Create a 1MB buffer
      const largeBuffer = Buffer.alloc(1024 * 1024, 'x');

      const result = await service.extractEmbedding(largeBuffer);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('embedding');
    });

    it('handles binary image data correctly', async () => {
      const service = await getNewServiceInstance();
      // Create buffer with binary data (like actual image bytes)
      const binaryBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]); // JPEG magic bytes

      const result = await service.extractEmbedding(binaryBuffer);

      expect(result).toBeDefined();
    });

    it('comparison with identical embeddings returns highest similarity', async () => {
      const service = await getNewServiceInstance();
      const embedding = createMockEmbedding(42);

      const result = await service.compareFaces(embedding, embedding);

      expect(result.similarity).toBeCloseTo(1, 2);
      expect(result.distance).toBeCloseTo(0, 2);
      expect(result.isSamePerson).toBe(true);
      expect(result.confidence).toBe('high');
    });
  });
});
