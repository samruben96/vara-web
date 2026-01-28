/**
 * TinEye Scan Engine
 *
 * Implementation of the ScanEngine interface for TinEye reverse image search API.
 * Handles authentication, request/response mapping, and retry logic with exponential backoff.
 */

import type { ScanEngine, ScanProvider } from '../interfaces/scan-engine.interface';
import type {
  ScanResult,
  ScanMatch,
  ScanStats,
  ScanBacklink,
  HealthStatus,
  QuotaInfo,
  QuotaBundle,
  MatchTag,
} from '../interfaces/scan-result.types';
import { scoreToConfidence } from '../interfaces/scan-result.types';
import type { ScanOptions, RetryConfig, ResolvedScanOptions } from '../interfaces/scan-options.types';
import { TINEYE_DEFAULTS, mergeWithDefaults } from '../interfaces/scan-options.types';
import {
  TinEyeError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  NotConfiguredError,
} from '../errors/scan.errors';

/**
 * TinEye API response types (raw API format).
 */
interface TinEyeBacklink {
  url: string;
  backlink: string;
  crawl_date?: string;
}

interface TinEyeMatch {
  image_url: string;
  domain: string;
  score: number;
  query_match_percent?: number;
  overlay?: string;
  format?: string;
  filesize?: number;
  width?: number;
  height?: number;
  size?: number;
  tags?: string[];
  backlinks?: TinEyeBacklink[];
}

interface TinEyeStats {
  timestamp?: number;
  query_time?: number;
  total_results?: number;
  total_backlinks?: number;
  total_stock?: number;
  total_collection?: number;
  total_filtered_results?: number;
}

interface TinEyeSearchResponse {
  code: number;
  messages?: string[];
  stats?: TinEyeStats;
  results?: {
    matches?: TinEyeMatch[];
  };
}

interface TinEyeBundle {
  remaining_searches: number;
  start_date: string;
  end_date: string;
}

interface TinEyeRemainingSearchesResponse {
  code: number;
  messages?: string[];
  results?: {
    bundles?: TinEyeBundle[];
    total_remaining_searches?: number;
  };
}

interface TinEyeImageCountResponse {
  code: number;
  messages?: string[];
  stats?: {
    timestamp?: number;
    query_time?: number;
  };
  results?: number;
}

/**
 * TinEye reverse image search engine.
 *
 * Features:
 * - Search by URL (GET /search/)
 * - Search by upload (POST /search/)
 * - Quota checking (GET /remaining_searches/)
 * - Health checking (GET /image_count/)
 * - Automatic retry with exponential backoff for rate limits
 */
export class TinEyeEngine implements ScanEngine {
  public readonly provider: ScanProvider = 'tineye';
  public readonly displayName = 'TinEye';

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.TINEYE_API_KEY;
    this.baseUrl = TINEYE_DEFAULTS.BASE_URL;
  }

  /**
   * Checks if the engine is properly configured with an API key.
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Search for image matches by URL.
   */
  async searchByUrl(imageUrl: string, options?: ScanOptions): Promise<ScanResult> {
    this.ensureConfigured();

    const opts = mergeWithDefaults(options);
    const params = this.buildSearchParams(opts);
    params.set('image_url', imageUrl);

    const url = `${this.baseUrl}/search/?${params.toString()}`;

    return this.executeSearch(url, undefined, opts);
  }

  /**
   * Search for image matches by uploading image data.
   */
  async searchByUpload(
    imageBuffer: Buffer,
    filename: string,
    options?: ScanOptions
  ): Promise<ScanResult> {
    this.ensureConfigured();

    const opts = mergeWithDefaults(options);
    const params = this.buildSearchParams(opts);
    const url = `${this.baseUrl}/search/?${params.toString()}`;

    // Build multipart form data
    const formData = new FormData();
    // Convert Buffer to ArrayBuffer for proper Blob compatibility in Node.js
    const arrayBuffer = imageBuffer.buffer.slice(
      imageBuffer.byteOffset,
      imageBuffer.byteOffset + imageBuffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: this.getMimeType(filename) });
    formData.append('image_upload', blob, filename);

    return this.executeSearch(url, formData, opts);
  }

  /**
   * Get remaining API quota.
   */
  async getQuota(): Promise<QuotaInfo> {
    this.ensureConfigured();

    const url = `${this.baseUrl}/remaining_searches/`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(TINEYE_DEFAULTS.TIMEOUT_MS),
      });

      const data = (await response.json()) as TinEyeRemainingSearchesResponse;

      if (!response.ok) {
        throw TinEyeError.fromResponse(response.status, data);
      }

      const bundles: QuotaBundle[] = (data.results?.bundles ?? []).map((b) => ({
        remainingSearches: b.remaining_searches,
        startDate: b.start_date,
        endDate: b.end_date,
      }));

      return {
        provider: this.provider,
        totalRemainingSearches: data.results?.total_remaining_searches ?? 0,
        bundles,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof TinEyeError) {
        throw error;
      }
      throw this.wrapError(error, startTime);
    }
  }

  /**
   * Check engine health by getting image count.
   */
  async checkHealth(): Promise<HealthStatus> {
    const startTime = Date.now();

    // If not configured, return unhealthy status without making API call
    if (!this.isConfigured()) {
      return {
        provider: this.provider,
        healthy: false,
        message: 'TinEye API key not configured',
        responseTimeMs: 0,
        checkedAt: new Date().toISOString(),
      };
    }

    const url = `${this.baseUrl}/image_count/`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(TINEYE_DEFAULTS.TIMEOUT_MS),
      });

      const responseTimeMs = Date.now() - startTime;
      const data = (await response.json()) as TinEyeImageCountResponse;

      if (!response.ok) {
        return {
          provider: this.provider,
          healthy: false,
          message: `API returned ${response.status}: ${data.messages?.join('; ') ?? 'Unknown error'}`,
          responseTimeMs,
          checkedAt: new Date().toISOString(),
        };
      }

      return {
        provider: this.provider,
        healthy: true,
        message: 'TinEye API is operational',
        indexedImages: data.results,
        responseTimeMs,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        provider: this.provider,
        healthy: false,
        message: `Health check failed: ${errorMessage}`,
        responseTimeMs,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Ensures the engine is configured before making API calls.
   */
  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new NotConfiguredError(this.provider);
    }
  }

  /**
   * Builds common headers for TinEye API requests.
   */
  private getHeaders(): Record<string, string> {
    return {
      'X-API-KEY': this.apiKey!,
      Accept: 'application/json',
    };
  }

  /**
   * Builds URL search parameters for search requests.
   */
  private buildSearchParams(
    opts: ResolvedScanOptions
  ): URLSearchParams {
    const params = new URLSearchParams();

    params.set('limit', opts.limit.toString());
    params.set('offset', opts.offset.toString());
    params.set('backlink_limit', opts.backlinkLimit.toString());
    params.set('sort', opts.sort);
    params.set('order', opts.order);

    if (opts.domain) {
      params.set('domain', opts.domain);
    }

    if (opts.tags && opts.tags.length > 0) {
      params.set('tags', opts.tags.join(','));
    }

    return params;
  }

  /**
   * Executes a search request with retry logic.
   */
  private async executeSearch(
    url: string,
    body: FormData | undefined,
    opts: ResolvedScanOptions
  ): Promise<ScanResult> {
    const retry = opts.retry;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        const headers = this.getHeaders();

        // Don't set Content-Type for FormData - fetch will set it with boundary
        const fetchOptions: RequestInit = {
          method: body ? 'POST' : 'GET',
          headers: body ? { ...headers } : headers,
          body,
          signal: AbortSignal.timeout(opts.timeoutMs),
        };

        const response = await fetch(url, fetchOptions);
        const data = (await response.json()) as TinEyeSearchResponse;

        if (!response.ok) {
          const error = TinEyeError.fromResponse(response.status, data);

          // Retry on rate limit
          if (response.status === 429 && attempt < retry.maxRetries) {
            const delay = this.calculateBackoff(attempt, retry);
            console.log(
              `[TinEyeEngine] Rate limited (attempt ${attempt + 1}/${retry.maxRetries + 1}), retrying in ${delay}ms`
            );
            await this.sleep(delay);
            lastError = error;
            continue;
          }

          // If we've exhausted retries on rate limit, throw RateLimitError
          if (response.status === 429) {
            throw new RateLimitError(this.provider, {
              attemptsMade: attempt + 1,
              details: data,
            });
          }

          throw error;
        }

        return this.mapResponse(data, startTime);
      } catch (error) {
        // Don't retry on non-retryable errors
        if (error instanceof TinEyeError && !error.retryable) {
          throw error;
        }

        if (error instanceof RateLimitError) {
          throw error;
        }

        // Wrap and potentially retry network/timeout errors
        const wrappedError = this.wrapError(error, startTime);

        if (wrappedError.retryable && attempt < retry.maxRetries) {
          const delay = this.calculateBackoff(attempt, retry);
          console.log(
            `[TinEyeEngine] ${wrappedError.name} (attempt ${attempt + 1}/${retry.maxRetries + 1}), retrying in ${delay}ms`
          );
          await this.sleep(delay);
          lastError = wrappedError;
          continue;
        }

        throw wrappedError;
      }
    }

    // Should not reach here, but just in case
    throw lastError ?? new TinEyeError('TINEYE_API_ERROR', 'Search failed');
  }

  /**
   * Maps TinEye API response to normalized ScanResult.
   */
  private mapResponse(data: TinEyeSearchResponse, startTime: number): ScanResult {
    const matches: ScanMatch[] = (data.results?.matches ?? []).map((match) =>
      this.mapMatch(match)
    );

    const stats: ScanStats = {
      timestamp: data.stats?.timestamp ?? Math.floor(Date.now() / 1000),
      queryTimeMs: data.stats?.query_time ?? Date.now() - startTime,
      totalResults: data.stats?.total_results ?? matches.length,
      totalBacklinks: data.stats?.total_backlinks ?? 0,
      totalStock: data.stats?.total_stock ?? 0,
      totalCollection: data.stats?.total_collection ?? 0,
      totalFilteredResults: data.stats?.total_filtered_results,
    };

    return {
      provider: this.provider,
      success: true,
      matches,
      stats,
      searchedAt: new Date().toISOString(),
      warnings: data.messages,
    };
  }

  /**
   * Maps a TinEye match to normalized ScanMatch.
   */
  private mapMatch(match: TinEyeMatch): ScanMatch {
    const backlinks: ScanBacklink[] = (match.backlinks ?? []).map((bl) => ({
      imageUrl: bl.url,
      pageUrl: bl.backlink,
      crawlDate: bl.crawl_date,
    }));

    const tags: MatchTag[] = (match.tags ?? []).filter(
      (tag): tag is MatchTag => tag === 'stock' || tag === 'collection'
    );

    return {
      imageUrl: match.image_url,
      domain: match.domain,
      score: match.score,
      confidence: scoreToConfidence(match.score),
      queryMatchPercent: match.query_match_percent,
      overlayUrl: match.overlay,
      format: match.format,
      filesize: match.filesize,
      width: match.width,
      height: match.height,
      size: match.size,
      tags,
      backlinks,
    };
  }

  /**
   * Calculates exponential backoff delay with jitter.
   */
  private calculateBackoff(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

    // Add jitter: +/- jitterFactor * delay
    const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Wraps unknown errors in appropriate error types.
   */
  private wrapError(error: unknown, startTime: number): TinEyeError | NetworkError | TimeoutError {
    if (error instanceof TinEyeError) {
      return error;
    }

    if (error instanceof Error) {
      // Check for timeout
      if (
        error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        error.message.includes('timeout')
      ) {
        return new TimeoutError(this.provider, Date.now() - startTime, {
          cause: error,
        });
      }

      // Check for network errors
      if (
        error.name === 'TypeError' ||
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        return new NetworkError(this.provider, error.message, { cause: error });
      }
    }

    // Generic API error
    return new TinEyeError(
      'TINEYE_API_ERROR',
      error instanceof Error ? error.message : 'Unknown error',
      {
        retryable: false,
        cause: error instanceof Error ? error : undefined,
      }
    );
  }

  /**
   * Gets MIME type from filename.
   */
  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      avif: 'image/avif',
    };
    return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance of TinEyeEngine.
 */
let tineyeEngineInstance: TinEyeEngine | undefined;

/**
 * Gets the singleton TinEyeEngine instance.
 */
export function getTinEyeEngine(): TinEyeEngine {
  if (!tineyeEngineInstance) {
    tineyeEngineInstance = new TinEyeEngine();
  }
  return tineyeEngineInstance;
}
