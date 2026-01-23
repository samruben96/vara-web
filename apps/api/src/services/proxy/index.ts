/**
 * Image Proxy Module
 *
 * Provides short-lived, publicly accessible URLs for protected images.
 * Designed for external services like SerpAPI that cannot handle
 * long Supabase signed URLs.
 *
 * @example
 * ```typescript
 * import { imageProxyService, getImageProxyService } from '@/services/proxy';
 *
 * // Create a proxy URL
 * const proxyUrl = imageProxyService.createProxyUrl('image-uuid');
 *
 * // Validate a token
 * const result = imageProxyService.validateToken('token');
 * if (result.valid) {
 *   // Use result.imageId
 * }
 * ```
 *
 * @module proxy
 */

export {
  ImageProxyService,
  imageProxyService,
  getImageProxyService,
  resetImageProxyService,
  createProxyUrl,
  createProxyUrlFromImage,
  validateProxyUrl,
} from './image-proxy.service';

export type {
  CreateProxyUrlOptions,
  TokenValidationResult,
} from './image-proxy.service';
