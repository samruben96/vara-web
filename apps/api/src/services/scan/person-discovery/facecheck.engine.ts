/**
 * FaceCheck.id Person Discovery Engine
 *
 * Implements PersonDiscoveryEngine to search the web for other photos
 * containing the same face using FaceCheck.id's face recognition API.
 *
 * Unlike SerpAPI (which finds visually similar images), FaceCheck performs
 * biometric face matching — it can find different photos of the same person
 * even in completely different contexts.
 */

import type {
  PersonDiscoveryEngine,
  PersonDiscoveryOptions,
  PersonDiscoveryResult,
  PersonDiscoveryCandidate,
} from './interfaces';
import {
  FaceCheckClient,
} from './facecheck.client';
import type {
  FaceCheckMatch,
  FaceCheckPollingOptions,
} from './facecheck.types';
import {
  getFaceCheckConfig,
  isFaceCheckEnabled,
  type FaceCheckConfig,
} from '@/config/facecheck.config';

/**
 * FaceCheck Person Discovery Engine
 *
 * Primary method is discoverByUpload() since FaceCheck requires image upload.
 * discoverByImageUrl() downloads the image first, then delegates to upload.
 */
export class FaceCheckPersonDiscoveryEngine implements PersonDiscoveryEngine {
  readonly name = 'facecheck';

  private readonly client: FaceCheckClient;
  private readonly config: FaceCheckConfig;

  constructor(client?: FaceCheckClient, config?: FaceCheckConfig) {
    this.config = config ?? getFaceCheckConfig();
    this.client = client ?? new FaceCheckClient(this.config);
  }

  /**
   * Discover by uploading image data directly (primary method for FaceCheck).
   */
  async discoverByUpload(
    file: Buffer,
    mimeType: string,
    options?: PersonDiscoveryOptions,
  ): Promise<PersonDiscoveryResult> {
    const startTime = Date.now();

    try {
      // Upload image
      const uploadResult = await this.client.uploadImage(file, mimeType);

      // Build polling options
      const pollingOptions: FaceCheckPollingOptions = {
        intervalMs: this.config.pollIntervalMs,
        maxTimeMs: options?.timeout ?? this.config.maxPollTimeMs,
      };

      // Search with polling (client handles cleanup in finally)
      const searchResult = await this.client.searchWithPolling(
        uploadResult.idSearch,
        pollingOptions,
      );

      // Filter by score threshold and map to candidates
      const filteredMatches = searchResult.matches.filter(
        (m) => m.score >= this.config.minScoreThreshold,
      );

      const maxCandidates = options?.maxCandidates ?? 20;
      const truncated = filteredMatches.length > maxCandidates;
      const limitedMatches = filteredMatches.slice(0, maxCandidates);

      const candidates = limitedMatches.map((match, index) =>
        this.mapMatchToCandidate(match, index + 1),
      );

      const durationMs = Date.now() - startTime;

      console.log(
        `[FaceCheckEngine] Discovery complete: ${searchResult.totalFound} raw matches, ` +
        `${filteredMatches.length} above threshold (${this.config.minScoreThreshold}), ` +
        `${candidates.length} returned in ${durationMs}ms`,
      );

      return {
        candidates,
        providersUsed: ['facecheck'],
        totalFound: filteredMatches.length,
        truncated,
        cacheHit: false,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`[FaceCheckEngine] Discovery failed after ${durationMs}ms: ${errorMessage}`);

      // Return empty result on failure (don't block other engines)
      return {
        candidates: [],
        providersUsed: ['facecheck'],
        totalFound: 0,
        truncated: false,
        cacheHit: false,
        durationMs,
      };
    }
  }

  /**
   * Discover by image URL — downloads the image, then delegates to discoverByUpload.
   */
  async discoverByImageUrl(
    imageUrl: string,
    options?: PersonDiscoveryOptions,
  ): Promise<PersonDiscoveryResult> {
    try {
      // Download the image
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Vara-Safety-Scanner/1.0' },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Failed to download image: HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return this.discoverByUpload(buffer, contentType, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[FaceCheckEngine] Failed to download image for discovery: ${errorMessage}`);

      return {
        candidates: [],
        providersUsed: ['facecheck'],
        totalFound: 0,
        truncated: false,
        cacheHit: false,
        durationMs: 0,
      };
    }
  }

  /**
   * Check if FaceCheck engine is available and can accept requests.
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!isFaceCheckEnabled()) return false;

      // Check API health and credits
      const info = await this.client.getInfo();
      return info.isHealthy && info.credits > 0;
    } catch {
      return false;
    }
  }

  /**
   * Map a FaceCheck match to PersonDiscoveryCandidate.
   */
  private mapMatchToCandidate(match: FaceCheckMatch, rank: number): PersonDiscoveryCandidate {
    return {
      candidateImageUrl: match.imageUrl ?? null,
      sourcePageUrl: match.sourcePageUrl,
      title: null, // FaceCheck doesn't return page titles
      snippet: null,
      engine: 'facecheck',
      rank,
      thumbnailUrl: null, // Thumbnails are base64 — not stored (security)
      dimensions: null,
      score: match.score,
      raw: {
        score: match.score,
        guid: match.guid,
        group: match.group,
        domain: match.domain,
      },
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _engineInstance: FaceCheckPersonDiscoveryEngine | null = null;

/**
 * Get the singleton FaceCheck person discovery engine.
 * Returns null if FaceCheck is not enabled.
 */
export function getFaceCheckPersonDiscoveryEngine(): FaceCheckPersonDiscoveryEngine | null {
  if (!isFaceCheckEnabled()) return null;

  if (!_engineInstance) {
    _engineInstance = new FaceCheckPersonDiscoveryEngine();
  }
  return _engineInstance;
}

/** Check if FaceCheck discovery engine is enabled */
export function isFaceCheckEngineEnabled(): boolean {
  return isFaceCheckEnabled();
}

/** Reset singleton (for testing) */
export function resetFaceCheckEngine(): void {
  _engineInstance = null;
}
