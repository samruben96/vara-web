/**
 * SerpAPI Person Discovery Engine Unit Tests
 *
 * Comprehensive tests for the SerpAPI-based person discovery engine.
 * Tests cover initialization, URL-based discovery, response transformation,
 * deduplication logic, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { SerpApiPersonDiscoveryEngine } from '../serpapi.engine';
import type { SerpApiClient, GoogleLensResponse, BingReverseImageResponse } from '../serpapi.client';
import { SerpApiError } from '../serpapi.client';
import type { PersonDiscoveryCandidate, PersonDiscoveryResult } from '../interfaces';

// Mock the config module
vi.mock('@/config/person-discovery.config', () => ({
  getPersonDiscoveryConfig: vi.fn(() => ({
    engine: 'serpapi',
    maxCandidates: 20,
    providerOrder: ['google_lens', 'bing_reverse_image'],
  })),
  isPersonDiscoveryEnabled: vi.fn(() => true),
}));

// Suppress console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('SerpApiPersonDiscoveryEngine', () => {
  let engine: SerpApiPersonDiscoveryEngine;
  let mockClient: {
    searchGoogleLens: Mock;
    searchBingReverseImage: Mock;
    isAvailable: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      searchGoogleLens: vi.fn(),
      searchBingReverseImage: vi.fn(),
      isAvailable: vi.fn(),
    };

    engine = new SerpApiPersonDiscoveryEngine(mockClient as unknown as SerpApiClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================
  // Engine Initialization Tests
  // ===========================================
  describe('Engine Initialization', () => {
    it('has engine name "serpapi"', () => {
      expect(engine.name).toBe('serpapi');
    });

    it('delegates isAvailable to client', async () => {
      mockClient.isAvailable.mockResolvedValue(true);

      const result = await engine.isAvailable();

      expect(result).toBe(true);
      expect(mockClient.isAvailable).toHaveBeenCalledTimes(1);
    });

    it('returns false when client isAvailable throws', async () => {
      mockClient.isAvailable.mockRejectedValue(new Error('Connection failed'));

      const result = await engine.isAvailable();

      expect(result).toBe(false);
    });

    it('accepts custom config options', () => {
      const customEngine = new SerpApiPersonDiscoveryEngine(
        mockClient as unknown as SerpApiClient,
        { maxCandidates: 10, providers: ['bing_reverse_image'] }
      );

      expect(customEngine.name).toBe('serpapi');
    });
  });

  // ===========================================
  // URL Validation Tests
  // ===========================================
  describe('URL Validation', () => {
    it('validates image URL and rejects invalid URLs', async () => {
      await expect(engine.discoverByImageUrl('not-a-url')).rejects.toThrow(SerpApiError);
    });

    it('rejects URLs with invalid protocol', async () => {
      await expect(engine.discoverByImageUrl('ftp://example.com/image.jpg')).rejects.toThrow(
        'Invalid URL protocol'
      );
    });

    it('accepts valid HTTP URLs', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({ visual_matches: [] });

      await expect(
        engine.discoverByImageUrl('http://example.com/image.jpg')
      ).resolves.not.toThrow();
    });

    it('accepts valid HTTPS URLs', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({ visual_matches: [] });

      await expect(
        engine.discoverByImageUrl('https://example.com/image.jpg')
      ).resolves.not.toThrow();
    });

    it('throws SerpApiError with SERPAPI_INVALID_REQUEST code for malformed URLs', async () => {
      try {
        await engine.discoverByImageUrl(':::invalid:::');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerpApiError);
        expect((error as SerpApiError).code).toBe('SERPAPI_INVALID_REQUEST');
      }
    });
  });

  // ===========================================
  // Provider Order Tests
  // ===========================================
  describe('Provider Order', () => {
    it('tries google_lens first by default', async () => {
      // Return enough results to reach maxCandidates so engine doesn't try Bing
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: Array.from({ length: 25 }, (_, i) => ({
          position: i + 1,
          title: `Test ${i + 1}`,
          link: `https://example${i}.com`,
          source: `example${i}.com`,
          thumbnail: '',
        })),
      } as GoogleLensResponse);

      await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(mockClient.searchGoogleLens).toHaveBeenCalledTimes(1);
      // Bing should not be called because Google Lens returned enough results
      expect(mockClient.searchBingReverseImage).not.toHaveBeenCalled();
    });

    it('falls back to bing when google_lens fails', async () => {
      mockClient.searchGoogleLens.mockRejectedValue(new Error('Google Lens failed'));
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        images_results: [
          { position: 1, title: 'Bing Test', link: 'https://bing.com', thumbnail: '' },
        ],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(mockClient.searchGoogleLens).toHaveBeenCalledTimes(1);
      expect(mockClient.searchBingReverseImage).toHaveBeenCalledTimes(1);
      expect(result.providersUsed).toContain('bing_reverse_image');
      expect(result.providersUsed).not.toContain('google_lens');
    });

    it('respects custom provider order', async () => {
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '789', status: 'Success' },
        images_results: [
          { position: 1, title: 'Bing First', link: 'https://bing.com', thumbnail: '' },
        ],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg', {
        providers: ['bing_reverse_image'],
      });

      expect(mockClient.searchBingReverseImage).toHaveBeenCalledTimes(1);
      expect(mockClient.searchGoogleLens).not.toHaveBeenCalled();
      expect(result.providersUsed).toEqual(['bing_reverse_image']);
    });

    it('tries multiple providers when first returns no results', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [],
      } as GoogleLensResponse);
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        images_results: [
          { position: 1, title: 'Found on Bing', link: 'https://bing.com', thumbnail: '' },
        ],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(mockClient.searchGoogleLens).toHaveBeenCalledTimes(1);
      expect(mockClient.searchBingReverseImage).toHaveBeenCalledTimes(1);
      // Only bing_reverse_image returned results
      expect(result.providersUsed).toEqual(['bing_reverse_image']);
    });
  });

  // ===========================================
  // Response Transformation Tests
  // ===========================================
  describe('Response Transformation', () => {
    describe('Google Lens Results', () => {
      it('transforms Google Lens visual matches correctly', async () => {
        mockClient.searchGoogleLens.mockResolvedValue({
          search_metadata: { id: '123', status: 'Success' },
          visual_matches: [
            {
              position: 1,
              title: 'Celebrity Photo',
              link: 'https://celebrity.com/gallery',
              source: 'celebrity.com',
              thumbnail: 'https://thumbnail.com/1.jpg',
              original: 'https://cdn.celebrity.com/photo.jpg',
              size: { width: 800, height: 600 },
            },
          ],
        } as GoogleLensResponse);

        const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

        expect(result.candidates).toHaveLength(1);
        const candidate = result.candidates[0];
        expect(candidate.candidateImageUrl).toBe('https://cdn.celebrity.com/photo.jpg');
        expect(candidate.sourcePageUrl).toBe('https://celebrity.com/gallery');
        expect(candidate.title).toBe('Celebrity Photo');
        expect(candidate.engine).toBe('google_lens');
        expect(candidate.rank).toBe(1);
        expect(candidate.thumbnailUrl).toBe('https://thumbnail.com/1.jpg');
        expect(candidate.dimensions).toEqual({ width: 800, height: 600 });
      });

      it('handles null values for optional Google Lens fields', async () => {
        mockClient.searchGoogleLens.mockResolvedValue({
          search_metadata: { id: '123', status: 'Success' },
          visual_matches: [
            {
              position: 1,
              title: 'Minimal Match',
              link: 'https://example.com/page',
              source: 'example.com',
              thumbnail: '',
              // No original, no size
            },
          ],
        } as GoogleLensResponse);

        const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

        const candidate = result.candidates[0];
        expect(candidate.candidateImageUrl).toBeNull();
        expect(candidate.dimensions).toBeNull();
        expect(candidate.snippet).toBeNull();
      });

      it('uses fallback rank when position is missing', async () => {
        mockClient.searchGoogleLens.mockResolvedValue({
          search_metadata: { id: '123', status: 'Success' },
          visual_matches: [
            {
              position: 0, // falsy position
              title: 'No Position',
              link: 'https://example.com/page',
              source: 'example.com',
              thumbnail: '',
            },
          ],
        } as GoogleLensResponse);

        const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

        // Should use index-based rank (1) when position is falsy
        expect(result.candidates[0].rank).toBe(1);
      });
    });

    describe('Bing Results', () => {
      it('transforms Bing reverse image results correctly', async () => {
        mockClient.searchGoogleLens.mockRejectedValue(new Error('Skipped'));
        mockClient.searchBingReverseImage.mockResolvedValue({
          search_metadata: { id: '456', status: 'Success' },
          images_results: [
            {
              position: 1,
              title: 'Bing Image Result',
              link: 'https://bing-result.com/image',
              thumbnail: 'https://bing-thumb.com/1.jpg',
              original: 'https://original.com/image.jpg',
              width: 1920,
              height: 1080,
            },
          ],
        } as BingReverseImageResponse);

        const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

        expect(result.candidates).toHaveLength(1);
        const candidate = result.candidates[0];
        expect(candidate.candidateImageUrl).toBe('https://original.com/image.jpg');
        expect(candidate.sourcePageUrl).toBe('https://bing-result.com/image');
        expect(candidate.title).toBe('Bing Image Result');
        expect(candidate.engine).toBe('bing_reverse_image');
        expect(candidate.rank).toBe(1);
        expect(candidate.thumbnailUrl).toBe('https://bing-thumb.com/1.jpg');
        expect(candidate.dimensions).toEqual({ width: 1920, height: 1080 });
      });

      it('falls back to cdn_original when original is missing', async () => {
        mockClient.searchGoogleLens.mockRejectedValue(new Error('Skipped'));
        mockClient.searchBingReverseImage.mockResolvedValue({
          search_metadata: { id: '456', status: 'Success' },
          images_results: [
            {
              position: 1,
              title: 'CDN Fallback',
              link: 'https://bing-result.com/image',
              thumbnail: 'https://bing-thumb.com/1.jpg',
              cdn_original: 'https://cdn.bing.com/original.jpg',
              // No 'original' field
            },
          ],
        } as BingReverseImageResponse);

        const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

        expect(result.candidates[0].candidateImageUrl).toBe('https://cdn.bing.com/original.jpg');
      });

      it('combines images_results and related_content from Bing', async () => {
        mockClient.searchGoogleLens.mockRejectedValue(new Error('Skipped'));
        mockClient.searchBingReverseImage.mockResolvedValue({
          search_metadata: { id: '456', status: 'Success' },
          images_results: [
            { position: 1, title: 'Image Result', link: 'https://img.com', thumbnail: '' },
          ],
          related_content: [
            { position: 2, title: 'Related Content', link: 'https://related.com', thumbnail: '' },
          ],
        } as BingReverseImageResponse);

        const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

        expect(result.candidates).toHaveLength(2);
        expect(result.candidates[0].title).toBe('Image Result');
        expect(result.candidates[1].title).toBe('Related Content');
      });

      it('handles missing dimensions in Bing results', async () => {
        mockClient.searchGoogleLens.mockRejectedValue(new Error('Skipped'));
        mockClient.searchBingReverseImage.mockResolvedValue({
          search_metadata: { id: '456', status: 'Success' },
          images_results: [
            {
              position: 1,
              title: 'No Dimensions',
              link: 'https://nodim.com/image',
              thumbnail: '',
              // No width/height
            },
          ],
        } as BingReverseImageResponse);

        const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

        expect(result.candidates[0].dimensions).toBeNull();
      });
    });
  });

  // ===========================================
  // Deduplication Logic Tests
  // ===========================================
  describe('Deduplication Logic', () => {
    it('removes duplicates by sourcePageUrl', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [
          { position: 1, title: 'Test 1', link: 'https://example.com/same', source: 'example.com', thumbnail: '' },
          { position: 2, title: 'Test 2', link: 'https://example.com/same', source: 'example.com', thumbnail: '' }, // duplicate
          { position: 3, title: 'Test 3', link: 'https://example.com/different', source: 'example.com', thumbnail: '' },
        ],
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates.length).toBe(2);
      const urls = result.candidates.map(c => c.sourcePageUrl);
      expect(urls).toContain('https://example.com/same');
      expect(urls).toContain('https://example.com/different');
    });

    it('prefers candidate with candidateImageUrl when deduplicating', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [
          { position: 1, title: 'No Image URL', link: 'https://example.com/page', source: 'example.com', thumbnail: '' },
          { position: 2, title: 'Has Image URL', link: 'https://example.com/page', source: 'example.com', thumbnail: '', original: 'https://cdn.example.com/image.jpg' },
        ],
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].candidateImageUrl).toBe('https://cdn.example.com/image.jpg');
      expect(result.candidates[0].title).toBe('Has Image URL');
    });

    it('keeps lower rank (higher priority) on tie when both have or lack image URL', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [
          { position: 5, title: 'Higher Rank (Lower Priority)', link: 'https://example.com/page', source: 'example.com', thumbnail: '', original: 'https://cdn.com/5.jpg' },
          { position: 2, title: 'Lower Rank (Higher Priority)', link: 'https://example.com/page', source: 'example.com', thumbnail: '', original: 'https://cdn.com/2.jpg' },
        ],
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates.length).toBe(1);
      // Should keep the one with lower rank (position 2)
      expect(result.candidates[0].rank).toBe(2);
      expect(result.candidates[0].candidateImageUrl).toBe('https://cdn.com/2.jpg');
    });

    it('prefers candidate with image URL over lower rank without image URL', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [
          { position: 1, title: 'Rank 1 No Image', link: 'https://example.com/page', source: 'example.com', thumbnail: '' },
          { position: 10, title: 'Rank 10 With Image', link: 'https://example.com/page', source: 'example.com', thumbnail: '', original: 'https://cdn.com/image.jpg' },
        ],
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates.length).toBe(1);
      // Should prefer the one with candidateImageUrl even though it has higher rank
      expect(result.candidates[0].candidateImageUrl).toBe('https://cdn.com/image.jpg');
      expect(result.candidates[0].rank).toBe(10);
    });

    it('sorts deduplicated results by rank', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [
          { position: 3, title: 'Third', link: 'https://third.com', source: 'third.com', thumbnail: '' },
          { position: 1, title: 'First', link: 'https://first.com', source: 'first.com', thumbnail: '' },
          { position: 2, title: 'Second', link: 'https://second.com', source: 'second.com', thumbnail: '' },
        ],
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates[0].rank).toBe(1);
      expect(result.candidates[1].rank).toBe(2);
      expect(result.candidates[2].rank).toBe(3);
    });
  });

  // ===========================================
  // MaxCandidates and Truncation Tests
  // ===========================================
  describe('MaxCandidates and Truncation', () => {
    it('respects maxCandidates option', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: Array.from({ length: 10 }, (_, i) => ({
          position: i + 1,
          title: `Result ${i + 1}`,
          link: `https://example${i}.com/page`,
          source: `example${i}.com`,
          thumbnail: '',
        })),
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg', {
        maxCandidates: 3,
      });

      expect(result.candidates.length).toBe(3);
      expect(result.truncated).toBe(true);
    });

    it('sets truncated flag when results exceed max', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: Array.from({ length: 5 }, (_, i) => ({
          position: i + 1,
          title: `Result ${i + 1}`,
          link: `https://example${i}.com/page`,
          source: `example${i}.com`,
          thumbnail: '',
        })),
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg', {
        maxCandidates: 3,
      });

      expect(result.truncated).toBe(true);
      expect(result.totalFound).toBe(5);
    });

    it('does not set truncated flag when results are within limit', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [
          { position: 1, title: 'Result 1', link: 'https://example.com/1', source: 'example.com', thumbnail: '' },
          { position: 2, title: 'Result 2', link: 'https://example.com/2', source: 'example.com', thumbnail: '' },
        ],
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg', {
        maxCandidates: 10,
      });

      expect(result.truncated).toBe(false);
      expect(result.candidates.length).toBe(2);
    });

    it('stops searching providers when maxCandidates is reached', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: Array.from({ length: 10 }, (_, i) => ({
          position: i + 1,
          title: `Google Result ${i + 1}`,
          link: `https://google-result${i}.com/page`,
          source: `google-result${i}.com`,
          thumbnail: '',
        })),
      } as GoogleLensResponse);
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        images_results: [
          { position: 1, title: 'Bing Result', link: 'https://bing.com', thumbnail: '' },
        ],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg', {
        maxCandidates: 5,
      });

      expect(result.candidates.length).toBe(5);
      // Should not have called Bing since Google already provided enough
      expect(mockClient.searchBingReverseImage).not.toHaveBeenCalled();
    });
  });

  // ===========================================
  // Timing Tracking Tests
  // ===========================================
  describe('Timing Tracking', () => {
    it('tracks duration in milliseconds', async () => {
      mockClient.searchGoogleLens.mockImplementation(async () => {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          search_metadata: { id: '123', status: 'Success' },
          visual_matches: [],
        } as GoogleLensResponse;
      });

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });

    it('includes durationMs in result even with no candidates', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [],
      } as GoogleLensResponse);
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        images_results: [],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.durationMs).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================
  // Error Handling Tests
  // ===========================================
  describe('Error Handling', () => {
    it('returns empty candidates when all providers fail', async () => {
      mockClient.searchGoogleLens.mockRejectedValue(new Error('Google failed'));
      mockClient.searchBingReverseImage.mockRejectedValue(new Error('Bing failed'));

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates).toEqual([]);
      expect(result.providersUsed).toEqual([]);
      expect(result.totalFound).toBe(0);
    });

    it('returns partial results when some providers fail', async () => {
      mockClient.searchGoogleLens.mockRejectedValue(new Error('Google failed'));
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        images_results: [
          { position: 1, title: 'Bing Success', link: 'https://bing.com/result', thumbnail: '' },
        ],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].title).toBe('Bing Success');
      expect(result.providersUsed).toEqual(['bing_reverse_image']);
    });

    it('handles Google Lens returning no visual_matches gracefully', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        // No visual_matches field
      } as GoogleLensResponse);
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        images_results: [],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates).toEqual([]);
      expect(result.providersUsed).toEqual([]);
    });

    it('handles Bing returning no results gracefully', async () => {
      mockClient.searchGoogleLens.mockRejectedValue(new Error('Skipped'));
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        // No images_results or related_content
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates).toEqual([]);
      expect(result.providersUsed).toEqual([]);
    });

    it('continues to next provider after error without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      mockClient.searchGoogleLens.mockRejectedValue(new SerpApiError('SERPAPI_RATE_LIMITED', 'Rate limited'));
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        images_results: [
          { position: 1, title: 'Fallback Result', link: 'https://bing.com', thumbnail: '' },
        ],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates.length).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ===========================================
  // Result Properties Tests
  // ===========================================
  describe('Result Properties', () => {
    it('sets cacheHit to false (SerpAPI does not provide cache info)', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [],
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.cacheHit).toBe(false);
    });

    it('correctly reports totalFound before deduplication', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [
          { position: 1, title: 'R1', link: 'https://a.com', source: 'a.com', thumbnail: '' },
          { position: 2, title: 'R2', link: 'https://b.com', source: 'b.com', thumbnail: '' },
          { position: 3, title: 'R3', link: 'https://c.com', source: 'c.com', thumbnail: '' },
        ],
      } as GoogleLensResponse);
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        images_results: [
          { position: 1, title: 'B1', link: 'https://d.com', thumbnail: '' },
          { position: 2, title: 'B2', link: 'https://e.com', thumbnail: '' },
        ],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      // totalFound is the sum of all results from all providers (before dedup)
      expect(result.totalFound).toBe(5);
    });

    it('only includes providers that returned results in providersUsed', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [], // No results
      } as GoogleLensResponse);
      mockClient.searchBingReverseImage.mockResolvedValue({
        search_metadata: { id: '456', status: 'Success' },
        images_results: [
          { position: 1, title: 'Only Bing', link: 'https://bing.com', thumbnail: '' },
        ],
      } as BingReverseImageResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.providersUsed).toEqual(['bing_reverse_image']);
      expect(result.providersUsed).not.toContain('google_lens');
    });
  });

  // ===========================================
  // Edge Cases Tests
  // ===========================================
  describe('Edge Cases', () => {
    it('handles unknown provider gracefully', async () => {
      // Create engine with invalid provider (should be ignored)
      const customEngine = new SerpApiPersonDiscoveryEngine(
        mockClient as unknown as SerpApiClient,
        { providers: ['unknown_provider' as any, 'google_lens'] }
      );

      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [
          { position: 1, title: 'Test', link: 'https://test.com', source: 'test.com', thumbnail: '' },
        ],
      } as GoogleLensResponse);

      const result = await customEngine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates.length).toBe(1);
      expect(result.providersUsed).toEqual(['google_lens']);
    });

    it('handles very long URLs', async () => {
      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [],
      } as GoogleLensResponse);

      const longUrl = `https://example.com/image.jpg?${'x'.repeat(200)}`;

      await expect(engine.discoverByImageUrl(longUrl)).resolves.not.toThrow();
    });

    it('includes raw response in candidate for debugging', async () => {
      const rawMatch = {
        position: 1,
        title: 'Test',
        link: 'https://test.com',
        source: 'test.com',
        thumbnail: 'https://thumb.com/1.jpg',
        original: 'https://original.com/1.jpg',
        source_icon: 'https://icon.com/favicon.ico',
      };

      mockClient.searchGoogleLens.mockResolvedValue({
        search_metadata: { id: '123', status: 'Success' },
        visual_matches: [rawMatch],
      } as GoogleLensResponse);

      const result = await engine.discoverByImageUrl('https://example.com/image.jpg');

      expect(result.candidates[0].raw).toEqual(rawMatch);
    });
  });
});
