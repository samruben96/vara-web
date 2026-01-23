/**
 * TinEye Engine Unit Tests
 *
 * Comprehensive tests for the TinEye reverse image search engine.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { TinEyeEngine, getTinEyeEngine } from '../engines/tineye.engine';
import { scoreToConfidence } from '../interfaces/scan-result.types';
import { mergeWithDefaults, TINEYE_DEFAULTS } from '../interfaces/scan-options.types';
import {
  TinEyeError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  NotConfiguredError,
} from '../errors/scan.errors';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock console.log to suppress retry messages during tests
vi.spyOn(console, 'log').mockImplementation(() => {});

// Store original env
const originalEnv = { ...process.env };

describe('TinEyeEngine', () => {
  let engine: TinEyeEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Set up API key for most tests
    process.env.TINEYE_API_KEY = 'test-api-key-12345';
    engine = new TinEyeEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  // ===========================================
  // Configuration Tests
  // ===========================================
  describe('Configuration', () => {
    it('isConfigured() returns true when API key is set', () => {
      process.env.TINEYE_API_KEY = 'valid-api-key';
      const configuredEngine = new TinEyeEngine();
      expect(configuredEngine.isConfigured()).toBe(true);
    });

    it('isConfigured() returns false when API key is missing', () => {
      delete process.env.TINEYE_API_KEY;
      const unconfiguredEngine = new TinEyeEngine();
      expect(unconfiguredEngine.isConfigured()).toBe(false);
    });

    it('isConfigured() returns false when API key is empty string', () => {
      process.env.TINEYE_API_KEY = '';
      const unconfiguredEngine = new TinEyeEngine();
      expect(unconfiguredEngine.isConfigured()).toBe(false);
    });

    it('throws NotConfiguredError when calling searchByUrl without API key', async () => {
      delete process.env.TINEYE_API_KEY;
      const unconfiguredEngine = new TinEyeEngine();

      await expect(
        unconfiguredEngine.searchByUrl('https://example.com/image.jpg')
      ).rejects.toThrow(NotConfiguredError);
    });

    it('throws NotConfiguredError when calling searchByUpload without API key', async () => {
      delete process.env.TINEYE_API_KEY;
      const unconfiguredEngine = new TinEyeEngine();

      await expect(
        unconfiguredEngine.searchByUpload(Buffer.from('test'), 'test.jpg')
      ).rejects.toThrow(NotConfiguredError);
    });

    it('throws NotConfiguredError when calling getQuota without API key', async () => {
      delete process.env.TINEYE_API_KEY;
      const unconfiguredEngine = new TinEyeEngine();

      await expect(unconfiguredEngine.getQuota()).rejects.toThrow(NotConfiguredError);
    });

    it('has correct provider and displayName', () => {
      expect(engine.provider).toBe('tineye');
      expect(engine.displayName).toBe('TinEye');
    });
  });

  // ===========================================
  // Request Construction Tests
  // ===========================================
  describe('Request Construction', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          stats: { timestamp: 1234567890, query_time: 100 },
          results: { matches: [] },
        }),
      });
    });

    describe('searchByUrl', () => {
      it('builds correct GET URL with query params', async () => {
        await engine.searchByUrl('https://example.com/image.jpg');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('https://api.tineye.com/rest/search/');
        expect(url).toContain('image_url=https%3A%2F%2Fexample.com%2Fimage.jpg');
      });

      it('includes default query parameters', async () => {
        await engine.searchByUrl('https://example.com/image.jpg');

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain(`limit=${TINEYE_DEFAULTS.LIMIT}`);
        expect(url).toContain(`offset=${TINEYE_DEFAULTS.OFFSET}`);
        expect(url).toContain(`backlink_limit=${TINEYE_DEFAULTS.BACKLINK_LIMIT}`);
        expect(url).toContain(`sort=${TINEYE_DEFAULTS.SORT}`);
        expect(url).toContain(`order=${TINEYE_DEFAULTS.ORDER}`);
      });

      it('applies custom options to query params', async () => {
        await engine.searchByUrl('https://example.com/image.jpg', {
          limit: 100,
          offset: 20,
          backlinkLimit: 5,
          sort: 'size',
          order: 'asc',
        });

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('limit=100');
        expect(url).toContain('offset=20');
        expect(url).toContain('backlink_limit=5');
        expect(url).toContain('sort=size');
        expect(url).toContain('order=asc');
      });

      it('includes domain filter when specified', async () => {
        await engine.searchByUrl('https://example.com/image.jpg', {
          domain: 'twitter.com',
        });

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('domain=twitter.com');
      });

      it('includes tags filter when specified', async () => {
        await engine.searchByUrl('https://example.com/image.jpg', {
          tags: ['stock', 'collection'],
        });

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('tags=stock%2Ccollection');
      });

      it('uses GET method for URL search', async () => {
        await engine.searchByUrl('https://example.com/image.jpg');

        const [, options] = mockFetch.mock.calls[0];
        expect(options.method).toBe('GET');
        expect(options.body).toBeUndefined();
      });

      it('includes X-API-KEY header', async () => {
        await engine.searchByUrl('https://example.com/image.jpg');

        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers['X-API-KEY']).toBe('test-api-key-12345');
      });

      it('includes Accept header', async () => {
        await engine.searchByUrl('https://example.com/image.jpg');

        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers['Accept']).toBe('application/json');
      });
    });

    describe('searchByUpload', () => {
      it('builds correct POST request with FormData', async () => {
        const imageBuffer = Buffer.from('fake-image-data');
        await engine.searchByUpload(imageBuffer, 'test.jpg');

        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toContain('https://api.tineye.com/rest/search/');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
      });

      it('includes query parameters in URL for upload', async () => {
        await engine.searchByUpload(Buffer.from('data'), 'test.jpg', {
          limit: 25,
          sort: 'crawl_date',
        });

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('limit=25');
        expect(url).toContain('sort=crawl_date');
      });

      it('sets correct MIME type for JPEG images', async () => {
        await engine.searchByUpload(Buffer.from('data'), 'photo.jpeg');

        const [, options] = mockFetch.mock.calls[0];
        const formData = options.body as FormData;
        const blob = formData.get('image_upload') as Blob;
        expect(blob.type).toBe('image/jpeg');
      });

      it('sets correct MIME type for PNG images', async () => {
        await engine.searchByUpload(Buffer.from('data'), 'photo.png');

        const [, options] = mockFetch.mock.calls[0];
        const formData = options.body as FormData;
        const blob = formData.get('image_upload') as Blob;
        expect(blob.type).toBe('image/png');
      });

      it('sets correct MIME type for WebP images', async () => {
        await engine.searchByUpload(Buffer.from('data'), 'photo.webp');

        const [, options] = mockFetch.mock.calls[0];
        const formData = options.body as FormData;
        const blob = formData.get('image_upload') as Blob;
        expect(blob.type).toBe('image/webp');
      });

      it('sets fallback MIME type for unknown extensions', async () => {
        await engine.searchByUpload(Buffer.from('data'), 'photo.xyz');

        const [, options] = mockFetch.mock.calls[0];
        const formData = options.body as FormData;
        const blob = formData.get('image_upload') as Blob;
        expect(blob.type).toBe('application/octet-stream');
      });

      it('includes X-API-KEY header for uploads', async () => {
        await engine.searchByUpload(Buffer.from('data'), 'test.jpg');

        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers['X-API-KEY']).toBe('test-api-key-12345');
      });
    });
  });

  // ===========================================
  // Response Mapping Tests
  // ===========================================
  describe('Response Mapping', () => {
    it('maps TinEye response to ScanResult correctly', async () => {
      const tineyeResponse = {
        code: 200,
        messages: ['Search successful'],
        stats: {
          timestamp: 1705000000,
          query_time: 250,
          total_results: 5,
          total_backlinks: 12,
          total_stock: 2,
          total_collection: 1,
        },
        results: {
          matches: [
            {
              image_url: 'https://match.com/image.jpg',
              domain: 'match.com',
              score: 95,
              query_match_percent: 100,
              format: 'JPEG',
              filesize: 50000,
              width: 800,
              height: 600,
              size: 480000,
              tags: ['stock'],
              backlinks: [
                {
                  url: 'https://match.com/img/photo.jpg',
                  backlink: 'https://match.com/gallery',
                  crawl_date: '2024-01-15',
                },
              ],
            },
          ],
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => tineyeResponse,
      });

      const result = await engine.searchByUrl('https://example.com/image.jpg');

      expect(result.provider).toBe('tineye');
      expect(result.success).toBe(true);
      expect(result.searchedAt).toBeDefined();
      expect(result.warnings).toEqual(['Search successful']);

      // Check stats mapping
      expect(result.stats.timestamp).toBe(1705000000);
      expect(result.stats.queryTimeMs).toBe(250);
      expect(result.stats.totalResults).toBe(5);
      expect(result.stats.totalBacklinks).toBe(12);
      expect(result.stats.totalStock).toBe(2);
      expect(result.stats.totalCollection).toBe(1);

      // Check match mapping
      expect(result.matches).toHaveLength(1);
      const match = result.matches[0];
      expect(match.imageUrl).toBe('https://match.com/image.jpg');
      expect(match.domain).toBe('match.com');
      expect(match.score).toBe(95);
      expect(match.confidence).toBe('HIGH');
      expect(match.queryMatchPercent).toBe(100);
      expect(match.format).toBe('JPEG');
      expect(match.filesize).toBe(50000);
      expect(match.width).toBe(800);
      expect(match.height).toBe(600);
      expect(match.size).toBe(480000);
      expect(match.tags).toEqual(['stock']);

      // Check backlink mapping
      expect(match.backlinks).toHaveLength(1);
      expect(match.backlinks[0].imageUrl).toBe('https://match.com/img/photo.jpg');
      expect(match.backlinks[0].pageUrl).toBe('https://match.com/gallery');
      expect(match.backlinks[0].crawlDate).toBe('2024-01-15');
    });

    it('handles empty results array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          stats: { timestamp: 1705000000 },
          results: { matches: [] },
        }),
      });

      const result = await engine.searchByUrl('https://example.com/image.jpg');

      expect(result.success).toBe(true);
      expect(result.matches).toEqual([]);
      expect(result.stats.totalResults).toBe(0);
    });

    it('handles missing results object', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          stats: { timestamp: 1705000000 },
        }),
      });

      const result = await engine.searchByUrl('https://example.com/image.jpg');

      expect(result.success).toBe(true);
      expect(result.matches).toEqual([]);
    });

    it('handles missing stats with fallback values', async () => {
      const startTime = Date.now();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: { matches: [] },
        }),
      });

      const result = await engine.searchByUrl('https://example.com/image.jpg');

      expect(result.stats.timestamp).toBeGreaterThanOrEqual(Math.floor(startTime / 1000));
      expect(result.stats.queryTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.totalResults).toBe(0);
      expect(result.stats.totalBacklinks).toBe(0);
    });

    it('maps overlay URL correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: {
            matches: [
              {
                image_url: 'https://test.com/img.jpg',
                domain: 'test.com',
                score: 80,
                overlay: 'https://overlay.tineye.com/compare/12345',
              },
            ],
          },
        }),
      });

      const result = await engine.searchByUrl('https://example.com/image.jpg');
      expect(result.matches[0].overlayUrl).toBe('https://overlay.tineye.com/compare/12345');
    });

    it('filters out invalid tags', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: {
            matches: [
              {
                image_url: 'https://test.com/img.jpg',
                domain: 'test.com',
                score: 80,
                tags: ['stock', 'invalid', 'collection', 'unknown'],
              },
            ],
          },
        }),
      });

      const result = await engine.searchByUrl('https://example.com/image.jpg');
      expect(result.matches[0].tags).toEqual(['stock', 'collection']);
    });

    it('handles match without backlinks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: {
            matches: [
              {
                image_url: 'https://test.com/img.jpg',
                domain: 'test.com',
                score: 80,
              },
            ],
          },
        }),
      });

      const result = await engine.searchByUrl('https://example.com/image.jpg');
      expect(result.matches[0].backlinks).toEqual([]);
    });
  });

  // ===========================================
  // Confidence Scoring Tests
  // ===========================================
  describe('Confidence Scoring (scoreToConfidence)', () => {
    it('returns HIGH for score >= 80', () => {
      expect(scoreToConfidence(80)).toBe('HIGH');
      expect(scoreToConfidence(85)).toBe('HIGH');
      expect(scoreToConfidence(100)).toBe('HIGH');
      expect(scoreToConfidence(99.9)).toBe('HIGH');
    });

    it('returns MEDIUM for score 50-79', () => {
      expect(scoreToConfidence(50)).toBe('MEDIUM');
      expect(scoreToConfidence(65)).toBe('MEDIUM');
      expect(scoreToConfidence(79)).toBe('MEDIUM');
      expect(scoreToConfidence(79.9)).toBe('MEDIUM');
    });

    it('returns LOW for score < 50', () => {
      expect(scoreToConfidence(0)).toBe('LOW');
      expect(scoreToConfidence(30)).toBe('LOW');
      expect(scoreToConfidence(49)).toBe('LOW');
      expect(scoreToConfidence(49.9)).toBe('LOW');
    });

    it('handles boundary cases correctly', () => {
      expect(scoreToConfidence(80)).toBe('HIGH');
      expect(scoreToConfidence(79.99999)).toBe('MEDIUM');
      expect(scoreToConfidence(50)).toBe('MEDIUM');
      expect(scoreToConfidence(49.99999)).toBe('LOW');
    });
  });

  // ===========================================
  // Error Handling Tests
  // ===========================================
  describe('Error Handling', () => {
    describe('HTTP 400 - Invalid Image', () => {
      it('throws TinEyeError with TINEYE_INVALID_IMAGE code', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({
            code: 400,
            messages: ['Image could not be processed'],
          }),
        });

        await expect(
          engine.searchByUrl('https://example.com/bad-image.jpg')
        ).rejects.toMatchObject({
          code: 'TINEYE_INVALID_IMAGE',
          statusCode: 400,
          retryable: false,
        });
      });
    });

    describe('HTTP 401/403 - Invalid API Key', () => {
      it('throws TinEyeError for 401 unauthorized', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({
            code: 401,
            messages: ['Invalid API key'],
          }),
        });

        await expect(
          engine.searchByUrl('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'TINEYE_INVALID_API_KEY',
          statusCode: 401,
          retryable: false,
        });
      });

      it('throws TinEyeError for 403 forbidden', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            code: 403,
            messages: ['Access denied'],
          }),
        });

        await expect(
          engine.searchByUrl('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'TINEYE_INVALID_API_KEY',
          statusCode: 403,
          retryable: false,
        });
      });
    });

    describe('HTTP 429 - Rate Limited', () => {
      it('triggers retry with backoff on 429', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({
              code: 429,
              messages: ['Rate limit exceeded'],
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              code: 200,
              results: { matches: [] },
            }),
          });

        const promise = engine.searchByUrl('https://example.com/image.jpg', {
          retry: { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
        });

        // Advance timers to trigger retry
        await vi.advanceTimersByTimeAsync(100);
        await promise;

        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('throws RateLimitError after max retries exhausted', async () => {
        // Use real timers for this test since retry logic is complex with fakes
        vi.useRealTimers();

        mockFetch.mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({
            code: 429,
            messages: ['Rate limit exceeded'],
          }),
        });

        // Use very short delays for fast test execution
        await expect(
          engine.searchByUrl('https://example.com/image.jpg', {
            retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 5, jitterFactor: 0 },
          })
        ).rejects.toThrow(RateLimitError);

        expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries

        // Restore fake timers for other tests
        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      it('includes attemptsMade in RateLimitError', async () => {
        // Use real timers for this test
        vi.useRealTimers();

        mockFetch.mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({
            code: 429,
            messages: ['Rate limit exceeded'],
          }),
        });

        let caughtError: RateLimitError | undefined;
        try {
          await engine.searchByUrl('https://example.com/image.jpg', {
            retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 5, jitterFactor: 0 },
          });
        } catch (error) {
          caughtError = error as RateLimitError;
        }

        expect(caughtError).toBeInstanceOf(RateLimitError);
        expect(caughtError?.attemptsMade).toBe(3);

        // Restore fake timers for other tests
        vi.useFakeTimers({ shouldAdvanceTime: true });
      });
    });

    describe('Network Errors', () => {
      it('throws NetworkError on fetch failure', async () => {
        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        await expect(
          engine.searchByUrl('https://example.com/image.jpg', {
            retry: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
          })
        ).rejects.toThrow(NetworkError);
      });

      it('throws NetworkError on connection refused', async () => {
        const connectionError = new Error('ECONNREFUSED');
        mockFetch.mockRejectedValue(connectionError);

        await expect(
          engine.searchByUrl('https://example.com/image.jpg', {
            retry: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
          })
        ).rejects.toMatchObject({
          code: 'TINEYE_NETWORK_ERROR',
          retryable: true,
        });
      });

      it('throws NetworkError on DNS lookup failure', async () => {
        const dnsError = new Error('ENOTFOUND');
        mockFetch.mockRejectedValue(dnsError);

        await expect(
          engine.searchByUrl('https://example.com/image.jpg', {
            retry: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
          })
        ).rejects.toMatchObject({
          code: 'TINEYE_NETWORK_ERROR',
        });
      });
    });

    describe('Timeout Errors', () => {
      it('throws TimeoutError on abort', async () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        mockFetch.mockRejectedValue(abortError);

        await expect(
          engine.searchByUrl('https://example.com/image.jpg', {
            retry: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
          })
        ).rejects.toMatchObject({
          code: 'TINEYE_TIMEOUT',
          retryable: true,
        });
      });

      it('throws TimeoutError on timeout error', async () => {
        const timeoutError = new Error('timeout');
        timeoutError.name = 'TimeoutError';
        mockFetch.mockRejectedValue(timeoutError);

        await expect(
          engine.searchByUrl('https://example.com/image.jpg', {
            retry: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
          })
        ).rejects.toThrow(TimeoutError);
      });
    });

    describe('Server Errors', () => {
      it('throws TinEyeError on 500 internal server error', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({
            code: 500,
            messages: ['Internal server error'],
          }),
        });

        await expect(
          engine.searchByUrl('https://example.com/image.jpg', {
            retry: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
          })
        ).rejects.toMatchObject({
          code: 'TINEYE_API_ERROR',
          statusCode: 500,
          retryable: true,
        });
      });
    });
  });

  // ===========================================
  // Retry Logic Tests
  // ===========================================
  describe('Retry Logic', () => {
    it('retries on 429 with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ code: 429, messages: ['Rate limited'] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ code: 429, messages: ['Rate limited'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ code: 200, results: { matches: [] } }),
        });

      const promise = engine.searchByUrl('https://example.com/image.jpg', {
        retry: { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 10000, jitterFactor: 0 },
      });

      // First retry: 100ms (100 * 2^0)
      await vi.advanceTimersByTimeAsync(100);
      // Second retry: 200ms (100 * 2^1)
      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('respects max retries limit', async () => {
      // Use real timers for this test
      vi.useRealTimers();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ code: 429, messages: ['Rate limited'] }),
      });

      await expect(
        engine.searchByUrl('https://example.com/image.jpg', {
          retry: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 5, jitterFactor: 0 },
        })
      ).rejects.toThrow(RateLimitError);

      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry

      // Restore fake timers for other tests
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it('successful retry returns result', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ code: 429, messages: ['Rate limited'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            code: 200,
            stats: { total_results: 3 },
            results: {
              matches: [
                { image_url: 'https://a.com/1.jpg', domain: 'a.com', score: 90 },
                { image_url: 'https://b.com/2.jpg', domain: 'b.com', score: 85 },
                { image_url: 'https://c.com/3.jpg', domain: 'c.com', score: 75 },
              ],
            },
          }),
        });

      const promise = engine.searchByUrl('https://example.com/image.jpg', {
        retry: { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
      });

      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(3);
    });

    it('applies jitter to delay (delay varies)', async () => {
      // Spy on Math.random to test jitter
      const randomSpy = vi.spyOn(Math, 'random');

      // First call returns 0.8 (positive jitter)
      randomSpy.mockReturnValueOnce(0.8);
      // Second call returns 0.2 (negative jitter)
      randomSpy.mockReturnValueOnce(0.2);

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ code: 429, messages: ['Rate limited'] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ code: 429, messages: ['Rate limited'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ code: 200, results: { matches: [] } }),
        });

      const promise = engine.searchByUrl('https://example.com/image.jpg', {
        retry: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0.1 },
      });

      // With jitterFactor=0.1 and random=0.8:
      // jitter = 1000 * 0.1 * (0.8 * 2 - 1) = 100 * 0.6 = 60
      // delay = 1000 + 60 = 1060
      await vi.advanceTimersByTimeAsync(1060);

      // Second retry with random=0.2:
      // jitter = 2000 * 0.1 * (0.2 * 2 - 1) = 200 * (-0.6) = -120
      // delay = 2000 - 120 = 1880
      await vi.advanceTimersByTimeAsync(1880);

      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      randomSpy.mockRestore();
    });

    it('retries network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ code: 200, results: { matches: [] } }),
        });

      const promise = engine.searchByUrl('https://example.com/image.jpg', {
        retry: { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
      });

      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry non-retryable errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 400, messages: ['Invalid image'] }),
      });

      await expect(
        engine.searchByUrl('https://example.com/bad.jpg', {
          retry: { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
        })
      ).rejects.toMatchObject({
        code: 'TINEYE_INVALID_IMAGE',
        retryable: false,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('caps delay at maxDelayMs', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ code: 429, messages: ['Rate limited'] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ code: 429, messages: ['Rate limited'] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ code: 429, messages: ['Rate limited'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ code: 200, results: { matches: [] } }),
        });

      const promise = engine.searchByUrl('https://example.com/image.jpg', {
        // With baseDelay=500, by attempt 3 exponential would be 500*8=4000
        // But maxDelay=1000 should cap it
        retry: { maxRetries: 5, baseDelayMs: 500, maxDelayMs: 1000, jitterFactor: 0 },
      });

      await vi.advanceTimersByTimeAsync(500);  // attempt 0: 500
      await vi.advanceTimersByTimeAsync(1000); // attempt 1: 1000 (would be 1000)
      await vi.advanceTimersByTimeAsync(1000); // attempt 2: capped at 1000 (would be 2000)

      const result = await promise;
      expect(result.success).toBe(true);
    });
  });

  // ===========================================
  // Quota Endpoint Tests
  // ===========================================
  describe('getQuota', () => {
    it('parses bundles correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: {
            bundles: [
              {
                remaining_searches: 1000,
                start_date: '2024-01-01',
                end_date: '2024-12-31',
              },
              {
                remaining_searches: 500,
                start_date: '2024-06-01',
                end_date: '2024-12-31',
              },
            ],
            total_remaining_searches: 1500,
          },
        }),
      });

      const quota = await engine.getQuota();

      expect(quota.provider).toBe('tineye');
      expect(quota.totalRemainingSearches).toBe(1500);
      expect(quota.bundles).toHaveLength(2);
      expect(quota.bundles[0]).toEqual({
        remainingSearches: 1000,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(quota.bundles[1]).toEqual({
        remainingSearches: 500,
        startDate: '2024-06-01',
        endDate: '2024-12-31',
      });
      expect(quota.checkedAt).toBeDefined();
    });

    it('returns total remaining searches', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: {
            bundles: [],
            total_remaining_searches: 2500,
          },
        }),
      });

      const quota = await engine.getQuota();

      expect(quota.totalRemainingSearches).toBe(2500);
    });

    it('handles missing bundles array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: {
            total_remaining_searches: 100,
          },
        }),
      });

      const quota = await engine.getQuota();

      expect(quota.bundles).toEqual([]);
      expect(quota.totalRemainingSearches).toBe(100);
    });

    it('handles missing total with fallback to 0', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: {},
        }),
      });

      const quota = await engine.getQuota();

      expect(quota.totalRemainingSearches).toBe(0);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          code: 401,
          messages: ['Invalid API key'],
        }),
      });

      await expect(engine.getQuota()).rejects.toThrow(TinEyeError);
    });

    it('makes request to correct endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: { total_remaining_searches: 100 },
        }),
      });

      await engine.getQuota();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.tineye.com/rest/remaining_searches/',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-KEY': 'test-api-key-12345',
          }),
        })
      );
    });
  });

  // ===========================================
  // Health Check Tests
  // ===========================================
  describe('checkHealth', () => {
    it('returns healthy status when API responds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          stats: { timestamp: 1705000000, query_time: 50 },
          results: 62000000000, // 62 billion images
        }),
      });

      const health = await engine.checkHealth();

      expect(health.provider).toBe('tineye');
      expect(health.healthy).toBe(true);
      expect(health.message).toBe('TinEye API is operational');
      expect(health.indexedImages).toBe(62000000000);
      expect(health.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(health.checkedAt).toBeDefined();
    });

    it('returns unhealthy on API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          code: 500,
          messages: ['Service temporarily unavailable'],
        }),
      });

      const health = await engine.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('API returned 500');
      expect(health.message).toContain('Service temporarily unavailable');
    });

    it('returns unhealthy on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network connection failed'));

      const health = await engine.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('Health check failed');
      expect(health.message).toContain('Network connection failed');
    });

    it('returns unhealthy when not configured', async () => {
      delete process.env.TINEYE_API_KEY;
      const unconfiguredEngine = new TinEyeEngine();

      const health = await unconfiguredEngine.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.message).toBe('TinEye API key not configured');
      expect(health.responseTimeMs).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('makes request to correct endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          results: 62000000000,
        }),
      });

      await engine.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.tineye.com/rest/image_count/',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('handles missing messages in error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          code: 503,
        }),
      });

      const health = await engine.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('Unknown error');
    });
  });

  // ===========================================
  // Options Merging Tests
  // ===========================================
  describe('mergeWithDefaults', () => {
    it('applies all defaults when no options provided', () => {
      const resolved = mergeWithDefaults();

      expect(resolved.limit).toBe(TINEYE_DEFAULTS.LIMIT);
      expect(resolved.offset).toBe(TINEYE_DEFAULTS.OFFSET);
      expect(resolved.backlinkLimit).toBe(TINEYE_DEFAULTS.BACKLINK_LIMIT);
      expect(resolved.sort).toBe(TINEYE_DEFAULTS.SORT);
      expect(resolved.order).toBe(TINEYE_DEFAULTS.ORDER);
      expect(resolved.timeoutMs).toBe(TINEYE_DEFAULTS.TIMEOUT_MS);
      expect(resolved.includeBacklinks).toBe(true);
      expect(resolved.retry).toEqual(TINEYE_DEFAULTS.RETRY);
    });

    it('overrides defaults with provided values', () => {
      const resolved = mergeWithDefaults({
        limit: 100,
        offset: 50,
        sort: 'size',
        order: 'asc',
        timeoutMs: 30000,
      });

      expect(resolved.limit).toBe(100);
      expect(resolved.offset).toBe(50);
      expect(resolved.sort).toBe('size');
      expect(resolved.order).toBe('asc');
      expect(resolved.timeoutMs).toBe(30000);
    });

    it('merges partial retry config with defaults', () => {
      const resolved = mergeWithDefaults({
        retry: { maxRetries: 10 },
      });

      expect(resolved.retry.maxRetries).toBe(10);
      expect(resolved.retry.baseDelayMs).toBe(TINEYE_DEFAULTS.RETRY.baseDelayMs);
      expect(resolved.retry.maxDelayMs).toBe(TINEYE_DEFAULTS.RETRY.maxDelayMs);
      expect(resolved.retry.jitterFactor).toBe(TINEYE_DEFAULTS.RETRY.jitterFactor);
    });

    it('preserves optional fields when set', () => {
      const resolved = mergeWithDefaults({
        domain: 'example.com',
        tags: ['stock'],
      });

      expect(resolved.domain).toBe('example.com');
      expect(resolved.tags).toEqual(['stock']);
    });

    it('leaves optional fields undefined when not set', () => {
      const resolved = mergeWithDefaults({});

      expect(resolved.domain).toBeUndefined();
      expect(resolved.tags).toBeUndefined();
    });
  });
});

describe('TinEyeError.fromResponse', () => {
  it('creates TINEYE_INVALID_IMAGE error for 400', () => {
    const error = TinEyeError.fromResponse(400, {
      code: 400,
      messages: ['Image too small'],
    });

    expect(error.code).toBe('TINEYE_INVALID_IMAGE');
    expect(error.message).toBe('Image too small');
    expect(error.retryable).toBe(false);
    expect(error.apiMessages).toEqual(['Image too small']);
  });

  it('creates TINEYE_INVALID_API_KEY error for 401', () => {
    const error = TinEyeError.fromResponse(401, {
      code: 401,
      messages: ['Unauthorized'],
    });

    expect(error.code).toBe('TINEYE_INVALID_API_KEY');
    expect(error.retryable).toBe(false);
  });

  it('creates TINEYE_INVALID_API_KEY error for 403', () => {
    const error = TinEyeError.fromResponse(403, {
      code: 403,
      messages: ['Forbidden'],
    });

    expect(error.code).toBe('TINEYE_INVALID_API_KEY');
    expect(error.retryable).toBe(false);
  });

  it('creates TINEYE_RATE_LIMITED error for 429', () => {
    const error = TinEyeError.fromResponse(429, {
      code: 429,
      messages: ['Too many requests'],
    });

    expect(error.code).toBe('TINEYE_RATE_LIMITED');
    expect(error.retryable).toBe(true);
  });

  it('creates TINEYE_API_ERROR for 5xx errors', () => {
    const error = TinEyeError.fromResponse(502, {
      code: 502,
      messages: ['Bad gateway'],
    });

    expect(error.code).toBe('TINEYE_API_ERROR');
    expect(error.retryable).toBe(true);
  });

  it('creates TINEYE_API_ERROR for unknown status codes', () => {
    const error = TinEyeError.fromResponse(418, {
      code: 418,
      messages: ["I'm a teapot"],
    });

    expect(error.code).toBe('TINEYE_API_ERROR');
    expect(error.retryable).toBe(false);
  });

  it('handles missing messages array', () => {
    const error = TinEyeError.fromResponse(400, { code: 400 });

    expect(error.message).toBe('Unknown error');
  });

  it('joins multiple messages', () => {
    const error = TinEyeError.fromResponse(400, {
      code: 400,
      messages: ['Error 1', 'Error 2', 'Error 3'],
    });

    expect(error.message).toBe('Error 1; Error 2; Error 3');
  });
});

describe('getTinEyeEngine (singleton)', () => {
  it('returns the same instance on multiple calls', async () => {
    // Reset modules to get fresh singleton
    vi.resetModules();

    // Re-import to get fresh module
    const { getTinEyeEngine: getEngine } = await import('../engines/tineye.engine');

    const instance1 = getEngine();
    const instance2 = getEngine();

    expect(instance1).toBe(instance2);
  });
});
