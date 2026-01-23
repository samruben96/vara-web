/**
 * Public URL Service
 *
 * Generates short-lived signed URLs for protected images stored in Supabase Storage.
 * These URLs are required by external services like SerpAPI that need publicly
 * accessible image URLs for reverse image search.
 *
 * @example
 * ```typescript
 * import { PublicUrlService } from './public-url.service';
 * import { supabaseAdmin } from '@/config/supabase';
 *
 * const urlService = new PublicUrlService(supabaseAdmin);
 *
 * // From storage path
 * const signedUrl = await urlService.getSignedUrl('user-id/image-id.jpg');
 *
 * // From ProtectedImage record
 * const url = await urlService.getSignedUrlForImage(protectedImage);
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Supabase Storage bucket name for protected images */
const STORAGE_BUCKET = 'protected-images';

/** Default signed URL expiration in seconds (1 hour) */
const DEFAULT_EXPIRY_SECONDS = 3600;

/** Warning threshold - log warning if expiry is less than this (5 minutes) */
const EXPIRY_WARNING_THRESHOLD_SECONDS = 300;

/** Minimum allowed expiry time in seconds (1 minute) */
const MIN_EXPIRY_SECONDS = 60;

/** Maximum allowed expiry time in seconds (7 days - Supabase limit) */
const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/**
 * Error thrown when a signed URL cannot be generated
 */
export class SignedUrlError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly storagePath?: string
  ) {
    super(message);
    this.name = 'SignedUrlError';
  }
}

/**
 * Service for generating signed URLs for protected images in Supabase Storage.
 *
 * Protected images are stored in a private bucket and require signed URLs
 * for external access. This service handles URL generation with proper
 * error handling and expiration management.
 */
export class PublicUrlService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Generates a signed URL for a protected image.
   *
   * @param storagePath - The path within the storage bucket (e.g., 'user-id/image-id.jpg')
   * @param expiresInSeconds - URL expiration time in seconds (default: 3600 / 1 hour)
   * @returns The full signed URL for accessing the image
   * @throws {SignedUrlError} If the path is invalid or URL generation fails
   *
   * @example
   * ```typescript
   * const url = await urlService.getSignedUrl('abc-123/image.jpg');
   * // Returns: https://xxx.supabase.co/storage/v1/object/sign/protected-images/abc-123/image.jpg?token=...
   * ```
   */
  async getSignedUrl(
    storagePath: string,
    expiresInSeconds: number = DEFAULT_EXPIRY_SECONDS
  ): Promise<string> {
    // Validate storage path
    if (!storagePath || storagePath.trim() === '') {
      throw new SignedUrlError(
        'Storage path is required',
        'INVALID_PATH',
        storagePath
      );
    }

    // Clean the path (remove leading slashes if present)
    const cleanPath = storagePath.replace(/^\/+/, '');

    // Validate expiry time
    const validExpiry = this.validateExpiry(expiresInSeconds);

    // Log warning for short expiry times
    if (validExpiry < EXPIRY_WARNING_THRESHOLD_SECONDS) {
      console.warn(
        `[PublicUrlService] Short expiry time requested: ${validExpiry}s for path: ${cleanPath}. ` +
          `URL may expire before external service can fetch it.`
      );
    }

    // Generate signed URL
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(cleanPath, validExpiry);

    if (error) {
      // Check for common error cases
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        throw new SignedUrlError(
          `Image not found at path: ${cleanPath}`,
          'IMAGE_NOT_FOUND',
          cleanPath
        );
      }

      throw new SignedUrlError(
        `Failed to generate signed URL: ${error.message}`,
        'SIGNED_URL_GENERATION_FAILED',
        cleanPath
      );
    }

    if (!data?.signedUrl) {
      throw new SignedUrlError(
        'Signed URL generation returned empty result',
        'EMPTY_RESULT',
        cleanPath
      );
    }

    return data.signedUrl;
  }

  /**
   * Generates a signed URL from a ProtectedImage record.
   *
   * Extracts the storage path from the full storage URL and generates
   * a signed URL for external access.
   *
   * @param protectedImage - Object containing the storageUrl property
   * @param expiresInSeconds - URL expiration time in seconds (default: 3600 / 1 hour)
   * @returns The full signed URL for accessing the image
   * @throws {SignedUrlError} If the storage URL is invalid or URL generation fails
   *
   * @example
   * ```typescript
   * const image = await prisma.protectedImage.findUnique({ where: { id } });
   * const url = await urlService.getSignedUrlForImage(image);
   * ```
   */
  async getSignedUrlForImage(
    protectedImage: { storageUrl: string },
    expiresInSeconds: number = DEFAULT_EXPIRY_SECONDS
  ): Promise<string> {
    if (!protectedImage?.storageUrl) {
      throw new SignedUrlError(
        'Protected image has no storage URL',
        'MISSING_STORAGE_URL'
      );
    }

    const storagePath = this.extractStoragePath(protectedImage.storageUrl);

    if (!storagePath) {
      throw new SignedUrlError(
        `Invalid storage URL format: ${protectedImage.storageUrl}`,
        'INVALID_STORAGE_URL_FORMAT',
        protectedImage.storageUrl
      );
    }

    return this.getSignedUrl(storagePath, expiresInSeconds);
  }

  /**
   * Extracts the storage path from a full Supabase storage URL.
   *
   * @param storageUrl - Full storage URL (e.g., 'https://xxx.supabase.co/storage/v1/object/protected-images/user/image.jpg')
   * @returns The path within the bucket, or null if the URL format is invalid
   *
   * @example
   * ```typescript
   * const path = urlService.extractStoragePath(
   *   'https://xxx.supabase.co/storage/v1/object/protected-images/user-123/img.jpg'
   * );
   * // Returns: 'user-123/img.jpg'
   * ```
   */
  private extractStoragePath(storageUrl: string): string | null {
    const prefix = `/storage/v1/object/${STORAGE_BUCKET}/`;
    const index = storageUrl.indexOf(prefix);

    if (index === -1) {
      return null;
    }

    return storageUrl.substring(index + prefix.length);
  }

  /**
   * Validates and clamps expiry time to acceptable bounds.
   *
   * @param expiresInSeconds - Requested expiry time
   * @returns Validated expiry time within allowed bounds
   */
  private validateExpiry(expiresInSeconds: number): number {
    if (typeof expiresInSeconds !== 'number' || isNaN(expiresInSeconds)) {
      return DEFAULT_EXPIRY_SECONDS;
    }

    if (expiresInSeconds < MIN_EXPIRY_SECONDS) {
      console.warn(
        `[PublicUrlService] Expiry time ${expiresInSeconds}s is below minimum. ` +
          `Using minimum: ${MIN_EXPIRY_SECONDS}s`
      );
      return MIN_EXPIRY_SECONDS;
    }

    if (expiresInSeconds > MAX_EXPIRY_SECONDS) {
      console.warn(
        `[PublicUrlService] Expiry time ${expiresInSeconds}s exceeds maximum. ` +
          `Using maximum: ${MAX_EXPIRY_SECONDS}s`
      );
      return MAX_EXPIRY_SECONDS;
    }

    return Math.floor(expiresInSeconds);
  }
}

/**
 * Default expiry time for signed URLs (1 hour)
 */
export const DEFAULT_SIGNED_URL_EXPIRY = DEFAULT_EXPIRY_SECONDS;
