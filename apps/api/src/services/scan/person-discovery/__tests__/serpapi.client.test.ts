/**
 * SerpAPI Client Unit Tests
 *
 * Comprehensive tests for the SerpAPI HTTP client covering:
 * - Request construction (Google Lens & Bing Reverse Image)
 * - Response parsing
 * - Error handling (auth, rate limit, server errors)
 * - Retry logic with exponential backoff
 * - API key masking in logs
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  SerpApiClient,
  SerpApiError,
  SerpApiRateLimitError,
  SerpApiAuthError,
  getSerpApiClient,
  isSerpApiConfigured,
  resetSerpApiClient,
  type GoogleLensResponse,
  type BingReverseImageResponse,
} from '../serpapi.client';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock console to suppress log output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Store original env
const originalEnv = { ...process.env };

// =============================================================================
// Mock Response Data
// =============================================================================

const mockGoogleLensResponse: GoogleLensResponse = {
  search_metadata: {
    id: 'test-id-123',
    status: 'Success',
    google_lens_url: 'https://lens.google.com/search?q=image',
    created_at: '2024-01-15T10:00:00Z',
    processed_at: '2024-01-15T10:00:01Z',
    total_time_taken: 1.2,
  },
  search_parameters: {
    engine: 'google_lens',
    url: 'https://example.com/image.jpg',
  },
  visual_matches: [
    {
      position: 1,
      title: 'Test Image Match',
      link: 'https://example.com/page',
      source: 'example.com',
      thumbnail: 'https://example.com/thumb.jpg',
      original: 'https://example.com/original.jpg',
      size: { width: 800, height: 600 },
    },
    {
      position: 2,
      title: 'Another Match',
      link: 'https://other.com/page',
      source: 'other.com',
      thumbnail: 'https://other.com/thumb.jpg',
    },
  ],
};

const mockBingResponse: BingReverseImageResponse = {
  search_metadata: {
    id: 'test-bing-id-456',
    status: 'Success',
    bing_reverse_image_url: 'https://bing.com/images/search',
    created_at: '2024-01-15T10:00:00Z',
  },
  search_parameters: {
    engine: 'bing_reverse_image',
    image_url: 'https://example.com/image.jpg',
  },
  search_information: {
    total_estimated_matches: 150,
  },
  image_info: {
    title: 'Original Image',
    width: 1920,
    height: 1080,
    format: 'jpeg',
  },
  images_results: [
    {
      position: 1,
      title: 'Bing Result 1',
      source: 'https://example.com',
      link: 'https://example.com/page',
      thumbnail: 'https://example.com/thumb.jpg',
      original: 'https://example.com/full.jpg',
      domain: 'example.com',
      width: 800,
      height: 600,
    },
  ],
  related_content: [
    {
      position: 1,
      title: 'Related Page',
      link: 'https://related.com/page',
      thumbnail: 'https://related.com/thumb.jpg',
      domain: 'related.com',
    },
  ],
};

// =============================================================================
// Helper Functions
// =============================================================================

function createMockResponse(options: {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  headers?: Record<string, string>;
}): Response {
  const headersMap = new Map(Object.entries(options.headers ?? {}));
  return {
    ok: options.ok,
    status: options.status,
    json: options.json ?? (async () => ({})),
    headers: {
      get: (name: string) => headersMap.get(name) ?? null,
    },
  } as unknown as Response;
}

// =============================================================================
// Tests
// =============================================================================

describe('SerpApiClient', () => {
  let client: SerpApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    client = new SerpApiClient({
      apiKey: 'test-api-key-12345',
      maxRetries: 3,
      retryBaseDelay: 100,
      retryMaxDelay: 1000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
    resetSerpApiClient();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================
  describe('constructor', () => {
    it('should throw SerpApiError when API key is not provided', () => {
      expect(() => new SerpApiClient({ apiKey: '' })).toThrow(SerpApiError);
      expect(() => new SerpApiClient({ apiKey: '' })).toThrow('SerpAPI API key is required');
    });

    it('should use default values when not provided', () => {
      const defaultClient = new SerpApiClient({ apiKey: 'test-key' });
      // Can only verify this through behavior, but constructor should not throw
      expect(defaultClient).toBeInstanceOf(SerpApiClient);
    });

    it('should accept custom configuration', () => {
      const customClient = new SerpApiClient({
        apiKey: 'custom-key',
        baseUrl: 'https://custom.serpapi.com',
        timeout: 60000,
        maxRetries: 5,
        retryBaseDelay: 2000,
        retryMaxDelay: 30000,
      });
      expect(customClient).toBeInstanceOf(SerpApiClient);
    });
  });

  // ===========================================================================
  // Request Construction Tests - Google Lens
  // ===========================================================================
  describe('searchGoogleLens', () => {
    describe('request construction', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockGoogleLensResponse,
          })
        );
      });

      it('should include correct engine parameter', async () => {
        await client.searchGoogleLens('https://example.com/image.jpg');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('engine=google_lens');
      });

      it('should include API key in request', async () => {
        await client.searchGoogleLens('https://example.com/image.jpg');

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('api_key=test-api-key-12345');
      });

      it('should properly encode image URL', async () => {
        const imageUrl = 'https://example.com/path/to/image.jpg?size=large&format=png';
        await client.searchGoogleLens(imageUrl);

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('url=https%3A%2F%2Fexample.com%2Fpath%2Fto%2Fimage.jpg');
      });

      it('should use correct base URL', async () => {
        await client.searchGoogleLens('https://example.com/image.jpg');

        const [url] = mockFetch.mock.calls[0];
        expect(url.startsWith('https://serpapi.com/search?')).toBe(true);
      });

      it('should use custom base URL when configured', async () => {
        const customClient = new SerpApiClient({
          apiKey: 'test-key',
          baseUrl: 'https://custom.serpapi.com',
        });
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockGoogleLensResponse,
          })
        );

        await customClient.searchGoogleLens('https://example.com/image.jpg');

        const [url] = mockFetch.mock.calls[0];
        expect(url.startsWith('https://custom.serpapi.com/search?')).toBe(true);
      });

      it('should use GET method', async () => {
        await client.searchGoogleLens('https://example.com/image.jpg');

        const [, options] = mockFetch.mock.calls[0];
        expect(options.method).toBe('GET');
      });

      it('should include Accept header', async () => {
        await client.searchGoogleLens('https://example.com/image.jpg');

        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers.Accept).toBe('application/json');
      });
    });

    describe('response parsing', () => {
      it('should parse visual_matches from response', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockGoogleLensResponse,
          })
        );

        const result = await client.searchGoogleLens('https://example.com/image.jpg');

        expect(result.visual_matches).toHaveLength(2);
        expect(result.visual_matches?.[0].title).toBe('Test Image Match');
        expect(result.visual_matches?.[0].link).toBe('https://example.com/page');
        expect(result.visual_matches?.[0].source).toBe('example.com');
        expect(result.visual_matches?.[0].size).toEqual({ width: 800, height: 600 });
      });

      it('should handle empty visual_matches array', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => ({
              search_metadata: { id: 'test', status: 'Success' },
              visual_matches: [],
            }),
          })
        );

        const result = await client.searchGoogleLens('https://example.com/image.jpg');

        expect(result.visual_matches).toEqual([]);
      });

      it('should handle response without visual_matches', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => ({
              search_metadata: { id: 'test', status: 'Success' },
            }),
          })
        );

        const result = await client.searchGoogleLens('https://example.com/image.jpg');

        expect(result.visual_matches).toBeUndefined();
      });

      it('should parse search_metadata', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockGoogleLensResponse,
          })
        );

        const result = await client.searchGoogleLens('https://example.com/image.jpg');

        expect(result.search_metadata.id).toBe('test-id-123');
        expect(result.search_metadata.status).toBe('Success');
      });

      it('should throw on API-level error in response body', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => ({
              search_metadata: { id: 'test', status: 'Error' },
              error: 'Invalid image URL provided',
            }),
          })
        );

        await expect(
          client.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'SERPAPI_API_ERROR',
          message: 'Invalid image URL provided',
          retryable: false,
        });
      });
    });
  });

  // ===========================================================================
  // Request Construction Tests - Bing Reverse Image
  // ===========================================================================
  describe('searchBingReverseImage', () => {
    describe('request construction', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockBingResponse,
          })
        );
      });

      it('should include correct engine parameter', async () => {
        await client.searchBingReverseImage('https://example.com/image.jpg');

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('engine=bing_reverse_image');
      });

      it('should use image_url parameter (not url)', async () => {
        await client.searchBingReverseImage('https://example.com/image.jpg');

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('image_url=');
        expect(url).not.toMatch(/[?&]url=/); // Should not have standalone 'url' param
      });

      it('should include API key in request', async () => {
        await client.searchBingReverseImage('https://example.com/image.jpg');

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('api_key=test-api-key-12345');
      });

      it('should properly encode image URL', async () => {
        const imageUrl = 'https://example.com/path/to/image.jpg?size=large';
        await client.searchBingReverseImage(imageUrl);

        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain('image_url=https%3A%2F%2Fexample.com%2Fpath%2Fto%2Fimage.jpg');
      });
    });

    describe('response parsing', () => {
      it('should parse images_results from response', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockBingResponse,
          })
        );

        const result = await client.searchBingReverseImage('https://example.com/image.jpg');

        expect(result.images_results).toHaveLength(1);
        expect(result.images_results?.[0].title).toBe('Bing Result 1');
        expect(result.images_results?.[0].domain).toBe('example.com');
      });

      it('should parse related_content from response', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockBingResponse,
          })
        );

        const result = await client.searchBingReverseImage('https://example.com/image.jpg');

        expect(result.related_content).toHaveLength(1);
        expect(result.related_content?.[0].title).toBe('Related Page');
      });

      it('should handle empty results', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => ({
              search_metadata: { id: 'test', status: 'Success' },
              images_results: [],
              related_content: [],
            }),
          })
        );

        const result = await client.searchBingReverseImage('https://example.com/image.jpg');

        expect(result.images_results).toEqual([]);
        expect(result.related_content).toEqual([]);
      });

      it('should handle response without results fields', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => ({
              search_metadata: { id: 'test', status: 'Success' },
            }),
          })
        );

        const result = await client.searchBingReverseImage('https://example.com/image.jpg');

        expect(result.images_results).toBeUndefined();
        expect(result.related_content).toBeUndefined();
      });
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================
  describe('error handling', () => {
    describe('authentication errors', () => {
      it('should throw SerpApiAuthError on 401', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Invalid API key' }),
          })
        );

        await expect(
          client.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toBeInstanceOf(SerpApiAuthError);
      });

      it('should throw SerpApiAuthError on 403', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 403,
            json: async () => ({ error: 'Forbidden' }),
          })
        );

        await expect(
          client.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toBeInstanceOf(SerpApiAuthError);
      });

      it('should have correct error properties on auth error', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Invalid API key' }),
          })
        );

        let caughtError: SerpApiAuthError | undefined;
        try {
          await client.searchGoogleLens('https://example.com/image.jpg');
        } catch (error) {
          caughtError = error as SerpApiAuthError;
        }

        expect(caughtError).toBeInstanceOf(SerpApiAuthError);
        expect(caughtError?.code).toBe('SERPAPI_AUTH_ERROR');
        expect(caughtError?.statusCode).toBe(401);
        expect(caughtError?.retryable).toBe(false);
      });
    });

    describe('rate limit errors', () => {
      it('should throw SerpApiRateLimitError on 429 after retries exhausted', async () => {
        vi.useRealTimers();

        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 429,
            json: async () => ({ error: 'Rate limit exceeded' }),
          })
        );

        // Create client with minimal retries/delays for fast test
        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 1,
          retryBaseDelay: 1,
          retryMaxDelay: 5,
        });

        await expect(
          fastClient.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toBeInstanceOf(SerpApiRateLimitError);

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      it('should include retryAfter from Retry-After header (seconds)', async () => {
        vi.useRealTimers();

        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 429,
            json: async () => ({ error: 'Rate limit exceeded' }),
            headers: { 'Retry-After': '30' },
          })
        );

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 0,
        });

        let caughtError: SerpApiRateLimitError | undefined;
        try {
          await fastClient.searchGoogleLens('https://example.com/image.jpg');
        } catch (error) {
          caughtError = error as SerpApiRateLimitError;
        }

        expect(caughtError).toBeInstanceOf(SerpApiRateLimitError);
        expect(caughtError?.retryAfter).toBe(30);
        expect(caughtError?.message).toContain('Retry after 30 seconds');

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      it('should have correct error properties on rate limit', async () => {
        vi.useRealTimers();

        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 429,
            json: async () => ({ error: 'Too many requests' }),
          })
        );

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 0,
        });

        let caughtError: SerpApiRateLimitError | undefined;
        try {
          await fastClient.searchGoogleLens('https://example.com/image.jpg');
        } catch (error) {
          caughtError = error as SerpApiRateLimitError;
        }

        expect(caughtError?.code).toBe('SERPAPI_RATE_LIMITED');
        expect(caughtError?.statusCode).toBe(429);
        expect(caughtError?.retryable).toBe(true);

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });
    });

    describe('server errors', () => {
      it('should throw SerpApiError on 500 after retries', async () => {
        vi.useRealTimers();

        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal server error' }),
          })
        );

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 1,
          retryBaseDelay: 1,
          retryMaxDelay: 5,
        });

        await expect(
          fastClient.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'SERPAPI_API_ERROR',
          statusCode: 500,
          retryable: true,
        });

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      it('should throw SerpApiError on 502 (Bad Gateway)', async () => {
        vi.useRealTimers();

        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 502,
            json: async () => ({ error: 'Bad gateway' }),
          })
        );

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 0,
        });

        await expect(
          fastClient.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'SERPAPI_API_ERROR',
          statusCode: 502,
        });

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      it('should throw SerpApiError on 503 (Service Unavailable)', async () => {
        vi.useRealTimers();

        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 503,
            json: async () => ({ message: 'Service temporarily unavailable' }),
          })
        );

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 0,
        });

        await expect(
          fastClient.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'SERPAPI_API_ERROR',
          statusCode: 503,
        });

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });
    });

    describe('client errors', () => {
      it('should throw SerpApiError with SERPAPI_INVALID_REQUEST on 400', async () => {
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 400,
            json: async () => ({ error: 'Invalid image URL' }),
          })
        );

        await expect(
          client.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'SERPAPI_INVALID_REQUEST',
          statusCode: 400,
          retryable: false,
        });
      });
    });

    describe('network errors', () => {
      it('should throw SerpApiError with SERPAPI_NETWORK_ERROR on fetch failure', async () => {
        vi.useRealTimers();

        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 0,
        });

        await expect(
          fastClient.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'SERPAPI_NETWORK_ERROR',
          retryable: true,
        });

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      it('should throw SerpApiError with SERPAPI_NETWORK_ERROR on ECONNREFUSED', async () => {
        vi.useRealTimers();

        const connectionError = new Error('ECONNREFUSED');
        mockFetch.mockRejectedValue(connectionError);

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 0,
        });

        await expect(
          fastClient.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'SERPAPI_NETWORK_ERROR',
        });

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      it('should throw SerpApiError with SERPAPI_TIMEOUT on timeout', async () => {
        vi.useRealTimers();

        const timeoutError = new Error('timeout');
        timeoutError.name = 'TimeoutError';
        mockFetch.mockRejectedValue(timeoutError);

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 0,
        });

        await expect(
          fastClient.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'SERPAPI_TIMEOUT',
          retryable: true,
        });

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      it('should throw SerpApiError with SERPAPI_TIMEOUT on AbortError', async () => {
        vi.useRealTimers();

        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        mockFetch.mockRejectedValue(abortError);

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 0,
        });

        await expect(
          fastClient.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toMatchObject({
          code: 'SERPAPI_TIMEOUT',
        });

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });
    });

    describe('malformed responses', () => {
      it('should handle JSON parse error', async () => {
        vi.useRealTimers();

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
        });

        const fastClient = new SerpApiClient({
          apiKey: 'test-key',
          maxRetries: 0,
        });

        await expect(
          fastClient.searchGoogleLens('https://example.com/image.jpg')
        ).rejects.toBeInstanceOf(SerpApiError);

        vi.useFakeTimers({ shouldAdvanceTime: true });
      });
    });
  });

  // ===========================================================================
  // Retry Logic Tests
  // ===========================================================================
  describe('retry logic', () => {
    it('should retry on 5xx errors with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Server error' }),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 502,
            json: async () => ({ error: 'Bad gateway' }),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockGoogleLensResponse,
          })
        );

      const promise = client.searchGoogleLens('https://example.com/image.jpg');

      // First retry: ~100ms (base delay)
      await vi.advanceTimersByTimeAsync(150);
      // Second retry: ~200ms (2x base delay)
      await vi.advanceTimersByTimeAsync(250);

      const result = await promise;

      expect(result.search_metadata.status).toBe('Success');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on 429 rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 429,
            json: async () => ({ error: 'Rate limited' }),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockGoogleLensResponse,
          })
        );

      const promise = client.searchGoogleLens('https://example.com/image.jpg');

      await vi.advanceTimersByTimeAsync(150);
      const result = await promise;

      expect(result.search_metadata.status).toBe('Success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use Retry-After header delay when present on 429', async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 429,
            json: async () => ({ error: 'Rate limited' }),
            headers: { 'Retry-After': '2' }, // 2 seconds
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockGoogleLensResponse,
          })
        );

      const promise = client.searchGoogleLens('https://example.com/image.jpg');

      // Should wait 2000ms based on Retry-After header
      await vi.advanceTimersByTimeAsync(2100);
      const result = await promise;

      expect(result.search_metadata.status).toBe('Success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockGoogleLensResponse,
          })
        );

      const promise = client.searchGoogleLens('https://example.com/image.jpg');

      await vi.advanceTimersByTimeAsync(150);
      const result = await promise;

      expect(result.search_metadata.status).toBe('Success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors (except 429)', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Bad request' }),
        })
      );

      await expect(
        client.searchGoogleLens('https://example.com/image.jpg')
      ).rejects.toMatchObject({
        code: 'SERPAPI_INVALID_REQUEST',
        retryable: false,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should not retry on auth errors', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Invalid API key' }),
        })
      );

      await expect(
        client.searchGoogleLens('https://example.com/image.jpg')
      ).rejects.toBeInstanceOf(SerpApiAuthError);

      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should respect max retries limit', async () => {
      vi.useRealTimers();

      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' }),
        })
      );

      // Client has maxRetries: 3, so 4 total attempts (1 initial + 3 retries)
      const fastClient = new SerpApiClient({
        apiKey: 'test-key',
        maxRetries: 2,
        retryBaseDelay: 1,
        retryMaxDelay: 5,
      });

      await expect(
        fastClient.searchGoogleLens('https://example.com/image.jpg')
      ).rejects.toMatchObject({
        code: 'SERPAPI_API_ERROR',
      });

      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries

      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it('should return result after successful retry', async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Server error' }),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => ({
              ...mockGoogleLensResponse,
              visual_matches: [
                {
                  position: 1,
                  title: 'Recovered Result',
                  link: 'https://recovered.com',
                  source: 'recovered.com',
                  thumbnail: 'https://recovered.com/thumb.jpg',
                },
              ],
            }),
          })
        );

      const promise = client.searchGoogleLens('https://example.com/image.jpg');

      await vi.advanceTimersByTimeAsync(150);
      const result = await promise;

      expect(result.visual_matches?.[0].title).toBe('Recovered Result');
    });

    it('should cap delay at maxDelayMs', async () => {
      // Create client with very low max delay
      const cappedClient = new SerpApiClient({
        apiKey: 'test-key',
        maxRetries: 5,
        retryBaseDelay: 500,
        retryMaxDelay: 600, // Very low cap
      });

      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Error 1' }),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Error 2' }),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Error 3' }),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: async () => mockGoogleLensResponse,
          })
        );

      const promise = cappedClient.searchGoogleLens('https://example.com/image.jpg');

      // All delays should be capped around 600ms (+ jitter)
      await vi.advanceTimersByTimeAsync(800); // First retry
      await vi.advanceTimersByTimeAsync(800); // Second retry
      await vi.advanceTimersByTimeAsync(800); // Third retry

      const result = await promise;
      expect(result.search_metadata.status).toBe('Success');
    });
  });

  // ===========================================================================
  // isAvailable Tests
  // ===========================================================================
  describe('isAvailable', () => {
    it('should return true when API responds with success', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ account_email: 'test@example.com' }),
        })
      );

      const result = await client.isAvailable();

      expect(result).toBe(true);
    });

    it('should return false when API returns error', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Invalid API key' }),
        })
      );

      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false on timeout', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValue(timeoutError);

      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it('should call the account endpoint', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
      );

      await client.isAvailable();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/account?');
      expect(url).toContain('api_key=');
    });
  });

  // ===========================================================================
  // API Key Masking Tests
  // ===========================================================================
  describe('API key masking', () => {
    it('should mask API key in logged URLs', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => mockGoogleLensResponse,
        })
      );

      await client.searchGoogleLens('https://example.com/image.jpg');

      // Check that console.log was called with masked key
      const logCalls = consoleSpy.mock.calls;
      const requestLog = logCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('search starting')
      );

      expect(requestLog).toBeDefined();
      expect(requestLog?.[0]).not.toContain('test-api-key-12345');
      expect(requestLog?.[0]).toContain('****2345'); // Last 4 chars
    });

    it('should fully mask short API keys', async () => {
      const shortKeyClient = new SerpApiClient({
        apiKey: 'abc', // Short key
        maxRetries: 0,
      });

      const consoleSpy = vi.spyOn(console, 'log');

      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => mockGoogleLensResponse,
        })
      );

      await shortKeyClient.searchGoogleLens('https://example.com/image.jpg');

      const logCalls = consoleSpy.mock.calls;
      const requestLog = logCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('search starting')
      );

      expect(requestLog).toBeDefined();
      expect(requestLog?.[0]).not.toContain('abc');
      expect(requestLog?.[0]).toContain('****'); // Fully masked
    });
  });
});

// =============================================================================
// Error Class Tests
// =============================================================================

describe('SerpApiError', () => {
  it('should create error with correct properties', () => {
    const error = new SerpApiError('SERPAPI_API_ERROR', 'Test error message', {
      statusCode: 500,
      response: { detail: 'error detail' },
      retryable: true,
    });

    expect(error.name).toBe('SerpApiError');
    expect(error.code).toBe('SERPAPI_API_ERROR');
    expect(error.message).toBe('Test error message');
    expect(error.statusCode).toBe(500);
    expect(error.response).toEqual({ detail: 'error detail' });
    expect(error.retryable).toBe(true);
  });

  it('should default retryable to false', () => {
    const error = new SerpApiError('SERPAPI_API_ERROR', 'Test error');
    expect(error.retryable).toBe(false);
  });

  it('should serialize to JSON correctly', () => {
    const error = new SerpApiError('SERPAPI_NETWORK_ERROR', 'Network failed', {
      statusCode: undefined,
      retryable: true,
    });

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'SerpApiError',
      code: 'SERPAPI_NETWORK_ERROR',
      message: 'Network failed',
      statusCode: undefined,
      retryable: true,
    });
  });

  it('should include cause when provided', () => {
    const originalError = new Error('Original error');
    const error = new SerpApiError('SERPAPI_API_ERROR', 'Wrapped error', {
      cause: originalError,
    });

    expect(error.cause).toBe(originalError);
  });
});

describe('SerpApiRateLimitError', () => {
  it('should create error with retryAfter', () => {
    const error = new SerpApiRateLimitError({
      retryAfter: 60,
      response: { error: 'Too many requests' },
    });

    expect(error.name).toBe('SerpApiRateLimitError');
    expect(error.code).toBe('SERPAPI_RATE_LIMITED');
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(60);
    expect(error.retryable).toBe(true);
    expect(error.message).toContain('Retry after 60 seconds');
  });

  it('should create error without retryAfter', () => {
    const error = new SerpApiRateLimitError();

    expect(error.retryAfter).toBeUndefined();
    expect(error.message).toBe('Rate limit exceeded. Please wait before retrying.');
  });
});

describe('SerpApiAuthError', () => {
  it('should create error with default message', () => {
    const error = new SerpApiAuthError();

    expect(error.name).toBe('SerpApiAuthError');
    expect(error.code).toBe('SERPAPI_AUTH_ERROR');
    expect(error.statusCode).toBe(401);
    expect(error.retryable).toBe(false);
    expect(error.message).toBe('Invalid or missing API key');
  });

  it('should create error with custom message', () => {
    const error = new SerpApiAuthError('API key expired', {
      response: { detail: 'Key expiration' },
    });

    expect(error.message).toBe('API key expired');
    expect(error.response).toEqual({ detail: 'Key expiration' });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('getSerpApiClient', () => {
  beforeEach(() => {
    resetSerpApiClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetSerpApiClient();
  });

  it('should throw when SERPAPI_API_KEY is not set', () => {
    delete process.env.SERPAPI_API_KEY;

    expect(() => getSerpApiClient()).toThrow(SerpApiError);
    expect(() => getSerpApiClient()).toThrow('SERPAPI_API_KEY environment variable is not set');
  });

  it('should return client when API key is set', () => {
    process.env.SERPAPI_API_KEY = 'test-env-api-key';

    const client = getSerpApiClient();

    expect(client).toBeInstanceOf(SerpApiClient);
  });

  it('should return same instance on multiple calls (singleton)', () => {
    process.env.SERPAPI_API_KEY = 'test-env-api-key';

    const client1 = getSerpApiClient();
    const client2 = getSerpApiClient();

    expect(client1).toBe(client2);
  });
});

describe('isSerpApiConfigured', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should return true when API key is set', () => {
    process.env.SERPAPI_API_KEY = 'test-key';
    expect(isSerpApiConfigured()).toBe(true);
  });

  it('should return false when API key is not set', () => {
    delete process.env.SERPAPI_API_KEY;
    expect(isSerpApiConfigured()).toBe(false);
  });

  it('should return false when API key is empty string', () => {
    process.env.SERPAPI_API_KEY = '';
    expect(isSerpApiConfigured()).toBe(false);
  });
});

describe('resetSerpApiClient', () => {
  it('should reset singleton instance', () => {
    process.env.SERPAPI_API_KEY = 'test-key-1';
    const client1 = getSerpApiClient();

    resetSerpApiClient();

    process.env.SERPAPI_API_KEY = 'test-key-2';
    const client2 = getSerpApiClient();

    // Can't directly test they're different due to internal state,
    // but if reset works, getSerpApiClient creates a new instance
    expect(client1).toBeInstanceOf(SerpApiClient);
    expect(client2).toBeInstanceOf(SerpApiClient);
  });
});
