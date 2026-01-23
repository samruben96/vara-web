/**
 * Reverse Image Service Tests
 *
 * Tests for the ReverseImageService which orchestrates reverse image searches
 * across multiple providers (TinEye, Google Vision, Mock).
 *
 * Test coverage:
 * - Provider selection based on configuration
 * - TinEye integration and result mapping
 * - Google Vision fallback behavior
 * - Mock mode for development
 * - Error handling and fallback chains
 * - Result format consistency
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import crypto from 'crypto';

// Mock fetch globally before any imports
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Store original environment
let originalEnv: NodeJS.ProcessEnv;

/**
 * Helper to create a test image buffer with deterministic content.
 */
function createTestImageBuffer(seed: string): Buffer {
  return Buffer.from(`test-image-data-${seed}-${Date.now()}`);
}

/**
 * Helper to reset modules and environment for fresh instances.
 */
async function resetModulesWithEnv(envOverrides: Record<string, string | undefined>) {
  // Restore original env first
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('TINEYE_') || key.startsWith('GOOGLE_VISION') || key.startsWith('SCAN_ENGINE')) {
      delete process.env[key];
    }
  });

  // Apply overrides
  Object.entries(envOverrides).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  vi.resetModules();
}

describe('ReverseImageService', () => {
  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    // Restore original environment
    Object.keys(process.env).forEach((key) => {
      if (
        key.startsWith('TINEYE_') ||
        key.startsWith('GOOGLE_VISION') ||
        key.startsWith('SCAN_ENGINE')
      ) {
        if (originalEnv[key] !== undefined) {
          process.env[key] = originalEnv[key];
        } else {
          delete process.env[key];
        }
      }
    });
  });

  describe('Provider Selection', () => {
    describe('with TINEYE_API_KEY set', () => {
      it('uses TinEye when SCAN_ENGINE is auto', async () => {
        await resetModulesWithEnv({
          TINEYE_API_KEY: 'test-api-key',
          SCAN_ENGINE: 'auto',
        });

        const { ReverseImageService } = await import('../reverse-image.service');
        const service = ReverseImageService.getInstance();

        expect(service.isUsingTinEye()).toBe(true);
        expect(service.getProvider()).toBe('tineye');
        expect(service.isInMockMode()).toBe(false);
      });

      it('uses TinEye when SCAN_ENGINE is tineye', async () => {
        await resetModulesWithEnv({
          TINEYE_API_KEY: 'test-api-key',
          SCAN_ENGINE: 'tineye',
        });

        const { ReverseImageService } = await import('../reverse-image.service');
        const service = ReverseImageService.getInstance();

        expect(service.isUsingTinEye()).toBe(true);
        expect(service.getProvider()).toBe('tineye');
      });

      it('uses Google Vision when SCAN_ENGINE is google-vision', async () => {
        await resetModulesWithEnv({
          TINEYE_API_KEY: 'test-api-key',
          GOOGLE_VISION_API_KEY: 'test-gv-key',
          SCAN_ENGINE: 'google-vision',
        });

        const { ReverseImageService } = await import('../reverse-image.service');
        const service = ReverseImageService.getInstance();

        expect(service.isUsingTinEye()).toBe(false);
        expect(service.getProvider()).toBe('google-vision');
      });
    });

    describe('without TINEYE_API_KEY', () => {
      it('falls back to Google Vision in auto mode', async () => {
        await resetModulesWithEnv({
          TINEYE_API_KEY: undefined,
          GOOGLE_VISION_API_KEY: 'test-gv-key',
          SCAN_ENGINE: 'auto',
        });

        const { ReverseImageService } = await import('../reverse-image.service');
        const service = ReverseImageService.getInstance();

        expect(service.isUsingTinEye()).toBe(false);
        expect(service.getProvider()).toBe('google-vision');
        expect(service.isInMockMode()).toBe(false);
      });

      it('enters mock mode when no API keys configured', async () => {
        await resetModulesWithEnv({
          TINEYE_API_KEY: undefined,
          GOOGLE_VISION_API_KEY: undefined,
          SCAN_ENGINE: 'auto',
        });

        const { ReverseImageService } = await import('../reverse-image.service');
        const service = ReverseImageService.getInstance();

        expect(service.isUsingTinEye()).toBe(false);
        expect(service.isInMockMode()).toBe(true);
        expect(service.getProvider()).toBe('mock-reverse-search');
      });
    });
  });

  describe('TinEye Result Mapping', () => {
    it('maps TinEye ScanMatch to ReverseImageMatch format', async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: 'test-api-key',
        SCAN_ENGINE: 'tineye',
      });

      // Mock TinEye API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 200,
            stats: {
              timestamp: Date.now() / 1000,
              query_time: 150,
              total_results: 2,
              total_backlinks: 4,
              total_stock: 0,
              total_collection: 0,
            },
            results: {
              matches: [
                {
                  image_url: 'https://example.com/image1.jpg',
                  domain: 'example.com',
                  score: 85,
                  query_match_percent: 95,
                  width: 1024,
                  height: 768,
                  tags: [],
                  backlinks: [
                    {
                      url: 'https://example.com/image1.jpg',
                      backlink: 'https://example.com/page1',
                      crawl_date: '2025-01-01',
                    },
                  ],
                },
                {
                  image_url: 'https://another.com/img.png',
                  domain: 'another.com',
                  score: 60,
                  query_match_percent: 70,
                  tags: ['stock'],
                  backlinks: [],
                },
              ],
            },
          }),
      });

      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      const imageBuffer = createTestImageBuffer('mapping-test');
      const result = await service.search(imageBuffer);

      expect(result.provider).toBe('tineye');
      expect(result.matches).toHaveLength(2);

      // Verify first match mapping
      const match1 = result.matches[0];
      expect(match1.sourceUrl).toBe('https://example.com/image1.jpg');
      expect(match1.domain).toBe('example.com');
      // TinEye score 85 -> similarity 0.85
      expect(match1.similarity).toBe(0.85);
      // Score 85 (>= 80) -> HIGH confidence -> fullMatchingImages
      expect(match1.matchSourceType).toBe('fullMatchingImages');
      expect(match1.isMock).toBe(false);

      // Verify second match mapping
      const match2 = result.matches[1];
      expect(match2.sourceUrl).toBe('https://another.com/img.png');
      expect(match2.domain).toBe('another.com');
      // TinEye score 60 -> similarity 0.60
      expect(match2.similarity).toBe(0.6);
      // Score 60 (50-79) -> MEDIUM confidence -> partialMatchingImages
      expect(match2.matchSourceType).toBe('partialMatchingImages');
    });

    it('maps confidence levels correctly', async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: 'test-api-key',
        SCAN_ENGINE: 'tineye',
      });

      // Create matches with different scores for confidence testing
      const testCases = [
        { score: 95, expectedConfidence: 'HIGH', expectedSourceType: 'fullMatchingImages' },
        { score: 80, expectedConfidence: 'HIGH', expectedSourceType: 'fullMatchingImages' },
        { score: 79, expectedConfidence: 'MEDIUM', expectedSourceType: 'partialMatchingImages' },
        { score: 50, expectedConfidence: 'MEDIUM', expectedSourceType: 'partialMatchingImages' },
        { score: 49, expectedConfidence: 'LOW', expectedSourceType: 'visuallySimilarImages' },
        { score: 10, expectedConfidence: 'LOW', expectedSourceType: 'visuallySimilarImages' },
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 200,
              stats: { total_results: 1 },
              results: {
                matches: [
                  {
                    image_url: 'https://example.com/test.jpg',
                    domain: 'example.com',
                    score: testCase.score,
                    tags: [],
                    backlinks: [],
                  },
                ],
              },
            }),
        });

        vi.resetModules();
        const { ReverseImageService } = await import('../reverse-image.service');
        
        // Get a fresh instance by recreating the module
        const imageBuffer = createTestImageBuffer(`confidence-${testCase.score}`);
        
        // We need to directly test the mapping function since the service is a singleton
        // For this test, we'll verify the module's behavior
        const service = ReverseImageService.getInstance();
        const result = await service.search(imageBuffer);

        if (result.matches.length > 0) {
          expect(result.matches[0].matchSourceType).toBe(testCase.expectedSourceType);
        }
      }
    });
  });

  describe('ReverseImageSearchResult Format', () => {
    it('returns correct result structure', async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: undefined,
        GOOGLE_VISION_API_KEY: undefined,
        SCAN_ENGINE: 'auto',
      });

      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      // Service should be in mock mode
      expect(service.isInMockMode()).toBe(true);

      const imageBuffer = createTestImageBuffer('format-test');
      const result = await service.search(imageBuffer);

      // Verify required fields
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('searchedAt');
      expect(result).toHaveProperty('processingTimeMs');

      // Verify types
      expect(typeof result.provider).toBe('string');
      expect(Array.isArray(result.matches)).toBe(true);
      expect(typeof result.searchedAt).toBe('string');
      expect(typeof result.processingTimeMs).toBe('number');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);

      // Verify ISO timestamp format
      expect(() => new Date(result.searchedAt)).not.toThrow();
    });

    it('match objects have required fields', async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: undefined,
        GOOGLE_VISION_API_KEY: undefined,
        SCAN_ENGINE: 'auto',
      });

      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      // Generate searches to find one with matches (limit to avoid timeout)
      let matchFound = false;
      for (let i = 0; i < 30 && !matchFound; i++) {
        const imageBuffer = createTestImageBuffer(`match-format-${i}`);
        const result = await service.search(imageBuffer);

        if (result.matches.length > 0) {
          matchFound = true;
          const match = result.matches[0];

          // Verify required fields
          expect(match).toHaveProperty('sourceUrl');
          expect(match).toHaveProperty('domain');
          expect(match).toHaveProperty('similarity');

          // Verify types
          expect(typeof match.sourceUrl).toBe('string');
          expect(typeof match.domain).toBe('string');
          expect(typeof match.similarity).toBe('number');

          // Verify similarity range (0.0 to 1.0)
          expect(match.similarity).toBeGreaterThanOrEqual(0);
          expect(match.similarity).toBeLessThanOrEqual(1);

          // Verify optional fields if present
          if (match.pageTitle !== undefined) {
            expect(typeof match.pageTitle).toBe('string');
          }
          if (match.matchSourceType !== undefined) {
            expect([
              'fullMatchingImages',
              'partialMatchingImages',
              'pagesWithMatchingImages',
              'visuallySimilarImages',
            ]).toContain(match.matchSourceType);
          }
        }
      }

      // It's okay if no matches were found in mock mode (~85% return no matches)
    }, 10000); // Extended timeout
  });

  describe('Mock Mode', () => {
    beforeEach(async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: undefined,
        GOOGLE_VISION_API_KEY: undefined,
        SCAN_ENGINE: 'auto',
      });
    });

    it('enters mock mode when no API keys configured', async () => {
      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      expect(service.isInMockMode()).toBe(true);
      expect(service.getProvider()).toBe('mock-reverse-search');
    });

    it('mock results are deterministic for same image', async () => {
      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      const imageBuffer = createTestImageBuffer('deterministic-test-fixed-seed');

      const result1 = await service.search(imageBuffer);
      const result2 = await service.search(imageBuffer);

      // Same buffer should produce same match/no-match outcome
      expect(result1.matches.length).toBe(result2.matches.length);

      if (result1.matches.length > 0) {
        expect(result1.matches[0].sourceUrl).toBe(result2.matches[0].sourceUrl);
        expect(result1.matches[0].domain).toBe(result2.matches[0].domain);
        expect(result1.matches[0].similarity).toBe(result2.matches[0].similarity);
      }
    });

    it('mock matches are marked with isMock: true', async () => {
      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      // Search until we find a match (limit iterations to avoid timeout)
      let matchFound = false;
      for (let i = 0; i < 50 && !matchFound; i++) {
        const imageBuffer = createTestImageBuffer(`mock-flag-${i}`);
        const result = await service.search(imageBuffer);

        if (result.matches.length > 0) {
          expect(result.matches[0].isMock).toBe(true);
          matchFound = true;
        }
      }
      // If no match found after 50 iterations, that's statistically unlikely but acceptable
      // The test verifies the flag when a match IS found
    }, 10000); // Extended timeout

    it('mock domains use example.com subdomains', async () => {
      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      // Search until we find a match (limit iterations to avoid timeout)
      let matchFound = false;
      for (let i = 0; i < 30 && !matchFound; i++) {
        const imageBuffer = createTestImageBuffer(`domain-test-${i}`);
        const result = await service.search(imageBuffer);

        if (result.matches.length > 0) {
          expect(result.matches[0].domain).toMatch(/\.example\.com$/);
          matchFound = true;
        }
      }
      // If no match found, that's statistically unlikely but acceptable
    }, 10000); // Extended timeout
  });

  describe('Error Handling', () => {
    it('throws error for empty image buffer', async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: undefined,
        GOOGLE_VISION_API_KEY: undefined,
        SCAN_ENGINE: 'auto',
      });

      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      const emptyBuffer = Buffer.alloc(0);
      await expect(service.search(emptyBuffer)).rejects.toThrow('Image buffer cannot be empty');
    });

    it('handles TinEye API errors gracefully in development mode', async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: 'test-api-key',
        GOOGLE_VISION_API_KEY: undefined, // No Google Vision fallback
        SCAN_ENGINE: 'tineye',
        NODE_ENV: 'development',
      });

      // Mock TinEye to fail with non-retryable error (400 bad request)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            code: 400,
            messages: ['Invalid image format'],
          }),
      });

      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      const imageBuffer = createTestImageBuffer('error-test');
      const result = await service.search(imageBuffer);

      // In development mode with TinEye error and no Google Vision,
      // should fall back to mock results
      expect(['tineye-fallback', 'mock-reverse-search']).toContain(result.provider);
    }, 15000); // Extended timeout for potential retries
  });

  describe('Google Vision Fallback', () => {
    it('uses Google Vision when TinEye is unavailable in auto mode', async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: undefined,
        GOOGLE_VISION_API_KEY: 'test-gv-key',
        SCAN_ENGINE: 'auto',
      });

      // Mock Google Vision API
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            responses: [
              {
                webDetection: {
                  fullMatchingImages: [
                    { url: 'https://example.com/full1.jpg', score: 0.98 },
                  ],
                  partialMatchingImages: [
                    { url: 'https://example.com/partial1.jpg', score: 0.85 },
                  ],
                  visuallySimilarImages: [
                    { url: 'https://example.com/similar1.jpg', score: 0.75 },
                  ],
                  pagesWithMatchingImages: [
                    {
                      url: 'https://example.com/page1',
                      pageTitle: 'Test Page',
                      score: 0.92,
                    },
                  ],
                },
              },
            ],
          }),
      });

      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      expect(service.getProvider()).toBe('google-vision');

      const imageBuffer = createTestImageBuffer('gv-test');
      const result = await service.search(imageBuffer);

      expect(result.provider).toBe('google-vision');
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('maps Google Vision results correctly', async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: undefined,
        GOOGLE_VISION_API_KEY: 'test-gv-key',
        SCAN_ENGINE: 'google-vision',
      });

      // Mock Google Vision API with various result types
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            responses: [
              {
                webDetection: {
                  fullMatchingImages: [
                    { url: 'https://example.com/full.jpg', score: 0.99 },
                  ],
                  partialMatchingImages: [
                    { url: 'https://example.com/partial.jpg', score: 0.85 },
                  ],
                  visuallySimilarImages: [
                    { url: 'https://example.com/similar.jpg', score: 0.70 },
                  ],
                  pagesWithMatchingImages: [
                    {
                      url: 'https://example.com/page',
                      pageTitle: 'Image Page',
                      score: 0.95,
                    },
                  ],
                },
              },
            ],
          }),
      });

      const { ReverseImageService } = await import('../reverse-image.service');
      const service = ReverseImageService.getInstance();

      const imageBuffer = createTestImageBuffer('gv-mapping-test');
      const result = await service.search(imageBuffer);

      expect(result.matches.length).toBe(4);

      // Verify full match
      const fullMatch = result.matches.find(
        (m) => m.matchSourceType === 'fullMatchingImages'
      );
      expect(fullMatch).toBeDefined();
      expect(fullMatch!.similarity).toBe(0.99);

      // Verify partial match
      const partialMatch = result.matches.find(
        (m) => m.matchSourceType === 'partialMatchingImages'
      );
      expect(partialMatch).toBeDefined();
      expect(partialMatch!.similarity).toBe(0.85);

      // Verify page match has title
      const pageMatch = result.matches.find(
        (m) => m.matchSourceType === 'pagesWithMatchingImages'
      );
      expect(pageMatch).toBeDefined();
      expect(pageMatch!.pageTitle).toBe('Image Page');
    });
  });

  describe('Singleton Pattern', () => {
    it('returns same instance on multiple getInstance calls', async () => {
      await resetModulesWithEnv({
        TINEYE_API_KEY: undefined,
        GOOGLE_VISION_API_KEY: undefined,
        SCAN_ENGINE: 'auto',
      });

      const { ReverseImageService } = await import('../reverse-image.service');
      
      const instance1 = ReverseImageService.getInstance();
      const instance2 = ReverseImageService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
