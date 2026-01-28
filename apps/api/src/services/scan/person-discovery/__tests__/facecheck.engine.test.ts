/**
 * FaceCheck.id Person Discovery Engine Unit Tests
 *
 * Comprehensive tests for the FaceCheck.id face recognition person discovery engine.
 * Tests cover constructor initialization, upload-based discovery, URL-based discovery,
 * availability checks, match-to-candidate mapping, and singleton management.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  FaceCheckPersonDiscoveryEngine,
  getFaceCheckPersonDiscoveryEngine,
  isFaceCheckEngineEnabled,
  resetFaceCheckEngine,
} from '../facecheck.engine';
import type { FaceCheckClient } from '../facecheck.client';
import type {
  FaceCheckMatch,
  FaceCheckSearchResult,
  FaceCheckUploadResult,
  FaceCheckInfo,
} from '../facecheck.types';
import type { FaceCheckConfig } from '@/config/facecheck.config';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../facecheck.client', () => ({
  FaceCheckClient: vi.fn(),
}));

vi.mock('@/config/facecheck.config', () => ({
  getFaceCheckConfig: vi.fn(() => ({
    engine: 'facecheck' as const,
    apiKey: 'test-key-1234',
    minScoreThreshold: 70,
    demoMode: true,
    apiBaseUrl: 'https://facecheck.id',
    pollIntervalMs: 100,
    maxPollTimeMs: 5000,
  })),
  isFaceCheckEnabled: vi.fn(() => true),
}));

// Suppress console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ============================================================================
// Test Helpers
// ============================================================================

const mockConfig: FaceCheckConfig = {
  engine: 'facecheck' as const,
  apiKey: 'test-key-1234',
  minScoreThreshold: 70,
  demoMode: true,
  apiBaseUrl: 'https://facecheck.id',
  pollIntervalMs: 100,
  maxPollTimeMs: 5000,
};

function createMockClient(): {
  uploadImage: Mock;
  searchWithPolling: Mock;
  getInfo: Mock;
  deletePic: Mock;
} {
  return {
    uploadImage: vi.fn(),
    searchWithPolling: vi.fn(),
    getInfo: vi.fn(),
    deletePic: vi.fn(),
  };
}

function createFaceCheckMatch(overrides?: Partial<FaceCheckMatch>): FaceCheckMatch {
  return {
    score: 85,
    sourcePageUrl: 'https://example.com/profile',
    domain: 'example.com',
    guid: 'match-guid-123',
    group: 1,
    imageUrl: 'https://cdn.example.com/photo.jpg',
    ...overrides,
  };
}

function createSearchResult(
  matches: FaceCheckMatch[],
  overrides?: Partial<FaceCheckSearchResult>,
): FaceCheckSearchResult {
  return {
    matches,
    idSearch: 'search-abc-123',
    totalFound: matches.length,
    durationMs: 1500,
    demoMode: true,
    ...overrides,
  };
}

function createUploadResult(overrides?: Partial<FaceCheckUploadResult>): FaceCheckUploadResult {
  return {
    idSearch: 'search-abc-123',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('FaceCheckPersonDiscoveryEngine', () => {
  let engine: FaceCheckPersonDiscoveryEngine;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    engine = new FaceCheckPersonDiscoveryEngine(
      mockClient as unknown as FaceCheckClient,
      mockConfig,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetFaceCheckEngine();
  });

  // ===========================================
  // Constructor Tests
  // ===========================================
  describe('Constructor', () => {
    it('has engine name "facecheck"', () => {
      expect(engine.name).toBe('facecheck');
    });

    it('uses injected client and config when provided', async () => {
      // Verify the injected client is used by calling a method
      mockClient.getInfo.mockResolvedValue({ idSearch: '', credits: 10, isHealthy: true });

      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');
      (isFaceCheckEnabled as Mock).mockReturnValue(true);

      await engine.isAvailable();

      expect(mockClient.getInfo).toHaveBeenCalledTimes(1);
    });

    it('falls back to defaults when no client or config is provided', async () => {
      // Import the mocked modules to verify they get called
      const { getFaceCheckConfig } = await import('@/config/facecheck.config');
      const { FaceCheckClient } = await import('../facecheck.client');

      // Create engine without arguments -- should call getFaceCheckConfig and new FaceCheckClient
      const defaultEngine = new FaceCheckPersonDiscoveryEngine();

      expect(getFaceCheckConfig).toHaveBeenCalled();
      expect(FaceCheckClient).toHaveBeenCalled();
      expect(defaultEngine.name).toBe('facecheck');
    });
  });

  // ===========================================
  // discoverByUpload Tests
  // ===========================================
  describe('discoverByUpload', () => {
    const testBuffer = Buffer.from('fake-image-data');
    const testMimeType = 'image/jpeg';

    it('successfully discovers matches above score threshold', async () => {
      const matches = [
        createFaceCheckMatch({ score: 90, sourcePageUrl: 'https://site-a.com/profile' }),
        createFaceCheckMatch({ score: 80, sourcePageUrl: 'https://site-b.com/photo' }),
      ];

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates).toHaveLength(2);
      expect(result.totalFound).toBe(2);
      expect(result.providersUsed).toEqual(['facecheck']);
    });

    it('filters out matches below minScoreThreshold (70)', async () => {
      const matches = [
        createFaceCheckMatch({ score: 90 }),
        createFaceCheckMatch({ score: 70, sourcePageUrl: 'https://on-threshold.com' }),
        createFaceCheckMatch({ score: 65, sourcePageUrl: 'https://below.com' }),
        createFaceCheckMatch({ score: 30, sourcePageUrl: 'https://way-below.com' }),
      ];

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      // score >= 70 passes: 90 and 70. score 65 and 30 are excluded.
      expect(result.candidates).toHaveLength(2);
      expect(result.totalFound).toBe(2);

      const scores = result.candidates.map((c) => c.score);
      expect(scores).toContain(90);
      expect(scores).toContain(70);
      expect(scores).not.toContain(65);
      expect(scores).not.toContain(30);
    });

    it('respects maxCandidates option and truncates results', async () => {
      const matches = Array.from({ length: 10 }, (_, i) =>
        createFaceCheckMatch({
          score: 95 - i,
          sourcePageUrl: `https://site-${i}.com`,
          guid: `guid-${i}`,
        }),
      );

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByUpload(testBuffer, testMimeType, {
        maxCandidates: 3,
      });

      expect(result.candidates).toHaveLength(3);
      expect(result.truncated).toBe(true);
    });

    it('defaults maxCandidates to 20 when not specified', async () => {
      const matches = Array.from({ length: 25 }, (_, i) =>
        createFaceCheckMatch({
          score: 95 - i * 0.5,
          sourcePageUrl: `https://site-${i}.com`,
          guid: `guid-${i}`,
        }),
      );

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates).toHaveLength(20);
      expect(result.truncated).toBe(true);
    });

    it('returns empty candidates array when no matches', async () => {
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates).toEqual([]);
      expect(result.totalFound).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('returns empty candidates when all matches are below threshold', async () => {
      const matches = [
        createFaceCheckMatch({ score: 50 }),
        createFaceCheckMatch({ score: 40, sourcePageUrl: 'https://low.com' }),
      ];

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates).toEqual([]);
      expect(result.totalFound).toBe(0);
    });

    it('always returns providersUsed as ["facecheck"]', async () => {
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.providersUsed).toEqual(['facecheck']);
    });

    it('sets truncated to true when filtered matches exceed maxCandidates', async () => {
      const matches = Array.from({ length: 5 }, (_, i) =>
        createFaceCheckMatch({
          score: 90 - i,
          sourcePageUrl: `https://site-${i}.com`,
          guid: `guid-${i}`,
        }),
      );

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByUpload(testBuffer, testMimeType, {
        maxCandidates: 2,
      });

      expect(result.truncated).toBe(true);
      expect(result.candidates).toHaveLength(2);
    });

    it('sets truncated to false when results fit within maxCandidates', async () => {
      const matches = [
        createFaceCheckMatch({ score: 90 }),
        createFaceCheckMatch({ score: 80, sourcePageUrl: 'https://another.com' }),
      ];

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByUpload(testBuffer, testMimeType, {
        maxCandidates: 10,
      });

      expect(result.truncated).toBe(false);
    });

    it('always sets cacheHit to false', async () => {
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(
        createSearchResult([createFaceCheckMatch()]),
      );

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.cacheHit).toBe(false);
    });

    it('measures and reports durationMs', async () => {
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns empty result on upload error (does not throw)', async () => {
      mockClient.uploadImage.mockRejectedValue(new Error('Upload failed: network error'));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates).toEqual([]);
      expect(result.totalFound).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.cacheHit).toBe(false);
      expect(result.providersUsed).toEqual(['facecheck']);
      expect(typeof result.durationMs).toBe('number');
    });

    it('returns empty result on search/polling error (does not throw)', async () => {
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockRejectedValue(new Error('Search timed out'));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates).toEqual([]);
      expect(result.totalFound).toBe(0);
      expect(result.providersUsed).toEqual(['facecheck']);
    });

    it('returns empty result on non-Error throw (does not throw)', async () => {
      mockClient.uploadImage.mockRejectedValue('string error');

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates).toEqual([]);
      expect(result.totalFound).toBe(0);
    });

    it('passes options.timeout to polling as maxTimeMs', async () => {
      const matches = [createFaceCheckMatch()];
      mockClient.uploadImage.mockResolvedValue(createUploadResult({ idSearch: 'test-id' }));
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      await engine.discoverByUpload(testBuffer, testMimeType, { timeout: 60000 });

      expect(mockClient.searchWithPolling).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          maxTimeMs: 60000,
          intervalMs: mockConfig.pollIntervalMs,
        }),
      );
    });

    it('uses config maxPollTimeMs when options.timeout is not provided', async () => {
      mockClient.uploadImage.mockResolvedValue(createUploadResult({ idSearch: 'test-id' }));
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([]));

      await engine.discoverByUpload(testBuffer, testMimeType);

      expect(mockClient.searchWithPolling).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          maxTimeMs: mockConfig.maxPollTimeMs,
          intervalMs: mockConfig.pollIntervalMs,
        }),
      );
    });

    it('passes the uploaded idSearch to searchWithPolling', async () => {
      mockClient.uploadImage.mockResolvedValue(createUploadResult({ idSearch: 'my-upload-id' }));
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([]));

      await engine.discoverByUpload(testBuffer, testMimeType);

      expect(mockClient.searchWithPolling).toHaveBeenCalledWith(
        'my-upload-id',
        expect.any(Object),
      );
    });
  });

  // ===========================================
  // mapMatchToCandidate Tests (via discoverByUpload)
  // ===========================================
  describe('mapMatchToCandidate (via discoverByUpload)', () => {
    const testBuffer = Buffer.from('fake-image-data');
    const testMimeType = 'image/jpeg';

    it('maps candidateImageUrl from match.imageUrl', async () => {
      const match = createFaceCheckMatch({
        imageUrl: 'https://cdn.example.com/face-photo.jpg',
      });
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([match]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates[0].candidateImageUrl).toBe('https://cdn.example.com/face-photo.jpg');
    });

    it('sets candidateImageUrl to null when match.imageUrl is undefined', async () => {
      const match = createFaceCheckMatch({ imageUrl: undefined });
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([match]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates[0].candidateImageUrl).toBeNull();
    });

    it('maps sourcePageUrl from match.sourcePageUrl', async () => {
      const match = createFaceCheckMatch({ sourcePageUrl: 'https://social.com/user/photos' });
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([match]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates[0].sourcePageUrl).toBe('https://social.com/user/photos');
    });

    it('sets engine to "facecheck"', async () => {
      const match = createFaceCheckMatch();
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([match]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates[0].engine).toBe('facecheck');
    });

    it('sets score from match.score', async () => {
      const match = createFaceCheckMatch({ score: 92 });
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([match]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates[0].score).toBe(92);
    });

    it('sets rank as 1-indexed position in filtered results', async () => {
      const matches = [
        createFaceCheckMatch({ score: 95, sourcePageUrl: 'https://first.com' }),
        createFaceCheckMatch({ score: 85, sourcePageUrl: 'https://second.com' }),
        createFaceCheckMatch({ score: 75, sourcePageUrl: 'https://third.com' }),
      ];
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates[0].rank).toBe(1);
      expect(result.candidates[1].rank).toBe(2);
      expect(result.candidates[2].rank).toBe(3);
    });

    it('includes score, guid, group, and domain in raw field', async () => {
      const match = createFaceCheckMatch({
        score: 88,
        guid: 'unique-guid-456',
        group: 3,
        domain: 'social-site.com',
      });
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([match]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      expect(result.candidates[0].raw).toEqual({
        score: 88,
        guid: 'unique-guid-456',
        group: 3,
        domain: 'social-site.com',
      });
    });

    it('sets title, snippet, thumbnailUrl, and dimensions to null', async () => {
      const match = createFaceCheckMatch();
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([match]));

      const result = await engine.discoverByUpload(testBuffer, testMimeType);

      const candidate = result.candidates[0];
      expect(candidate.title).toBeNull();
      expect(candidate.snippet).toBeNull();
      expect(candidate.thumbnailUrl).toBeNull();
      expect(candidate.dimensions).toBeNull();
    });
  });

  // ===========================================
  // discoverByImageUrl Tests
  // ===========================================
  describe('discoverByImageUrl', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      // Reset fetch mock before each test in this describe block
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('successfully downloads image and delegates to discoverByUpload', async () => {
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: vi.fn().mockResolvedValue(imageData.buffer),
      };
      (globalThis.fetch as Mock).mockResolvedValue(mockResponse);

      const matches = [createFaceCheckMatch({ score: 92 })];
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByImageUrl('https://images.example.com/photo.png');

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].score).toBe(92);
      expect(mockClient.uploadImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        'image/png',
      );
    });

    it('sends User-Agent header "Vara-Safety-Scanner/1.0"', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      };
      (globalThis.fetch as Mock).mockResolvedValue(mockResponse);

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([]));

      await engine.discoverByImageUrl('https://example.com/photo.jpg');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.com/photo.jpg',
        expect.objectContaining({
          headers: { 'User-Agent': 'Vara-Safety-Scanner/1.0' },
        }),
      );
    });

    it('returns empty result on non-200 HTTP response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        headers: new Headers(),
      };
      (globalThis.fetch as Mock).mockResolvedValue(mockResponse);

      const result = await engine.discoverByImageUrl('https://example.com/missing.jpg');

      expect(result.candidates).toEqual([]);
      expect(result.totalFound).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.cacheHit).toBe(false);
      expect(result.durationMs).toBe(0);
      expect(result.providersUsed).toEqual(['facecheck']);
    });

    it('returns empty result on network/fetch error', async () => {
      (globalThis.fetch as Mock).mockRejectedValue(new TypeError('fetch failed'));

      const result = await engine.discoverByImageUrl('https://example.com/photo.jpg');

      expect(result.candidates).toEqual([]);
      expect(result.totalFound).toBe(0);
      expect(result.durationMs).toBe(0);
      expect(result.providersUsed).toEqual(['facecheck']);
    });

    it('handles abort timeout (30s)', async () => {
      // Simulate an AbortError as would happen if setTimeout fires
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      (globalThis.fetch as Mock).mockRejectedValue(abortError);

      const result = await engine.discoverByImageUrl('https://slow.example.com/photo.jpg');

      expect(result.candidates).toEqual([]);
      expect(result.totalFound).toBe(0);
      expect(result.durationMs).toBe(0);
    });

    it('passes AbortSignal to fetch call', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      };
      (globalThis.fetch as Mock).mockResolvedValue(mockResponse);

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([]));

      await engine.discoverByImageUrl('https://example.com/photo.jpg');

      const fetchCall = (globalThis.fetch as Mock).mock.calls[0];
      expect(fetchCall[1]).toHaveProperty('signal');
      expect(fetchCall[1].signal).toBeInstanceOf(AbortSignal);
    });

    it('passes content-type from response to discoverByUpload', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/webp' }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
      };
      (globalThis.fetch as Mock).mockResolvedValue(mockResponse);

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([]));

      await engine.discoverByImageUrl('https://example.com/photo.webp');

      expect(mockClient.uploadImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        'image/webp',
      );
    });

    it('defaults content-type to "image/jpeg" when header is missing', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(), // No content-type
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
      };
      (globalThis.fetch as Mock).mockResolvedValue(mockResponse);

      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult([]));

      await engine.discoverByImageUrl('https://example.com/photo');

      expect(mockClient.uploadImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        'image/jpeg',
      );
    });

    it('passes options through to discoverByUpload', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
      };
      (globalThis.fetch as Mock).mockResolvedValue(mockResponse);

      const matches = Array.from({ length: 5 }, (_, i) =>
        createFaceCheckMatch({
          score: 95 - i,
          sourcePageUrl: `https://site-${i}.com`,
          guid: `guid-${i}`,
        }),
      );
      mockClient.uploadImage.mockResolvedValue(createUploadResult());
      mockClient.searchWithPolling.mockResolvedValue(createSearchResult(matches));

      const result = await engine.discoverByImageUrl('https://example.com/photo.jpg', {
        maxCandidates: 2,
      });

      expect(result.candidates).toHaveLength(2);
      expect(result.truncated).toBe(true);
    });
  });

  // ===========================================
  // isAvailable Tests
  // ===========================================
  describe('isAvailable', () => {
    it('returns true when enabled, healthy, and has credits', async () => {
      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');
      (isFaceCheckEnabled as Mock).mockReturnValue(true);

      mockClient.getInfo.mockResolvedValue({
        idSearch: 'info-id',
        credits: 50,
        isHealthy: true,
      } satisfies FaceCheckInfo);

      const result = await engine.isAvailable();

      expect(result).toBe(true);
    });

    it('returns false when not enabled', async () => {
      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');
      (isFaceCheckEnabled as Mock).mockReturnValue(false);

      const result = await engine.isAvailable();

      expect(result).toBe(false);
      // Should not even call getInfo when disabled
      expect(mockClient.getInfo).not.toHaveBeenCalled();
    });

    it('returns false when API reports unhealthy', async () => {
      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');
      (isFaceCheckEnabled as Mock).mockReturnValue(true);

      mockClient.getInfo.mockResolvedValue({
        idSearch: '',
        credits: 100,
        isHealthy: false,
      } satisfies FaceCheckInfo);

      const result = await engine.isAvailable();

      expect(result).toBe(false);
    });

    it('returns false when no credits remain', async () => {
      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');
      (isFaceCheckEnabled as Mock).mockReturnValue(true);

      mockClient.getInfo.mockResolvedValue({
        idSearch: '',
        credits: 0,
        isHealthy: true,
      } satisfies FaceCheckInfo);

      const result = await engine.isAvailable();

      expect(result).toBe(false);
    });

    it('returns false when getInfo throws an error', async () => {
      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');
      (isFaceCheckEnabled as Mock).mockReturnValue(true);

      mockClient.getInfo.mockRejectedValue(new Error('Network timeout'));

      const result = await engine.isAvailable();

      expect(result).toBe(false);
    });
  });

  // ===========================================
  // Singleton Tests
  // ===========================================
  describe('Singletons', () => {
    it('getFaceCheckPersonDiscoveryEngine returns null when disabled', async () => {
      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');
      (isFaceCheckEnabled as Mock).mockReturnValue(false);

      const instance = getFaceCheckPersonDiscoveryEngine();

      expect(instance).toBeNull();
    });

    it('getFaceCheckPersonDiscoveryEngine returns an instance when enabled', async () => {
      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');
      (isFaceCheckEnabled as Mock).mockReturnValue(true);

      const instance = getFaceCheckPersonDiscoveryEngine();

      expect(instance).toBeInstanceOf(FaceCheckPersonDiscoveryEngine);
      expect(instance?.name).toBe('facecheck');
    });

    it('resetFaceCheckEngine clears the cached singleton instance', async () => {
      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');
      (isFaceCheckEnabled as Mock).mockReturnValue(true);

      const instance1 = getFaceCheckPersonDiscoveryEngine();
      resetFaceCheckEngine();
      const instance2 = getFaceCheckPersonDiscoveryEngine();

      // After reset, a new instance should be created (different reference)
      expect(instance1).not.toBe(instance2);
    });

    it('isFaceCheckEngineEnabled delegates to isFaceCheckEnabled', async () => {
      const { isFaceCheckEnabled } = await import('@/config/facecheck.config');

      (isFaceCheckEnabled as Mock).mockReturnValue(true);
      expect(isFaceCheckEngineEnabled()).toBe(true);

      (isFaceCheckEnabled as Mock).mockReturnValue(false);
      expect(isFaceCheckEngineEnabled()).toBe(false);

      expect(isFaceCheckEnabled).toHaveBeenCalled();
    });
  });
});
