import crypto from 'crypto';

/**
 * Result from face embedding extraction.
 */
export interface FaceEmbeddingResult {
  embedding: number[] | null;
  faceCount: number;
  faceConfidence: number;
  facialArea: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  processingTimeMs: number;
}

/**
 * Result from face comparison.
 */
export interface FaceComparisonResult {
  isSamePerson: boolean;
  distance: number;
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
  processingTimeMs: number;
}

/**
 * Response from the DeepFace service health check.
 */
interface HealthResponse {
  status: string;
  service: string;
  model_loaded: boolean;
}

/**
 * Response from the DeepFace service embedding extraction.
 */
interface ExtractEmbeddingResponse {
  embedding: number[];
  face_count: number;
  face_confidence: number;
  facial_area: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  processing_time_ms: number;
}

/**
 * Response from the DeepFace service face comparison.
 */
interface CompareFacesResponse {
  is_same_person: boolean;
  distance: number;
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
  processing_time_ms: number;
}

/**
 * Error response from the DeepFace service.
 */
interface ErrorResponse {
  error: string;
  code?: string;
}

/**
 * Environment variable for DeepFace service URL.
 */
const DEEPFACE_SERVICE_URL = process.env.DEEPFACE_SERVICE_URL || 'http://localhost:8000';

/**
 * Face embeddings are 512-dimensional vectors (ArcFace/Facenet512).
 */
const EMBEDDING_DIMENSION = 512;

/**
 * Default threshold for face comparison (cosine distance).
 */
const DEFAULT_COMPARISON_THRESHOLD = 0.68;

/**
 * Health check cache duration in milliseconds (30 seconds).
 */
const HEALTH_CACHE_DURATION_MS = 30000;

/**
 * Generates a deterministic random number from a seed string.
 */
function seededRandom(seed: string): number {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
}

/**
 * Generates a deterministic normalized 512-dim vector based on input data.
 * Uses hash as seed for reproducible results.
 */
function generateMockEmbedding(data: Buffer | string): number[] {
  const inputBuffer = typeof data === 'string' ? Buffer.from(data) : data;
  const hash = crypto.createHash('sha256').update(inputBuffer).digest('hex');

  const embedding: number[] = [];

  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    // Use different parts of the hash for each dimension
    const hashPart = hash.substring((i * 2) % 60, ((i * 2) % 60) + 4);
    const value = parseInt(hashPart, 16) / 0xffff;
    // Map to range [-1, 1]
    embedding.push(value * 2 - 1);
  }

  // Normalize the vector to unit length (L2 normalization)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / magnitude);
}

/**
 * Calculates cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`);
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

/**
 * Face embedding service for extracting and comparing facial embeddings.
 *
 * Uses DeepFace Python microservice when available,
 * otherwise falls back to deterministic mock embeddings.
 *
 * Mock mode behavior:
 * - 15% of images will have a face detected
 * - Deterministic embeddings based on image hash
 * - Simulates 50-150ms latency
 */
class FaceEmbeddingService {
  private static instance: FaceEmbeddingService;
  private isMockMode: boolean;
  private healthCache: { available: boolean; timestamp: number } | null = null;

  private constructor() {
    // Start assuming mock mode, will be updated on first health check
    this.isMockMode = true;

    console.log(
      `[FaceEmbeddingService] Initializing with DeepFace service URL: ${DEEPFACE_SERVICE_URL}`
    );

    // Perform initial health check asynchronously
    this.isServiceAvailable().then((available) => {
      if (available) {
        console.log('[FaceEmbeddingService] DeepFace service is available');
        this.isMockMode = false;
      } else {
        console.log(
          '[FaceEmbeddingService] Running in mock mode - DeepFace service unavailable'
        );
      }
    });
  }

  /**
   * Gets the singleton instance of FaceEmbeddingService.
   */
  public static getInstance(): FaceEmbeddingService {
    if (!FaceEmbeddingService.instance) {
      FaceEmbeddingService.instance = new FaceEmbeddingService();
    }
    return FaceEmbeddingService.instance;
  }

  /**
   * Checks if the service is running in mock mode.
   */
  public isInMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Checks if the DeepFace service is available.
   * Results are cached for 30 seconds.
   *
   * @returns Promise resolving to true if service is available
   */
  public async isServiceAvailable(): Promise<boolean> {
    // Check cache first
    if (this.healthCache) {
      const cacheAge = Date.now() - this.healthCache.timestamp;
      if (cacheAge < HEALTH_CACHE_DURATION_MS) {
        return this.healthCache.available;
      }
    }

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
        const available = data.status === 'healthy' && data.model_loaded;

        this.healthCache = { available, timestamp: Date.now() };
        this.isMockMode = !available;

        return available;
      }

      this.healthCache = { available: false, timestamp: Date.now() };
      return false;
    } catch (error) {
      console.warn(
        `[FaceEmbeddingService] Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.healthCache = { available: false, timestamp: Date.now() };
      return false;
    }
  }

  /**
   * Extracts face embedding from an image.
   *
   * @param imageBuffer - The image data as a Buffer
   * @returns Promise resolving to embedding result
   *          Returns null embedding if no face detected
   *
   * @example
   * const result = await faceEmbeddingService.extractEmbedding(imageBuffer);
   * if (result.embedding) {
   *   console.log('Face detected with confidence:', result.faceConfidence);
   * } else {
   *   console.log('No face detected in image');
   * }
   */
  public async extractEmbedding(imageBuffer: Buffer): Promise<FaceEmbeddingResult> {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer cannot be empty');
    }

    // Check service availability before attempting real call
    const available = await this.isServiceAvailable();

    if (!available || this.isMockMode) {
      return this.extractMockEmbedding(imageBuffer);
    }

    return this.extractRealEmbedding(imageBuffer);
  }

  /**
   * Compares two face embeddings to determine if they're the same person.
   *
   * @param embedding1 - First face embedding vector
   * @param embedding2 - Second face embedding vector
   * @param threshold - Distance threshold (default: 0.68)
   * @returns Promise resolving to comparison result
   *
   * @example
   * const result = await faceEmbeddingService.compareFaces(embedding1, embedding2);
   * if (result.isSamePerson) {
   *   console.log(`Match with ${result.confidence} confidence`);
   * }
   */
  public async compareFaces(
    embedding1: number[],
    embedding2: number[],
    threshold: number = DEFAULT_COMPARISON_THRESHOLD
  ): Promise<FaceComparisonResult> {
    if (!embedding1 || embedding1.length === 0) {
      throw new Error('First embedding cannot be empty');
    }
    if (!embedding2 || embedding2.length === 0) {
      throw new Error('Second embedding cannot be empty');
    }
    if (embedding1.length !== EMBEDDING_DIMENSION || embedding2.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Embeddings must be ${EMBEDDING_DIMENSION}-dimensional`);
    }

    // Check service availability before attempting real call
    const available = await this.isServiceAvailable();

    if (!available || this.isMockMode) {
      return this.compareMockFaces(embedding1, embedding2, threshold);
    }

    return this.compareRealFaces(embedding1, embedding2, threshold);
  }

  /**
   * Extracts mock embedding for development/testing.
   * 15% chance of detecting a face.
   */
  private async extractMockEmbedding(imageBuffer: Buffer): Promise<FaceEmbeddingResult> {
    const startTime = Date.now();

    // Simulate API latency (50-150ms)
    const delay = Math.floor(Math.random() * 100) + 50;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const faceDetectionChance = seededRandom(hash + 'face_detection');

    // 15% chance of detecting a face
    const hasFace = faceDetectionChance < 0.15;

    if (!hasFace) {
      return {
        embedding: null,
        faceCount: 0,
        faceConfidence: 0,
        facialArea: null,
        processingTimeMs: Date.now() - startTime,
      };
    }

    const embedding = generateMockEmbedding(imageBuffer);
    const faceConfidence = 0.85 + seededRandom(hash + 'confidence') * 0.14; // 0.85-0.99

    // Generate deterministic facial area
    const imageWidth = 640; // Assume standard dimensions
    const imageHeight = 480;
    const faceWidth = 100 + Math.floor(seededRandom(hash + 'width') * 150); // 100-250
    const faceHeight = 100 + Math.floor(seededRandom(hash + 'height') * 200); // 100-300
    const faceX = Math.floor(seededRandom(hash + 'x') * (imageWidth - faceWidth));
    const faceY = Math.floor(seededRandom(hash + 'y') * (imageHeight - faceHeight));

    return {
      embedding,
      faceCount: 1,
      faceConfidence: Math.round(faceConfidence * 100) / 100,
      facialArea: {
        x: faceX,
        y: faceY,
        w: faceWidth,
        h: faceHeight,
      },
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Extracts real embedding using DeepFace service.
   */
  private async extractRealEmbedding(imageBuffer: Buffer): Promise<FaceEmbeddingResult> {
    const startTime = Date.now();

    try {
      const base64Image = imageBuffer.toString('base64');

      const response = await fetch(`${DEEPFACE_SERVICE_URL}/api/v1/extract-embedding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: base64Image,
        }),
      });

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;

        // Handle NO_FACE_DETECTED gracefully
        if (errorData.code === 'NO_FACE_DETECTED') {
          console.log('[FaceEmbeddingService] No face detected in image');
          return {
            embedding: null,
            faceCount: 0,
            faceConfidence: 0,
            facialArea: null,
            processingTimeMs,
          };
        }

        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as ExtractEmbeddingResponse;

      return {
        embedding: data.embedding,
        faceCount: data.face_count,
        faceConfidence: data.face_confidence,
        facialArea: data.facial_area,
        processingTimeMs,
      };
    } catch (error) {
      console.error(
        `[FaceEmbeddingService] Embedding extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Fall back to mock on error
      console.warn('[FaceEmbeddingService] Falling back to mock mode');
      this.isMockMode = true;
      return this.extractMockEmbedding(imageBuffer);
    }
  }

  /**
   * Compares mock faces for development/testing.
   * Uses cosine similarity of embedding hashes for deterministic results.
   */
  private async compareMockFaces(
    embedding1: number[],
    embedding2: number[],
    threshold: number
  ): Promise<FaceComparisonResult> {
    const startTime = Date.now();

    // Simulate API latency (30-80ms)
    const delay = Math.floor(Math.random() * 50) + 30;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Calculate actual cosine similarity
    const similarity = cosineSimilarity(embedding1, embedding2);

    // Convert similarity to distance (cosine distance = 1 - similarity)
    const distance = 1 - similarity;

    // Determine if same person based on threshold
    const isSamePerson = distance <= threshold;

    // Determine confidence based on how far from threshold
    let confidence: 'high' | 'medium' | 'low';
    const distanceFromThreshold = Math.abs(distance - threshold);

    if (distanceFromThreshold > 0.15) {
      confidence = 'high';
    } else if (distanceFromThreshold > 0.05) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      isSamePerson,
      distance: Math.round(distance * 1000) / 1000,
      similarity: Math.round(similarity * 1000) / 1000,
      confidence,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Compares real faces using DeepFace service.
   */
  private async compareRealFaces(
    embedding1: number[],
    embedding2: number[],
    threshold: number
  ): Promise<FaceComparisonResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${DEEPFACE_SERVICE_URL}/api/v1/compare-faces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embedding1,
          embedding2,
          threshold,
        }),
      });

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as CompareFacesResponse;

      return {
        isSamePerson: data.is_same_person,
        distance: data.distance,
        similarity: data.similarity,
        confidence: data.confidence,
        processingTimeMs,
      };
    } catch (error) {
      console.error(
        `[FaceEmbeddingService] Face comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Fall back to mock on error
      console.warn('[FaceEmbeddingService] Falling back to mock mode for comparison');
      this.isMockMode = true;
      return this.compareMockFaces(embedding1, embedding2, threshold);
    }
  }

  /**
   * Calculates cosine similarity between two face embeddings.
   *
   * Static method that can be used without service instance.
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Cosine similarity score between -1 and 1
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    return cosineSimilarity(a, b);
  }
}

// Export singleton instance
export const faceEmbeddingService = FaceEmbeddingService.getInstance();

// Export class for testing and static method access
export { FaceEmbeddingService };
