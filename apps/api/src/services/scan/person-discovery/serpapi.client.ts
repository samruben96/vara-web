/**
 * SerpAPI HTTP Client
 *
 * Low-level HTTP client for SerpAPI reverse image search engines (Google Lens, Bing).
 * Handles authentication, request building, rate limiting, and response parsing.
 *
 * SerpAPI Endpoints:
 * - Google Lens: GET /search?engine=google_lens&url={imageUrl}&api_key={key}
 * - Bing Reverse Image: GET /search?engine=bing_reverse_image&image_url={imageUrl}&api_key={key}
 *
 * @see https://serpapi.com/google-lens-api
 * @see https://serpapi.com/bing-reverse-image-api
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the SerpAPI client.
 */
export interface SerpApiClientOptions {
  /**
   * SerpAPI API key.
   * Get one at https://serpapi.com/
   */
  apiKey: string;

  /**
   * Base URL for the SerpAPI service.
   * @default 'https://serpapi.com'
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Maximum number of retry attempts for retryable errors.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay between retries in milliseconds (used for exponential backoff).
   * @default 1000
   */
  retryBaseDelay?: number;

  /**
   * Maximum delay between retries in milliseconds.
   * @default 10000
   */
  retryMaxDelay?: number;
}

/**
 * Default configuration values.
 */
const SERPAPI_DEFAULTS = {
  BASE_URL: 'https://serpapi.com',
  TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,
  RETRY_MAX_DELAY_MS: 10000,
  SLOW_RESPONSE_THRESHOLD_MS: 10000,
} as const;

// ============================================================================
// Response Types - Google Lens
// ============================================================================

/**
 * Metadata returned with every SerpAPI search.
 */
export interface SerpApiSearchMetadata {
  id: string;
  status: 'Success' | 'Error' | 'Processing';
  json_endpoint?: string;
  created_at?: string;
  processed_at?: string;
  total_time_taken?: number;
  google_lens_url?: string;
  bing_reverse_image_url?: string;
}

/**
 * A visual match from Google Lens.
 */
export interface GoogleLensVisualMatch {
  /**
   * Position in search results (1-indexed).
   */
  position: number;

  /**
   * Title of the matched page or image.
   */
  title: string;

  /**
   * URL of the page containing the image.
   */
  link: string;

  /**
   * Domain/source of the match.
   */
  source: string;

  /**
   * URL to thumbnail image.
   */
  thumbnail: string;

  /**
   * Direct URL to the original image, if available.
   */
  original?: string;

  /**
   * Image dimensions, if available.
   */
  size?: {
    width: number;
    height: number;
  };

  /**
   * Source icon URL.
   */
  source_icon?: string;
}

/**
 * Full response from Google Lens API.
 */
export interface GoogleLensResponse {
  /**
   * Search metadata.
   */
  search_metadata: SerpApiSearchMetadata;

  /**
   * Search parameters that were used.
   */
  search_parameters?: {
    engine: 'google_lens';
    url: string;
  };

  /**
   * Visual matches found for the image.
   */
  visual_matches?: GoogleLensVisualMatch[];

  /**
   * Knowledge graph information about detected objects.
   */
  knowledge_graph?: Array<{
    title?: string;
    subtitle?: string;
    link?: string;
    images?: Array<{
      title?: string;
      source?: string;
      link?: string;
    }>;
  }>;

  /**
   * Error message if the request failed.
   */
  error?: string;
}

// ============================================================================
// Response Types - Bing Reverse Image
// ============================================================================

/**
 * A related content result from Bing Reverse Image search.
 */
export interface BingReverseImageResult {
  /**
   * Position in search results (1-indexed).
   */
  position: number;

  /**
   * Title of the matched page.
   */
  title: string;

  /**
   * Domain of the source.
   */
  source?: string;

  /**
   * URL to the Bing search result page.
   */
  link: string;

  /**
   * URL to thumbnail image.
   */
  thumbnail: string;

  /**
   * Direct URL to the original image, if available.
   */
  original?: string;

  /**
   * CDN URL to the original image (via Bing's CDN).
   */
  cdn_original?: string;

  /**
   * Domain where the image was found.
   */
  domain?: string;

  /**
   * Image width in pixels.
   */
  width?: number;

  /**
   * Image height in pixels.
   */
  height?: number;

  /**
   * Image format (e.g., 'jpeg', 'png').
   */
  format?: string;

  /**
   * File size as a string (e.g., '128095 B').
   */
  file_size?: string;

  /**
   * Thumbnail dimensions.
   */
  thumbnail_width?: number;
  thumbnail_height?: number;

  /**
   * Date the image was published or last modified.
   */
  date?: string;
}

/**
 * Image info from Bing Reverse Image search.
 */
export interface BingImageInfo {
  title?: string;
  link?: string;
  source?: string;
  original?: string;
  cdn_original?: string;
  domain?: string;
  width?: number;
  height?: number;
  format?: string;
  file_size?: string;
  thumbnail?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  date?: string;
}

/**
 * Full response from Bing Reverse Image API.
 */
export interface BingReverseImageResponse {
  /**
   * Search metadata.
   */
  search_metadata: SerpApiSearchMetadata;

  /**
   * Search parameters that were used.
   */
  search_parameters?: {
    engine: 'bing_reverse_image';
    image_url: string;
  };

  /**
   * Information about the search results.
   */
  search_information?: {
    total_estimated_matches?: number;
  };

  /**
   * Information about the searched image.
   */
  image_info?: BingImageInfo;

  /**
   * Related image results.
   */
  related_content?: BingReverseImageResult[];

  /**
   * Direct image search results.
   */
  images_results?: BingReverseImageResult[];

  /**
   * Error message if the request failed.
   */
  error?: string;
}

// ============================================================================
// Response Types - Google Reverse Image
// ============================================================================

/**
 * An image result from Google Reverse Image search.
 */
export interface GoogleReverseImageResult {
  /**
   * Position in search results (1-indexed).
   */
  position: number;

  /**
   * Title of the matched page or image.
   */
  title: string;

  /**
   * URL of the page containing the image.
   */
  link: string;

  /**
   * Domain/source of the match.
   */
  source?: string;

  /**
   * URL to thumbnail image.
   */
  thumbnail?: string;

  /**
   * Direct URL to the original image, if available.
   */
  original?: string;

  /**
   * Image dimensions as string (e.g., "800 x 600").
   */
  size?: string;
}

/**
 * Full response from Google Reverse Image API.
 */
export interface GoogleReverseImageResponse {
  /**
   * Search metadata.
   */
  search_metadata: SerpApiSearchMetadata;

  /**
   * Search parameters that were used.
   */
  search_parameters?: {
    engine: 'google_reverse_image';
    image_url: string;
  };

  /**
   * Image results from reverse image search.
   */
  image_results?: GoogleReverseImageResult[];

  /**
   * Inline images (thumbnails from same page).
   */
  inline_images?: Array<{
    link?: string;
    source?: string;
    thumbnail?: string;
    original?: string;
  }>;

  /**
   * Error message if the request failed.
   */
  error?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for SerpAPI operations.
 */
export type SerpApiErrorCode =
  | 'SERPAPI_AUTH_ERROR'
  | 'SERPAPI_RATE_LIMITED'
  | 'SERPAPI_INVALID_REQUEST'
  | 'SERPAPI_NETWORK_ERROR'
  | 'SERPAPI_TIMEOUT'
  | 'SERPAPI_API_ERROR'
  | 'SERPAPI_NOT_CONFIGURED';

/**
 * Base error class for SerpAPI operations.
 */
export class SerpApiError extends Error {
  /**
   * Error code for programmatic handling.
   */
  public readonly code: SerpApiErrorCode;

  /**
   * HTTP status code if applicable.
   */
  public readonly statusCode?: number;

  /**
   * Raw response from the API.
   */
  public readonly response?: unknown;

  /**
   * Whether this error is retryable.
   */
  public readonly retryable: boolean;

  /**
   * The underlying error that caused this error (if any).
   */
  public declare readonly cause?: Error;

  constructor(
    code: SerpApiErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      response?: unknown;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'SerpApiError';
    this.code = code;
    this.statusCode = options?.statusCode;
    this.response = options?.response;
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;

    // Maintain proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Creates a serializable representation of the error.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
    };
  }
}

/**
 * Error thrown when rate limited by SerpAPI.
 */
export class SerpApiRateLimitError extends SerpApiError {
  /**
   * Seconds to wait before retrying (from Retry-After header).
   */
  public readonly retryAfter?: number;

  constructor(options?: {
    retryAfter?: number;
    response?: unknown;
    cause?: Error;
  }) {
    super(
      'SERPAPI_RATE_LIMITED',
      options?.retryAfter
        ? `Rate limit exceeded. Retry after ${options.retryAfter} seconds.`
        : 'Rate limit exceeded. Please wait before retrying.',
      {
        statusCode: 429,
        retryable: true,
        response: options?.response,
        cause: options?.cause,
      }
    );
    this.name = 'SerpApiRateLimitError';
    this.retryAfter = options?.retryAfter;
  }
}

/**
 * Error thrown when authentication fails.
 */
export class SerpApiAuthError extends SerpApiError {
  constructor(message?: string, options?: { response?: unknown; cause?: Error }) {
    super('SERPAPI_AUTH_ERROR', message ?? 'Invalid or missing API key', {
      statusCode: 401,
      retryable: false,
      response: options?.response,
      cause: options?.cause,
    });
    this.name = 'SerpApiAuthError';
  }
}

// ============================================================================
// SerpAPI Client
// ============================================================================

/**
 * SerpAPI HTTP client for Google Lens and Bing Reverse Image search.
 *
 * Features:
 * - Google Lens reverse image search
 * - Bing Reverse Image search
 * - Automatic retry with exponential backoff
 * - Rate limit handling
 * - Request logging with API key masking
 *
 * @example
 * ```typescript
 * const client = new SerpApiClient({
 *   apiKey: process.env.SERPAPI_API_KEY!,
 * });
 *
 * // Google Lens search
 * const lensResults = await client.searchGoogleLens('https://example.com/image.jpg');
 *
 * // Bing Reverse Image search
 * const bingResults = await client.searchBingReverseImage('https://example.com/image.jpg');
 *
 * // Health check
 * const isAvailable = await client.isAvailable();
 * ```
 */
export class SerpApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;
  private readonly retryMaxDelay: number;

  constructor(options: SerpApiClientOptions) {
    if (!options.apiKey) {
      throw new SerpApiError(
        'SERPAPI_NOT_CONFIGURED',
        'SerpAPI API key is required'
      );
    }

    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? SERPAPI_DEFAULTS.BASE_URL;
    this.timeout = options.timeout ?? SERPAPI_DEFAULTS.TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? SERPAPI_DEFAULTS.MAX_RETRIES;
    this.retryBaseDelay = options.retryBaseDelay ?? SERPAPI_DEFAULTS.RETRY_BASE_DELAY_MS;
    this.retryMaxDelay = options.retryMaxDelay ?? SERPAPI_DEFAULTS.RETRY_MAX_DELAY_MS;
  }

  /**
   * Perform a Google Lens reverse image search.
   *
   * @param imageUrl - Public URL of the image to search
   * @returns Google Lens search results
   * @throws {SerpApiRateLimitError} When rate limited
   * @throws {SerpApiAuthError} When API key is invalid
   * @throws {SerpApiError} For other API errors
   */
  async searchGoogleLens(imageUrl: string): Promise<GoogleLensResponse> {
    const params = new URLSearchParams({
      engine: 'google_lens',
      url: imageUrl,
      type: 'visual_matches', // Required for visual match results
      hl: 'en',
      country: 'us',
      api_key: this.apiKey,
    });

    const url = `${this.baseUrl}/search?${params.toString()}`;
    return this.executeRequest<GoogleLensResponse>(url, 'google_lens');
  }

  /**
   * Perform a Bing Reverse Image search.
   *
   * @param imageUrl - Public URL of the image to search
   * @returns Bing Reverse Image search results
   * @throws {SerpApiRateLimitError} When rate limited
   * @throws {SerpApiAuthError} When API key is invalid
   * @throws {SerpApiError} For other API errors
   */
  async searchBingReverseImage(imageUrl: string): Promise<BingReverseImageResponse> {
    const params = new URLSearchParams({
      engine: 'bing_reverse_image',
      image_url: imageUrl,
      api_key: this.apiKey,
    });

    const url = `${this.baseUrl}/search?${params.toString()}`;
    return this.executeRequest<BingReverseImageResponse>(url, 'bing_reverse_image');
  }

  /**
   * Perform a Google Reverse Image search.
   *
   * @param imageUrl - Public URL of the image to search
   * @returns Google Reverse Image search results
   * @throws {SerpApiRateLimitError} When rate limited
   * @throws {SerpApiAuthError} When API key is invalid
   * @throws {SerpApiError} For other API errors
   */
  async searchGoogleReverseImage(imageUrl: string): Promise<GoogleReverseImageResponse> {
    const params = new URLSearchParams({
      engine: 'google_reverse_image',
      image_url: imageUrl,
      api_key: this.apiKey,
    });

    const url = `${this.baseUrl}/search?${params.toString()}`;
    return this.executeRequest<GoogleReverseImageResponse>(url, 'google_reverse_image');
  }

  /**
   * Check if the SerpAPI service is available.
   *
   * This performs a lightweight request to verify:
   * - API key is valid
   * - Service is reachable
   *
   * @returns true if the service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Use the account endpoint to check API key validity
      const params = new URLSearchParams({
        api_key: this.apiKey,
      });
      const url = `${this.baseUrl}/account?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      return response.ok;
    } catch (error) {
      this.logWarning('Health check failed', error);
      return false;
    }
  }

  /**
   * Execute an HTTP request with retry logic.
   */
  private async executeRequest<T>(
    url: string,
    engine: 'google_lens' | 'google_reverse_image' | 'bing_reverse_image'
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        // Log request start (mask API key)
        this.logRequest(url, engine, attempt);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(this.timeout),
        });

        const responseTime = Date.now() - startTime;
        const data = (await response.json()) as T;

        // Log response
        this.logResponse(engine, response.status, responseTime);

        // Handle error responses
        if (!response.ok) {
          const error = this.createErrorFromResponse(response, data);

          // Retry on rate limit
          if (response.status === 429 && attempt < this.maxRetries) {
            const retryAfter = this.parseRetryAfter(response);
            const delay = retryAfter
              ? retryAfter * 1000
              : this.calculateBackoff(attempt);

            this.logRetry(engine, attempt, delay, 'rate_limit');
            await this.sleep(delay);
            lastError = error;
            continue;
          }

          // Retry on 5xx errors
          if (response.status >= 500 && attempt < this.maxRetries) {
            const delay = this.calculateBackoff(attempt);
            this.logRetry(engine, attempt, delay, 'server_error');
            await this.sleep(delay);
            lastError = error;
            continue;
          }

          throw error;
        }

        // Check for API-level error in response body
        const responseWithError = data as { error?: string };
        if (responseWithError.error) {
          throw new SerpApiError(
            'SERPAPI_API_ERROR',
            responseWithError.error,
            {
              response: data,
              retryable: false,
            }
          );
        }

        return data;
      } catch (error) {
        // Don't retry on non-retryable errors
        if (error instanceof SerpApiError && !error.retryable) {
          throw error;
        }

        // Retry on network/timeout errors
        if (this.isRetryableNetworkError(error) && attempt < this.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          this.logRetry(engine, attempt, delay, 'network_error');
          await this.sleep(delay);
          lastError = this.wrapError(error, startTime);
          continue;
        }

        throw this.wrapError(error, startTime);
      }
    }

    // Should not reach here, but just in case
    throw lastError ?? new SerpApiError('SERPAPI_API_ERROR', 'Request failed');
  }

  /**
   * Create an appropriate error from the HTTP response.
   */
  private createErrorFromResponse(
    response: Response,
    data: unknown
  ): SerpApiError {
    const status = response.status;

    switch (status) {
      case 401:
      case 403:
        return new SerpApiAuthError('Invalid API key', { response: data });

      case 429: {
        const retryAfter = this.parseRetryAfter(response);
        return new SerpApiRateLimitError({
          retryAfter,
          response: data,
        });
      }

      case 400:
        return new SerpApiError(
          'SERPAPI_INVALID_REQUEST',
          this.extractErrorMessage(data) ?? 'Invalid request',
          {
            statusCode: status,
            response: data,
            retryable: false,
          }
        );

      default:
        return new SerpApiError(
          'SERPAPI_API_ERROR',
          this.extractErrorMessage(data) ?? `API request failed with status ${status}`,
          {
            statusCode: status,
            response: data,
            retryable: status >= 500,
          }
        );
    }
  }

  /**
   * Wrap unknown errors in SerpApiError.
   */
  private wrapError(error: unknown, startTime: number): SerpApiError {
    if (error instanceof SerpApiError) {
      return error;
    }

    const elapsed = Date.now() - startTime;

    if (error instanceof Error) {
      // Check for timeout
      if (
        error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        error.message.includes('timeout')
      ) {
        return new SerpApiError(
          'SERPAPI_TIMEOUT',
          `Request timed out after ${elapsed}ms`,
          {
            retryable: true,
            cause: error,
          }
        );
      }

      // Check for network errors
      if (
        error.name === 'TypeError' ||
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        return new SerpApiError(
          'SERPAPI_NETWORK_ERROR',
          error.message,
          {
            retryable: true,
            cause: error,
          }
        );
      }
    }

    // Generic error
    return new SerpApiError(
      'SERPAPI_API_ERROR',
      error instanceof Error ? error.message : 'Unknown error',
      {
        retryable: false,
        cause: error instanceof Error ? error : undefined,
      }
    );
  }

  /**
   * Check if an error is a retryable network error.
   */
  private isRetryableNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        error.name === 'TypeError' ||
        error.message.includes('timeout') ||
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      );
    }
    return false;
  }

  /**
   * Parse Retry-After header value.
   */
  private parseRetryAfter(response: Response): number | undefined {
    const retryAfter = response.headers.get('Retry-After');
    if (!retryAfter) {
      return undefined;
    }

    // Could be seconds or HTTP date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds;
    }

    // Try to parse as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
    }

    return undefined;
  }

  /**
   * Extract error message from response data.
   */
  private extractErrorMessage(data: unknown): string | undefined {
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (typeof obj.error === 'string') {
        return obj.error;
      }
      if (typeof obj.message === 'string') {
        return obj.message;
      }
    }
    return undefined;
  }

  /**
   * Calculate exponential backoff delay.
   */
  private calculateBackoff(attempt: number): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = this.retryBaseDelay * Math.pow(2, attempt);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.retryMaxDelay);

    // Add jitter: +/- 20% of delay
    const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1);

    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Mask API key for logging (show only last 4 chars).
   */
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 4) {
      return '****';
    }
    return `****${apiKey.slice(-4)}`;
  }

  /**
   * Log request start.
   */
  private logRequest(
    url: string,
    engine: string,
    attempt: number
  ): void {
    // Mask API key in URL for logging
    const maskedUrl = url.replace(
      /api_key=[^&]+/,
      `api_key=${this.maskApiKey(this.apiKey)}`
    );

    const attemptInfo = attempt > 0 ? ` (attempt ${attempt + 1}/${this.maxRetries + 1})` : '';
    console.log(`[SerpApiClient] ${engine} search starting${attemptInfo}: ${maskedUrl}`);
  }

  /**
   * Log response.
   */
  private logResponse(
    engine: string,
    status: number,
    responseTimeMs: number
  ): void {
    const logLevel = responseTimeMs > SERPAPI_DEFAULTS.SLOW_RESPONSE_THRESHOLD_MS
      ? 'warn'
      : 'log';

    const slowWarning = responseTimeMs > SERPAPI_DEFAULTS.SLOW_RESPONSE_THRESHOLD_MS
      ? ' [SLOW]'
      : '';

    console[logLevel](
      `[SerpApiClient] ${engine} search completed: status=${status}, time=${responseTimeMs}ms${slowWarning}`
    );
  }

  /**
   * Log retry attempt.
   */
  private logRetry(
    engine: string,
    attempt: number,
    delayMs: number,
    reason: string
  ): void {
    console.log(
      `[SerpApiClient] ${engine} ${reason} (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delayMs}ms`
    );
  }

  /**
   * Log warning.
   */
  private logWarning(message: string, error?: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[SerpApiClient] ${message}: ${errorMessage}`);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Singleton instance of SerpApiClient.
 */
let serpApiClientInstance: SerpApiClient | undefined;

/**
 * Get or create the singleton SerpApiClient instance.
 *
 * Uses SERPAPI_API_KEY environment variable for configuration.
 *
 * @returns SerpApiClient instance
 * @throws {SerpApiError} If SERPAPI_API_KEY is not set
 */
export function getSerpApiClient(): SerpApiClient {
  if (!serpApiClientInstance) {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      throw new SerpApiError(
        'SERPAPI_NOT_CONFIGURED',
        'SERPAPI_API_KEY environment variable is not set'
      );
    }

    serpApiClientInstance = new SerpApiClient({ apiKey });
  }
  return serpApiClientInstance;
}

/**
 * Check if SerpAPI is configured (API key is available).
 *
 * @returns true if SERPAPI_API_KEY environment variable is set
 */
export function isSerpApiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY);
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetSerpApiClient(): void {
  serpApiClientInstance = undefined;
}
