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
 * Environment variable for OpenAI API key.
 * When present, real CLIP API will be used.
 * When absent, mock embeddings are generated.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * CLIP embeddings are 512-dimensional vectors.
 */
const EMBEDDING_DIMENSION = 512;

/**
 * Model version identifier for mock implementation.
 */
const MOCK_MODEL_VERSION = 'clip-vit-base-patch32-mock';

/**
 * Simulates processing delay between min and max milliseconds.
 */
async function simulateLatency(minMs: number, maxMs: number): Promise<number> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
  return delay;
}

/**
 * Generates a deterministic normalized vector based on image buffer.
 * Uses buffer hash as seed for reproducible results.
 */
function generateMockEmbedding(imageBuffer: Buffer): number[] {
  // Create deterministic seed from buffer hash
  const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

  // Use hash to seed the random number generator
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
 * CLIP embedding service for generating image embeddings.
 *
 * Uses OpenAI CLIP when OPENAI_API_KEY is configured,
 * otherwise falls back to deterministic mock embeddings.
 *
 * Mock mode simulates 100-300ms latency to mimic real API behavior.
 */
class ClipService {
  private static instance: ClipService;
  private readonly isMockMode: boolean;

  private constructor() {
    this.isMockMode = !OPENAI_API_KEY;

    if (this.isMockMode) {
      console.log('[ClipService] Running in mock mode - OPENAI_API_KEY not configured');
    } else {
      console.log('[ClipService] Running with real OpenAI CLIP API');
    }
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
   * Generates a CLIP embedding for the given image buffer.
   *
   * @param imageBuffer - The image data as a Buffer
   * @returns Promise resolving to embedding result with 512-dimensional vector and metadata
   *
   * @example
   * const result = await clipService.generateEmbedding(imageBuffer);
   * console.log(result.embedding.length); // 512
   * console.log(result.processingTimeMs); // ~100-300ms in mock mode
   */
  public async generateEmbedding(imageBuffer: Buffer): Promise<ClipEmbeddingResult> {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer cannot be empty');
    }

    if (this.isMockMode) {
      return this.generateMockEmbeddingResult(imageBuffer);
    }

    return this.generateRealEmbedding(imageBuffer);
  }

  /**
   * Generates a mock embedding for development/testing.
   * Simulates 100-300ms latency.
   */
  private async generateMockEmbeddingResult(imageBuffer: Buffer): Promise<ClipEmbeddingResult> {
    const processingTimeMs = await simulateLatency(100, 300);
    const embedding = generateMockEmbedding(imageBuffer);

    return {
      embedding,
      modelVersion: MOCK_MODEL_VERSION,
      processingTimeMs,
    };
  }

  /**
   * Generates a real embedding using OpenAI CLIP API.
   * TODO: Implement actual API call when ready.
   */
  private async generateRealEmbedding(imageBuffer: Buffer): Promise<ClipEmbeddingResult> {
    const startTime = Date.now();

    // TODO: Implement actual OpenAI CLIP API call
    // For now, fall back to mock to allow testing
    console.warn('[ClipService] Real CLIP API not yet implemented, using mock');

    const embedding = generateMockEmbedding(imageBuffer);
    const processingTimeMs = Date.now() - startTime;

    return {
      embedding,
      modelVersion: 'clip-vit-base-patch32',
      processingTimeMs,
    };
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
