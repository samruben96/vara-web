/**
 * Vector Services
 *
 * Exports for pgvector-based image similarity operations.
 */

export {
  findSimilarImages,
  findSimilarToImage,
  findSimilarImagesBatch,
  type SimilarImageResult,
  type SimilaritySearchOptions,
} from './similarity';
