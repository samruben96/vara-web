/**
 * Scan Engine Interface
 *
 * Defines the contract for reverse image search engines (TinEye, Google Vision, etc.).
 * Each engine must implement these methods to be used by the scanning system.
 */

import type { ScanResult, HealthStatus, QuotaInfo } from './scan-result.types';
import type { ScanOptions } from './scan-options.types';

/**
 * Supported scan providers.
 */
export type ScanProvider = 'tineye' | 'google-vision' | 'mock';

/**
 * Base interface for all scan engines.
 */
export interface ScanEngine {
  /**
   * Provider identifier for this engine.
   */
  readonly provider: ScanProvider;

  /**
   * Display name for this engine.
   */
  readonly displayName: string;

  /**
   * Search for image matches by URL.
   *
   * @param imageUrl - Publicly accessible URL of the image to search
   * @param options - Optional search configuration
   * @returns Promise resolving to scan results
   * @throws {TinEyeError} When the API returns an error
   * @throws {RateLimitError} When rate limited (429)
   * @throws {InvalidImageError} When image cannot be processed (400)
   */
  searchByUrl(imageUrl: string, options?: ScanOptions): Promise<ScanResult>;

  /**
   * Search for image matches by uploading image data.
   *
   * @param imageBuffer - Image data as a Buffer
   * @param filename - Original filename (used for Content-Disposition)
   * @param options - Optional search configuration
   * @returns Promise resolving to scan results
   * @throws {TinEyeError} When the API returns an error
   * @throws {RateLimitError} When rate limited (429)
   * @throws {InvalidImageError} When image cannot be processed (400)
   */
  searchByUpload(
    imageBuffer: Buffer,
    filename: string,
    options?: ScanOptions
  ): Promise<ScanResult>;

  /**
   * Get remaining API quota/searches.
   *
   * @returns Promise resolving to quota information
   */
  getQuota(): Promise<QuotaInfo>;

  /**
   * Check if the engine is healthy and can accept requests.
   *
   * @returns Promise resolving to health status
   */
  checkHealth(): Promise<HealthStatus>;

  /**
   * Whether the engine is properly configured (has required API keys).
   */
  isConfigured(): boolean;
}

/**
 * Factory function type for creating scan engines.
 */
export type ScanEngineFactory = () => ScanEngine;
