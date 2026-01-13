/**
 * Vector Similarity Service
 *
 * Provides functions for finding similar images using pgvector.
 * Uses cosine similarity for comparing CLIP embeddings stored as vector(512).
 */

import { prisma } from '../../config/prisma';

/**
 * Result of a similarity search.
 */
export interface SimilarImageResult {
  id: string;
  userId: string;
  storageUrl: string;
  similarity: number;
}

/**
 * Options for similarity search operations.
 */
export interface SimilaritySearchOptions {
  /** Filter results to a specific user's images */
  userId?: string;
  /** Maximum number of results to return (default: 10) */
  limit?: number;
  /** Minimum similarity threshold 0-1 (default: 0.7) */
  threshold?: number;
  /** Exclude a specific image from results (useful for self-comparison) */
  excludeImageId?: string;
}

/**
 * Default configuration for similarity searches.
 */
const DEFAULT_OPTIONS = {
  limit: 10,
  threshold: 0.7,
} as const;

/**
 * Converts a number array to a pgvector-compatible string.
 * Example: [0.1, 0.2, 0.3] -> '[0.1,0.2,0.3]'
 */
function toVectorString(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Finds protected images similar to the provided embedding vector.
 *
 * Uses pgvector's cosine distance operator (<=>):
 * - Cosine distance = 1 - cosine_similarity
 * - We convert to similarity: similarity = 1 - distance
 *
 * @param embedding - The 512-dimensional CLIP embedding vector to compare against
 * @param options - Search configuration options
 * @returns Array of similar images sorted by similarity (highest first)
 *
 * @example
 * ```typescript
 * const results = await findSimilarImages(clipEmbedding, {
 *   userId: 'user-123',
 *   limit: 5,
 *   threshold: 0.8
 * });
 * ```
 */
export async function findSimilarImages(
  embedding: number[],
  options: SimilaritySearchOptions = {}
): Promise<SimilarImageResult[]> {
  const { limit, threshold, userId, excludeImageId } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // Validate embedding dimensions
  if (embedding.length !== 512) {
    throw new Error(
      `Invalid embedding dimension: expected 512, got ${embedding.length}`
    );
  }

  const vectorString = toVectorString(embedding);

  // Build the WHERE clause conditions
  const conditions: string[] = [
    `status = 'ACTIVE'`,
    `embedding IS NOT NULL`,
    `(1 - (embedding <=> $1::vector)) >= $2`, // Similarity threshold
  ];

  const params: (string | number)[] = [vectorString, threshold];
  let paramIndex = 3;

  if (userId) {
    conditions.push(`"userId" = $${paramIndex}`);
    params.push(userId);
    paramIndex++;
  }

  if (excludeImageId) {
    conditions.push(`id != $${paramIndex}`);
    params.push(excludeImageId);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // Use raw query for pgvector operations
  // Prisma doesn't natively support vector types, so we use $queryRawUnsafe
  const query = `
    SELECT
      id,
      "userId",
      "storageUrl",
      (1 - (embedding <=> $1::vector)) as similarity
    FROM protected_images
    WHERE ${whereClause}
    ORDER BY similarity DESC
    LIMIT $${paramIndex}
  `;

  params.push(limit);

  try {
    const results = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        userId: string;
        storageUrl: string;
        similarity: number;
      }>
    >(query, ...params);

    return results.map((row) => ({
      id: row.id,
      userId: row.userId,
      storageUrl: row.storageUrl,
      similarity: Number(row.similarity),
    }));
  } catch (error) {
    console.error('[VectorSimilarity] Error finding similar images:', error);
    throw error;
  }
}

/**
 * Finds images similar to an existing protected image by its ID.
 *
 * This is a convenience function that:
 * 1. Retrieves the embedding from the specified image
 * 2. Searches for similar images (excluding the source image)
 *
 * @param imageId - The ID of the protected image to find matches for
 * @param options - Search configuration options (excludeImageId is set automatically)
 * @returns Array of similar images sorted by similarity (highest first)
 * @throws Error if the image doesn't exist or has no embedding
 *
 * @example
 * ```typescript
 * const matches = await findSimilarToImage('img-abc-123', {
 *   limit: 20,
 *   threshold: 0.75
 * });
 * ```
 */
export async function findSimilarToImage(
  imageId: string,
  options: Omit<SimilaritySearchOptions, 'excludeImageId'> = {}
): Promise<SimilarImageResult[]> {
  // Fetch the source image's embedding using raw query
  // since Prisma doesn't support vector type directly
  const sourceImages = await prisma.$queryRawUnsafe<
    Array<{ id: string; embedding: string | null }>
  >(
    `SELECT id, embedding::text FROM protected_images WHERE id = $1 LIMIT 1`,
    imageId
  );

  const sourceImage = sourceImages[0];

  if (!sourceImage) {
    throw new Error(`Image not found: ${imageId}`);
  }

  if (!sourceImage.embedding) {
    throw new Error(`Image has no embedding: ${imageId}`);
  }

  // Parse the embedding from the database string format
  // pgvector returns embeddings as strings like '[0.1,0.2,0.3,...]'
  const embedding = parseEmbeddingString(sourceImage.embedding);

  return findSimilarImages(embedding, {
    ...options,
    excludeImageId: imageId,
  });
}

/**
 * Parses a pgvector embedding string into a number array.
 * Format: '[0.1,0.2,0.3,...]' -> [0.1, 0.2, 0.3, ...]
 */
function parseEmbeddingString(embeddingStr: string): number[] {
  // Remove brackets and split by comma
  const cleanedStr = embeddingStr.replace(/[[\]]/g, '');
  return cleanedStr.split(',').map((val) => parseFloat(val.trim()));
}

/**
 * Batch find similar images for multiple embeddings.
 * Useful for processing multiple images in a single scan job.
 *
 * @param embeddings - Array of {imageId, embedding} pairs to search for
 * @param options - Search configuration options
 * @returns Map of imageId -> similar images array
 */
export async function findSimilarImagesBatch(
  embeddings: Array<{ imageId: string; embedding: number[] }>,
  options: SimilaritySearchOptions = {}
): Promise<Map<string, SimilarImageResult[]>> {
  const results = new Map<string, SimilarImageResult[]>();

  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;

  for (let i = 0; i < embeddings.length; i += CONCURRENCY) {
    const batch = embeddings.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async ({ imageId, embedding }) => {
        const similar = await findSimilarImages(embedding, {
          ...options,
          excludeImageId: imageId,
        });
        return { imageId, similar };
      })
    );

    for (const { imageId, similar } of batchResults) {
      results.set(imageId, similar);
    }
  }

  return results;
}
