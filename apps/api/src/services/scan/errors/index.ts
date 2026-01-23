/**
 * Scan Errors
 *
 * Export all error classes for the scan system.
 */

export {
  ScanError,
  TinEyeError,
  InvalidImageError,
  RateLimitError,
  QuotaExhaustedError,
  NetworkError,
  TimeoutError,
  NotConfiguredError,
} from './scan.errors';

export type { TinEyeErrorCode, ScanErrorCode } from './scan.errors';
