import type { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { env } from './env';

// Shared Redis client for direct operations (outside of BullMQ)
let redisClient: Redis | null = null;

/**
 * Creates Redis connection options for BullMQ.
 * Returns null if REDIS_URL is not configured.
 */
function createRedisOptions(): ConnectionOptions | null {
  if (!env.REDIS_URL) {
    console.warn(
      '[Redis] REDIS_URL not configured. Queue functionality will be disabled.'
    );
    return null;
  }

  // Parse the Redis URL to extract connection options
  // BullMQ accepts either a URL string or connection options object
  return {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy(times: number) {
      // Exponential backoff with max 30 seconds
      const delay = Math.min(times * 100, 30000);
      console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  };
}

/**
 * Shared Redis connection options for all BullMQ queues and workers.
 */
export const redisOptions = createRedisOptions();

/**
 * Creates Redis connection options for BullMQ workers.
 * Workers can share the same options - BullMQ handles connections internally.
 */
export function createWorkerConnectionOptions(): ConnectionOptions | null {
  if (!env.REDIS_URL) {
    return null;
  }

  return {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      const delay = Math.min(times * 100, 30000);
      return delay;
    },
  };
}

/**
 * Gets the shared Redis client.
 * Creates a new connection if one doesn't exist.
 */
export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times: number) {
        const delay = Math.min(times * 100, 30000);
        return delay;
      },
    });

    redisClient.on('error', (error) => {
      console.error('[Redis] Connection error:', error.message);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected');
    });
  }

  return redisClient;
}

/**
 * Gracefully closes the Redis connection.
 * Call this during application shutdown.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Connection closed');
  }
}
