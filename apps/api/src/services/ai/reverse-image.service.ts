/**
 * Reverse Image Search Service
 *
 * Provides reverse image search capabilities for detecting image misuse across the web.
 *
 * Engine Priority:
 * 1. TinEye (PRIMARY) - High reliability, score-based confidence, requires TINEYE_API_KEY
 * 2. Google Vision (FALLBACK) - Web detection API, requires GOOGLE_VISION_API_KEY
 * 3. Mock Mode (DEVELOPMENT) - Deterministic test results when no API keys configured
 *
 * Configuration:
 * - SCAN_ENGINE env var controls engine selection:
 *   - 'auto' (default): Use TinEye if configured, otherwise Google Vision
 *   - 'tineye': Force TinEye only
 *   - 'google-vision': Force Google Vision only
 * - TINEYE_API_KEY: Enables TinEye integration
 * - GOOGLE_VISION_API_KEY: Enables Google Vision integration
 *
 * @see ../scan/engines/tineye.engine.ts for TinEye implementation details
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { TinEyeEngine, getTinEyeEngine } from '../scan/engines/tineye.engine';
import type { ScanMatch, MatchConfidence } from '../scan/interfaces/scan-result.types';
import {
  getSerpApiPersonDiscoveryEngine,
  type PersonDiscoveryCandidate,
  type PersonDiscoveryResult,
} from '../scan/person-discovery';
import {
  createProxyUrlFromImage,
  validateProxyUrl,
} from '../proxy';
import {
  getPersonDiscoveryConfig,
  isPersonDiscoveryEnabled,
} from '@/config/person-discovery.config';
import { supabaseAdmin } from '@/config/supabase';

/**
 * A single match result from reverse image search.
 */
export interface ReverseImageMatch {
  sourceUrl: string;
  domain: string;
  similarity: number;
  pageTitle?: string;
  isMock?: boolean; // Indicates this is test data, not a real match
  matchSourceType?: 'fullMatchingImages' | 'partialMatchingImages' | 'pagesWithMatchingImages' | 'visuallySimilarImages';
}

/**
 * Result from reverse image search.
 */
export interface ReverseImageSearchResult {
  provider: string;
  matches: ReverseImageMatch[];
  searchedAt: string;
  processingTimeMs: number;
}

/**
 * Options for person discovery scan pipeline.
 */
export interface PersonDiscoveryScanOptions {
  /** Maximum number of candidates to fetch from SerpAPI (default: 20) */
  maxCandidates?: number;
  /** Maximum number of TinEye expansion searches per scan (default: 10) */
  maxTineyeExpansions?: number;
  /** Skip face verification step - always true for now (placeholder) */
  skipFaceVerification?: boolean;
  /** Skip cache and force fresh search */
  skipCache?: boolean;
}

/**
 * A candidate expanded with TinEye results.
 */
export interface ExpandedCandidate {
  /** The original person discovery candidate */
  candidate: PersonDiscoveryCandidate;
  /** TinEye matches found for this candidate's image */
  tineyeMatches: ScanMatch[];
  /** Face similarity score (placeholder for future face verification) */
  faceSimilarity?: number;
}

/**
 * Result from the full person discovery scan pipeline.
 *
 * The pipeline:
 * 1. Gets a public URL for the protected image
 * 2. Runs SerpAPI person discovery to find visually similar images
 * 3. (Optional) Face verification gate (placeholder)
 * 4. Runs TinEye on each discovered candidate
 * 5. Returns combined results with person-level grouping
 */
export interface PersonDiscoveryScanResult {
  /** TinEye/Google Vision scan results on the original protected image */
  originalImageMatches: ScanMatch[];

  /** Person discovery candidates expanded with TinEye results */
  candidates: ExpandedCandidate[];

  /** UUID to group all results from this scan together */
  candidateGroupId: string;

  /** Total number of matches found across all sources */
  totalMatchesFound: number;

  /** Time taken for person discovery phase (SerpAPI) in milliseconds */
  discoveryDurationMs: number;

  /** Time taken for TinEye expansion phase in milliseconds */
  expansionDurationMs: number;

  /** Whether person discovery was available and used */
  personDiscoveryUsed: boolean;

  /** Providers used for person discovery */
  providersUsed: string[];

  /** Any warnings or issues during the scan */
  warnings: string[];
}

/**
 * Google Vision API response types for Web Detection.
 */
interface GoogleVisionWebEntity {
  entityId?: string;
  score?: number;
  description?: string;
}

interface GoogleVisionWebImage {
  url: string;
  score?: number;
}

interface GoogleVisionWebPage {
  url: string;
  pageTitle?: string;
  fullMatchingImages?: GoogleVisionWebImage[];
  partialMatchingImages?: GoogleVisionWebImage[];
  score?: number;
}

interface GoogleVisionWebDetection {
  webEntities?: GoogleVisionWebEntity[];
  fullMatchingImages?: GoogleVisionWebImage[];
  partialMatchingImages?: GoogleVisionWebImage[];
  visuallySimilarImages?: GoogleVisionWebImage[];
  pagesWithMatchingImages?: GoogleVisionWebPage[];
  bestGuessLabels?: Array<{ label: string; languageCode?: string }>;
}

interface GoogleVisionAnnotateResponse {
  responses: Array<{
    webDetection?: GoogleVisionWebDetection;
    error?: {
      code: number;
      message: string;
      status: string;
    };
  }>;
}

/**
 * Environment variables for reverse image search APIs.
 * Note: TINEYE_API_KEY is read by TinEyeEngine directly
 */
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;

/**
 * Scan engine selection.
 * - 'tineye': Always use TinEye (requires TINEYE_API_KEY)
 * - 'google-vision': Always use Google Vision (requires GOOGLE_VISION_API_KEY)
 * - 'auto' (default): Use TinEye if configured, otherwise Google Vision
 */
const SCAN_ENGINE = process.env.SCAN_ENGINE || 'auto';

/**
 * Google Vision API endpoint for image annotation.
 */
const GOOGLE_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

/**
 * Provider identifier for mock implementation.
 */
const MOCK_PROVIDER = 'mock-reverse-search';

/**
 * Sample domains for mock matches.
 * Using example.com subdomains to make it clear these are test results.
 */
const MOCK_DOMAINS = [
  'instagram.example.com',
  'facebook.example.com',
  'twitter.example.com',
  'pinterest.example.com',
  'dating-site.example.com',
  'forum.example.com',
  'blog.example.com',
  'photos.example.com',
];

/**
 * Sample page titles for mock matches.
 */
const MOCK_TITLES = [
  '[TEST] Profile Photo',
  '[TEST] User Gallery',
  '[TEST] Shared Images',
  '[TEST] Photo Album',
  '[TEST] Image Post',
];

/**
 * Generates a deterministic random number from a seed string.
 */
function seededRandom(seed: string): number {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
}

/**
 * Generates mock match data based on image buffer.
 */
function generateMockMatch(imageBuffer: Buffer, index: number): ReverseImageMatch {
  const seed = crypto.createHash('sha256').update(imageBuffer).digest('hex');

  // Use different parts of the hash for different random values
  const domainIndex = Math.floor(seededRandom(seed + 'domain' + index) * MOCK_DOMAINS.length);
  const titleIndex = Math.floor(seededRandom(seed + 'title' + index) * MOCK_TITLES.length);
  const similarity = 0.88 + seededRandom(seed + 'similarity' + index) * 0.10; // 88-98% (above MIN_SIMILARITY_THRESHOLD of 0.85)

  const domain = MOCK_DOMAINS[domainIndex]!;

  return {
    sourceUrl: `https://${domain}/test-match-demo`,
    domain,
    similarity: Math.round(similarity * 100) / 100,
    pageTitle: MOCK_TITLES[titleIndex],
    isMock: true,
  };
}

/**
 * Maps TinEye confidence level to matchSourceType.
 * - HIGH (score >= 80) -> fullMatchingImages (exact matches)
 * - MEDIUM (score 50-79) -> partialMatchingImages (modified versions)
 * - LOW (score < 50) -> visuallySimilarImages (weak matches)
 */
function confidenceToMatchSourceType(confidence: MatchConfidence): ReverseImageMatch['matchSourceType'] {
  switch (confidence) {
    case 'HIGH':
      return 'fullMatchingImages';
    case 'MEDIUM':
      return 'partialMatchingImages';
    case 'LOW':
      return 'visuallySimilarImages';
  }
}

/**
 * Maps a TinEye ScanMatch to ReverseImageMatch format for backward compatibility.
 */
function mapTinEyeMatchToReverseImageMatch(match: ScanMatch): ReverseImageMatch {
  return {
    sourceUrl: match.imageUrl,
    domain: match.domain,
    // TinEye score is 0-100, convert to 0.0-1.0
    similarity: match.score / 100,
    pageTitle: match.backlinks.length > 0 ? match.backlinks[0]?.pageUrl : undefined,
    isMock: false,
    matchSourceType: confidenceToMatchSourceType(match.confidence),
  };
}

/**
 * Reverse image search service for finding image matches across the web.
 *
 * Supports multiple providers:
 * - TinEye (primary, when TINEYE_API_KEY is set)
 * - Google Vision (fallback, when GOOGLE_VISION_API_KEY is set)
 * - Mock mode (development, when no API keys are configured)
 *
 * Provider selection is controlled by SCAN_ENGINE env var:
 * - 'auto' (default): TinEye if configured, otherwise Google Vision
 * - 'tineye': Force TinEye
 * - 'google-vision': Force Google Vision
 */
class ReverseImageService {
  private static instance: ReverseImageService;
  private readonly isMockMode: boolean;
  private readonly provider: string;
  private readonly useTinEye: boolean;
  private readonly tineyeEngine: TinEyeEngine;

  private constructor() {
    this.tineyeEngine = getTinEyeEngine();
    
    // Determine which provider to use based on SCAN_ENGINE and available API keys
    this.useTinEye = this.shouldUseTinEye();
    this.isMockMode = !this.useTinEye && !GOOGLE_VISION_API_KEY;

    if (this.useTinEye) {
      this.provider = 'tineye';
      console.log('[ReverseImageService] Running with TinEye API (primary engine)');
    } else if (GOOGLE_VISION_API_KEY) {
      this.provider = 'google-vision';
      console.log('[ReverseImageService] Running with Google Vision API (fallback engine)');
    } else {
      this.provider = MOCK_PROVIDER;
      console.log('[ReverseImageService] Running in mock mode - no API keys configured');
    }
  }

  /**
   * Determines if TinEye should be used based on configuration.
   */
  private shouldUseTinEye(): boolean {
    const tineyeConfigured = this.tineyeEngine.isConfigured();
    
    switch (SCAN_ENGINE) {
      case 'tineye':
        if (!tineyeConfigured) {
          console.warn('[ReverseImageService] SCAN_ENGINE=tineye but TINEYE_API_KEY not set');
        }
        return tineyeConfigured;
      case 'google-vision':
        return false; // Force Google Vision
      case 'auto':
      default:
        // Auto mode: prefer TinEye if configured
        return tineyeConfigured;
    }
  }

  /**
   * Gets the singleton instance of ReverseImageService.
   */
  public static getInstance(): ReverseImageService {
    if (!ReverseImageService.instance) {
      ReverseImageService.instance = new ReverseImageService();
    }
    return ReverseImageService.instance;
  }

  /**
   * Checks if the service is running in mock mode.
   */
  public isInMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Gets the current provider being used.
   */
  public getProvider(): string {
    return this.provider;
  }

  /**
   * Checks if TinEye is being used as the scan engine.
   */
  public isUsingTinEye(): boolean {
    return this.useTinEye;
  }

  /**
   * Performs a reverse image search for the given image buffer.
   *
   * @param imageBuffer - The image data as a Buffer
   * @returns Promise resolving to search results with matches
   */
  public async search(imageBuffer: Buffer): Promise<ReverseImageSearchResult> {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer cannot be empty');
    }

    if (this.isMockMode) {
      return this.performMockSearch(imageBuffer);
    }

    return this.performRealSearch(imageBuffer);
  }

  /**
   * Performs a full person discovery scan pipeline.
   *
   * Pipeline steps:
   * 1. Generate a unique candidate group ID
   * 2. Get a public signed URL for the protected image
   * 3. Run person discovery (SerpAPI - Google Lens / Bing)
   * 4. (Placeholder) Face verification gate
   * 5. Run TinEye on the original image
   * 6. Run TinEye on each discovered candidate
   * 7. Aggregate and return results
   *
   * @param protectedImage - Object containing id and storageUrl of the protected image
   * @param options - Optional configuration for the scan pipeline
   * @returns Promise resolving to combined results with person-level grouping
   */
  public async scanWithPersonDiscovery(
    protectedImage: { id: string; storageUrl: string },
    options?: PersonDiscoveryScanOptions
  ): Promise<PersonDiscoveryScanResult> {
    const candidateGroupId = uuidv4();
    const warnings: string[] = [];

    // Merge options with defaults from config
    const config = getPersonDiscoveryConfig();
    const maxCandidates = options?.maxCandidates ?? config.maxCandidates;
    const maxTineyeExpansions = options?.maxTineyeExpansions ?? config.maxTineyeExpansions;
    const skipCache = options?.skipCache ?? false;


    let originalImageMatches: ScanMatch[] = [];
    let candidates: ExpandedCandidate[] = [];
    let discoveryDurationMs = 0;
    let expansionDurationMs = 0;
    let personDiscoveryUsed = false;
    let providersUsed: string[] = [];

    // Step 1: Try to get public URL and run person discovery
    let personDiscoveryResult: PersonDiscoveryResult | null = null;

    if (isPersonDiscoveryEnabled()) {
      const discoveryStartTime = Date.now();

      try {
        // Create a short-lived proxy URL for the protected image
        // This generates a single proxy URL that will be reused across all providers
        const proxyUrl = createProxyUrlFromImage(protectedImage);

        // CRITICAL: Check if proxy URL is accessible from external services
        // SerpAPI servers CANNOT access localhost URLs
        if (proxyUrl.includes('localhost') || proxyUrl.includes('127.0.0.1')) {
          console.warn(
            `[ReverseImageService] ⚠️ WARNING: Proxy URL uses localhost (${proxyUrl.substring(0, 50)}...). ` +
            `SerpAPI servers cannot access localhost URLs. ` +
            `For local testing, either:\n` +
            `  1. Use ngrok to expose your local server: ngrok http 4000\n` +
            `  2. Set API_URL to your ngrok URL in .env\n` +
            `  3. Deploy to production (Render) for real testing`
          );
          // Continue anyway - local validation will pass, but SerpAPI will fail
        }

        // Validate the proxy URL is accessible from THIS server (won't catch localhost issue)
        const isValid = await validateProxyUrl(proxyUrl);
        if (!isValid) {
          throw new Error('Failed to validate proxy URL - image not accessible');
        }

        // Run person discovery via SerpAPI
        const discoveryEngine = getSerpApiPersonDiscoveryEngine();

        if (discoveryEngine) {
          personDiscoveryResult = await discoveryEngine.discoverByImageUrl(proxyUrl, {
            maxCandidates,
            skipCache,
          });

          personDiscoveryUsed = true;
          providersUsed = personDiscoveryResult.providersUsed;
        } else {
          warnings.push('Person discovery engine not available - skipping person discovery phase');
          console.warn('[ReverseImageService] Person discovery engine not available');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnings.push(`Person discovery failed: ${errorMessage}`);
        console.error(`[ReverseImageService] Person discovery failed: ${errorMessage}`);
      }

      discoveryDurationMs = Date.now() - discoveryStartTime;
    } else {
      warnings.push('Person discovery not enabled (missing SERPAPI_API_KEY or disabled)');
    }

    // Step 2: Run TinEye on the original protected image
    const expansionStartTime = Date.now();

    try {
      // Download the protected image to get a buffer for TinEye
      const imageBuffer = await this.downloadProtectedImage(protectedImage.storageUrl);

      if (imageBuffer && this.useTinEye) {
        const tineyeResult = await this.tineyeEngine.searchByUpload(imageBuffer, 'protected-image.jpg', {
          limit: 50,
        });
        originalImageMatches = tineyeResult.matches;
      } else if (imageBuffer && !this.useTinEye && GOOGLE_VISION_API_KEY) {
        const searchResult = await this.performGoogleVisionSearch(imageBuffer, Date.now());

        // Convert ReverseImageMatch to ScanMatch format
        originalImageMatches = searchResult.matches.map((match) => ({
          imageUrl: match.sourceUrl,
          domain: match.domain,
          score: Math.round(match.similarity * 100),
          confidence: match.similarity >= 0.8 ? 'HIGH' : match.similarity >= 0.5 ? 'MEDIUM' : 'LOW',
          backlinks: [],
          tags: [],
        })) as ScanMatch[];
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      warnings.push(`Original image scan failed: ${errorMessage}`);
      console.error(`[ReverseImageService] Original image scan failed: ${errorMessage}`);
    }

    // Step 3: Run TinEye expansion on each person discovery candidate
    if (personDiscoveryResult && personDiscoveryResult.candidates.length > 0 && this.useTinEye) {
      const candidatesToExpand = personDiscoveryResult.candidates.slice(0, maxTineyeExpansions);

      for (let i = 0; i < candidatesToExpand.length; i++) {
        const candidate = candidatesToExpand[i]!;

        // Skip candidates without a direct image URL
        if (!candidate.candidateImageUrl) {
          candidates.push({
            candidate,
            tineyeMatches: [],
            faceSimilarity: undefined,
          });
          continue;
        }

        try {
          const tineyeResult = await this.tineyeEngine.searchByUrl(candidate.candidateImageUrl, {
            limit: 20,
          });
          candidates.push({
            candidate,
            tineyeMatches: tineyeResult.matches,
            faceSimilarity: undefined,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          warnings.push(`TinEye expansion failed for candidate ${i + 1}: ${errorMessage}`);
          candidates.push({
            candidate,
            tineyeMatches: [],
            faceSimilarity: undefined,
          });
        }
      }

      // Add remaining candidates that weren't expanded
      const remainingCandidates = personDiscoveryResult.candidates.slice(maxTineyeExpansions);
      for (const candidate of remainingCandidates) {
        candidates.push({
          candidate,
          tineyeMatches: [],
          faceSimilarity: undefined,
        });
      }
    } else if (personDiscoveryResult && personDiscoveryResult.candidates.length > 0) {
      // No TinEye - just include candidates without expansion
      for (const candidate of personDiscoveryResult.candidates) {
        candidates.push({
          candidate,
          tineyeMatches: [],
          faceSimilarity: undefined,
        });
      }
    }

    expansionDurationMs = Date.now() - expansionStartTime;

    // Calculate total matches
    const totalMatchesFound =
      originalImageMatches.length +
      candidates.reduce((sum, c) => sum + c.tineyeMatches.length, 0);

    return {
      originalImageMatches,
      candidates,
      candidateGroupId,
      totalMatchesFound,
      discoveryDurationMs,
      expansionDurationMs,
      personDiscoveryUsed,
      providersUsed,
      warnings,
    };
  }

  /**
   * Downloads a protected image from Supabase storage.
   *
   * @param storageUrl - The full storage URL of the protected image
   * @returns Buffer containing the image data, or null if download fails
   */
  private async downloadProtectedImage(storageUrl: string): Promise<Buffer | null> {
    try {
      // Extract the storage path from the full URL
      const STORAGE_BUCKET = 'protected-images';
      const prefix = `/storage/v1/object/${STORAGE_BUCKET}/`;
      const index = storageUrl.indexOf(prefix);

      if (index === -1) {
        console.error('[ReverseImageService] Invalid storage URL format');
        return null;
      }

      const storagePath = storageUrl.substring(index + prefix.length);

      // Download from Supabase
      const { data, error } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .download(storagePath);

      if (error) {
        console.error(`[ReverseImageService] Failed to download image: ${error.message}`);
        return null;
      }

      if (!data) {
        console.error('[ReverseImageService] Download returned no data');
        return null;
      }

      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ReverseImageService] Download error: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Performs a mock reverse image search.
   * Returns empty results 85% of the time, 1 match 15% of the time.
   */
  private async performMockSearch(imageBuffer: Buffer): Promise<ReverseImageSearchResult> {
    const startTime = Date.now();

    // Simulate API latency (500-1500ms)
    const delay = Math.floor(Math.random() * 1000) + 500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Use buffer hash to determine if we should return a match
    // This makes results deterministic per image for testing
    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const matchProbability = seededRandom(hash + 'match');

    const matches: ReverseImageMatch[] = [];

    // 15% chance of finding a match for realistic mock behavior
    if (matchProbability < 0.15) {
      matches.push(generateMockMatch(imageBuffer, 0));
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      provider: MOCK_PROVIDER,
      matches,
      searchedAt: new Date().toISOString(),
      processingTimeMs,
    };
  }

  /**
   * Performs a real reverse image search using configured API.
   */
  private async performRealSearch(imageBuffer: Buffer): Promise<ReverseImageSearchResult> {
    const startTime = Date.now();

    if (this.useTinEye) {
      return this.performTinEyeSearch(imageBuffer, startTime);
    }

    if (this.provider === 'google-vision') {
      return this.performGoogleVisionSearch(imageBuffer, startTime);
    }

    // Fallback to mock
    const mockResult = await this.performMockSearch(imageBuffer);
    return {
      ...mockResult,
      provider: this.provider,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Performs reverse image search using TinEye API.
   */
  private async performTinEyeSearch(
    imageBuffer: Buffer,
    startTime: number
  ): Promise<ReverseImageSearchResult> {
    try {
      // Use TinEye engine to search by upload
      const scanResult = await this.tineyeEngine.searchByUpload(
        imageBuffer,
        'scan-image.jpg', // Default filename for upload
        {
          limit: 20, // Match Google Vision's maxResults
        }
      );

      // Map TinEye ScanResult to ReverseImageSearchResult
      const matches: ReverseImageMatch[] = scanResult.matches.map(mapTinEyeMatchToReverseImageMatch);

      const processingTimeMs = Date.now() - startTime;

      // Log match breakdown by confidence
      const highConfidence = matches.filter(m => m.matchSourceType === 'fullMatchingImages').length;
      const mediumConfidence = matches.filter(m => m.matchSourceType === 'partialMatchingImages').length;
      const lowConfidence = matches.filter(m => m.matchSourceType === 'visuallySimilarImages').length;

      console.log(
        `[ReverseImageService] TinEye search completed in ${processingTimeMs}ms, ` +
        `found ${matches.length} matches (high: ${highConfidence}, medium: ${mediumConfidence}, low: ${lowConfidence})`
      );

      if (scanResult.warnings && scanResult.warnings.length > 0) {
        console.warn('[ReverseImageService] TinEye warnings:', scanResult.warnings.join('; '));
      }

      return {
        provider: 'tineye',
        matches,
        searchedAt: scanResult.searchedAt,
        processingTimeMs,
      };
    } catch (error) {
      console.error('[ReverseImageService] TinEye search failed:', error);

      // If Google Vision is available as fallback, try it
      if (GOOGLE_VISION_API_KEY && SCAN_ENGINE === 'auto') {
        console.warn('[ReverseImageService] Falling back to Google Vision due to TinEye error');
        return this.performGoogleVisionSearch(imageBuffer, startTime);
      }

      // On error in development, fall back to mock results
      if (process.env.NODE_ENV === 'development') {
        console.warn('[ReverseImageService] Falling back to mock results due to API error');
        const mockResult = await this.performMockSearch(imageBuffer);
        return {
          ...mockResult,
          provider: 'tineye-fallback',
          processingTimeMs: Date.now() - startTime,
        };
      }

      throw error;
    }
  }

  /**
   * Performs reverse image search using Google Cloud Vision Web Detection API.
   */
  private async performGoogleVisionSearch(
    imageBuffer: Buffer,
    startTime: number
  ): Promise<ReverseImageSearchResult> {
    try {
      // Convert image buffer to base64
      const base64Image = imageBuffer.toString('base64');

      // Build the request payload
      const requestBody = {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'WEB_DETECTION',
                maxResults: 20,
              },
            ],
          },
        ],
      };

      // Make the API request
      const response = await fetch(
        `${GOOGLE_VISION_API_URL}?key=${GOOGLE_VISION_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ReverseImageService] Google Vision API error:', response.status, errorText);
        throw new Error(`Google Vision API request failed: ${response.status}`);
      }

      const data = (await response.json()) as GoogleVisionAnnotateResponse;

      // Check for API-level errors in the response
      const firstResponse = data.responses[0];
      if (firstResponse?.error) {
        console.error('[ReverseImageService] Google Vision API error:', firstResponse.error);
        throw new Error(`Google Vision API error: ${firstResponse.error.message}`);
      }

      // Extract and process the web detection results
      const webDetection = firstResponse?.webDetection;
      const matches = this.processGoogleVisionResults(webDetection);

      const processingTimeMs = Date.now() - startTime;

      // Log breakdown of match types
      const fullCount = webDetection?.fullMatchingImages?.length ?? 0;
      const pagesCount = webDetection?.pagesWithMatchingImages?.length ?? 0;
      const partialCount = webDetection?.partialMatchingImages?.length ?? 0;
      const similarCount = webDetection?.visuallySimilarImages?.length ?? 0;

      console.log(
        `[ReverseImageService] Google Vision search completed in ${processingTimeMs}ms, ` +
        `found ${matches.length} matches (full: ${fullCount}, pages: ${pagesCount}, partial: ${partialCount}, similar: ${similarCount})`
      );

      return {
        provider: 'google-vision',
        matches,
        searchedAt: new Date().toISOString(),
        processingTimeMs,
      };
    } catch (error) {
      console.error('[ReverseImageService] Google Vision search failed:', error);

      // On error, fall back to mock results in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('[ReverseImageService] Falling back to mock results due to API error');
        const mockResult = await this.performMockSearch(imageBuffer);
        return {
          ...mockResult,
          provider: 'google-vision-fallback',
          processingTimeMs: Date.now() - startTime,
        };
      }

      throw error;
    }
  }

  /**
   * Processes Google Vision Web Detection results into ReverseImageMatch array.
   */
  private processGoogleVisionResults(
    webDetection: GoogleVisionWebDetection | undefined
  ): ReverseImageMatch[] {
    if (!webDetection) {
      return [];
    }

    const matches: ReverseImageMatch[] = [];
    const seenUrls = new Set<string>();

    // Helper to extract domain from URL
    const extractDomain = (url: string): string => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch {
        return 'unknown';
      }
    };

    // Helper to add a match if not already seen
    const addMatch = (
      url: string,
      similarity: number,
      matchSourceType: ReverseImageMatch['matchSourceType'],
      pageTitle?: string
    ): void => {
      if (seenUrls.has(url)) {
        return;
      }
      seenUrls.add(url);

      matches.push({
        sourceUrl: url,
        domain: extractDomain(url),
        similarity: Math.round(similarity * 100) / 100,
        pageTitle,
        isMock: false,
        matchSourceType,
      });
    };

    // Process full matching images (exact matches - highest confidence)
    if (webDetection.fullMatchingImages) {
      for (const image of webDetection.fullMatchingImages) {
        if (image.url) {
          // Full matches get 0.95-1.0 similarity
          const similarity = image.score ?? 0.98;
          addMatch(image.url, similarity, 'fullMatchingImages');
        }
      }
    }

    // Process partial matching images (cropped or modified)
    if (webDetection.partialMatchingImages) {
      for (const image of webDetection.partialMatchingImages) {
        if (image.url) {
          // Partial matches get slightly lower similarity
          const similarity = image.score ?? 0.85;
          addMatch(image.url, similarity, 'partialMatchingImages');
        }
      }
    }

    // Process pages with matching images (includes page titles)
    if (webDetection.pagesWithMatchingImages) {
      for (const page of webDetection.pagesWithMatchingImages) {
        if (page.url) {
          // Pages with matching images typically have high similarity
          const similarity = page.score ?? 0.92;
          addMatch(page.url, similarity, 'pagesWithMatchingImages', page.pageTitle);
        }
      }
    }

    // Process visually similar images
    // Note: These have the highest false positive rate and should be treated with more scrutiny
    if (webDetection.visuallySimilarImages) {
      for (const image of webDetection.visuallySimilarImages) {
        if (image.url) {
          // Use provided score, or default to 0.86 to pass threshold
          const similarity = image.score ?? 0.86;
          addMatch(image.url, similarity, 'visuallySimilarImages');
        }
      }
    }

    // Sort by similarity (highest first) and limit to top results
    return matches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20);
  }
}

// Export singleton instance
export const reverseImageService = ReverseImageService.getInstance();

// Export class for testing purposes
export { ReverseImageService };
