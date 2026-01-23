/**
 * Scan Error Classes
 *
 * Custom error classes for scan engine operations.
 * These provide structured error information for handling API failures.
 */

import type { ScanProvider } from '../interfaces/scan-engine.interface';

/**
 * Error codes for TinEye API errors.
 */
export type TinEyeErrorCode =
  | 'TINEYE_INVALID_IMAGE'
  | 'TINEYE_RATE_LIMITED'
  | 'TINEYE_QUOTA_EXHAUSTED'
  | 'TINEYE_NETWORK_ERROR'
  | 'TINEYE_TIMEOUT'
  | 'TINEYE_API_ERROR'
  | 'TINEYE_INVALID_API_KEY'
  | 'TINEYE_NOT_CONFIGURED';

/**
 * Generic error codes for scan operations.
 */
export type ScanErrorCode =
  | TinEyeErrorCode
  | 'SCAN_INVALID_IMAGE'
  | 'SCAN_RATE_LIMITED'
  | 'SCAN_QUOTA_EXHAUSTED'
  | 'SCAN_NETWORK_ERROR'
  | 'SCAN_TIMEOUT'
  | 'SCAN_API_ERROR'
  | 'SCAN_NOT_CONFIGURED';

/**
 * Base error class for all scan-related errors.
 */
export class ScanError extends Error {
  /**
   * Error code for programmatic handling.
   */
  public readonly code: ScanErrorCode;

  /**
   * Provider that generated the error.
   */
  public readonly provider: ScanProvider;

  /**
   * HTTP status code if applicable.
   */
  public readonly statusCode?: number;

  /**
   * Whether this error is retryable.
   */
  public readonly retryable: boolean;

  /**
   * Additional error details from the API.
   */
  public readonly details?: unknown;

  /**
   * The underlying error that caused this error (if any).
   */
  public readonly cause?: Error;

  constructor(
    code: ScanErrorCode,
    message: string,
    provider: ScanProvider,
    options?: {
      statusCode?: number;
      retryable?: boolean;
      details?: unknown;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'ScanError';
    this.code = code;
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
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
      provider: this.provider,
      statusCode: this.statusCode,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

/**
 * Error thrown when the TinEye API returns an error.
 */
export class TinEyeError extends ScanError {
  /**
   * Messages from the TinEye API response.
   */
  public readonly apiMessages?: string[];

  constructor(
    code: TinEyeErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      retryable?: boolean;
      details?: unknown;
      cause?: Error;
      apiMessages?: string[];
    }
  ) {
    super(code, message, 'tineye', options);
    this.name = 'TinEyeError';
    this.apiMessages = options?.apiMessages;
  }

  /**
   * Creates a TinEyeError from an API response.
   *
   * @param statusCode - HTTP status code
   * @param response - Parsed API response body
   * @returns Appropriate TinEyeError instance
   */
  static fromResponse(
    statusCode: number,
    response: { code?: number; messages?: string[] }
  ): TinEyeError {
    const messages = response.messages ?? [];
    const messageText = messages.join('; ') || 'Unknown error';

    switch (statusCode) {
      case 400:
        return new TinEyeError('TINEYE_INVALID_IMAGE', messageText, {
          statusCode,
          retryable: false,
          apiMessages: messages,
        });

      case 401:
      case 403:
        return new TinEyeError(
          'TINEYE_INVALID_API_KEY',
          'Invalid or missing API key',
          {
            statusCode,
            retryable: false,
            apiMessages: messages,
          }
        );

      case 429:
        return new TinEyeError(
          'TINEYE_RATE_LIMITED',
          'Rate limit exceeded. Please wait before retrying.',
          {
            statusCode,
            retryable: true,
            apiMessages: messages,
          }
        );

      default:
        return new TinEyeError('TINEYE_API_ERROR', messageText, {
          statusCode,
          retryable: statusCode >= 500,
          apiMessages: messages,
        });
    }
  }
}

/**
 * Error thrown when an image cannot be processed.
 */
export class InvalidImageError extends ScanError {
  constructor(
    provider: ScanProvider,
    message: string,
    options?: {
      details?: unknown;
      cause?: Error;
    }
  ) {
    const code: ScanErrorCode =
      provider === 'tineye' ? 'TINEYE_INVALID_IMAGE' : 'SCAN_INVALID_IMAGE';
    super(code, message, provider, {
      statusCode: 400,
      retryable: false,
      ...options,
    });
    this.name = 'InvalidImageError';
  }
}

/**
 * Error thrown when rate limited by the API.
 */
export class RateLimitError extends ScanError {
  /**
   * Suggested retry delay in milliseconds (if provided by API).
   */
  public readonly retryAfterMs?: number;

  /**
   * Number of retry attempts made before this error.
   */
  public readonly attemptsMade: number;

  constructor(
    provider: ScanProvider,
    options?: {
      retryAfterMs?: number;
      attemptsMade?: number;
      details?: unknown;
      cause?: Error;
    }
  ) {
    const code: ScanErrorCode =
      provider === 'tineye' ? 'TINEYE_RATE_LIMITED' : 'SCAN_RATE_LIMITED';
    super(
      code,
      `Rate limit exceeded after ${options?.attemptsMade ?? 0} attempts`,
      provider,
      {
        statusCode: 429,
        retryable: false, // No more retries at this point
        ...options,
      }
    );
    this.name = 'RateLimitError';
    this.retryAfterMs = options?.retryAfterMs;
    this.attemptsMade = options?.attemptsMade ?? 0;
  }
}

/**
 * Error thrown when API quota is exhausted.
 */
export class QuotaExhaustedError extends ScanError {
  constructor(
    provider: ScanProvider,
    options?: {
      details?: unknown;
      cause?: Error;
    }
  ) {
    const code: ScanErrorCode =
      provider === 'tineye' ? 'TINEYE_QUOTA_EXHAUSTED' : 'SCAN_QUOTA_EXHAUSTED';
    super(code, 'API quota exhausted. No searches remaining.', provider, {
      statusCode: 402,
      retryable: false,
      ...options,
    });
    this.name = 'QuotaExhaustedError';
  }
}

/**
 * Error thrown when a network request fails.
 */
export class NetworkError extends ScanError {
  constructor(
    provider: ScanProvider,
    message: string,
    options?: {
      cause?: Error;
    }
  ) {
    const code: ScanErrorCode =
      provider === 'tineye' ? 'TINEYE_NETWORK_ERROR' : 'SCAN_NETWORK_ERROR';
    super(code, message, provider, {
      retryable: true,
      ...options,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when a request times out.
 */
export class TimeoutError extends ScanError {
  /**
   * Timeout duration in milliseconds.
   */
  public readonly timeoutMs: number;

  constructor(
    provider: ScanProvider,
    timeoutMs: number,
    options?: {
      cause?: Error;
    }
  ) {
    const code: ScanErrorCode =
      provider === 'tineye' ? 'TINEYE_TIMEOUT' : 'SCAN_TIMEOUT';
    super(code, `Request timed out after ${timeoutMs}ms`, provider, {
      retryable: true,
      ...options,
    });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when the scan engine is not configured.
 */
export class NotConfiguredError extends ScanError {
  constructor(provider: ScanProvider, message?: string) {
    const code: ScanErrorCode =
      provider === 'tineye' ? 'TINEYE_NOT_CONFIGURED' : 'SCAN_NOT_CONFIGURED';
    super(
      code,
      message ?? `${provider} scan engine is not configured (missing API key)`,
      provider,
      {
        retryable: false,
      }
    );
    this.name = 'NotConfiguredError';
  }
}
