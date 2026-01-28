/**
 * Reverse Image Service - FaceCheck Integration Tests
 *
 * Tests the FaceCheck-specific functionality within ReverseImageService.scanWithPersonDiscovery(),
 * including the discovery gate, FaceCheck engine setup, parallel execution with SerpAPI,
 * candidate deduplication, TinEye expansion of FaceCheck candidates, and result structure.
 *
 * Uses Vitest (NOT Jest). All mocks use vi.fn() / vi.mock() / vi.hoisted().
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock objects - vi.hoisted() runs BEFORE vi.mock() factories,
// so these are available when the mock factories execute.
// ---------------------------------------------------------------------------
const {
  mockTinEyeEngine,
  mockSerpApiEngine,
  mockFaceCheckEngine,
  mockIsPersonDiscoveryEnabled,
  mockIsFaceCheckEnabled,
  mockGetPersonDiscoveryConfig,
  mockCreateProxyUrlFromImage,
  mockValidateProxyUrl,
  mockSupabaseFrom,
} = vi.hoisted(() => {
  const mockTinEyeEngine = {
    isConfigured: vi.fn().mockReturnValue(true),
    searchByUrl: vi.fn(),
    searchByUpload: vi.fn(),
    provider: 'tineye' as const,
    displayName: 'TinEye',
  };

  const mockSerpApiEngine = {
    name: 'SerpAPI',
    discoverByImageUrl: vi.fn(),
    discoverByUpload: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  };

  const mockFaceCheckEngine = {
    name: 'FaceCheck',
    discoverByImageUrl: vi.fn(),
    discoverByUpload: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  };

  const mockIsPersonDiscoveryEnabled = vi.fn().mockReturnValue(false);
  const mockIsFaceCheckEnabled = vi.fn().mockReturnValue(false);
  const mockGetPersonDiscoveryConfig = vi.fn().mockReturnValue({
    engine: 'serpapi',
    serpApiKey: 'test-key',
    maxCandidates: 20,
    providerOrder: ['google_lens', 'google_reverse_image', 'bing_reverse_image'],
    maxTineyeExpansions: 10,
    cacheTtl: 86400,
  });

  const mockCreateProxyUrlFromImage = vi.fn().mockReturnValue('https://api.vara.com/proxy/abc123');
  const mockValidateProxyUrl = vi.fn().mockResolvedValue(true);

  const mockSupabaseFrom = vi.fn().mockReturnValue({
    download: vi.fn().mockResolvedValue({
      data: {
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)),
      },
      error: null,
    }),
  });

  return {
    mockTinEyeEngine,
    mockSerpApiEngine,
    mockFaceCheckEngine,
    mockIsPersonDiscoveryEnabled,
    mockIsFaceCheckEnabled,
    mockGetPersonDiscoveryConfig,
    mockCreateProxyUrlFromImage,
    mockValidateProxyUrl,
    mockSupabaseFrom,
  };
});

// ---------------------------------------------------------------------------
// vi.mock() declarations - factories use the hoisted mocks above
// ---------------------------------------------------------------------------

vi.mock('../../scan/engines/tineye.engine', () => ({
  TinEyeEngine: vi.fn().mockImplementation(() => mockTinEyeEngine),
  getTinEyeEngine: vi.fn(() => mockTinEyeEngine),
}));

vi.mock('../../scan/person-discovery', () => ({
  getSerpApiPersonDiscoveryEngine: vi.fn(() => mockSerpApiEngine),
  getFaceCheckPersonDiscoveryEngine: vi.fn(() => mockFaceCheckEngine),
}));

vi.mock('@/config/person-discovery.config', () => ({
  getPersonDiscoveryConfig: (...args: unknown[]) => mockGetPersonDiscoveryConfig(...args),
  isPersonDiscoveryEnabled: (...args: unknown[]) => mockIsPersonDiscoveryEnabled(...args),
}));

vi.mock('@/config/facecheck.config', () => ({
  isFaceCheckEnabled: (...args: unknown[]) => mockIsFaceCheckEnabled(...args),
}));

vi.mock('../../proxy', () => ({
  createProxyUrlFromImage: (...args: unknown[]) => mockCreateProxyUrlFromImage(...args),
  validateProxyUrl: (...args: unknown[]) => mockValidateProxyUrl(...args),
}));

vi.mock('@/config/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: (...args: unknown[]) => mockSupabaseFrom(...args),
    },
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import { ReverseImageService } from '../reverse-image.service';
import type {
  PersonDiscoveryScanResult,
  ExpandedCandidate,
} from '../reverse-image.service';
import type {
  PersonDiscoveryCandidate,
  PersonDiscoveryResult,
} from '../../scan/person-discovery';
import {
  getSerpApiPersonDiscoveryEngine,
  getFaceCheckPersonDiscoveryEngine,
} from '../../scan/person-discovery';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid storage URL that downloadProtectedImage can parse. */
const VALID_STORAGE_URL =
  'https://supabase.co/storage/v1/object/protected-images/user-1/photo.jpg';

const PROTECTED_IMAGE = {
  id: 'img-001',
  storageUrl: VALID_STORAGE_URL,
};

function makeFaceCheckCandidate(
  overrides?: Partial<PersonDiscoveryCandidate>,
): PersonDiscoveryCandidate {
  return {
    candidateImageUrl: 'https://facecheck.id/result/face1.jpg',
    sourcePageUrl: 'https://example.com/profile',
    title: 'FC Profile Match',
    snippet: 'Face match found',
    engine: 'facecheck',
    rank: 1,
    thumbnailUrl: 'https://facecheck.id/thumb/face1.jpg',
    dimensions: { width: 200, height: 200 },
    score: 92,
    ...overrides,
  };
}

function makeSerpApiCandidate(
  overrides?: Partial<PersonDiscoveryCandidate>,
): PersonDiscoveryCandidate {
  return {
    candidateImageUrl: 'https://images.google.com/img1.jpg',
    sourcePageUrl: 'https://example.com/gallery',
    title: 'Image Gallery',
    snippet: 'User image found',
    engine: 'google_lens',
    rank: 1,
    thumbnailUrl: 'https://images.google.com/thumb1.jpg',
    dimensions: { width: 640, height: 480 },
    ...overrides,
  };
}

function makeDiscoveryResult(
  candidates: PersonDiscoveryCandidate[],
  providersUsed: PersonDiscoveryCandidate['engine'][] = ['google_lens'],
  overrides?: Partial<PersonDiscoveryResult>,
): PersonDiscoveryResult {
  return {
    candidates,
    providersUsed,
    totalFound: candidates.length,
    truncated: false,
    cacheHit: false,
    durationMs: 150,
    ...overrides,
  };
}

function makeTinEyeScanResult(
  matches: Array<{ imageUrl: string; domain: string; score: number }> = [],
) {
  return {
    provider: 'tineye' as const,
    success: true,
    matches: matches.map((m) => ({
      imageUrl: m.imageUrl,
      domain: m.domain,
      score: m.score,
      confidence: m.score >= 80 ? 'HIGH' : m.score >= 50 ? 'MEDIUM' : 'LOW',
      tags: [] as string[],
      backlinks: [] as Array<{ imageUrl: string; pageUrl: string }>,
    })),
    stats: {
      timestamp: Date.now() / 1000,
      queryTimeMs: 100,
      totalResults: matches.length,
      totalBacklinks: 0,
      totalStock: 0,
      totalCollection: 0,
    },
    searchedAt: new Date().toISOString(),
  };
}

/**
 * Reset the Supabase download mock to a successful download that returns a Buffer.
 */
function resetSupabaseDownloadMock() {
  mockSupabaseFrom.mockReturnValue({
    download: vi.fn().mockResolvedValue({
      data: {
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)),
      },
      error: null,
    }),
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('ReverseImageService - FaceCheck integration', () => {
  let service: ReverseImageService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks to safe defaults
    mockIsPersonDiscoveryEnabled.mockReturnValue(false);
    mockIsFaceCheckEnabled.mockReturnValue(false);
    mockGetPersonDiscoveryConfig.mockReturnValue({
      engine: 'serpapi',
      serpApiKey: 'test-key',
      maxCandidates: 20,
      providerOrder: ['google_lens', 'google_reverse_image', 'bing_reverse_image'],
      maxTineyeExpansions: 10,
      cacheTtl: 86400,
    });
    mockTinEyeEngine.isConfigured.mockReturnValue(true);
    mockTinEyeEngine.searchByUrl.mockResolvedValue(makeTinEyeScanResult());
    mockTinEyeEngine.searchByUpload.mockResolvedValue(makeTinEyeScanResult());

    (getSerpApiPersonDiscoveryEngine as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSerpApiEngine,
    );
    (getFaceCheckPersonDiscoveryEngine as ReturnType<typeof vi.fn>).mockReturnValue(
      mockFaceCheckEngine,
    );

    mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
      makeDiscoveryResult([], ['google_lens']),
    );
    mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
      makeDiscoveryResult([], ['facecheck']),
    );

    mockCreateProxyUrlFromImage.mockReturnValue('https://api.vara.com/proxy/abc123');
    mockValidateProxyUrl.mockResolvedValue(true);
    resetSupabaseDownloadMock();

    // Get singleton (constructor will use mocked getTinEyeEngine)
    service = ReverseImageService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Discovery gate (~4 tests)
  // =========================================================================
  describe('Discovery gate', () => {
    it('runs discovery when only isFaceCheckEnabled() is true', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockIsPersonDiscoveryEnabled.mockReturnValue(false);

      const fc = makeFaceCheckCandidate();
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.personDiscoveryUsed).toBe(true);
      expect(result.candidates.length).toBeGreaterThanOrEqual(1);
      // SerpAPI should NOT have been called
      expect(mockSerpApiEngine.discoverByImageUrl).not.toHaveBeenCalled();
    });

    it('runs discovery when only isPersonDiscoveryEnabled() is true', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(false);
      mockIsPersonDiscoveryEnabled.mockReturnValue(true);

      const sc = makeSerpApiCandidate();
      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult([sc], ['google_lens']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.personDiscoveryUsed).toBe(true);
      expect(result.candidates.length).toBeGreaterThanOrEqual(1);
      // FaceCheck should NOT have been called
      expect(mockFaceCheckEngine.discoverByUpload).not.toHaveBeenCalled();
    });

    it('runs discovery when both engines are enabled', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockIsPersonDiscoveryEnabled.mockReturnValue(true);

      const sc = makeSerpApiCandidate({ sourcePageUrl: 'https://a.com/1' });
      const fc = makeFaceCheckCandidate({ sourcePageUrl: 'https://b.com/2' });

      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult([sc], ['google_lens']),
      );
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.personDiscoveryUsed).toBe(true);
      expect(result.candidates.length).toBe(2);
    });

    it('skips discovery and adds warning when both are disabled', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(false);
      mockIsPersonDiscoveryEnabled.mockReturnValue(false);

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.personDiscoveryUsed).toBe(false);
      expect(result.candidates).toHaveLength(0);
      expect(result.warnings).toContain(
        'Person discovery not enabled (no engines configured)',
      );
    });
  });

  // =========================================================================
  // 2. FaceCheck engine setup (~5 tests)
  // =========================================================================
  describe('FaceCheck engine setup', () => {
    beforeEach(() => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockIsPersonDiscoveryEnabled.mockReturnValue(false);
    });

    it('downloads protected image and passes buffer to discoverByUpload', async () => {
      const fc = makeFaceCheckCandidate();
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(mockFaceCheckEngine.discoverByUpload).toHaveBeenCalledTimes(1);
      const callArgs = mockFaceCheckEngine.discoverByUpload.mock.calls[0];
      // First arg should be a Buffer
      expect(Buffer.isBuffer(callArgs[0])).toBe(true);
    });

    it('passes image/jpeg as mime type to discoverByUpload', async () => {
      const fc = makeFaceCheckCandidate();
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      const callArgs = mockFaceCheckEngine.discoverByUpload.mock.calls[0];
      expect(callArgs[1]).toBe('image/jpeg');
    });

    it('passes maxCandidates option to discoverByUpload', async () => {
      const fc = makeFaceCheckCandidate();
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      await service.scanWithPersonDiscovery(PROTECTED_IMAGE, { maxCandidates: 5 });

      const callArgs = mockFaceCheckEngine.discoverByUpload.mock.calls[0];
      // Third arg is the options object containing maxCandidates
      expect(callArgs[2]).toEqual(expect.objectContaining({ maxCandidates: 5 }));
    });

    it('adds warning when image download fails and skips FaceCheck', async () => {
      // Override the supabase mock to return an error for download
      mockSupabaseFrom.mockReturnValue({
        download: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      });

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Failed to download image for FaceCheck'),
        ]),
      );
      expect(mockFaceCheckEngine.discoverByUpload).not.toHaveBeenCalled();
    });

    it('skips FaceCheck when getFaceCheckPersonDiscoveryEngine() returns null', async () => {
      (getFaceCheckPersonDiscoveryEngine as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        null,
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(mockFaceCheckEngine.discoverByUpload).not.toHaveBeenCalled();
      // No engines were set up, so warning about no engines available
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('No person discovery engines available'),
        ]),
      );
    });
  });

  // =========================================================================
  // 3. Parallel execution (~6 tests)
  // =========================================================================
  describe('Parallel execution', () => {
    beforeEach(() => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockIsPersonDiscoveryEnabled.mockReturnValue(true);
    });

    it('runs both SerpAPI and FaceCheck concurrently', async () => {
      let serpApiCalled = false;
      let faceCheckCalled = false;

      mockSerpApiEngine.discoverByImageUrl.mockImplementation(async () => {
        serpApiCalled = true;
        return makeDiscoveryResult(
          [makeSerpApiCandidate({ sourcePageUrl: 'https://s.com' })],
          ['google_lens'],
        );
      });
      mockFaceCheckEngine.discoverByUpload.mockImplementation(async () => {
        faceCheckCalled = true;
        return makeDiscoveryResult(
          [makeFaceCheckCandidate({ sourcePageUrl: 'https://f.com' })],
          ['facecheck'],
        );
      });

      await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(serpApiCalled).toBe(true);
      expect(faceCheckCalled).toBe(true);
    });

    it('merges candidates from both engines when both succeed', async () => {
      const sc = makeSerpApiCandidate({
        sourcePageUrl: 'https://serp.example.com/p1',
      });
      const fc = makeFaceCheckCandidate({
        sourcePageUrl: 'https://fc.example.com/p2',
      });

      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult([sc], ['google_lens']),
      );
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.personDiscoveryUsed).toBe(true);
      expect(result.candidates.length).toBe(2);

      const urls = result.candidates.map((c) => c.candidate.sourcePageUrl);
      expect(urls).toContain('https://serp.example.com/p1');
      expect(urls).toContain('https://fc.example.com/p2');
    });

    it('returns only SerpAPI candidates and adds warning when FaceCheck fails', async () => {
      const sc = makeSerpApiCandidate();
      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult([sc], ['google_lens']),
      );
      mockFaceCheckEngine.discoverByUpload.mockRejectedValue(
        new Error('FaceCheck API timeout'),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.personDiscoveryUsed).toBe(true);
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].candidate.engine).toBe('google_lens');
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('facecheck discovery failed'),
        ]),
      );
    });

    it('returns only FaceCheck candidates and adds warning when SerpAPI fails', async () => {
      const fc = makeFaceCheckCandidate();
      mockSerpApiEngine.discoverByImageUrl.mockRejectedValue(
        new Error('SerpAPI rate limit'),
      );
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.personDiscoveryUsed).toBe(true);
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].candidate.engine).toBe('facecheck');
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('serpapi discovery failed'),
        ]),
      );
    });

    it('returns no candidates and adds both warnings when both fail', async () => {
      mockSerpApiEngine.discoverByImageUrl.mockRejectedValue(
        new Error('SerpAPI down'),
      );
      mockFaceCheckEngine.discoverByUpload.mockRejectedValue(
        new Error('FaceCheck down'),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.personDiscoveryUsed).toBe(false);
      expect(result.candidates).toHaveLength(0);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('serpapi discovery failed'),
          expect.stringContaining('facecheck discovery failed'),
        ]),
      );
    });

    it('sets personDiscoveryUsed to true when at least one engine succeeds', async () => {
      const fc = makeFaceCheckCandidate();
      mockSerpApiEngine.discoverByImageUrl.mockRejectedValue(new Error('fail'));
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.personDiscoveryUsed).toBe(true);
    });

    it('includes providersUsed from all successful engines', async () => {
      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult(
          [makeSerpApiCandidate({ sourcePageUrl: 'https://a.com' })],
          ['google_lens'],
        ),
      );
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult(
          [makeFaceCheckCandidate({ sourcePageUrl: 'https://b.com' })],
          ['facecheck'],
        ),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.providersUsed).toContain('google_lens');
      expect(result.providersUsed).toContain('facecheck');
    });
  });

  // =========================================================================
  // 4. Deduplication (~5 tests)
  // =========================================================================
  describe('Deduplication', () => {
    beforeEach(() => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockIsPersonDiscoveryEnabled.mockReturnValue(true);
    });

    it('keeps candidates with different sourcePageUrls', async () => {
      const sc = makeSerpApiCandidate({ sourcePageUrl: 'https://a.com/page1' });
      const fc = makeFaceCheckCandidate({ sourcePageUrl: 'https://b.com/page2' });

      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult([sc], ['google_lens']),
      );
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.candidates.length).toBe(2);
    });

    it('prefers FaceCheck candidate when same URL found by both engines', async () => {
      const sharedUrl = 'https://shared.example.com/profile';

      const sc = makeSerpApiCandidate({
        sourcePageUrl: sharedUrl,
        title: 'SerpAPI found this',
        engine: 'google_lens',
      });
      const fc = makeFaceCheckCandidate({
        sourcePageUrl: sharedUrl,
        title: 'FaceCheck found this',
        engine: 'facecheck',
      });

      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult([sc], ['google_lens']),
      );
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      // Only one candidate since same URL, and the FaceCheck one wins
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].candidate.engine).toBe('facecheck');
      expect(result.candidates[0].candidate.title).toBe('FaceCheck found this');
    });

    it('keeps first candidate when same URL from same engine', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(false);
      mockIsPersonDiscoveryEnabled.mockReturnValue(true);

      const sharedUrl = 'https://dup.example.com/page';
      const sc1 = makeSerpApiCandidate({
        sourcePageUrl: sharedUrl,
        title: 'First occurrence',
        rank: 1,
      });
      const sc2 = makeSerpApiCandidate({
        sourcePageUrl: sharedUrl,
        title: 'Second occurrence',
        rank: 2,
      });

      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult([sc1, sc2], ['google_lens']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].candidate.title).toBe('First occurrence');
    });

    it('deduplication happens after merging results from both engines', async () => {
      const sc1 = makeSerpApiCandidate({ sourcePageUrl: 'https://unique-serp.com' });
      const sc2 = makeSerpApiCandidate({
        sourcePageUrl: 'https://shared.com',
        engine: 'google_lens',
      });
      const fc1 = makeFaceCheckCandidate({ sourcePageUrl: 'https://unique-fc.com' });
      const fc2 = makeFaceCheckCandidate({
        sourcePageUrl: 'https://shared.com',
        engine: 'facecheck',
      });

      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult([sc1, sc2], ['google_lens']),
      );
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc1, fc2], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      // 4 total but 1 overlap -> 3 unique
      expect(result.candidates.length).toBe(3);

      // The shared.com candidate should be from FaceCheck
      const shared = result.candidates.find(
        (c) => c.candidate.sourcePageUrl === 'https://shared.com',
      );
      expect(shared).toBeDefined();
      expect(shared!.candidate.engine).toBe('facecheck');
    });

    it('handles multiple duplicate URLs correctly', async () => {
      const sc1 = makeSerpApiCandidate({ sourcePageUrl: 'https://only-serp.com' });
      const sc2 = makeSerpApiCandidate({
        sourcePageUrl: 'https://overlap-1.com',
        engine: 'google_lens',
      });
      const sc3 = makeSerpApiCandidate({
        sourcePageUrl: 'https://overlap-2.com',
        engine: 'google_lens',
      });

      const fc1 = makeFaceCheckCandidate({
        sourcePageUrl: 'https://overlap-1.com',
        engine: 'facecheck',
      });
      const fc2 = makeFaceCheckCandidate({
        sourcePageUrl: 'https://overlap-2.com',
        engine: 'facecheck',
      });

      mockSerpApiEngine.discoverByImageUrl.mockResolvedValue(
        makeDiscoveryResult([sc1, sc2, sc3], ['google_lens']),
      );
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc1, fc2], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      // 5 total - 2 overlaps = 3 unique
      expect(result.candidates.length).toBe(3);

      // Both overlaps should prefer FaceCheck
      const overlap1 = result.candidates.find(
        (c) => c.candidate.sourcePageUrl === 'https://overlap-1.com',
      );
      const overlap2 = result.candidates.find(
        (c) => c.candidate.sourcePageUrl === 'https://overlap-2.com',
      );
      expect(overlap1!.candidate.engine).toBe('facecheck');
      expect(overlap2!.candidate.engine).toBe('facecheck');
    });
  });

  // =========================================================================
  // 5. FaceCheck candidates in TinEye expansion (~5 tests)
  // =========================================================================
  describe('FaceCheck candidates in TinEye expansion', () => {
    beforeEach(() => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockIsPersonDiscoveryEnabled.mockReturnValue(false);
    });

    it('includes FaceCheck candidates without candidateImageUrl with empty tineyeMatches', async () => {
      const fc = makeFaceCheckCandidate({
        candidateImageUrl: null,
        sourcePageUrl: 'https://no-image.example.com',
      });

      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].candidate.candidateImageUrl).toBeNull();
      expect(result.candidates[0].tineyeMatches).toEqual([]);
      // searchByUrl should NOT have been called for this candidate
      expect(mockTinEyeEngine.searchByUrl).not.toHaveBeenCalled();
    });

    it('expands FaceCheck candidates with candidateImageUrl through TinEye', async () => {
      const fc = makeFaceCheckCandidate({
        candidateImageUrl: 'https://facecheck.id/result/face-full.jpg',
      });

      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      mockTinEyeEngine.searchByUrl.mockResolvedValue(
        makeTinEyeScanResult([
          {
            imageUrl: 'https://tineye-match.com/img.jpg',
            domain: 'tineye-match.com',
            score: 85,
          },
        ]),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.candidates.length).toBe(1);
      expect(mockTinEyeEngine.searchByUrl).toHaveBeenCalledWith(
        'https://facecheck.id/result/face-full.jpg',
        expect.objectContaining({ limit: 20 }),
      );
      expect(result.candidates[0].tineyeMatches.length).toBe(1);
    });

    it('sets faceSimilarity to undefined on expanded candidates (placeholder)', async () => {
      const fc = makeFaceCheckCandidate();
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      mockTinEyeEngine.searchByUrl.mockResolvedValue(makeTinEyeScanResult());

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      for (const candidate of result.candidates) {
        expect(candidate.faceSimilarity).toBeUndefined();
      }
    });

    it('handles TinEye expansion failure for a FaceCheck candidate gracefully', async () => {
      const fc = makeFaceCheckCandidate({
        candidateImageUrl: 'https://facecheck.id/result/failing.jpg',
      });
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      mockTinEyeEngine.searchByUrl.mockRejectedValue(
        new Error('TinEye expansion error'),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      // Candidate should still be present but with empty tineyeMatches
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].tineyeMatches).toEqual([]);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('TinEye expansion failed for candidate 1'),
        ]),
      );
    });

    it('mixes expandable and non-expandable FaceCheck candidates correctly', async () => {
      const fcWithImage = makeFaceCheckCandidate({
        sourcePageUrl: 'https://has-image.com',
        candidateImageUrl: 'https://facecheck.id/result/with-img.jpg',
      });
      const fcWithoutImage = makeFaceCheckCandidate({
        sourcePageUrl: 'https://no-image.com',
        candidateImageUrl: null,
      });

      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fcWithImage, fcWithoutImage], ['facecheck']),
      );

      mockTinEyeEngine.searchByUrl.mockResolvedValue(
        makeTinEyeScanResult([
          {
            imageUrl: 'https://tineye.com/match.jpg',
            domain: 'tineye.com',
            score: 75,
          },
        ]),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.candidates.length).toBe(2);

      const withImage = result.candidates.find(
        (c) => c.candidate.sourcePageUrl === 'https://has-image.com',
      );
      const withoutImage = result.candidates.find(
        (c) => c.candidate.sourcePageUrl === 'https://no-image.com',
      );

      expect(withImage!.tineyeMatches.length).toBe(1);
      expect(withoutImage!.tineyeMatches).toEqual([]);
    });
  });

  // =========================================================================
  // 6. Result structure (~5 tests)
  // =========================================================================
  describe('Result structure', () => {
    it('candidateGroupId is a valid non-empty string', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(true);

      const fc = makeFaceCheckCandidate();
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([fc], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.candidateGroupId).toBeDefined();
      expect(typeof result.candidateGroupId).toBe('string');
      expect(result.candidateGroupId.length).toBeGreaterThan(0);
    });

    it('discoveryDurationMs is a non-negative number', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(typeof result.discoveryDurationMs).toBe('number');
      expect(result.discoveryDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('warnings captures FaceCheck-specific error messages', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockIsPersonDiscoveryEnabled.mockReturnValue(false);

      mockFaceCheckEngine.discoverByUpload.mockRejectedValue(
        new Error('FaceCheck credit exhausted'),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'facecheck discovery failed: FaceCheck credit exhausted',
          ),
        ]),
      );
    });

    it('providersUsed includes facecheck when FaceCheck succeeds', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockIsPersonDiscoveryEnabled.mockReturnValue(false);

      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([makeFaceCheckCandidate()], ['facecheck']),
      );

      const result = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);

      expect(result.providersUsed).toContain('facecheck');
    });

    it('personDiscoveryUsed reflects actual usage -- false when all engines fail', async () => {
      mockIsFaceCheckEnabled.mockReturnValue(true);
      mockIsPersonDiscoveryEnabled.mockReturnValue(true);

      mockSerpApiEngine.discoverByImageUrl.mockRejectedValue(new Error('fail'));
      mockFaceCheckEngine.discoverByUpload.mockRejectedValue(new Error('fail'));

      const failResult = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);
      expect(failResult.personDiscoveryUsed).toBe(false);

      // Now let FaceCheck succeed
      mockFaceCheckEngine.discoverByUpload.mockResolvedValue(
        makeDiscoveryResult([makeFaceCheckCandidate()], ['facecheck']),
      );

      const successResult = await service.scanWithPersonDiscovery(PROTECTED_IMAGE);
      expect(successResult.personDiscoveryUsed).toBe(true);
    });
  });
});
