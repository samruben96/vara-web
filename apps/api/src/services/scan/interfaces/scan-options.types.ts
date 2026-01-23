/**
 * Scan Options Types
 *
 * Configuration options for reverse image search operations.
 */

/**
 * Sort order for results.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort field for results.
 */
export type SortBy = 'score' | 'size' | 'crawl_date';

/**
 * Tag filter options.
 */
export type TagFilter = 'stock' | 'collection';

/**
 * Retry configuration for handling rate limits and transient errors.
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts.
   * @default 5
   */
  maxRetries: number;

  /**
   * Base delay in milliseconds for exponential backoff.
   * @default 1000
   */
  baseDelayMs: number;

  /**
   * Maximum delay in milliseconds between retries.
   * @default 30000
   */
  maxDelayMs: number;

  /**
   * Jitter factor (0-1) to randomize retry delays.
   * Helps prevent thundering herd when multiple requests retry simultaneously.
   * @default 0.1
   */
  jitterFactor: number;
}

/**
 * TinEye-specific search options.
 */
export interface TinEyeSearchOptions {
  /**
   * Maximum number of results to return.
   * @default 50
   */
  limit?: number;

  /**
   * Offset for pagination.
   * @default 0
   */
  offset?: number;

  /**
   * Maximum number of backlinks per match.
   * @default 10
   */
  backlinkLimit?: number;

  /**
   * Sort field for results.
   * @default 'score'
   */
  sort?: SortBy;

  /**
   * Sort order.
   * @default 'desc'
   */
  order?: SortOrder;

  /**
   * Filter to specific domain (must be at least 5 characters).
   */
  domain?: string;

  /**
   * Filter to stock and/or collection results.
   */
  tags?: TagFilter[];
}

/**
 * General scan options that apply to all engines.
 */
export interface ScanOptions extends TinEyeSearchOptions {
  /**
   * Request timeout in milliseconds.
   * @default 15000
   */
  timeoutMs?: number;

  /**
   * Retry configuration for handling rate limits.
   */
  retry?: Partial<RetryConfig>;

  /**
   * Whether to include full backlink details.
   * @default true
   */
  includeBacklinks?: boolean;
}

/**
 * Default values for TinEye API requests.
 */
export const TINEYE_DEFAULTS = {
  /**
   * Base URL for TinEye API.
   */
  BASE_URL: 'https://api.tineye.com/rest',

  /**
   * Default number of results to return.
   */
  LIMIT: 50,

  /**
   * Default pagination offset.
   */
  OFFSET: 0,

  /**
   * Default number of backlinks per match.
   */
  BACKLINK_LIMIT: 10,

  /**
   * Default sort field.
   */
  SORT: 'score' as SortBy,

  /**
   * Default sort order.
   */
  ORDER: 'desc' as SortOrder,

  /**
   * Default request timeout in milliseconds.
   */
  TIMEOUT_MS: 15000,

  /**
   * Default retry configuration.
   */
  RETRY: {
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterFactor: 0.1,
  } satisfies RetryConfig,
} as const;

/**
 * Resolved scan options with all defaults applied.
 */
export interface ResolvedScanOptions {
  limit: number;
  offset: number;
  backlinkLimit: number;
  sort: SortBy;
  order: SortOrder;
  domain?: string;
  tags?: TagFilter[];
  timeoutMs: number;
  retry: RetryConfig;
  includeBacklinks: boolean;
}

/**
 * Merges provided options with defaults.
 *
 * @param options - User-provided options
 * @returns Complete options with defaults applied
 */
export function mergeWithDefaults(options?: ScanOptions): ResolvedScanOptions {
  const retry: RetryConfig = {
    ...TINEYE_DEFAULTS.RETRY,
    ...options?.retry,
  };

  return {
    limit: options?.limit ?? TINEYE_DEFAULTS.LIMIT,
    offset: options?.offset ?? TINEYE_DEFAULTS.OFFSET,
    backlinkLimit: options?.backlinkLimit ?? TINEYE_DEFAULTS.BACKLINK_LIMIT,
    sort: options?.sort ?? TINEYE_DEFAULTS.SORT,
    order: options?.order ?? TINEYE_DEFAULTS.ORDER,
    domain: options?.domain,
    tags: options?.tags,
    timeoutMs: options?.timeoutMs ?? TINEYE_DEFAULTS.TIMEOUT_MS,
    retry,
    includeBacklinks: options?.includeBacklinks ?? true,
  };
}
