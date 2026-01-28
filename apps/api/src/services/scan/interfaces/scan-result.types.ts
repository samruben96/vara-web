/**
 * Scan Result Types
 *
 * Normalized result types for reverse image search across different providers.
 * These types abstract away provider-specific response formats.
 */

import type { ScanProvider } from './scan-engine.interface';

/**
 * Confidence level for a match based on score.
 * - HIGH: score >= 80 (strong match, likely the same image)
 * - MEDIUM: score 50-79 (partial match or modified version)
 * - LOW: score < 50 (weak match, may be false positive)
 */
export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Tags that can be associated with a match.
 * - stock: Image found on a stock photo site
 * - collection: Image found in a known collection
 */
export type MatchTag = 'stock' | 'collection';

/**
 * A backlink where the matched image was found.
 */
export interface ScanBacklink {
  /**
   * Direct URL to the image file.
   */
  imageUrl: string;

  /**
   * URL of the page containing the image.
   */
  pageUrl: string;

  /**
   * Date when the page was crawled.
   */
  crawlDate?: string;
}

/**
 * A single match from a reverse image search.
 */
export interface ScanMatch {
  /**
   * Direct URL to the matched image.
   */
  imageUrl: string;

  /**
   * Domain where the match was found.
   */
  domain: string;

  /**
   * Match score from the provider (0-100).
   */
  score: number;

  /**
   * Normalized confidence level based on score.
   */
  confidence: MatchConfidence;

  /**
   * Percentage of the query image that matches this result (0-100).
   * Higher values indicate more of the original image is present.
   */
  queryMatchPercent?: number;

  /**
   * URL to an overlay image showing the match comparison.
   */
  overlayUrl?: string;

  /**
   * Image format (e.g., "JPEG", "PNG").
   */
  format?: string;

  /**
   * File size in bytes.
   */
  filesize?: number;

  /**
   * Image dimensions.
   */
  width?: number;
  height?: number;

  /**
   * Total pixels (width x height).
   */
  size?: number;

  /**
   * Tags indicating image source type.
   */
  tags: MatchTag[];

  /**
   * Locations where this matched image was found.
   */
  backlinks: ScanBacklink[];
}

/**
 * Statistics about the scan.
 */
export interface ScanStats {
  /**
   * Unix timestamp when the query was executed.
   */
  timestamp: number;

  /**
   * Time taken to execute the query in milliseconds.
   */
  queryTimeMs: number;

  /**
   * Total number of matches found.
   */
  totalResults: number;

  /**
   * Total number of backlinks across all matches.
   */
  totalBacklinks: number;

  /**
   * Number of matches from stock photo sites.
   */
  totalStock: number;

  /**
   * Number of matches from collection sites.
   */
  totalCollection: number;

  /**
   * Number of results after applying filters.
   */
  totalFilteredResults?: number;
}

/**
 * Complete result from a reverse image search.
 */
export interface ScanResult {
  /**
   * Provider that performed the search.
   */
  provider: ScanProvider;

  /**
   * Whether the search was successful.
   */
  success: boolean;

  /**
   * List of matches found.
   */
  matches: ScanMatch[];

  /**
   * Search statistics.
   */
  stats: ScanStats;

  /**
   * ISO timestamp when the search was performed.
   */
  searchedAt: string;

  /**
   * Any warning messages from the provider.
   */
  warnings?: string[];
}

/**
 * Information about a search bundle.
 */
export interface QuotaBundle {
  /**
   * Number of searches remaining in this bundle.
   */
  remainingSearches: number;

  /**
   * When this bundle started.
   */
  startDate: string;

  /**
   * When this bundle expires.
   */
  endDate: string;
}

/**
 * Quota/usage information for the API.
 */
export interface QuotaInfo {
  /**
   * Provider identifier.
   */
  provider: ScanProvider;

  /**
   * Total remaining searches across all bundles.
   */
  totalRemainingSearches: number;

  /**
   * Individual bundle information.
   */
  bundles: QuotaBundle[];

  /**
   * When quota was checked.
   */
  checkedAt: string;
}

/**
 * Health status of the scan engine.
 */
export interface HealthStatus {
  /**
   * Provider identifier.
   */
  provider: ScanProvider;

  /**
   * Whether the engine is healthy.
   */
  healthy: boolean;

  /**
   * Human-readable status message.
   */
  message: string;

  /**
   * Total images indexed by the provider (if available).
   */
  indexedImages?: number;

  /**
   * Response time for the health check in milliseconds.
   */
  responseTimeMs: number;

  /**
   * When health was checked.
   */
  checkedAt: string;
}

/**
 * Maps a numeric score to a confidence level.
 *
 * TinEye scores represent image similarity:
 * - 50-100%: Significant match, should alert user
 * - 30-49%: Possible match, may need review
 * - 0-29%: Low confidence, likely false positive
 *
 * @param score - Match score from 0-100
 * @returns Confidence level
 */
export function scoreToConfidence(score: number): MatchConfidence {
  if (score >= 50) {
    return 'HIGH';  // 50%+ similarity is significant for image protection
  }
  if (score >= 30) {
    return 'MEDIUM';
  }
  return 'LOW';
}
