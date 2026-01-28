/**
 * Scan Service
 *
 * Main export file for the image scanning system.
 * Provides reverse image search capabilities via TinEye and other providers.
 *
 * @example
 * ```typescript
 * import { getTinEyeEngine } from '@/services/scan';
 *
 * const engine = getTinEyeEngine();
 *
 * // Check if configured
 * if (engine.isConfigured()) {
 *   // Search by URL
 *   const result = await engine.searchByUrl('https://example.com/image.jpg');
 *   console.log(`Found ${result.matches.length} matches`);
 *
 *   // Search by upload
 *   const uploadResult = await engine.searchByUpload(imageBuffer, 'photo.jpg');
 *
 *   // Check quota
 *   const quota = await engine.getQuota();
 *   console.log(`${quota.totalRemainingSearches} searches remaining`);
 *
 *   // Health check
 *   const health = await engine.checkHealth();
 *   console.log(`TinEye healthy: ${health.healthy}`);
 * }
 * ```
 */

// Interfaces and types
export * from './interfaces';

// Error classes
export * from './errors';

// Engine implementations
export * from './engines';
