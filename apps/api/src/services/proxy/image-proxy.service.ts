/**
 * Image Proxy Service
 *
 * Provides short-lived, publicly accessible URLs for protected images.
 * These proxy URLs are designed for external services like SerpAPI that
 * cannot handle long Supabase signed URLs.
 *
 * Features:
 * - Cryptographically secure random tokens
 * - In-memory token store with automatic cleanup
 * - Short TTL (2-5 minutes) for security
 * - No authentication required for proxy endpoint
 *
 * @example
 * ```typescript
 * import { imageProxyService } from '@/services/proxy/image-proxy.service';
 *
 * // Create a proxy URL for an image
 * const proxyUrl = await imageProxyService.createProxyUrl('image-uuid');
 * // Returns: https://api.example.com/api/v1/proxy/images/abc123...
 *
 * // Validate and get image ID from token
 * const imageId = imageProxyService.validateToken('abc123...');
 * if (imageId) {
 *   // Token is valid and not expired
 * }
 * ```
 */

import { randomBytes } from 'crypto';
import { env } from '@/config/env';
import { prisma } from '@/config/prisma';

/** Default token TTL in milliseconds (3 minutes) */
const DEFAULT_TTL_MS = 3 * 60 * 1000;

/** Minimum token TTL in milliseconds (2 minutes) */
const MIN_TTL_MS = 2 * 60 * 1000;

/** Maximum token TTL in milliseconds (5 minutes) */
const MAX_TTL_MS = 5 * 60 * 1000;

/** Token length in bytes (32 bytes = 64 hex characters) */
const TOKEN_LENGTH_BYTES = 32;

/** Cleanup interval in milliseconds (1 minute) */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Token data stored in the in-memory store
 */
interface TokenData {
  /** The protected image ID */
  imageId: string;
  /** Timestamp when the token expires */
  expiresAt: number;
  /** Optional storage path for direct Supabase access */
  storagePath?: string;
}

/**
 * Options for creating a proxy URL
 */
export interface CreateProxyUrlOptions {
  /** TTL in milliseconds (default: 3 minutes, range: 2-5 minutes) */
  ttlMs?: number;
  /** Storage path for direct Supabase access (optional optimization) */
  storagePath?: string;
}

/**
 * Result of validating a proxy token
 */
export interface TokenValidationResult {
  /** Whether the token is valid and not expired */
  valid: boolean;
  /** The image ID if valid */
  imageId?: string;
  /** The storage path if provided during creation */
  storagePath?: string;
  /** Error message if invalid */
  error?: string;
}

/**
 * Image Proxy Service
 *
 * Manages short-lived proxy tokens for protected images.
 * Uses an in-memory Map for storage (can be upgraded to Redis for multi-instance deployments).
 */
export class ImageProxyService {
  /** In-memory token store: token -> TokenData */
  private readonly tokenStore = new Map<string, TokenData>();

  /** Cleanup interval handle */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /** Base URL for proxy endpoints */
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || env.API_URL;
    this.startCleanup();
  }

  /**
   * Generates a cryptographically secure random token.
   *
   * @returns A 64-character hex string token
   */
  private generateToken(): string {
    return randomBytes(TOKEN_LENGTH_BYTES).toString('hex');
  }

  /**
   * Validates and clamps TTL to acceptable bounds.
   *
   * @param ttlMs - Requested TTL in milliseconds
   * @returns Validated TTL within allowed bounds
   */
  private validateTtl(ttlMs?: number): number {
    if (typeof ttlMs !== 'number' || isNaN(ttlMs)) {
      return DEFAULT_TTL_MS;
    }

    if (ttlMs < MIN_TTL_MS) {
      console.warn(
        `[ImageProxyService] TTL ${ttlMs}ms is below minimum. Using minimum: ${MIN_TTL_MS}ms`
      );
      return MIN_TTL_MS;
    }

    if (ttlMs > MAX_TTL_MS) {
      console.warn(
        `[ImageProxyService] TTL ${ttlMs}ms exceeds maximum. Using maximum: ${MAX_TTL_MS}ms`
      );
      return MAX_TTL_MS;
    }

    return Math.floor(ttlMs);
  }

  /**
   * Creates a short-lived proxy URL for a protected image.
   *
   * @param imageId - The protected image UUID
   * @param options - Optional configuration
   * @returns The full proxy URL
   *
   * @example
   * ```typescript
   * const proxyUrl = await imageProxyService.createProxyUrl('abc-123', {
   *   ttlMs: 180000, // 3 minutes
   *   storagePath: 'user-id/image.jpg',
   * });
   * ```
   */
  public createProxyUrl(imageId: string, options?: CreateProxyUrlOptions): string {
    if (!imageId || typeof imageId !== 'string') {
      throw new Error('Image ID is required');
    }

    const token = this.generateToken();
    const ttlMs = this.validateTtl(options?.ttlMs);
    const expiresAt = Date.now() + ttlMs;

    // Store token data
    this.tokenStore.set(token, {
      imageId,
      expiresAt,
      storagePath: options?.storagePath,
    });

    // Construct the proxy URL
    const proxyUrl = `${this.baseUrl}/api/v1/proxy/images/${token}`;

    console.log(
      `[ImageProxyService] Created proxy URL for image ${imageId}, expires in ${ttlMs / 1000}s`
    );

    return proxyUrl;
  }

  /**
   * Validates a proxy token and returns the associated image data.
   *
   * @param token - The proxy token to validate
   * @returns Validation result with image data if valid
   *
   * @example
   * ```typescript
   * const result = imageProxyService.validateToken('abc123...');
   * if (result.valid) {
   *   console.log(`Token valid for image: ${result.imageId}`);
   * } else {
   *   console.log(`Invalid: ${result.error}`);
   * }
   * ```
   */
  public validateToken(token: string): TokenValidationResult {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token is required' };
    }

    const data = this.tokenStore.get(token);

    if (!data) {
      return { valid: false, error: 'Token not found' };
    }

    if (data.expiresAt < Date.now()) {
      // Token expired - clean it up
      this.tokenStore.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      imageId: data.imageId,
      storagePath: data.storagePath,
    };
  }

  /**
   * Manually invalidates a token (e.g., after successful use).
   *
   * @param token - The token to invalidate
   * @returns True if the token was found and removed
   */
  public invalidateToken(token: string): boolean {
    return this.tokenStore.delete(token);
  }

  /**
   * Gets the current number of active tokens in the store.
   * Useful for monitoring and debugging.
   *
   * @returns The number of active tokens
   */
  public getActiveTokenCount(): number {
    return this.tokenStore.size;
  }

  /**
   * Starts the periodic cleanup of expired tokens.
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, CLEANUP_INTERVAL_MS);

    // Ensure cleanup doesn't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Cleans up expired tokens from the store.
   * Called periodically by the cleanup interval.
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, data] of this.tokenStore.entries()) {
      if (data.expiresAt < now) {
        this.tokenStore.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[ImageProxyService] Cleaned up ${cleaned} expired tokens`);
    }
  }

  /**
   * Stops the cleanup interval.
   * Call this during graceful shutdown.
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clears all tokens from the store.
   * Useful for testing.
   */
  public clearAllTokens(): void {
    this.tokenStore.clear();
  }
}

/**
 * Singleton instance of the ImageProxyService
 */
let imageProxyServiceInstance: ImageProxyService | null = null;

/**
 * Gets the singleton ImageProxyService instance.
 *
 * @returns The ImageProxyService instance
 */
export function getImageProxyService(): ImageProxyService {
  if (!imageProxyServiceInstance) {
    imageProxyServiceInstance = new ImageProxyService();
  }
  return imageProxyServiceInstance;
}

/**
 * Resets the singleton instance.
 * Useful for testing.
 */
export function resetImageProxyService(): void {
  if (imageProxyServiceInstance) {
    imageProxyServiceInstance.stopCleanup();
    imageProxyServiceInstance.clearAllTokens();
    imageProxyServiceInstance = null;
  }
}

/**
 * Default export for convenience
 */
export const imageProxyService = getImageProxyService();

/**
 * Supabase Storage bucket name for protected images
 */
const STORAGE_BUCKET = 'protected-images';

/**
 * Extracts the storage path from a full storage URL.
 * URL format: supabase_url/storage/v1/object/bucket/path
 */
function extractStoragePath(storageUrl: string): string | null {
  const prefix = `/storage/v1/object/${STORAGE_BUCKET}/`;
  const index = storageUrl.indexOf(prefix);
  if (index === -1) return null;
  return storageUrl.substring(index + prefix.length);
}

/**
 * Creates a short-lived proxy URL for a protected image.
 * This is the main function to use for external services like SerpAPI.
 *
 * @param imageId - The protected image UUID
 * @param options - Optional configuration
 * @returns The full proxy URL that can be used by external services
 *
 * @example
 * ```typescript
 * import { createProxyUrl } from '@/services/proxy';
 *
 * // Create a proxy URL for person discovery
 * const proxyUrl = await createProxyUrl('image-uuid');
 * // Returns: https://api.example.com/api/v1/proxy/images/abc123...
 *
 * // With custom TTL
 * const proxyUrl = await createProxyUrl('image-uuid', { ttlMs: 300000 });
 * ```
 */
export async function createProxyUrl(
  imageId: string,
  options?: CreateProxyUrlOptions
): Promise<string> {
  // Look up the image to get the storage path
  const image = await prisma.protectedImage.findUnique({
    where: { id: imageId },
    select: { storageUrl: true, status: true },
  });

  if (!image) {
    throw new Error(`Image not found: ${imageId}`);
  }

  if (image.status === 'ARCHIVED') {
    throw new Error(`Image is archived: ${imageId}`);
  }

  // Extract storage path for faster lookup in proxy endpoint
  const storagePath = extractStoragePath(image.storageUrl);

  // Create the proxy URL with storage path cached for efficiency
  return getImageProxyService().createProxyUrl(imageId, {
    ...options,
    storagePath: storagePath || undefined,
  });
}

/**
 * Creates a proxy URL from a protected image object.
 * Use this when you already have the image record to avoid an extra DB lookup.
 *
 * @param protectedImage - Object containing id and storageUrl
 * @param options - Optional configuration
 * @returns The full proxy URL
 */
export function createProxyUrlFromImage(
  protectedImage: { id: string; storageUrl: string },
  options?: CreateProxyUrlOptions
): string {
  const storagePath = extractStoragePath(protectedImage.storageUrl);

  return getImageProxyService().createProxyUrl(protectedImage.id, {
    ...options,
    storagePath: storagePath || undefined,
  });
}

/**
 * Validates that a proxy URL is accessible and returns an image.
 * Call this before passing the URL to external services like SerpAPI.
 *
 * @param proxyUrl - The proxy URL to validate
 * @returns True if the URL is valid and returns an image
 *
 * @example
 * ```typescript
 * const proxyUrl = await createProxyUrl('image-uuid');
 *
 * if (await validateProxyUrl(proxyUrl)) {
 *   // Safe to use with SerpAPI
 * }
 * ```
 */
export async function validateProxyUrl(proxyUrl: string): Promise<boolean> {
  try {
    const response = await fetch(proxyUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      console.warn(`[validateProxyUrl] HTTP error: ${response.status}`);
      return false;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      console.warn(`[validateProxyUrl] Invalid content-type: ${contentType}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `[validateProxyUrl] Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }
}
