"""
CLIP embedding extraction service.

Uses sentence-transformers with the clip-ViT-B-32 model to generate
512-dimensional image embeddings for similarity search.
"""

import io
import logging
import os
import time
from typing import Optional, Tuple

import numpy as np
from PIL import Image
from scipy.spatial.distance import cosine

# Configure logging
logger = logging.getLogger(__name__)


class CLIPService:
    """
    Service for CLIP image embedding extraction.

    Uses lazy-loading to defer model initialization until first use,
    as model loading can take several seconds and uses ~400MB memory.
    """

    MODEL_NAME = "clip-ViT-B-32"
    EMBEDDING_DIMENSIONS = 512

    def __init__(self):
        """Initialize service without loading the model."""
        self._model = None
        self._model_loaded = False
        logger.info("CLIPService initialized (model not yet loaded)")

    def _ensure_model_loaded(self) -> None:
        """
        Lazy-load the CLIP model on first use.

        This is done lazily because model loading takes several seconds
        and we don't want to block service startup.
        """
        if self._model_loaded:
            return

        logger.info(f"Loading {self.MODEL_NAME} model (this may take a while)...")
        start_time = time.time()

        try:
            # Import sentence_transformers here to defer initialization
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.MODEL_NAME)
            self._model_loaded = True

            elapsed = time.time() - start_time
            logger.info(f"{self.MODEL_NAME} model loaded successfully in {elapsed:.2f}s")

        except Exception as e:
            logger.error(f"Failed to load {self.MODEL_NAME} model: {e}")
            raise RuntimeError(f"CLIP model initialization failed: {e}")

    @property
    def is_model_loaded(self) -> bool:
        """Check if the model is currently loaded."""
        return self._model_loaded

    def extract_embedding(self, image: Image.Image) -> np.ndarray:
        """
        Extract CLIP embedding from an image.

        Args:
            image: PIL Image object

        Returns:
            512-dimensional numpy array embedding
        """
        self._ensure_model_loaded()

        try:
            # Ensure image is in RGB mode
            if image.mode != "RGB":
                image = image.convert("RGB")

            # Generate embedding using sentence-transformers
            # The model.encode() method handles image preprocessing
            embedding = self._model.encode(image, convert_to_numpy=True)

            return embedding.flatten()

        except Exception as e:
            logger.error(f"Failed to extract CLIP embedding: {e}")
            raise ValueError(f"CLIP embedding extraction failed: {e}")

    def compute_similarity(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray
    ) -> float:
        """
        Compute cosine similarity between two CLIP embeddings.

        Args:
            embedding1: First 512-dim embedding
            embedding2: Second 512-dim embedding

        Returns:
            Similarity score (0-1, higher is more similar)
        """
        # Ensure embeddings are numpy arrays and flattened
        emb1 = np.array(embedding1).flatten()
        emb2 = np.array(embedding2).flatten()

        # Validate dimensions
        if len(emb1) != self.EMBEDDING_DIMENSIONS or len(emb2) != self.EMBEDDING_DIMENSIONS:
            raise ValueError(
                f"Embeddings must have {self.EMBEDDING_DIMENSIONS} dimensions. "
                f"Got {len(emb1)} and {len(emb2)}"
            )

        # Compute cosine similarity (1 - cosine distance)
        similarity = 1 - cosine(emb1, emb2)

        return float(np.clip(similarity, 0, 1))


# Global service instance (singleton)
_clip_service_instance: Optional[CLIPService] = None


def get_clip_service() -> CLIPService:
    """
    Get the global CLIP service instance.

    Returns:
        CLIPService singleton instance
    """
    global _clip_service_instance

    if _clip_service_instance is None:
        _clip_service_instance = CLIPService()

    return _clip_service_instance
