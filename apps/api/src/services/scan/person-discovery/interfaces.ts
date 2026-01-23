/**
 * Person Discovery Interfaces
 *
 * Type definitions for the person discovery system that uses reverse image search
 * engines (Google Lens, Bing Reverse Image) to find where a person's face appears
 * across the web.
 *
 * This is distinct from the image-matching scan system (TinEye) which finds exact
 * or near-duplicate images. Person discovery focuses on finding ANY images that
 * contain a specific person's face, regardless of the image context.
 */

/**
 * Supported person discovery providers.
 * Order in arrays indicates search priority.
 */
export type PersonDiscoveryProvider = 'google_lens' | 'google_reverse_image' | 'bing_reverse_image';

/**
 * A candidate image found by a person discovery engine.
 * These are potential matches that need face verification before being confirmed.
 */
export interface PersonDiscoveryCandidate {
  /**
   * Direct URL to the candidate image, if available.
   * May be null if only page URL is known.
   */
  candidateImageUrl: string | null;

  /**
   * URL of the page where the candidate was found.
   */
  sourcePageUrl: string;

  /**
   * Title of the source page, if available.
   */
  title: string | null;

  /**
   * Text snippet from the page providing context about the image.
   */
  snippet: string | null;

  /**
   * The search engine that found this candidate.
   */
  engine: PersonDiscoveryProvider;

  /**
   * Position in the search results (1-indexed).
   * Lower rank means higher relevance according to the search engine.
   */
  rank: number;

  /**
   * URL to a thumbnail version of the image, if available.
   * Useful for preview without downloading full image.
   */
  thumbnailUrl: string | null;

  /**
   * Image dimensions, if reported by the search engine.
   */
  dimensions: {
    width: number;
    height: number;
  } | null;

  /**
   * Original provider response payload for debugging.
   * Structure varies by provider.
   */
  raw?: unknown;
}

/**
 * Configuration options for person discovery searches.
 */
export interface PersonDiscoveryOptions {
  /**
   * Maximum number of candidates to return.
   * @default 20
   */
  maxCandidates?: number;

  /**
   * Providers to use for discovery, in order of preference.
   * If a provider fails, the next one is tried.
   * @default ['google_lens', 'bing_reverse_image']
   */
  providers?: PersonDiscoveryProvider[];

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Skip cache and force fresh search.
   * @default false
   */
  skipCache?: boolean;
}

/**
 * Default options for person discovery searches.
 */
export const PERSON_DISCOVERY_DEFAULTS: Required<PersonDiscoveryOptions> = {
  maxCandidates: 20,
  providers: ['google_lens', 'google_reverse_image', 'bing_reverse_image'],
  timeout: 30000,
  skipCache: false,
};

/**
 * Result of a person discovery search operation.
 */
export interface PersonDiscoveryResult {
  /**
   * List of discovered candidate images.
   * Sorted by rank (most relevant first).
   */
  candidates: PersonDiscoveryCandidate[];

  /**
   * Providers that were actually used during this search.
   * May differ from requested providers if some were unavailable.
   */
  providersUsed: PersonDiscoveryProvider[];

  /**
   * Total number of results found before truncation.
   */
  totalFound: number;

  /**
   * Whether the results were truncated due to maxCandidates limit.
   */
  truncated: boolean;

  /**
   * Whether the result was served from cache.
   */
  cacheHit: boolean;

  /**
   * Time taken to perform the search in milliseconds.
   */
  durationMs: number;
}

/**
 * Person Discovery Engine Interface
 *
 * Defines the contract for search engines that can discover where a person's
 * face appears across the web. Implementations may use services like Google Lens
 * or Bing Reverse Image Search.
 */
export interface PersonDiscoveryEngine {
  /**
   * Human-readable name for this engine.
   */
  readonly name: string;

  /**
   * Discover candidate images by providing a publicly accessible image URL.
   *
   * @param imageUrl - Publicly accessible URL of the image containing the person's face
   * @param options - Optional search configuration
   * @returns Promise resolving to discovery results with candidate images
   * @throws {PersonDiscoveryError} When the search operation fails
   */
  discoverByImageUrl(
    imageUrl: string,
    options?: PersonDiscoveryOptions
  ): Promise<PersonDiscoveryResult>;

  /**
   * Discover candidate images by uploading image data directly.
   * This method is optional as not all providers support direct upload.
   *
   * @param file - Image data as a Buffer
   * @param mimeType - MIME type of the image (e.g., 'image/jpeg', 'image/png')
   * @param options - Optional search configuration
   * @returns Promise resolving to discovery results with candidate images
   * @throws {PersonDiscoveryError} When the search operation fails
   */
  discoverByUpload?(
    file: Buffer,
    mimeType: string,
    options?: PersonDiscoveryOptions
  ): Promise<PersonDiscoveryResult>;

  /**
   * Check if the engine is available and can accept requests.
   * This should verify API keys are configured and the service is reachable.
   *
   * @returns Promise resolving to true if the engine is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Factory function type for creating person discovery engines.
 */
export type PersonDiscoveryEngineFactory = () => PersonDiscoveryEngine;

/**
 * Merge user options with defaults.
 *
 * @param options - User-provided options (partial)
 * @returns Fully resolved options with defaults applied
 */
export function mergePersonDiscoveryOptions(
  options?: PersonDiscoveryOptions
): Required<PersonDiscoveryOptions> {
  return {
    ...PERSON_DISCOVERY_DEFAULTS,
    ...options,
  };
}
