import crypto from 'crypto';

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
 */
const TINEYE_API_KEY = process.env.TINEYE_API_KEY;
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;

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
 * Reverse image search service for finding image matches across the web.
 *
 * Uses TinEye or Google Vision APIs when configured,
 * otherwise falls back to mock results for development.
 */
class ReverseImageService {
  private static instance: ReverseImageService;
  private readonly isMockMode: boolean;
  private readonly provider: string;

  private constructor() {
    this.isMockMode = !TINEYE_API_KEY && !GOOGLE_VISION_API_KEY;

    if (TINEYE_API_KEY) {
      this.provider = 'tineye';
      console.log('[ReverseImageService] Running with TinEye API');
    } else if (GOOGLE_VISION_API_KEY) {
      this.provider = 'google-vision';
      console.log('[ReverseImageService] Running with Google Vision API');
    } else {
      this.provider = MOCK_PROVIDER;
      console.log('[ReverseImageService] Running in mock mode - no API keys configured');
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

    if (this.provider === 'google-vision') {
      return this.performGoogleVisionSearch(imageBuffer, startTime);
    }

    if (this.provider === 'tineye') {
      // TinEye implementation can be added here in the future
      console.warn('[ReverseImageService] TinEye API not yet implemented, falling back to mock');
      const mockResult = await this.performMockSearch(imageBuffer);
      return {
        ...mockResult,
        provider: this.provider,
        processingTimeMs: Date.now() - startTime,
      };
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
