/**
 * Scan Interfaces and Types
 *
 * Export all interfaces and type definitions for the scan system.
 */

// Engine interface
export type {
  ScanEngine,
  ScanEngineFactory,
  ScanProvider,
} from './scan-engine.interface';

// Result types
export type {
  ScanResult,
  ScanMatch,
  ScanStats,
  ScanBacklink,
  HealthStatus,
  QuotaInfo,
  QuotaBundle,
  MatchConfidence,
  MatchTag,
} from './scan-result.types';
export { scoreToConfidence } from './scan-result.types';

// Option types
export type {
  ScanOptions,
  TinEyeSearchOptions,
  RetryConfig,
  ResolvedScanOptions,
  SortOrder,
  SortBy,
  TagFilter,
} from './scan-options.types';
export { TINEYE_DEFAULTS, mergeWithDefaults } from './scan-options.types';
