import crypto from 'crypto';

/**
 * Result from perceptual hash generation.
 */
export interface PerceptualHashResult {
  hash: string;
  algorithm: string;
  processingTimeMs: number;
}

/**
 * Result from comparing two perceptual hashes.
 */
export interface HashComparisonResult {
  hammingDistance: number;
  similarity: number;
  isLikelySame: boolean;
}

/**
 * Hash length for the perceptual hash (16 hex characters = 64 bits).
 */
const HASH_LENGTH = 16;

/**
 * Algorithm identifier for the mock implementation.
 */
const MOCK_ALGORITHM = 'pHash-mock';

/**
 * Hamming distance threshold for considering images as likely the same.
 * Lower distance = more similar.
 */
const SIMILARITY_THRESHOLD = 10;

/**
 * Generates a deterministic 16-character hex hash from image buffer.
 * This simulates a perceptual hash that would be similar for visually similar images.
 */
function generateDeterministicHash(imageBuffer: Buffer): string {
  // Create SHA-256 hash of the buffer
  const fullHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

  // Take first 16 characters as our perceptual hash
  return fullHash.substring(0, HASH_LENGTH);
}

/**
 * Calculates the Hamming distance between two hex strings.
 * Hamming distance counts the number of positions where corresponding bits differ.
 */
function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error(`Hash lengths must match: ${hash1.length} vs ${hash2.length}`);
  }

  let distance = 0;

  for (let i = 0; i < hash1.length; i++) {
    // Convert each hex character to its binary representation
    const bits1 = parseInt(hash1[i]!, 16);
    const bits2 = parseInt(hash2[i]!, 16);

    // XOR to find differing bits, then count them
    let xor = bits1 ^ bits2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Perceptual hash service for generating and comparing image hashes.
 *
 * Perceptual hashes create fingerprints that remain similar for
 * visually similar images, even after resizing, compression, or minor edits.
 *
 * This is useful for:
 * - Finding exact duplicates quickly (hash equality)
 * - Finding near-duplicates (small Hamming distance)
 * - Detecting minor modifications to images
 */
class PerceptualHashService {
  private static instance: PerceptualHashService;

  private constructor() {
    console.log('[PerceptualHashService] Initialized in mock mode');
  }

  /**
   * Gets the singleton instance of PerceptualHashService.
   */
  public static getInstance(): PerceptualHashService {
    if (!PerceptualHashService.instance) {
      PerceptualHashService.instance = new PerceptualHashService();
    }
    return PerceptualHashService.instance;
  }

  /**
   * Generates a perceptual hash for the given image buffer.
   *
   * @param imageBuffer - The image data as a Buffer
   * @returns Promise resolving to hash result with 16-character hex hash and metadata
   *
   * @example
   * const result = await perceptualHashService.generateHash(imageBuffer);
   * console.log(result.hash); // "a4e9f8d2c3b1a0e5"
   */
  public async generateHash(imageBuffer: Buffer): Promise<PerceptualHashResult> {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer cannot be empty');
    }

    const startTime = Date.now();

    // Generate deterministic hash
    const hash = generateDeterministicHash(imageBuffer);

    // Simulate minimal processing time (5-20ms for hash generation)
    const minDelay = 5;
    const maxDelay = 20;
    const targetDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    const elapsed = Date.now() - startTime;

    if (elapsed < targetDelay) {
      await new Promise((resolve) => setTimeout(resolve, targetDelay - elapsed));
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      hash,
      algorithm: MOCK_ALGORITHM,
      processingTimeMs,
    };
  }

  /**
   * Compares two perceptual hashes and returns similarity metrics.
   *
   * @param hash1 - First perceptual hash (16-character hex string)
   * @param hash2 - Second perceptual hash (16-character hex string)
   * @returns Comparison result with Hamming distance, similarity score, and likely-same flag
   *
   * @example
   * const result = perceptualHashService.compareHashes(hash1, hash2);
   * if (result.isLikelySame) {
   *   console.log('Images appear to be the same or very similar');
   * }
   *
   * Similarity thresholds:
   * - hammingDistance 0: Identical images
   * - hammingDistance 1-5: Very similar (same image, minor edits)
   * - hammingDistance 6-10: Similar (same subject, different angle/crop)
   * - hammingDistance 11-20: Somewhat similar
   * - hammingDistance 21+: Different images
   */
  public compareHashes(hash1: string, hash2: string): HashComparisonResult {
    if (!hash1 || !hash2) {
      throw new Error('Both hashes are required for comparison');
    }

    if (hash1.length !== HASH_LENGTH || hash2.length !== HASH_LENGTH) {
      throw new Error(`Hashes must be ${HASH_LENGTH} characters long`);
    }

    // Validate hex format
    const hexPattern = /^[0-9a-f]+$/i;
    if (!hexPattern.test(hash1) || !hexPattern.test(hash2)) {
      throw new Error('Hashes must be valid hexadecimal strings');
    }

    const hammingDistance = calculateHammingDistance(
      hash1.toLowerCase(),
      hash2.toLowerCase()
    );

    // Maximum possible Hamming distance for 16 hex characters (64 bits)
    const maxDistance = HASH_LENGTH * 4; // 4 bits per hex character

    // Calculate similarity as a percentage (1 = identical, 0 = completely different)
    const similarity = 1 - (hammingDistance / maxDistance);

    // Determine if images are likely the same based on threshold
    const isLikelySame = hammingDistance <= SIMILARITY_THRESHOLD;

    return {
      hammingDistance,
      similarity,
      isLikelySame,
    };
  }
}

// Export singleton instance
export const perceptualHashService = PerceptualHashService.getInstance();

// Export class for testing purposes
export { PerceptualHashService };
