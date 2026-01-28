/**
 * CLIP embedding service for generating image embeddings.
 *
 * Calls the Python DeepFace service CLIP endpoints for real embeddings.
 * Falls back to mock mode if the service is unavailable.
 */

import crypto from 'crypto';

/**
 * Result from CLIP embedding generation.
 */
export interface ClipEmbeddingResult {
  embedding: number[];
  modelVersion: string;
  processingTimeMs: number;
}

/**
 * Response from the DeepFace CLIP embed endpoint.
 */
interface ClipEmbedResponse {
  embedding: number[];
  success: boolean;
  error?: string;
}

/**
 * Response from the DeepFace CLIP compare endpoint.
 */
interface ClipCompareResponse {
  similarity: number;
  success: boolean;
  error?: string;
}

/**
 * Health check response from the DeepFace service.
 */
interface HealthResponse {
  status: string;
  model_loaded?: boolean;
  clip_loaded?: boolean;
}

/**
 * Environment variable for DeepFace service URL.
 */
const DEEPFACE_SERVICE_URL = process.env.DEEPFACE_SERVICE_URL || 'http://localhost:8001';

/**
 * CLIP embeddings are 512-dimensional vectors.
 */
const EMBEDDING_DIMENSION = 512;

/**
 * Model version identifier for CLIP embeddings.
 */
const MODEL_VERSION = 'clip-vit-base-patch32';

/**
 * Duration to cache SUCCESSFUL health check results (60 seconds).
 */
const HEALTH_CACHE_SUCCESS_MS = 60_000;

/**
 * Duration to cache FAILED health check results (5 seconds).
 * Short duration to quickly retry after transient startup failures.
 */
const HEALTH_CACHE_FAILURE_MS = 5_000;

/**
 * CLIP embedding service for generating image embeddings.
 *
 * Calls the Python DeepFace service for CLIP embeddings when available.
 * Falls back to mock mode if the service is unavailable.
 */
class ClipService {
  private static instance: ClipService;
  private isMockMode: boolean;
  private healthCache: { available: boolean; timestamp: number } | null = null;

  private constructor() {
    // Start assuming mock mode, will be updated on first health check
    this.isMockMode = true;

    console.log(
      `[ClipService] Initializing with DeepFace service URL: ${DEEPFACE_SERVICE_URL}`
    );

    // Perform initial health check asynchronously
    this.isServiceAvailable().then((available) => {
      if (available) {
        console.log('[ClipService] DeepFace CLIP service is available');
        this.isMockMode = false;
      } else {
        console.log(
          '[ClipService] Running in mock mode - DeepFace service unavailable'
        );
      }
    });
  }

  /**
   * Gets the singleton instance of ClipService.
   */
  public static getInstance(): ClipService {
    if (!ClipService.instance) {
      ClipService.instance = new ClipService();
    }
    return ClipService.instance;
  }

  /**
   * Checks if the service is running in mock mode.
   */
  public isInMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Checks if the DeepFace CLIP service is available.
   * Successful checks cached for 60s, failures cached for 5s.
   *
   * @returns Promise resolving to true if service is available
   */
  public async isServiceAvailable(): Promise<boolean> {
    // Check cache first - use different TTLs for success vs failure
    if (this.healthCache) {
      const cacheAge = Date.now() - this.healthCache.timestamp;
      const cacheDuration = this.healthCache.available
        ? HEALTH_CACHE_SUCCESS_MS
        : HEALTH_CACHE_FAILURE_MS;
      if (cacheAge < cacheDuration) {
        return this.healthCache.available;
      }
    }

    // Try health check with retry for transient failures
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${DEEPFACE_SERVICE_URL}/api/v1/health`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data = (await response.json()) as HealthResponse;
          const available = data.status === 'healthy';

          this.healthCache = { available, timestamp: Date.now() };
          this.isMockMode = !available;

          return available;
        }

        // Non-200 response - don't retry
        break;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (attempt < 2) {
          console.log(`[ClipService] Health check attempt ${attempt} failed: ${errorMsg}. Retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          console.warn(
            `[ClipService] Health check failed: ${errorMsg}. ` +
              `Falling back to mock mode (will retry in ${HEALTH_CACHE_FAILURE_MS / 1000}s).`
          );
        }
      }
    }

    this.healthCache = { available: false, timestamp: Date.now() };
    this.isMockMode = true;
    return false;
  }

  /**
   * Generates a CLIP embedding for the given image.
   *
   * @param imageUrl - The URL of the image to embed
   * @returns Promise resolving to embedding result with 512-dimensional vector
   *
   * @example
   * const result = await clipService.generateEmbedding('https://example.com/image.jpg');
   * console.log(result.embedding.length); // 512
   */
  public async generateEmbedding(imageUrl: string): Promise<ClipEmbeddingResult> {
    if (!imageUrl || imageUrl.trim() === '') {
      throw new Error('Image URL cannot be empty');
    }

    // Check service availability
    const available = await this.isServiceAvailable();

    if (!available || this.isMockMode) {
      return this.generateMockEmbedding(imageUrl);
    }

    return this.generateRealEmbedding(imageUrl);
  }

  /**
   * Generates a CLIP embedding from a base64-encoded image.
   *
   * @param imageBase64 - The base64-encoded image data
   * @returns Promise resolving to embedding result with 512-dimensional vector
   */
  public async generateEmbeddingFromBase64(imageBase64: string): Promise<ClipEmbeddingResult> {
    if (!imageBase64 || imageBase64.trim() === '') {
      throw new Error('Image base64 data cannot be empty');
    }

    // Check service availability
    const available = await this.isServiceAvailable();

    if (!available || this.isMockMode) {
      return this.generateMockEmbeddingFromBase64(imageBase64);
    }

    return this.generateRealEmbeddingFromBase64(imageBase64);
  }

  /**
   * Compares two images and returns their similarity score.
   *
   * @param image1Url - URL of the first image
   * @param image2Url - URL of the second image
   * @returns Promise resolving to similarity score (0.0 - 1.0)
   *
   * @example
   * const similarity = await clipService.compareImages(url1, url2);
   * if (similarity > 0.9) {
   *   console.log('Images are very similar');
   * }
   */
  public async compareImages(image1Url: string, image2Url: string): Promise<number> {
    if (!image1Url || image1Url.trim() === '') {
      throw new Error('First image URL cannot be empty');
    }
    if (!image2Url || image2Url.trim() === '') {
      throw new Error('Second image URL cannot be empty');
    }

    // Check service availability
    const available = await this.isServiceAvailable();

    if (!available || this.isMockMode) {
      return this.compareMockImages(image1Url, image2Url);
    }

    return this.compareRealImages(image1Url, image2Url);
  }

  /**
   * Generates a real embedding using the DeepFace CLIP service.
   */
  private async generateRealEmbedding(imageUrl: string): Promise<ClipEmbeddingResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${DEEPFACE_SERVICE_URL}/api/v1/clip/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
        }),
      });

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = (await response.json()) as ClipEmbedResponse;
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as ClipEmbedResponse;

      if (!data.success || !data.embedding) {
        throw new Error(data.error || 'Failed to generate embedding');
      }

      return {
        embedding: data.embedding,
        modelVersion: MODEL_VERSION,
        processingTimeMs,
      };
    } catch (error) {
      console.error(
        `[ClipService] Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Fall back to mock on error
      console.warn('[ClipService] Falling back to mock mode');
      this.isMockMode = true;
      return this.generateMockEmbedding(imageUrl);
    }
  }

  /**
   * Generates a real embedding from base64 using the DeepFace CLIP service.
   * Includes retry logic for transient network failures.
   */
  private async generateRealEmbeddingFromBase64(imageBase64: string): Promise<ClipEmbeddingResult> {
    const startTime = Date.now();
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout for embedding

        const response = await fetch(`${DEEPFACE_SERVICE_URL}/api/v1/clip/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_base64: imageBase64,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const processingTimeMs = Date.now() - startTime;

        if (!response.ok) {
          const errorData = (await response.json()) as ClipEmbedResponse;
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = (await response.json()) as ClipEmbedResponse;

        if (!data.success || !data.embedding) {
          throw new Error(data.error || 'Failed to generate embedding');
        }

        return {
          embedding: data.embedding,
          modelVersion: MODEL_VERSION,
          processingTimeMs,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        if (attempt < maxRetries) {
          console.log(`[ClipService] Embedding attempt ${attempt} failed: ${errorMsg}. Retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        console.error(`[ClipService] Embedding generation from base64 failed after ${maxRetries} attempts: ${errorMsg}`);
      }
    }

    // Fall back to mock on error
    console.warn('[ClipService] Falling back to mock mode');
    this.isMockMode = true;
    return this.generateMockEmbeddingFromBase64(imageBase64);
  }

  /**
   * Compares two images using the DeepFace CLIP service.
   */
  private async compareRealImages(image1Url: string, image2Url: string): Promise<number> {
    try {
      const response = await fetch(`${DEEPFACE_SERVICE_URL}/api/v1/clip/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image1_url: image1Url,
          image2_url: image2Url,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ClipCompareResponse;
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as ClipCompareResponse;

      if (!data.success) {
        throw new Error(data.error || 'Failed to compare images');
      }

      return data.similarity;
    } catch (error) {
      console.error(
        `[ClipService] Image comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Fall back to mock on error
      console.warn('[ClipService] Falling back to mock mode for comparison');
      this.isMockMode = true;
      return this.compareMockImages(image1Url, image2Url);
    }
  }

  /**
   * Generates a mock embedding for development/testing.
   * Uses URL hash for deterministic results.
   */
  private async generateMockEmbedding(imageUrl: string): Promise<ClipEmbeddingResult> {
    const startTime = Date.now();

    // Simulate API latency (50-150ms)
    const delay = Math.floor(Math.random() * 100) + 50;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const embedding = this.generateDeterministicEmbedding(imageUrl);
    const processingTimeMs = Date.now() - startTime;

    return {
      embedding,
      modelVersion: `${MODEL_VERSION}-mock`,
      processingTimeMs,
    };
  }

  /**
   * Generates a mock embedding from base64 for development/testing.
   */
  private async generateMockEmbeddingFromBase64(imageBase64: string): Promise<ClipEmbeddingResult> {
    const startTime = Date.now();

    // Simulate API latency (50-150ms)
    const delay = Math.floor(Math.random() * 100) + 50;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const embedding = this.generateDeterministicEmbedding(imageBase64);
    const processingTimeMs = Date.now() - startTime;

    return {
      embedding,
      modelVersion: `${MODEL_VERSION}-mock`,
      processingTimeMs,
    };
  }

  /**
   * Compares two mock images using their embeddings.
   */
  private async compareMockImages(image1Url: string, image2Url: string): Promise<number> {
    // Simulate API latency (30-80ms)
    const delay = Math.floor(Math.random() * 50) + 30;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const embedding1 = this.generateDeterministicEmbedding(image1Url);
    const embedding2 = this.generateDeterministicEmbedding(image2Url);

    return ClipService.cosineSimilarity(embedding1, embedding2);
  }

  /**
   * Generates a deterministic normalized vector based on input string.
   * Uses hash as seed for reproducible results.
   */
  private generateDeterministicEmbedding(input: string): number[] {
    const hash = crypto.createHash('sha256').update(input).digest('hex');

    const embedding: number[] = [];

    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      // Use different parts of the hash for each dimension
      const hashPart = hash.substring((i * 2) % 60, ((i * 2) % 60) + 4);
      const value = parseInt(hashPart, 16) / 0xffff;
      // Map to range [-1, 1]
      embedding.push((value * 2) - 1);
    }

    // Normalize the vector to unit length (L2 normalization)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / magnitude);
  }

  /**
   * Calculates the cosine similarity between two embedding vectors.
   *
   * This is a static method that can be used without a service instance.
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Cosine similarity score between -1 and 1
   *          (1 = identical, 0 = orthogonal, -1 = opposite)
   *
   * @example
   * const similarity = ClipService.cosineSimilarity(embedding1, embedding2);
   * if (similarity > 0.9) {
   *   console.log('Images are very similar');
   * }
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`);
    }

    if (a.length === 0) {
      throw new Error('Vectors cannot be empty');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i]!;
      const bVal = b[i]!;
      dotProduct += aVal * bVal;
      magnitudeA += aVal * aVal;
      magnitudeB += bVal * bVal;
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Export singleton instance
export const clipService = ClipService.getInstance();

// Export class for testing and static method access
export { ClipService };
