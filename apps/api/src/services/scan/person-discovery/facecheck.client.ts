/**
 * FaceCheck.id API Client
 *
 * HTTP client wrapping the FaceCheck.id face recognition search API.
 * Handles upload, polling-based search, and cleanup with security hardening.
 *
 * SECURITY:
 * - Always deletes uploaded images after search (finally block)
 * - Never stores base64 thumbnails
 * - Masks API key in all logs
 * - Validates all returned URLs
 */

import {
  FaceCheckErrorCode,
  FACECHECK_DEFAULTS,
  type FaceCheckRawUploadResponse,
  type FaceCheckRawSearchResponse,
  type FaceCheckRawSearchOutput,
  type FaceCheckRawMatch,
  type FaceCheckRawInfoResponse,
  type FaceCheckMatch,
  type FaceCheckSearchResult,
  type FaceCheckUploadResult,
  type FaceCheckInfo,
  type FaceCheckPollingOptions,
} from './facecheck.types';
import {
  getFaceCheckConfig,
  isFaceCheckEnabled,
  type FaceCheckConfig,
} from '@/config/facecheck.config';

// ============================================================================
// Error Hierarchy
// ============================================================================

export class FaceCheckError extends Error {
  constructor(
    message: string,
    public readonly code: FaceCheckErrorCode,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'FaceCheckError';
  }
}

export class FaceCheckAuthError extends FaceCheckError {
  constructor(message: string = 'FaceCheck authentication failed') {
    super(message, FaceCheckErrorCode.AUTH_ERROR, false, 401);
    this.name = 'FaceCheckAuthError';
  }
}

export class FaceCheckUploadError extends FaceCheckError {
  constructor(message: string = 'FaceCheck image upload failed') {
    super(message, FaceCheckErrorCode.UPLOAD_ERROR, true);
    this.name = 'FaceCheckUploadError';
  }
}

export class FaceCheckCreditError extends FaceCheckError {
  constructor(message: string = 'Insufficient FaceCheck credits') {
    super(message, FaceCheckErrorCode.CREDIT_ERROR, false);
    this.name = 'FaceCheckCreditError';
  }
}

export class FaceCheckTimeoutError extends FaceCheckError {
  constructor(message: string = 'FaceCheck search timed out') {
    super(message, FaceCheckErrorCode.TIMEOUT, true);
    this.name = 'FaceCheckTimeoutError';
  }
}

export class FaceCheckCancelledError extends FaceCheckError {
  constructor(message: string = 'FaceCheck search was cancelled') {
    super(message, FaceCheckErrorCode.CANCELLED, false);
    this.name = 'FaceCheckCancelledError';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Mask API key for logging: show only last 4 chars */
function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

/** Validate and sanitize a URL. Returns null if invalid or non-HTTPS. */
function sanitizeUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/** Extract domain from URL */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/** Sleep with AbortSignal support */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new FaceCheckCancelledError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new FaceCheckCancelledError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Exponential backoff with jitter */
function getRetryDelay(attempt: number, baseDelay: number = FACECHECK_DEFAULTS.RETRY_BASE_DELAY_MS): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * exponentialDelay * 0.3;
  return exponentialDelay + jitter;
}

// ============================================================================
// FaceCheck Client
// ============================================================================

export class FaceCheckClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly demoMode: boolean;
  private readonly config: FaceCheckConfig;

  constructor(config?: FaceCheckConfig) {
    this.config = config ?? getFaceCheckConfig();
    this.apiKey = this.config.apiKey ?? '';
    this.baseUrl = this.config.apiBaseUrl;
    this.demoMode = this.config.demoMode;

    if (!this.apiKey) {
      console.warn('[FaceCheckClient] No API key configured');
    } else {
      console.log(`[FaceCheckClient] Initialized (key: ${maskApiKey(this.apiKey)}, demo: ${this.demoMode})`);
    }
  }

  /**
   * Upload an image to FaceCheck for face search.
   */
  async uploadImage(buffer: Buffer, mimeType: string): Promise<FaceCheckUploadResult> {
    const url = `${this.baseUrl}/api/upload_pic`;

    // Use a factory to re-create FormData on each retry attempt,
    // since FormData/ReadableStream bodies are consumed on first fetch.
    const buildInit = (): RequestInit => {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: mimeType });
      formData.append('images', blob, `face.${mimeType.split('/')[1] || 'jpg'}`);
      formData.append('id_search', '');
      return {
        method: 'POST',
        headers: { 'Authorization': this.apiKey },
        body: formData,
      };
    };

    const response = await this.fetchWithRetry(url, buildInit);

    if (!response.ok) {
      if (response.status === 401) throw new FaceCheckAuthError();
      throw new FaceCheckUploadError(`Upload failed with status ${response.status}`);
    }

    const data = await response.json() as FaceCheckRawUploadResponse;

    if (data.error) {
      if (data.error.toLowerCase().includes('no face')) {
        throw new FaceCheckError(data.error, FaceCheckErrorCode.NO_FACE_DETECTED, false);
      }
      throw new FaceCheckUploadError(data.error);
    }

    if (!data.id_search) {
      throw new FaceCheckError('Upload response missing id_search', FaceCheckErrorCode.INVALID_RESPONSE);
    }

    console.log(`[FaceCheckClient] Upload successful, id_search: ${data.id_search.substring(0, 8)}...`);
    return { idSearch: data.id_search };
  }

  /**
   * Search with polling. Polls /api/search until results are ready.
   * Always calls deletePic in finally block.
   */
  async searchWithPolling(
    idSearch: string,
    options?: FaceCheckPollingOptions,
  ): Promise<FaceCheckSearchResult> {
    const intervalMs = options?.intervalMs ?? this.config.pollIntervalMs;
    const maxTimeMs = options?.maxTimeMs ?? this.config.maxPollTimeMs;
    const signal = options?.signal;
    const onProgress = options?.onProgress;

    const startTime = Date.now();
    let attempt = 0;
    let completedWithNoOutputRetries = 0;
    const MAX_COMPLETED_NO_OUTPUT_RETRIES = 5;

    console.log(
      `[FaceCheckClient] Starting search polling (interval: ${intervalMs}ms, timeout: ${Math.round(maxTimeMs / 1000)}s, demo: ${this.demoMode})`
    );

    try {
      while (true) {
        attempt++;
        const elapsedMs = Date.now() - startTime;

        // Check timeout
        if (elapsedMs >= maxTimeMs) {
          onProgress?.({ attempt, elapsedMs, status: 'timeout' });
          throw new FaceCheckTimeoutError(`Search timed out after ${elapsedMs}ms`);
        }

        // Check cancellation
        if (signal?.aborted) {
          onProgress?.({ attempt, elapsedMs, status: 'cancelled' });
          throw new FaceCheckCancelledError();
        }

        // Poll for results
        const url = `${this.baseUrl}/api/search`;
        const response = await this.fetchWithRetry(url, {
          method: 'POST',
          headers: {
            'Authorization': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id_search: idSearch,
            with_progress: true,
            status_only: false,
            demo: this.demoMode,
          }),
        });

        if (!response.ok) {
          if (response.status === 401) throw new FaceCheckAuthError();
          if (response.status === 402) throw new FaceCheckCreditError();
          throw new FaceCheckError(
            `Search request failed: ${response.status}`,
            FaceCheckErrorCode.API_ERROR,
            response.status >= 500,
            response.status,
          );
        }

        const data = await response.json() as FaceCheckRawSearchResponse;

        if (data.error) {
          if (data.error.toLowerCase().includes('credit')) {
            throw new FaceCheckCreditError(data.error);
          }
          throw new FaceCheckError(data.error, FaceCheckErrorCode.API_ERROR);
        }

        // Check if results are ready.
        // FaceCheck API returns output as an object with an items sub-array:
        // { output: { items: [...], max_score: ..., ... } }
        const outputItems = data.output?.items;
        if (outputItems && outputItems.length > 0) {
          onProgress?.({ attempt, elapsedMs: Date.now() - startTime, status: 'completed' });

          const matches = this.normalizeMatches(outputItems);
          const durationMs = Date.now() - startTime;

          console.log(
            `[FaceCheckClient] Search complete: ${matches.length} matches found in ${Math.round(durationMs / 1000)}s`
          );

          return {
            matches,
            idSearch,
            totalFound: matches.length,
            durationMs,
            demoMode: this.demoMode,
          };
        }

        // Detect when the API reports search is completed but output items
        // are not yet populated. The API may return the output object with no
        // items, or a "Search Completed" status message before items are ready.
        // Give it a few more poll attempts, then return empty results.
        const statusText = (data.message || data.progress || '').toLowerCase();
        const isSearchCompleted =
          statusText.includes('completed') ||
          statusText.includes('complete') ||
          (data.output != null && (!outputItems || outputItems.length === 0));

        if (isSearchCompleted) {
          completedWithNoOutputRetries++;
          console.log(
            `[FaceCheckClient] Search reports completed but no output yet ` +
            `(retry ${completedWithNoOutputRetries}/${MAX_COMPLETED_NO_OUTPUT_RETRIES})`
          );

          if (completedWithNoOutputRetries >= MAX_COMPLETED_NO_OUTPUT_RETRIES) {
            const durationMs = Date.now() - startTime;
            console.warn(
              `[FaceCheckClient] Search completed with no results after ${MAX_COMPLETED_NO_OUTPUT_RETRIES} ` +
              `additional polls (${Math.round(durationMs / 1000)}s). Returning empty result set.`
            );
            onProgress?.({ attempt, elapsedMs: Date.now() - startTime, status: 'completed' });

            return {
              matches: [],
              idSearch,
              totalFound: 0,
              durationMs,
              demoMode: this.demoMode,
            };
          }
        }

        // Not ready yet — report progress and wait
        console.log(
          `[FaceCheckClient] Polling attempt ${attempt} (${Math.round(elapsedMs / 1000)}s / ${Math.round(maxTimeMs / 1000)}s) - ${data.message || data.progress || 'waiting...'}`
        );

        onProgress?.({
          attempt,
          elapsedMs,
          message: data.message || data.progress,
          status: 'polling',
        });

        await sleep(intervalMs, signal);
      }
    } finally {
      // SECURITY: Always cleanup uploaded image
      await this.deletePic(idSearch);
    }
  }

  /**
   * Get account info and credit status.
   */
  async getInfo(): Promise<FaceCheckInfo> {
    const url = `${this.baseUrl}/api/info_pic`;

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      if (response.status === 401) throw new FaceCheckAuthError();
      throw new FaceCheckError(`Info request failed: ${response.status}`, FaceCheckErrorCode.API_ERROR);
    }

    const data = await response.json() as FaceCheckRawInfoResponse;

    return {
      idSearch: data.id_search ?? '',
      credits: data.credits ?? 0,
      isHealthy: !data.error,
    };
  }

  /**
   * Delete an uploaded image from FaceCheck servers.
   * Best-effort — errors are logged but not thrown.
   */
  async deletePic(idSearch: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/delete_pic`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id_search: idSearch }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      console.log(`[FaceCheckClient] Deleted uploaded image: ${idSearch.substring(0, 8)}...`);
    } catch (error) {
      // Best-effort cleanup — log but don't throw
      console.warn(
        `[FaceCheckClient] Failed to delete image ${idSearch.substring(0, 8)}...: ` +
        (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Normalize raw FaceCheck matches: validate URLs, extract domains, strip base64.
   */
  private normalizeMatches(rawMatches: FaceCheckRawMatch[]): FaceCheckMatch[] {
    const matches: FaceCheckMatch[] = [];

    for (const raw of rawMatches) {
      const sourcePageUrl = sanitizeUrl(raw.url);
      if (!sourcePageUrl) {
        console.warn(`[FaceCheckClient] Skipping match with invalid URL: ${raw.url?.substring(0, 50)}`);
        continue;
      }

      const match: FaceCheckMatch = {
        score: raw.score,
        sourcePageUrl,
        domain: extractDomain(sourcePageUrl),
        guid: raw.guid,
        group: raw.group,
      };

      // Add direct image URL if valid
      if (raw.image_url) {
        const imageUrl = sanitizeUrl(raw.image_url);
        if (imageUrl) {
          match.imageUrl = imageUrl;
        }
      }

      // NOTE: raw.base64 is intentionally NOT included — security requirement

      matches.push(match);
    }

    return matches;
  }

  /**
   * Fetch with retry logic: exponential backoff on 429/5xx, no retry on 401/400.
   * Accepts a RequestInit or a factory function (for stream/FormData bodies that
   * are consumed on first read and must be re-created on retry).
   */
  private async fetchWithRetry(
    url: string,
    initOrFactory: RequestInit | (() => RequestInit),
    maxRetries: number = FACECHECK_DEFAULTS.MAX_RETRIES,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const init = typeof initOrFactory === 'function' ? initOrFactory() : initOrFactory;
        const response = await fetch(url, init);

        // Don't retry client errors (except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response;
        }

        // Retry on 429 or 5xx
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          const delay = getRetryDelay(attempt);
          console.warn(
            `[FaceCheckClient] Request to ${new URL(url).pathname} returned ${response.status}, ` +
            `retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(delay);
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof FaceCheckCancelledError) throw error;

        if (attempt < maxRetries) {
          const delay = getRetryDelay(attempt);
          console.warn(
            `[FaceCheckClient] Network error on ${new URL(url).pathname}, ` +
            `retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries}): ${lastError.message}`
          );
          await sleep(delay);
        }
      }
    }

    throw new FaceCheckError(
      `Request failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
      FaceCheckErrorCode.API_ERROR,
      true,
    );
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _clientInstance: FaceCheckClient | null = null;

/**
 * Get the singleton FaceCheck client instance.
 * Returns null if FaceCheck is not configured.
 */
export function getFaceCheckClient(): FaceCheckClient | null {
  if (!isFaceCheckEnabled()) return null;

  if (!_clientInstance) {
    _clientInstance = new FaceCheckClient();
  }
  return _clientInstance;
}

/** Check if FaceCheck API is configured */
export function isFaceCheckConfigured(): boolean {
  return isFaceCheckEnabled();
}

/** Reset singleton (for testing) */
export function resetFaceCheckClient(): void {
  _clientInstance = null;
}
