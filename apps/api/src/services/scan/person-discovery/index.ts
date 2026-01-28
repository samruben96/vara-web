/**
 * Person Discovery Module
 *
 * Provides capabilities for discovering instances of a person's images
 * across the web using reverse image search services like SerpAPI.
 *
 * This module is designed to work in conjunction with the face verification
 * system (DeepFace) to find and confirm matches of protected individuals.
 *
 * @example
 * ```typescript
 * import { PublicUrlService, SignedUrlError } from '@/services/scan/person-discovery';
 * import { supabaseAdmin } from '@/config/supabase';
 *
 * const urlService = new PublicUrlService(supabaseAdmin);
 *
 * try {
 *   const signedUrl = await urlService.getSignedUrlForImage(protectedImage);
 *   // Use signedUrl with SerpAPI for reverse image search
 * } catch (error) {
 *   if (error instanceof SignedUrlError) {
 *     console.error(`URL generation failed: ${error.code}`);
 *   }
 * }
 * ```
 *
 * @module person-discovery
 */

// Interfaces and types
export type {
  PersonDiscoveryProvider,
  PersonDiscoveryCandidate,
  PersonDiscoveryOptions,
  PersonDiscoveryResult,
  PersonDiscoveryEngine,
  PersonDiscoveryEngineFactory,
} from './interfaces';

export {
  PERSON_DISCOVERY_DEFAULTS,
  mergePersonDiscoveryOptions,
} from './interfaces';

// Public URL generation
export {
  PublicUrlService,
  SignedUrlError,
  DEFAULT_SIGNED_URL_EXPIRY,
} from './public-url.service';

// SerpAPI HTTP Client
export {
  SerpApiClient,
  getSerpApiClient,
  isSerpApiConfigured,
  resetSerpApiClient,
  SerpApiError,
  SerpApiRateLimitError,
  SerpApiAuthError,
} from './serpapi.client';

export type {
  SerpApiClientOptions,
  SerpApiErrorCode,
  SerpApiSearchMetadata,
  GoogleLensResponse,
  GoogleLensVisualMatch,
  GoogleReverseImageResponse,
  GoogleReverseImageResult,
  BingReverseImageResponse,
  BingReverseImageResult,
  BingImageInfo,
} from './serpapi.client';

// SerpAPI Person Discovery Engine
export {
  SerpApiPersonDiscoveryEngine,
  getSerpApiPersonDiscoveryEngine,
  resetSerpApiPersonDiscoveryEngine,
} from './serpapi.engine';

// Discovery Cache Service
export {
  DiscoveryCacheService,
  getDiscoveryCacheService,
  resetDiscoveryCacheService,
} from './discovery-cache.service';

export type { CachedDiscoveryResult } from './discovery-cache.service';
