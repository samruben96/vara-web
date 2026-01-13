-- Add HNSW index for vector similarity search on protected_images embeddings
-- This index dramatically speeds up cosine similarity searches for image matching
--
-- HNSW (Hierarchical Navigable Small World) parameters:
-- - m = 16: Maximum number of connections per layer (higher = better recall, more memory)
-- - ef_construction = 64: Size of dynamic candidate list during index build (higher = better quality, slower build)
--
-- Uses vector_cosine_ops for cosine similarity searches (most common for CLIP embeddings)
-- The IF NOT EXISTS clause makes this migration idempotent

CREATE INDEX IF NOT EXISTS "protected_images_embedding_idx"
ON "protected_images"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
