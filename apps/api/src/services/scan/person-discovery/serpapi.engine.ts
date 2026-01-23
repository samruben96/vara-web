/**
 * SerpAPI Person Discovery Engine
 *
 * Implements the PersonDiscoveryEngine interface using SerpAPI to discover
 * visually similar images via Google Lens and Bing reverse image search.
 *
 * This engine orchestrates searches across multiple providers with automatic
 * fallback support when a provider fails or is rate limited.
 */

import {
  getPersonDiscoveryConfig,
  isPersonDiscoveryEnabled,
} from '@/config/person-discovery.config';
import {
  PersonDiscoveryCandidate,
  PersonDiscoveryEngine,
  PersonDiscoveryOptions,
  PersonDiscoveryProvider,
  PersonDiscoveryResult,
  mergePersonDiscoveryOptions,
} from './interfaces';
import {
  BingReverseImageResponse,
  BingReverseImageResult,
  GoogleLensResponse,
  GoogleLensVisualMatch,
  GoogleReverseImageResponse,
  GoogleReverseImageResult,
  getSerpApiClient,
  SerpApiClient,
  SerpApiError,
} from './serpapi.client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SerpAPI-based person discovery engine.
 *
 * Searches across Google Lens and Bing Reverse Image to find where a person's
 * face appears across the web. Supports automatic failover between providers.
 */
export class SerpApiPersonDiscoveryEngine implements PersonDiscoveryEngine {
  readonly name = 'serpapi';

  constructor(
    private client: SerpApiClient,
    private config?: Partial<PersonDiscoveryOptions>
  ) {}

  /**
   * Discover candidate images by searching for visually similar images.
   *
   * @param imageUrl - Publicly accessible URL of the image to search
   * @param options - Search configuration options
   * @returns Discovery results with candidate images
   */
  async discoverByImageUrl(
    imageUrl: string,
    options?: PersonDiscoveryOptions
  ): Promise<PersonDiscoveryResult> {
    const startTime = Date.now();

    // Validate URL
    this.validateImageUrl(imageUrl);

    // Merge options with config defaults and global defaults
    const mergedOptions = mergePersonDiscoveryOptions({
      ...this.config,
      ...options,
    });

    const allCandidates: PersonDiscoveryCandidate[] = [];
    const providersUsed: PersonDiscoveryProvider[] = [];
    let totalFound = 0;

    // Try each provider in order
    for (const provider of mergedOptions.providers) {
      if (allCandidates.length >= mergedOptions.maxCandidates) {
        break;
      }

      try {
        const candidates = await this.searchWithProvider(provider, imageUrl);
        if (candidates.length > 0) {
          providersUsed.push(provider);
          allCandidates.push(...candidates);
          totalFound += candidates.length;
        }
      } catch {
        continue;
      }
    }

    // Deduplicate and truncate
    const dedupedCandidates = this.deduplicateCandidates(allCandidates);
    const truncated = dedupedCandidates.length > mergedOptions.maxCandidates;
    const finalCandidates = dedupedCandidates.slice(0, mergedOptions.maxCandidates);
    const durationMs = Date.now() - startTime;

    return {
      candidates: finalCandidates,
      providersUsed,
      totalFound,
      truncated,
      cacheHit: false, // SerpAPI doesn't provide cache info at this level
      durationMs,
    };
  }

  /**
   * Check if the SerpAPI engine is available and properly configured.
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.client.isAvailable();
    } catch (error) {
      console.warn(
        `[SerpApiPersonDiscoveryEngine] Availability check failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * Validate that the image URL is well-formed.
   */
  private validateImageUrl(imageUrl: string): void {
    try {
      const url = new URL(imageUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new SerpApiError(
          'SERPAPI_INVALID_REQUEST',
          `Invalid URL protocol: ${url.protocol}. Only http and https are supported.`
        );
      }
    } catch (error) {
      if (error instanceof SerpApiError) {
        throw error;
      }
      throw new SerpApiError(
        'SERPAPI_INVALID_REQUEST',
        `Invalid image URL: ${error instanceof Error ? error.message : 'malformed URL'}`
      );
    }
  }

  /**
   * Search with a specific provider and return candidates.
   */
  private async searchWithProvider(
    provider: PersonDiscoveryProvider,
    imageUrl: string
  ): Promise<PersonDiscoveryCandidate[]> {
    switch (provider) {
      case 'google_lens':
        return this.searchGoogleLens(imageUrl);

      case 'google_reverse_image':
        return this.searchGoogleReverseImage(imageUrl);

      case 'bing_reverse_image':
        return this.searchBingReverseImage(imageUrl);

      default:
        console.warn(`[SerpApiPersonDiscoveryEngine] Unknown provider: ${provider}`);
        return [];
    }
  }

  /**
   * Search using Google Lens via SerpAPI.
   */
  private async searchGoogleLens(imageUrl: string): Promise<PersonDiscoveryCandidate[]> {
    const response: GoogleLensResponse = await this.client.searchGoogleLens(imageUrl);

    if (!response.visual_matches || response.visual_matches.length === 0) {
      console.log('[SerpApiPersonDiscoveryEngine] Google Lens returned no visual matches');
      this.logZeroCandidatesDebug('google_lens', response);
      return [];
    }

    return response.visual_matches.map((match, index) =>
      this.transformGoogleLensResult(match, index + 1)
    );
  }

  /**
   * Search using Bing Reverse Image via SerpAPI.
   */
  private async searchBingReverseImage(imageUrl: string): Promise<PersonDiscoveryCandidate[]> {
    const response: BingReverseImageResponse =
      await this.client.searchBingReverseImage(imageUrl);

    // Bing can return results in either images_results or related_content
    const results: BingReverseImageResult[] = [
      ...(response.images_results || []),
      ...(response.related_content || []),
    ];

    if (results.length === 0) {
      this.logZeroCandidatesDebug('bing_reverse_image', response);
      return [];
    }

    return results.map((result, index) => this.transformBingResult(result, index + 1));
  }

  /**
   * Search using Google Reverse Image via SerpAPI.
   */
  private async searchGoogleReverseImage(imageUrl: string): Promise<PersonDiscoveryCandidate[]> {
    const response: GoogleReverseImageResponse =
      await this.client.searchGoogleReverseImage(imageUrl);

    // Google Reverse Image can return results in image_results or inline_images
    const imageResults = response.image_results || [];
    const inlineImages = response.inline_images || [];

    if (imageResults.length === 0 && inlineImages.length === 0) {
      this.logZeroCandidatesDebug('google_reverse_image', response);
      return [];
    }

    // Transform image_results first (primary results)
    const candidates: PersonDiscoveryCandidate[] = imageResults.map((result, index) =>
      this.transformGoogleReverseImageResult(result, index + 1)
    );

    // Add inline_images as lower-ranked candidates
    const inlineCandidates: PersonDiscoveryCandidate[] = inlineImages
      .filter((img) => img.link || img.original)
      .map((img, index) => ({
        candidateImageUrl: img.original || null,
        sourcePageUrl: img.link || img.source || '',
        title: img.source || null,
        snippet: null,
        engine: 'google_reverse_image' as PersonDiscoveryProvider,
        rank: imageResults.length + index + 1,
        thumbnailUrl: img.thumbnail || null,
        dimensions: null,
        raw: img,
      }));

    return [...candidates, ...inlineCandidates];
  }

  /**
   * Log debug information when a provider returns 0 candidates.
   * When PERSON_DISCOVERY_DEBUG=true, also writes sanitized response to temp file.
   */
  private logZeroCandidatesDebug(
    provider: 'google_lens' | 'google_reverse_image' | 'bing_reverse_image',
    response: GoogleLensResponse | GoogleReverseImageResponse | BingReverseImageResponse
  ): void {
    // Build array lengths info based on provider
    const arrayLengths: Record<string, number> = {};

    if (provider === 'google_lens') {
      const lensResponse = response as GoogleLensResponse;
      arrayLengths.visual_matches = lensResponse.visual_matches?.length ?? 0;
      arrayLengths.knowledge_graph = lensResponse.knowledge_graph?.length ?? 0;
    } else if (provider === 'google_reverse_image') {
      const googleResponse = response as GoogleReverseImageResponse;
      arrayLengths.image_results = googleResponse.image_results?.length ?? 0;
      arrayLengths.inline_images = googleResponse.inline_images?.length ?? 0;
    } else {
      const bingResponse = response as BingReverseImageResponse;
      arrayLengths.images_results = bingResponse.images_results?.length ?? 0;
      arrayLengths.related_content = bingResponse.related_content?.length ?? 0;
    }

    // Log warning with key diagnostic info
    console.warn('[SerpAPI] Zero candidates returned', {
      provider,
      status: response.search_metadata?.status,
      error: response.error,
      arrayLengths,
    });

    // If debug mode enabled, write sanitized response to temp file
    if (process.env.PERSON_DISCOVERY_DEBUG === 'true') {
      try {
        // Sanitize response - remove api_key from search_metadata
        const sanitizedResponse = JSON.parse(JSON.stringify(response));
        if (sanitizedResponse.search_metadata) {
          delete sanitizedResponse.search_metadata.api_key;
        }
        if (sanitizedResponse.search_parameters) {
          delete sanitizedResponse.search_parameters.api_key;
        }

        const debugFilePath = path.join('/tmp', `serpapi-debug-${Date.now()}.json`);
        fs.writeFileSync(
          debugFilePath,
          JSON.stringify(
            {
              provider,
              timestamp: new Date().toISOString(),
              response: sanitizedResponse,
            },
            null,
            2
          )
        );
        console.log(`[SerpAPI] Debug response written to: ${debugFilePath}`);
      } catch (writeError) {
        console.warn(
          '[SerpAPI] Failed to write debug file:',
          writeError instanceof Error ? writeError.message : String(writeError)
        );
      }
    }
  }

  /**
   * Transform a Google Lens visual match into a PersonDiscoveryCandidate.
   */
  private transformGoogleLensResult(
    match: GoogleLensVisualMatch,
    rank: number
  ): PersonDiscoveryCandidate {
    // Prefer original URL, fall back to thumbnail if original is not available.
    // Thumbnail URLs can still be used for TinEye expansion, though at lower resolution.
    const candidateImageUrl = match.original || match.thumbnail || null;

    return {
      candidateImageUrl,
      sourcePageUrl: match.link,
      title: match.title || null,
      snippet: null, // Google Lens doesn't provide snippets
      engine: 'google_lens',
      rank: match.position || rank,
      thumbnailUrl: match.thumbnail || null,
      dimensions: match.size
        ? {
            width: match.size.width,
            height: match.size.height,
          }
        : null,
      raw: match,
    };
  }

  /**
   * Transform a Google Reverse Image result into a PersonDiscoveryCandidate.
   */
  private transformGoogleReverseImageResult(
    result: GoogleReverseImageResult,
    rank: number
  ): PersonDiscoveryCandidate {
    // Parse dimensions from size string (e.g., "800 x 600")
    let dimensions: { width: number; height: number } | null = null;
    if (result.size) {
      const match = result.size.match(/(\d+)\s*x\s*(\d+)/i);
      if (match) {
        dimensions = {
          width: parseInt(match[1]!, 10),
          height: parseInt(match[2]!, 10),
        };
      }
    }

    // Prefer original URL, fall back to thumbnail if original is not available.
    // Thumbnail URLs can still be used for TinEye expansion, though at lower resolution.
    const candidateImageUrl = result.original || result.thumbnail || null;

    return {
      candidateImageUrl,
      sourcePageUrl: result.link,
      title: result.title || null,
      snippet: null, // Google Reverse Image doesn't provide snippets
      engine: 'google_reverse_image',
      rank: result.position || rank,
      thumbnailUrl: result.thumbnail || null,
      dimensions,
      raw: result,
    };
  }

  /**
   * Transform a Bing reverse image result into a PersonDiscoveryCandidate.
   */
  private transformBingResult(
    result: BingReverseImageResult,
    rank: number
  ): PersonDiscoveryCandidate {
    // Prefer original URL, fall back to CDN original
    const candidateImageUrl = result.original || result.cdn_original || null;

    return {
      candidateImageUrl,
      sourcePageUrl: result.link,
      title: result.title || null,
      snippet: null, // Bing doesn't provide snippets in reverse image search
      engine: 'bing_reverse_image',
      rank: result.position || rank,
      thumbnailUrl: result.thumbnail || null,
      dimensions:
        result.width && result.height
          ? {
              width: result.width,
              height: result.height,
            }
          : null,
      raw: result,
    };
  }

  /**
   * Deduplicate candidates by source page URL.
   *
   * When duplicates are found:
   * - Prefer candidates with a direct image URL (candidateImageUrl)
   * - Keep the lower rank (higher priority) candidate
   */
  private deduplicateCandidates(
    candidates: PersonDiscoveryCandidate[]
  ): PersonDiscoveryCandidate[] {
    const seenUrls = new Map<string, PersonDiscoveryCandidate>();

    for (const candidate of candidates) {
      const url = candidate.sourcePageUrl;
      const existing = seenUrls.get(url);

      if (!existing) {
        // First time seeing this URL
        seenUrls.set(url, candidate);
      } else {
        // Duplicate found - decide which to keep
        const shouldReplace = this.shouldReplaceCandidate(existing, candidate);
        if (shouldReplace) {
          seenUrls.set(url, candidate);
        }
      }
    }

    // Return candidates sorted by rank
    return Array.from(seenUrls.values()).sort((a, b) => a.rank - b.rank);
  }

  /**
   * Determine if a new candidate should replace an existing one.
   *
   * Preference order:
   * 1. Has candidateImageUrl (direct image link)
   * 2. Lower rank (higher in search results)
   */
  private shouldReplaceCandidate(
    existing: PersonDiscoveryCandidate,
    candidate: PersonDiscoveryCandidate
  ): boolean {
    // Prefer candidates with direct image URLs
    const existingHasImage = existing.candidateImageUrl !== null;
    const candidateHasImage = candidate.candidateImageUrl !== null;

    if (candidateHasImage && !existingHasImage) {
      return true;
    }
    if (!candidateHasImage && existingHasImage) {
      return false;
    }

    // Both have or both lack image URL - prefer lower rank
    return candidate.rank < existing.rank;
  }
}

// Singleton instance
let serpApiEngineInstance: SerpApiPersonDiscoveryEngine | null = null;

/**
 * Get the SerpAPI person discovery engine singleton.
 *
 * Returns null if:
 * - PERSON_DISCOVERY_ENGINE is set to 'off'
 * - SERPAPI_API_KEY is not configured
 *
 * @returns SerpApiPersonDiscoveryEngine instance or null if not available
 */
export function getSerpApiPersonDiscoveryEngine(): SerpApiPersonDiscoveryEngine | null {
  // Check if person discovery is enabled
  if (!isPersonDiscoveryEnabled()) {
    const config = getPersonDiscoveryConfig();
    if (config.engine === 'off') {
      console.log(
        '[SerpApiPersonDiscoveryEngine] Person discovery disabled (PERSON_DISCOVERY_ENGINE=off)'
      );
    } else {
      console.log(
        '[SerpApiPersonDiscoveryEngine] Person discovery disabled (missing SERPAPI_API_KEY)'
      );
    }
    return null;
  }

  // Return existing instance
  if (serpApiEngineInstance) {
    return serpApiEngineInstance;
  }

  // Create new instance
  try {
    const client = getSerpApiClient();
    const config = getPersonDiscoveryConfig();

    serpApiEngineInstance = new SerpApiPersonDiscoveryEngine(client, {
      maxCandidates: config.maxCandidates,
      providers: config.providerOrder,
    });

    console.log('[SerpApiPersonDiscoveryEngine] Engine initialized successfully');
    return serpApiEngineInstance;
  } catch (error) {
    console.error(
      '[SerpApiPersonDiscoveryEngine] Failed to initialize engine:',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetSerpApiPersonDiscoveryEngine(): void {
  serpApiEngineInstance = null;
}
