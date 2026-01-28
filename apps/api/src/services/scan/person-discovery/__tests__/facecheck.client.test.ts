/**
 * FaceCheck.id Client Unit Tests
 *
 * Comprehensive tests for the FaceCheck.id HTTP client covering:
 * - Constructor (config, no config, no API key warning)
 * - uploadImage (success, auth error, non-401 error, "no face", missing id_search, FormData, retry)
 * - searchWithPolling (immediate result, polling, timeout, cancellation, auth/credit errors,
 *   deletePic always called, progress callback, URL normalization, base64 excluded, demo mode)
 * - getInfo (success, auth error, error response, health status)
 * - deletePic (success, failure doesn't throw, logs on error)
 * - fetchWithRetry (no retry on 400/401, retry on 429/500, max retries, network errors, cancel)
 * - Singleton functions (getFaceCheckClient, isFaceCheckConfigured, resetFaceCheckClient)
 * - Error classes (FaceCheckError, AuthError, UploadError, CreditError, TimeoutError, CancelledError)
 *
 * SECURITY TESTS:
 * - deletePic is always called after searchWithPolling (even on error)
 * - base64 data is never included in normalized matches
 * - API key is masked in logs
 * - Invalid URLs are filtered out in normalizeMatches
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  FaceCheckClient,
  FaceCheckError,
  FaceCheckAuthError,
  FaceCheckUploadError,
  FaceCheckCreditError,
  FaceCheckTimeoutError,
  FaceCheckCancelledError,
  getFaceCheckClient,
  isFaceCheckConfigured,
  resetFaceCheckClient,
} from '../facecheck.client';
import { FaceCheckErrorCode } from '../facecheck.types';
import type { FaceCheckConfig } from '@/config/facecheck.config';

// ============================================================================
// Mocks
// ============================================================================

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock console to suppress log output during tests and enable assertions
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock the config module
vi.mock('@/config/facecheck.config', () => ({
  getFaceCheckConfig: vi.fn(),
  isFaceCheckEnabled: vi.fn(),
}));

import { getFaceCheckConfig, isFaceCheckEnabled } from '@/config/facecheck.config';
const mockGetFaceCheckConfig = getFaceCheckConfig as Mock;
const mockIsFaceCheckEnabled = isFaceCheckEnabled as Mock;

// Store original env
const originalEnv = { ...process.env };

// ============================================================================
// Test Helpers
// ============================================================================

function createDefaultConfig(overrides?: Partial<FaceCheckConfig>): FaceCheckConfig {
  return {
    engine: 'facecheck',
    apiKey: 'test-facecheck-api-key-abcd1234',
    minScoreThreshold: 70,
    demoMode: false,
    apiBaseUrl: 'https://facecheck.id',
    pollIntervalMs: 100,
    maxPollTimeMs: 5000,
    ...overrides,
  };
}

function createMockResponse(options: {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
}): Response {
  return {
    ok: options.ok,
    status: options.status,
    json: options.json ?? (async () => ({})),
  } as unknown as Response;
}

function createSuccessUploadResponse(idSearch: string = 'search-id-abc123') {
  return createMockResponse({
    ok: true,
    status: 200,
    json: async () => ({ id_search: idSearch }),
  });
}

function createSearchNotReadyResponse(message?: string) {
  return createMockResponse({
    ok: true,
    status: 200,
    json: async () => ({
      message: message ?? 'Searching...',
      progress: '50%',
    }),
  });
}

function createSearchReadyResponse(matches?: Array<Record<string, unknown>>) {
  return createMockResponse({
    ok: true,
    status: 200,
    json: async () => ({
      output: matches ?? [
        {
          score: 95,
          url: 'https://example.com/found-face',
          base64: 'data:image/jpeg;base64,AAAA',
          guid: 'match-guid-1',
          group: 1,
          image_url: 'https://example.com/face-image.jpg',
        },
        {
          score: 80,
          url: 'https://other-site.org/profile',
          guid: 'match-guid-2',
          group: 2,
        },
      ],
    }),
  });
}

// A response for deletePic (always called in finally)
function createDeleteSuccessResponse() {
  return createMockResponse({
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('FaceCheckClient', () => {
  let client: FaceCheckClient;
  let config: FaceCheckConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = createDefaultConfig();
    mockGetFaceCheckConfig.mockReturnValue(config);
    mockIsFaceCheckEnabled.mockReturnValue(true);
    client = new FaceCheckClient(config);
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
    resetFaceCheckClient();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================
  describe('constructor', () => {
    it('should initialize with provided config and log masked API key', () => {
      const logCalls = consoleLogSpy.mock.calls;
      const initLog = logCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('[FaceCheckClient] Initialized'),
      );

      expect(initLog).toBeDefined();
      expect(initLog?.[0]).toContain('****1234');
      expect(initLog?.[0]).not.toContain('test-facecheck-api-key-abcd1234');
    });

    it('should use getFaceCheckConfig when no config is provided', () => {
      const defaultConfig = createDefaultConfig({ apiKey: 'from-env-key-5678' });
      mockGetFaceCheckConfig.mockReturnValue(defaultConfig);

      const defaultClient = new FaceCheckClient();

      expect(mockGetFaceCheckConfig).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls;
      const initLog = logCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('****5678'),
      );
      expect(initLog).toBeDefined();
    });

    it('should warn when no API key is configured', () => {
      const noKeyConfig = createDefaultConfig({ apiKey: undefined });
      new FaceCheckClient(noKeyConfig);

      const warnCalls = consoleWarnSpy.mock.calls;
      const noKeyWarn = warnCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('No API key configured'),
      );
      expect(noKeyWarn).toBeDefined();
    });
  });

  // ==========================================================================
  // uploadImage Tests
  // ==========================================================================
  describe('uploadImage', () => {
    it('should upload successfully and return idSearch', async () => {
      mockFetch.mockResolvedValue(createSuccessUploadResponse('search-abc'));

      const result = await client.uploadImage(Buffer.from('fakepng'), 'image/png');

      expect(result).toEqual({ idSearch: 'search-abc' });
    });

    it('should POST to /api/upload_pic with FormData and apikey header', async () => {
      mockFetch.mockResolvedValue(createSuccessUploadResponse());

      await client.uploadImage(Buffer.from('fakejpeg'), 'image/jpeg');

      expect(mockFetch).toHaveBeenCalled();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://facecheck.id/api/upload_pic');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('test-facecheck-api-key-abcd1234');
      expect(init.body).toBeInstanceOf(FormData);
    });

    it('should construct FormData with correct file name based on mime type', async () => {
      mockFetch.mockResolvedValue(createSuccessUploadResponse());

      await client.uploadImage(Buffer.from('fakepng'), 'image/png');

      const [, init] = mockFetch.mock.calls[0];
      const formData = init.body as FormData;
      const imagesEntry = formData.get('images');
      expect(imagesEntry).toBeTruthy();
      // FormData wraps it as a File/Blob — check the name
      if (imagesEntry && typeof imagesEntry === 'object' && 'name' in imagesEntry) {
        expect((imagesEntry as File).name).toBe('face.png');
      }
    });

    it('should throw FaceCheckAuthError on 401 response', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 401 }),
      );

      await expect(client.uploadImage(Buffer.from('img'), 'image/jpeg'))
        .rejects.toBeInstanceOf(FaceCheckAuthError);
    });

    it('should throw FaceCheckUploadError on non-401 error response', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 500 }),
      );

      let caughtError: unknown;
      const promise = client.uploadImage(Buffer.from('img'), 'image/jpeg').catch((err) => {
        caughtError = err;
      });

      // Advance timers to exhaust all retries (exponential backoff: ~1s, ~2s, ~4s)
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      await promise;
      expect(caughtError).toBeInstanceOf(FaceCheckUploadError);

      vi.useRealTimers();
    });

    it('should throw FaceCheckError with NO_FACE_DETECTED when response contains "no face"', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ id_search: '', error: 'No face detected in image' }),
        }),
      );

      try {
        await client.uploadImage(Buffer.from('img'), 'image/jpeg');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(FaceCheckError);
        expect((err as FaceCheckError).code).toBe(FaceCheckErrorCode.NO_FACE_DETECTED);
      }
    });

    it('should throw FaceCheckUploadError on generic error in response body', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ id_search: '', error: 'Something went wrong' }),
        }),
      );

      await expect(client.uploadImage(Buffer.from('img'), 'image/jpeg'))
        .rejects.toBeInstanceOf(FaceCheckUploadError);
    });

    it('should throw FaceCheckError with INVALID_RESPONSE when id_search is missing', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ id_search: '' }),
        }),
      );

      try {
        await client.uploadImage(Buffer.from('img'), 'image/jpeg');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(FaceCheckError);
        expect((err as FaceCheckError).code).toBe(FaceCheckErrorCode.INVALID_RESPONSE);
      }
    });
  });

  // ==========================================================================
  // searchWithPolling Tests
  // ==========================================================================
  describe('searchWithPolling', () => {
    // For polling tests we need to handle the sleep() + polling loop.
    // We use real timers but with very short intervals to keep tests fast.

    it('should return results immediately when output is available on first poll', async () => {
      // First call: search endpoint returns results; Second call: deletePic
      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse())
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      const result = await client.searchWithPolling('search-id-123', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      expect(result.matches).toHaveLength(2);
      expect(result.idSearch).toBe('search-id-123');
      expect(result.totalFound).toBe(2);
      expect(result.demoMode).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should poll multiple times before getting results', async () => {
      mockFetch
        .mockResolvedValueOnce(createSearchNotReadyResponse('Processing...'))
        .mockResolvedValueOnce(createSearchNotReadyResponse('Analyzing faces...'))
        .mockResolvedValueOnce(createSearchReadyResponse())
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      const result = await client.searchWithPolling('search-id-123', {
        intervalMs: 10,
        maxTimeMs: 10000,
      });

      expect(result.matches).toHaveLength(2);
      // 3 search calls + 1 delete call
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should throw FaceCheckTimeoutError when maxTimeMs is exceeded', async () => {
      // Always return "not ready" so it times out
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/api/delete_pic')) {
          return createDeleteSuccessResponse();
        }
        return createSearchNotReadyResponse();
      });

      await expect(
        client.searchWithPolling('search-id-123', {
          intervalMs: 5,
          maxTimeMs: 50,
        }),
      ).rejects.toBeInstanceOf(FaceCheckTimeoutError);
    });

    it('should throw FaceCheckCancelledError when AbortSignal is aborted', async () => {
      const controller = new AbortController();

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/api/delete_pic')) {
          return createDeleteSuccessResponse();
        }
        // Abort after the first poll
        controller.abort();
        return createSearchNotReadyResponse();
      });

      await expect(
        client.searchWithPolling('search-id-123', {
          intervalMs: 10,
          maxTimeMs: 10000,
          signal: controller.signal,
        }),
      ).rejects.toBeInstanceOf(FaceCheckCancelledError);
    });

    it('should throw FaceCheckAuthError on 401 during search', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/api/delete_pic')) {
          return createDeleteSuccessResponse();
        }
        return createMockResponse({ ok: false, status: 401 });
      });

      await expect(
        client.searchWithPolling('search-id-123', {
          intervalMs: 10,
          maxTimeMs: 5000,
        }),
      ).rejects.toBeInstanceOf(FaceCheckAuthError);
    });

    it('should throw FaceCheckCreditError on 402 during search', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/api/delete_pic')) {
          return createDeleteSuccessResponse();
        }
        return createMockResponse({ ok: false, status: 402 });
      });

      await expect(
        client.searchWithPolling('search-id-123', {
          intervalMs: 10,
          maxTimeMs: 5000,
        }),
      ).rejects.toBeInstanceOf(FaceCheckCreditError);
    });

    it('should throw FaceCheckError on generic API error in response body', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/api/delete_pic')) {
          return createDeleteSuccessResponse();
        }
        return createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ error: 'Internal processing failure' }),
        });
      });

      await expect(
        client.searchWithPolling('search-id-123', {
          intervalMs: 10,
          maxTimeMs: 5000,
        }),
      ).rejects.toMatchObject({
        code: FaceCheckErrorCode.API_ERROR,
      });
    });

    it('should throw FaceCheckCreditError when response body error mentions credits', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/api/delete_pic')) {
          return createDeleteSuccessResponse();
        }
        return createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ error: 'Insufficient credit balance' }),
        });
      });

      await expect(
        client.searchWithPolling('search-id-123', {
          intervalMs: 10,
          maxTimeMs: 5000,
        }),
      ).rejects.toBeInstanceOf(FaceCheckCreditError);
    });

    it('should ALWAYS call deletePic after successful search', async () => {
      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse())
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      await client.searchWithPolling('search-id-success');

      // The last call should be to delete_pic
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(lastCall[0]).toBe('https://facecheck.id/api/delete_pic');
      const body = JSON.parse(lastCall[1].body);
      expect(body.id_search).toBe('search-id-success');
    });

    it('should ALWAYS call deletePic even when search throws an error', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/api/delete_pic')) {
          return createDeleteSuccessResponse();
        }
        return createMockResponse({ ok: false, status: 401 });
      });

      try {
        await client.searchWithPolling('search-id-error', {
          intervalMs: 10,
          maxTimeMs: 5000,
        });
      } catch {
        // expected
      }

      const deleteCalls = mockFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('/api/delete_pic'),
      );
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
      const body = JSON.parse(deleteCalls[0][1].body);
      expect(body.id_search).toBe('search-id-error');
    });

    it('should invoke onProgress callback on each poll iteration', async () => {
      const onProgress = vi.fn();

      mockFetch
        .mockResolvedValueOnce(createSearchNotReadyResponse('Processing...'))
        .mockResolvedValueOnce(createSearchReadyResponse())
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      await client.searchWithPolling('search-id-123', {
        intervalMs: 10,
        maxTimeMs: 10000,
        onProgress,
      });

      // Should have been called for the "polling" state and the "completed" state
      expect(onProgress).toHaveBeenCalled();

      const progressCalls = onProgress.mock.calls.map((c) => c[0]);
      const pollingCall = progressCalls.find((p) => p.status === 'polling');
      const completedCall = progressCalls.find((p) => p.status === 'completed');

      expect(pollingCall).toBeDefined();
      expect(pollingCall.attempt).toBe(1);
      expect(pollingCall.message).toBe('Processing...');

      expect(completedCall).toBeDefined();
      expect(completedCall.attempt).toBe(2);
    });

    it('should send demo mode flag in search request body', async () => {
      const demoConfig = createDefaultConfig({ demoMode: true });
      const demoClient = new FaceCheckClient(demoConfig);

      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse())
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      await demoClient.searchWithPolling('search-id-demo', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      const searchCall = mockFetch.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('/api/search'),
      );
      expect(searchCall).toBeDefined();
      const body = JSON.parse(searchCall[1].body);
      expect(body.demo).toBe(true);
      expect(body.id_search).toBe('search-id-demo');
      expect(body.with_progress).toBe(true);
    });

    // -- URL normalization tests --
    it('should filter out matches with invalid URLs', async () => {
      const matchesWithInvalidUrl = [
        { score: 90, url: 'https://valid.com/page', guid: 'g1' },
        { score: 85, url: 'not-a-valid-url', guid: 'g2' },
        { score: 80, url: 'ftp://invalid-protocol.com/page', guid: 'g3' },
      ];

      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse(matchesWithInvalidUrl))
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      const result = await client.searchWithPolling('search-id-123', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      // Only the first match with https should pass — "not-a-valid-url" fails URL parse,
      // and ftp:// is not http/https so it also fails.
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].sourcePageUrl).toBe('https://valid.com/page');
    });

    it('should extract domains from valid URLs', async () => {
      const matchesWithDomains = [
        { score: 95, url: 'https://www.example.com/some/page' },
        { score: 85, url: 'http://sub.domain.org/path' },
      ];

      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse(matchesWithDomains))
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      const result = await client.searchWithPolling('search-id-123', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].domain).toBe('www.example.com');
      expect(result.matches[1].domain).toBe('sub.domain.org');
    });

    it('should NEVER include base64 data in normalized matches (security requirement)', async () => {
      const matchesWithBase64 = [
        {
          score: 95,
          url: 'https://example.com/page',
          base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',
          guid: 'match-1',
        },
      ];

      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse(matchesWithBase64))
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      const result = await client.searchWithPolling('search-id-123', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      expect(result.matches).toHaveLength(1);
      // Verify base64 is NOT present anywhere in the normalized match
      const match = result.matches[0] as Record<string, unknown>;
      expect(match).not.toHaveProperty('base64');
      expect(JSON.stringify(match)).not.toContain('base64');
    });

    it('should include imageUrl when raw match has a valid image_url', async () => {
      const matchesWithImageUrl = [
        {
          score: 90,
          url: 'https://example.com/page',
          image_url: 'https://cdn.example.com/face.jpg',
        },
      ];

      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse(matchesWithImageUrl))
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      const result = await client.searchWithPolling('search-id-123', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      expect(result.matches[0].imageUrl).toBe('https://cdn.example.com/face.jpg');
    });

    it('should omit imageUrl when raw match has invalid image_url', async () => {
      const matchesWithBadImageUrl = [
        {
          score: 90,
          url: 'https://example.com/page',
          image_url: 'not-a-url',
        },
      ];

      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse(matchesWithBadImageUrl))
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      const result = await client.searchWithPolling('search-id-123', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      expect(result.matches[0].imageUrl).toBeUndefined();
    });
  });

  // ==========================================================================
  // getInfo Tests
  // ==========================================================================
  describe('getInfo', () => {
    it('should return account info on success', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({
            id_search: 'info-id-123',
            credits: 42,
          }),
        }),
      );

      const info = await client.getInfo();

      expect(info).toEqual({
        idSearch: 'info-id-123',
        credits: 42,
        isHealthy: true,
      });
    });

    it('should throw FaceCheckAuthError on 401', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 401 }),
      );

      await expect(client.getInfo()).rejects.toBeInstanceOf(FaceCheckAuthError);
    });

    it('should throw FaceCheckError on non-401 error', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 500 }),
      );

      let caughtError: unknown;
      const promise = client.getInfo().catch((err) => {
        caughtError = err;
      });

      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      await promise;
      expect(caughtError).toBeInstanceOf(FaceCheckError);

      vi.useRealTimers();
    });

    it('should report unhealthy when response contains error', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({
            id_search: 'info-id-456',
            credits: 0,
            error: 'Account suspended',
          }),
        }),
      );

      const info = await client.getInfo();

      expect(info.isHealthy).toBe(false);
      expect(info.credits).toBe(0);
    });
  });

  // ==========================================================================
  // deletePic Tests
  // ==========================================================================
  describe('deletePic', () => {
    it('should call /api/delete_pic with correct body and log success', async () => {
      mockFetch.mockResolvedValue(createDeleteSuccessResponse());

      await client.deletePic('delete-search-id');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://facecheck.id/api/delete_pic');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('test-facecheck-api-key-abcd1234');
      const body = JSON.parse(init.body);
      expect(body.id_search).toBe('delete-search-id');

      const logCalls = consoleLogSpy.mock.calls;
      const deleteLog = logCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Deleted uploaded image'),
      );
      expect(deleteLog).toBeDefined();
    });

    it('should NOT throw when fetch fails (best-effort cleanup)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Should resolve without throwing
      await expect(client.deletePic('delete-search-id')).resolves.toBeUndefined();
    });

    it('should log a warning when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      await client.deletePic('delete-search-id');

      const warnCalls = consoleWarnSpy.mock.calls;
      const failWarn = warnCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Failed to delete image'),
      );
      expect(failWarn).toBeDefined();
      expect(failWarn?.[0]).toContain('Network timeout');
    });
  });

  // ==========================================================================
  // fetchWithRetry Tests
  // ==========================================================================
  describe('fetchWithRetry (via uploadImage as proxy)', () => {
    // fetchWithRetry is private, so we test it indirectly through uploadImage
    // which calls fetchWithRetry for the upload request.

    it('should NOT retry on 400 (client error)', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 400 }),
      );

      // 400 is a non-401 failure, so uploadImage throws UploadError
      await expect(client.uploadImage(Buffer.from('img'), 'image/jpeg'))
        .rejects.toBeInstanceOf(FaceCheckUploadError);

      // Should be called only once — no retry on 400
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 401 (auth error)', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 401 }),
      );

      await expect(client.uploadImage(Buffer.from('img'), 'image/jpeg'))
        .rejects.toBeInstanceOf(FaceCheckAuthError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 (rate limited) and eventually succeed', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 429 }))
        .mockResolvedValueOnce(createSuccessUploadResponse('after-retry'));

      const promise = client.uploadImage(Buffer.from('img'), 'image/jpeg');

      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      const result = await promise;
      expect(result.idSearch).toBe('after-retry');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should retry on 500 (server error) and eventually succeed', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 500 }))
        .mockResolvedValueOnce(createSuccessUploadResponse('recovered'));

      const promise = client.uploadImage(Buffer.from('img'), 'image/jpeg');

      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      const result = await promise;
      expect(result.idSearch).toBe('recovered');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should throw after max retries are exhausted on persistent 500', async () => {
      vi.useFakeTimers();

      // FACECHECK_DEFAULTS.MAX_RETRIES is 3, meaning 4 total attempts (0..3)
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 500 }),
      );

      let caughtError: unknown;
      // fetchWithRetry will eventually return the 500 response after maxRetries.
      // uploadImage sees the non-ok response and throws FaceCheckUploadError.
      const promise = client.uploadImage(Buffer.from('img'), 'image/jpeg').catch((err) => {
        caughtError = err;
      });

      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      await promise;
      expect(caughtError).toBeInstanceOf(FaceCheckUploadError);

      // 1 initial + 3 retries = 4 total attempts
      expect(mockFetch).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });

    it('should retry on network errors (fetch rejection)', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(createSuccessUploadResponse('after-network-retry'));

      const promise = client.uploadImage(Buffer.from('img'), 'image/jpeg');

      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      const result = await promise;
      expect(result.idSearch).toBe('after-network-retry');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should NOT retry on FaceCheckCancelledError during retry sleep', async () => {
      // Simulate: first call returns 500 (triggering retry), but during sleep
      // the error is a cancellation, which should propagate immediately.
      // We test this indirectly: if the fetch itself throws FaceCheckCancelledError,
      // it should bubble up without further retries.
      mockFetch.mockRejectedValue(new FaceCheckCancelledError());

      await expect(client.uploadImage(Buffer.from('img'), 'image/jpeg'))
        .rejects.toBeInstanceOf(FaceCheckCancelledError);

      // Only called once — cancellation is not retried
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw FaceCheckError with retryable=true after all retries exhausted on network errors', async () => {
      vi.useFakeTimers();

      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      let caughtError: unknown;
      const promise = client.uploadImage(Buffer.from('img'), 'image/jpeg').catch((err) => {
        caughtError = err;
      });

      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      await promise;

      // After retries exhausted, fetchWithRetry throws a FaceCheckError
      expect(caughtError).toBeInstanceOf(FaceCheckError);
      expect((caughtError as FaceCheckError).retryable).toBe(true);
      expect((caughtError as FaceCheckError).message).toContain('failed after');

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // URL Normalization (Security)
  // ==========================================================================
  describe('normalizeMatches (via searchWithPolling)', () => {
    it('should accept http and https URLs', async () => {
      const matches = [
        { score: 90, url: 'https://secure.example.com/page' },
        { score: 85, url: 'http://insecure.example.com/page' },
      ];

      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse(matches))
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      const result = await client.searchWithPolling('search-id', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      expect(result.matches).toHaveLength(2);
    });

    it('should reject non-http/https protocols', async () => {
      const matches = [
        { score: 90, url: 'ftp://files.example.com/image.jpg' },
        { score: 85, url: 'javascript:alert(1)' },
        { score: 80, url: 'data:text/html,<h1>test</h1>' },
      ];

      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse(matches))
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      const result = await client.searchWithPolling('search-id', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      expect(result.matches).toHaveLength(0);
    });

    it('should log warning for each skipped invalid URL', async () => {
      const matches = [
        { score: 90, url: 'not-valid' },
      ];

      mockFetch
        .mockResolvedValueOnce(createSearchReadyResponse(matches))
        .mockResolvedValueOnce(createDeleteSuccessResponse());

      await client.searchWithPolling('search-id', {
        intervalMs: 10,
        maxTimeMs: 5000,
      });

      const warnCalls = consoleWarnSpy.mock.calls;
      const skipWarn = warnCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Skipping match with invalid URL'),
      );
      expect(skipWarn).toBeDefined();
    });
  });
});

// =============================================================================
// Error Class Tests
// =============================================================================

describe('FaceCheckError', () => {
  it('should create error with correct properties', () => {
    const error = new FaceCheckError('Test error', FaceCheckErrorCode.API_ERROR, true, 500);

    expect(error.name).toBe('FaceCheckError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(FaceCheckErrorCode.API_ERROR);
    expect(error.retryable).toBe(true);
    expect(error.statusCode).toBe(500);
  });

  it('should default retryable to false', () => {
    const error = new FaceCheckError('Test error', FaceCheckErrorCode.API_ERROR);
    expect(error.retryable).toBe(false);
  });

  it('should be an instance of Error', () => {
    const error = new FaceCheckError('Test', FaceCheckErrorCode.API_ERROR);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('FaceCheckAuthError', () => {
  it('should have correct defaults', () => {
    const error = new FaceCheckAuthError();

    expect(error.name).toBe('FaceCheckAuthError');
    expect(error.code).toBe(FaceCheckErrorCode.AUTH_ERROR);
    expect(error.retryable).toBe(false);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('FaceCheck authentication failed');
  });

  it('should accept custom message', () => {
    const error = new FaceCheckAuthError('Custom auth message');
    expect(error.message).toBe('Custom auth message');
  });

  it('should be an instance of FaceCheckError', () => {
    expect(new FaceCheckAuthError()).toBeInstanceOf(FaceCheckError);
  });
});

describe('FaceCheckUploadError', () => {
  it('should have correct defaults', () => {
    const error = new FaceCheckUploadError();

    expect(error.name).toBe('FaceCheckUploadError');
    expect(error.code).toBe(FaceCheckErrorCode.UPLOAD_ERROR);
    expect(error.retryable).toBe(true);
    expect(error.statusCode).toBeUndefined();
    expect(error.message).toBe('FaceCheck image upload failed');
  });

  it('should accept custom message', () => {
    const error = new FaceCheckUploadError('Upload timed out');
    expect(error.message).toBe('Upload timed out');
  });
});

describe('FaceCheckCreditError', () => {
  it('should have correct defaults', () => {
    const error = new FaceCheckCreditError();

    expect(error.name).toBe('FaceCheckCreditError');
    expect(error.code).toBe(FaceCheckErrorCode.CREDIT_ERROR);
    expect(error.retryable).toBe(false);
    expect(error.message).toBe('Insufficient FaceCheck credits');
  });
});

describe('FaceCheckTimeoutError', () => {
  it('should have correct defaults', () => {
    const error = new FaceCheckTimeoutError();

    expect(error.name).toBe('FaceCheckTimeoutError');
    expect(error.code).toBe(FaceCheckErrorCode.TIMEOUT);
    expect(error.retryable).toBe(true);
    expect(error.message).toBe('FaceCheck search timed out');
  });
});

describe('FaceCheckCancelledError', () => {
  it('should have correct defaults', () => {
    const error = new FaceCheckCancelledError();

    expect(error.name).toBe('FaceCheckCancelledError');
    expect(error.code).toBe(FaceCheckErrorCode.CANCELLED);
    expect(error.retryable).toBe(false);
    expect(error.message).toBe('FaceCheck search was cancelled');
  });
});

// =============================================================================
// Singleton Function Tests
// =============================================================================

describe('getFaceCheckClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFaceCheckClient();
  });

  afterEach(() => {
    resetFaceCheckClient();
  });

  it('should return null when FaceCheck is not enabled', () => {
    (isFaceCheckEnabled as Mock).mockReturnValue(false);

    const client = getFaceCheckClient();
    expect(client).toBeNull();
  });

  it('should return a FaceCheckClient instance when enabled', () => {
    (isFaceCheckEnabled as Mock).mockReturnValue(true);
    (getFaceCheckConfig as Mock).mockReturnValue(
      createDefaultConfig(),
    );

    const client = getFaceCheckClient();
    expect(client).toBeInstanceOf(FaceCheckClient);
  });

  it('should return the same singleton instance on subsequent calls', () => {
    (isFaceCheckEnabled as Mock).mockReturnValue(true);
    (getFaceCheckConfig as Mock).mockReturnValue(
      createDefaultConfig(),
    );

    const client1 = getFaceCheckClient();
    const client2 = getFaceCheckClient();

    expect(client1).toBe(client2);
  });
});

describe('isFaceCheckConfigured', () => {
  it('should return true when isFaceCheckEnabled returns true', () => {
    (isFaceCheckEnabled as Mock).mockReturnValue(true);
    expect(isFaceCheckConfigured()).toBe(true);
  });

  it('should return false when isFaceCheckEnabled returns false', () => {
    (isFaceCheckEnabled as Mock).mockReturnValue(false);
    expect(isFaceCheckConfigured()).toBe(false);
  });
});

describe('resetFaceCheckClient', () => {
  it('should clear the singleton so a new instance is created next time', () => {
    (isFaceCheckEnabled as Mock).mockReturnValue(true);
    (getFaceCheckConfig as Mock).mockReturnValue(createDefaultConfig());

    const client1 = getFaceCheckClient();
    resetFaceCheckClient();
    const client2 = getFaceCheckClient();

    // Both are FaceCheckClient instances but they should be different objects
    expect(client1).toBeInstanceOf(FaceCheckClient);
    expect(client2).toBeInstanceOf(FaceCheckClient);
    expect(client1).not.toBe(client2);
  });
});
