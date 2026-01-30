/**
 * FaceCheck.id API Types
 *
 * Type definitions for the FaceCheck.id face recognition search API.
 * FaceCheck searches the web for other photos containing the same face.
 *
 * SECURITY NOTES:
 * - base64 thumbnails must NEVER be stored — only URLs, scores, domains
 * - API key must be masked in all logs (****last4)
 * - All returned URLs must be validated (HTTPS only)
 */

// ============================================================================
// Error Codes
// ============================================================================

export enum FaceCheckErrorCode {
  API_ERROR = 'FACECHECK_API_ERROR',
  AUTH_ERROR = 'FACECHECK_AUTH_ERROR',
  UPLOAD_ERROR = 'FACECHECK_UPLOAD_ERROR',
  CREDIT_ERROR = 'FACECHECK_CREDIT_ERROR',
  TIMEOUT = 'FACECHECK_TIMEOUT',
  CANCELLED = 'FACECHECK_CANCELLED',
  INVALID_RESPONSE = 'FACECHECK_INVALID_RESPONSE',
  NO_FACE_DETECTED = 'FACECHECK_NO_FACE_DETECTED',
  RATE_LIMITED = 'FACECHECK_RATE_LIMITED',
}

// ============================================================================
// Raw API Response Types (what FaceCheck.id returns)
// ============================================================================

/** POST /api/upload_pic response */
export interface FaceCheckRawUploadResponse {
  id_search: string;
  error?: string;
}

/** POST /api/search response (polled until output populated) */
export interface FaceCheckRawSearchResponse {
  output?: FaceCheckRawSearchOutput;
  message?: string;
  progress?: string;
  error?: string;
}

/** The output object returned when search is complete */
export interface FaceCheckRawSearchOutput {
  items?: FaceCheckRawMatch[];
  demo?: boolean;
  max_score?: number;
  searchedFaces?: number;
  tookSeconds?: number;
  tookSecondsDownload?: number;
  tookSecondsQueue?: number;
}

/** Individual match from search output */
export interface FaceCheckRawMatch {
  /** Similarity score 0-100 */
  score: number;
  /** Source page URL where face was found */
  url: string;
  /**
   * Base64 thumbnail of the matched face.
   * SECURITY: Do NOT store this value — it contains biometric data.
   * Only used transiently during processing, then discarded.
   */
  base64?: string;
  /** Unique match identifier */
  guid?: string;
  /** Result grouping number */
  group?: number;
  /** Direct image URL if available */
  image_url?: string;
}

/** POST /api/info_pic response */
export interface FaceCheckRawInfoResponse {
  id_search: string;
  credits?: number;
  error?: string;
}

/** DELETE /api/delete_pic response */
export interface FaceCheckRawDeleteResponse {
  success?: boolean;
  error?: string;
}

// ============================================================================
// Normalized Client Types
// ============================================================================

/**
 * A normalized face match result.
 * base64 thumbnail is intentionally excluded — security requirement.
 */
export interface FaceCheckMatch {
  /** Similarity score 0-100 */
  score: number;
  /** Sanitized source page URL (validated HTTPS) */
  sourcePageUrl: string;
  /** Extracted domain from sourcePageUrl */
  domain: string;
  /** Unique match identifier */
  guid?: string;
  /** Result grouping number */
  group?: number;
  /** Direct image URL if available (validated HTTPS) */
  imageUrl?: string;
}

/** Result from a completed FaceCheck search */
export interface FaceCheckSearchResult {
  matches: FaceCheckMatch[];
  idSearch: string;
  totalFound: number;
  durationMs: number;
  demoMode: boolean;
}

/** FaceCheck account/health info */
export interface FaceCheckInfo {
  idSearch: string;
  credits: number;
  isHealthy: boolean;
}

/** Result from uploading an image to FaceCheck */
export interface FaceCheckUploadResult {
  idSearch: string;
}

// ============================================================================
// Polling Types
// ============================================================================

/** Options for the search polling loop */
export interface FaceCheckPollingOptions {
  /** Polling interval in ms (default: 3000) */
  intervalMs?: number;
  /** Maximum polling time in ms (default: 600000 = 10 min) */
  maxTimeMs?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Progress callback invoked on each poll attempt */
  onProgress?: (progress: FaceCheckPollingProgress) => void;
}

/** Progress information during polling */
export interface FaceCheckPollingProgress {
  attempt: number;
  elapsedMs: number;
  message?: string;
  status: 'polling' | 'completed' | 'timeout' | 'cancelled';
}

// ============================================================================
// Constants
// ============================================================================

export const FACECHECK_DEFAULTS = {
  MIN_SCORE_THRESHOLD: 70,
  POLL_INTERVAL_MS: 3000,
  MAX_POLL_TIME_MS: 600000,
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,
  API_BASE_URL: 'https://facecheck.id',
} as const;
