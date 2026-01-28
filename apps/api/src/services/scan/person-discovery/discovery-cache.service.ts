/**
 * Discovery Cache Service
 *
 * Caches SerpAPI person discovery results to avoid redundant API calls.
 * SerpAPI charges per search, so caching by (protectedImageId + imageHash)
 * prevents repeated charges when re-scanning the same image.
 */

import type Redis from 'ioredis';
import { getRedisClient } from '@/config/redis';
import { getPersonDiscoveryConfig } from '@/config/person-discovery.config';
import type { PersonDiscoveryResult } from './interfaces';

/**
 * Cache key prefix for discovery results
 */
const CACHE_KEY_PREFIX = 'vara:discovery:cache';

/**
 * Cached discovery result with metadata
 */
export interface CachedDiscoveryResult {
  /** The cached discovery result */
  result: PersonDiscoveryResult;
  /** When this entry was cached */
  cachedAt: Date;
  /** When this cache entry expires */
  expiresAt: Date;
  /** Image hash used for cache key (if provided) */
  imageHash: string | null;
  /** Protected image ID */
  protectedImageId: string;
}

/**
 * Internal storage format for Redis (JSON-serializable)
 */
interface CacheEntry {
  result: PersonDiscoveryResult;
  cachedAt: string; // ISO date string
  expiresAt: string; // ISO date string
  imageHash: string | null;
  protectedImageId: string;
}

/**
 * Discovery Cache Service
 *
 * Provides caching for SerpAPI person discovery results to minimize API costs.
 * Uses Redis for storage with automatic TTL-based expiration.
 */
export class DiscoveryCacheService {
  private readonly ttlSeconds: number;

  /**
   * Create a new DiscoveryCacheService instance.
   *
   * @param redis - Redis client instance
   * @param ttlSeconds - Cache TTL in seconds (default from config: 86400 = 24 hours)
   */
  constructor(
    private readonly redis: Redis,
    ttlSeconds?: number
  ) {
    const config = getPersonDiscoveryConfig();
    this.ttlSeconds = ttlSeconds ?? config.cacheTtl;
  }

  /**
   * Generate a cache key from protectedImageId and optional image hash.
   *
   * Format: vara:discovery:cache:{protectedImageId}:{imageHash}
   * If no imageHash is provided, uses '_' as placeholder.
   *
   * @param protectedImageId - The protected image ID
   * @param imageHash - Optional perceptual hash of the image
   * @returns The cache key string
   */
  getCacheKey(protectedImageId: string, imageHash?: string): string {
    const hashPart = imageHash || '_';
    return `${CACHE_KEY_PREFIX}:${protectedImageId}:${hashPart}`;
  }

  /**
   * Get a cached discovery result if it exists and is not expired.
   *
   * @param protectedImageId - The protected image ID
   * @param imageHash - Optional perceptual hash of the image
   * @returns The cached result or null if not found/expired
   */
  async get(
    protectedImageId: string,
    imageHash?: string
  ): Promise<PersonDiscoveryResult | null> {
    const cacheKey = this.getCacheKey(protectedImageId, imageHash);

    try {
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        console.log(
          `[DiscoveryCache] MISS for image ${protectedImageId} (key: ${cacheKey})`
        );
        return null;
      }

      const entry: CacheEntry = JSON.parse(cached);

      // Double-check expiration (Redis SETEX should handle this, but be safe)
      const expiresAt = new Date(entry.expiresAt);
      if (expiresAt < new Date()) {
        console.log(
          `[DiscoveryCache] EXPIRED for image ${protectedImageId} (key: ${cacheKey})`
        );
        // Delete expired entry (shouldn't happen with SETEX, but clean up anyway)
        await this.redis.del(cacheKey);
        return null;
      }

      console.log(
        `[DiscoveryCache] HIT for image ${protectedImageId} (key: ${cacheKey}, candidates: ${entry.result.candidates.length})`
      );

      // Return result with cacheHit flag set to true
      return {
        ...entry.result,
        cacheHit: true,
      };
    } catch (error) {
      // Log error but don't throw - treat as cache miss
      console.error(
        `[DiscoveryCache] Error reading cache for ${protectedImageId}:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  /**
   * Cache a discovery result.
   *
   * @param protectedImageId - The protected image ID
   * @param result - The discovery result to cache
   * @param imageHash - Optional perceptual hash of the image
   */
  async set(
    protectedImageId: string,
    result: PersonDiscoveryResult,
    imageHash?: string
  ): Promise<void> {
    const cacheKey = this.getCacheKey(protectedImageId, imageHash);

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);

      const entry: CacheEntry = {
        result: {
          ...result,
          cacheHit: false, // Original result was not from cache
        },
        cachedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        imageHash: imageHash || null,
        protectedImageId,
      };

      // Use SETEX for automatic expiration
      await this.redis.setex(cacheKey, this.ttlSeconds, JSON.stringify(entry));

      console.log(
        `[DiscoveryCache] SET for image ${protectedImageId} (key: ${cacheKey}, candidates: ${result.candidates.length}, TTL: ${this.ttlSeconds}s)`
      );
    } catch (error) {
      // Log error but don't throw - caching failure shouldn't break the flow
      console.error(
        `[DiscoveryCache] Error writing cache for ${protectedImageId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Invalidate cache for a protected image.
   * Removes the cache entry regardless of the image hash.
   *
   * @param protectedImageId - The protected image ID to invalidate
   */
  async invalidate(protectedImageId: string): Promise<void> {
    try {
      // Find all cache keys for this image (any hash)
      const pattern = `${CACHE_KEY_PREFIX}:${protectedImageId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        console.log(
          `[DiscoveryCache] No cache entries to invalidate for image ${protectedImageId}`
        );
        return;
      }

      // Delete all matching keys
      await this.redis.del(...keys);

      console.log(
        `[DiscoveryCache] INVALIDATED ${keys.length} cache entries for image ${protectedImageId}`
      );
    } catch (error) {
      console.error(
        `[DiscoveryCache] Error invalidating cache for ${protectedImageId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Check if a cache entry exists (without retrieving the full result).
   * Useful for quick checks before initiating expensive operations.
   *
   * @param protectedImageId - The protected image ID
   * @param imageHash - Optional perceptual hash of the image
   * @returns True if cache entry exists
   */
  async has(protectedImageId: string, imageHash?: string): Promise<boolean> {
    const cacheKey = this.getCacheKey(protectedImageId, imageHash);

    try {
      const exists = await this.redis.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      console.error(
        `[DiscoveryCache] Error checking cache for ${protectedImageId}:`,
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  /**
   * Get cache statistics for monitoring.
   *
   * @returns Cache stats including total entries and memory usage
   */
  async getStats(): Promise<{
    totalEntries: number;
    keyPattern: string;
  } | null> {
    try {
      const pattern = `${CACHE_KEY_PREFIX}:*`;
      const keys = await this.redis.keys(pattern);

      return {
        totalEntries: keys.length,
        keyPattern: pattern,
      };
    } catch (error) {
      console.error(
        '[DiscoveryCache] Error getting cache stats:',
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }
}

/**
 * Singleton instance of the discovery cache service
 */
let discoveryCacheServiceInstance: DiscoveryCacheService | null = null;

/**
 * Get the singleton DiscoveryCacheService instance.
 *
 * Returns null if Redis is not configured, allowing the application
 * to function without caching (all searches will hit the API).
 *
 * @returns DiscoveryCacheService instance or null if Redis unavailable
 */
export function getDiscoveryCacheService(): DiscoveryCacheService | null {
  // Return existing instance if available
  if (discoveryCacheServiceInstance) {
    return discoveryCacheServiceInstance;
  }

  // Get Redis client
  const redis = getRedisClient();

  if (!redis) {
    console.warn(
      '[DiscoveryCache] Cache disabled - Redis not configured. All searches will hit SerpAPI.'
    );
    return null;
  }

  // Create and cache the singleton instance
  discoveryCacheServiceInstance = new DiscoveryCacheService(redis);

  console.log('[DiscoveryCache] Cache service initialized');
  return discoveryCacheServiceInstance;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetDiscoveryCacheService(): void {
  discoveryCacheServiceInstance = null;
}
