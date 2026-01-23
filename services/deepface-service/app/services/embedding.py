"""
DeepFace embedding extraction and face comparison service.

Handles lazy-loading of the ArcFace model and provides face recognition functionality.
"""

import base64
import io
import logging
import os
import tempfile
import time
from typing import Optional, Tuple

import httpx
import numpy as np
from PIL import Image

# Configure logging
logger = logging.getLogger(__name__)


class DeepFaceService:
    """
    Service for face embedding extraction and comparison using DeepFace.

    Uses lazy-loading to defer model initialization until first use,
    as model loading can take 10-30 seconds.
    """

    # ArcFace model configuration
    MODEL_NAME = "ArcFace"
    EMBEDDING_DIMENSIONS = 512

    # Default thresholds for ArcFace model by distance metric
    DEFAULT_THRESHOLDS = {
        "cosine": 0.68,
        "euclidean": 4.15,
        "euclidean_l2": 1.13
    }

    def __init__(self):
        """Initialize service without loading the model."""
        self._model_loaded = False
        self._deepface = None
        logger.info("DeepFaceService initialized (model not yet loaded)")

    def _ensure_model_loaded(self) -> None:
        """
        Lazy-load the DeepFace model on first use.

        This is done lazily because model loading takes 10-30 seconds
        and we don't want to block service startup.
        """
        if self._model_loaded:
            return

        logger.info(f"Loading {self.MODEL_NAME} model (this may take a while)...")
        start_time = time.time()

        try:
            # Import DeepFace here to defer TensorFlow initialization
            from deepface import DeepFace
            self._deepface = DeepFace

            # Warm up the model by running a dummy extraction
            # This ensures the model weights are loaded into memory
            dummy_image = self._create_dummy_image()
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                dummy_image.save(tmp.name)
                try:
                    self._deepface.represent(
                        img_path=tmp.name,
                        model_name=self.MODEL_NAME,
                        enforce_detection=False
                    )
                finally:
                    os.unlink(tmp.name)

            self._model_loaded = True
            elapsed = time.time() - start_time
            logger.info(f"{self.MODEL_NAME} model loaded successfully in {elapsed:.2f}s")

        except Exception as e:
            logger.error(f"Failed to load {self.MODEL_NAME} model: {e}")
            raise RuntimeError(f"Model initialization failed: {e}")

    def _create_dummy_image(self) -> Image.Image:
        """Create a simple dummy image for model warm-up."""
        # Create a 224x224 RGB image (typical face recognition input size)
        return Image.new("RGB", (224, 224), color=(128, 128, 128))

    @property
    def is_model_loaded(self) -> bool:
        """Check if the model is currently loaded."""
        return self._model_loaded

    async def download_image(self, url: str, timeout: float = 30.0) -> bytes:
        """
        Download image from URL.

        Args:
            url: Image URL to download
            timeout: Request timeout in seconds

        Returns:
            Image bytes

        Raises:
            ValueError: If download fails or image is invalid
        """
        logger.debug(f"Downloading image from URL: {url[:100]}...")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=timeout, follow_redirects=True)
                response.raise_for_status()

                content_type = response.headers.get("content-type", "")
                if not content_type.startswith("image/"):
                    logger.warning(f"Unexpected content type: {content_type}")

                return response.content

            except httpx.TimeoutException:
                raise ValueError(f"Timeout downloading image from {url}")
            except httpx.HTTPStatusError as e:
                raise ValueError(f"HTTP error {e.response.status_code} downloading image")
            except Exception as e:
                raise ValueError(f"Failed to download image: {e}")

    def decode_base64_image(self, base64_string: str) -> bytes:
        """
        Decode base64 string to image bytes.

        Args:
            base64_string: Base64 encoded image (with or without data URI prefix)

        Returns:
            Image bytes

        Raises:
            ValueError: If base64 decoding fails
        """
        try:
            # Remove data URI prefix if present
            if "," in base64_string:
                base64_string = base64_string.split(",", 1)[1]

            # Remove whitespace
            base64_string = base64_string.strip()

            return base64.b64decode(base64_string)

        except Exception as e:
            raise ValueError(f"Invalid base64 image data: {e}")

    def validate_image(self, image_bytes: bytes) -> Image.Image:
        """
        Validate and open image from bytes.

        Args:
            image_bytes: Raw image bytes

        Returns:
            PIL Image object

        Raises:
            ValueError: If image is invalid or corrupted
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image.verify()  # Verify image integrity

            # Re-open after verify (verify() invalidates the image)
            image = Image.open(io.BytesIO(image_bytes))

            # Convert to RGB if necessary (handles RGBA, P, etc.)
            if image.mode != "RGB":
                image = image.convert("RGB")

            return image

        except Exception as e:
            raise ValueError(f"Invalid or corrupted image: {e}")

    def extract_embedding(
        self,
        image: Image.Image,
        enforce_detection: bool = True,
        align: bool = True
    ) -> Tuple[np.ndarray, dict]:
        """
        Extract face embedding from an image.

        Args:
            image: PIL Image object
            enforce_detection: Raise error if no face detected
            align: Align face before extraction

        Returns:
            Tuple of (embedding array, face metadata)

        Raises:
            ValueError: If face detection fails
        """
        self._ensure_model_loaded()

        # Save image to temporary file (DeepFace requires file path)
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            try:
                image.save(tmp.name, format="JPEG", quality=95)

                # Extract embedding using DeepFace
                result = self._deepface.represent(
                    img_path=tmp.name,
                    model_name=self.MODEL_NAME,
                    enforce_detection=enforce_detection,
                    align=align,
                    detector_backend="retinaface"  # Best accuracy
                )

            finally:
                # Clean up temp file
                if os.path.exists(tmp.name):
                    os.unlink(tmp.name)

        if not result:
            raise ValueError("No embedding generated")

        # DeepFace returns a list of results (one per face)
        if isinstance(result, list):
            if len(result) == 0:
                raise ValueError("No faces detected in image")
            if len(result) > 1 and enforce_detection:
                raise ValueError(f"Multiple faces detected ({len(result)})")

            # Use the first face (highest confidence)
            face_data = result[0]
        else:
            face_data = result

        embedding = np.array(face_data["embedding"])

        # Extract metadata
        metadata = {
            "face_count": len(result) if isinstance(result, list) else 1,
            "face_confidence": face_data.get("face_confidence", 0.99),
            "facial_area": face_data.get("facial_area", {"x": 0, "y": 0, "w": 0, "h": 0})
        }

        return embedding, metadata

    def compare_embeddings(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray,
        distance_metric: str = "cosine",
        threshold: Optional[float] = None
    ) -> dict:
        """
        Compare two face embeddings.

        Args:
            embedding1: First face embedding (512-dim)
            embedding2: Second face embedding (512-dim)
            distance_metric: 'cosine', 'euclidean', or 'euclidean_l2'
            threshold: Custom threshold (uses default if None)

        Returns:
            Comparison results dict
        """
        # Ensure embeddings are numpy arrays
        emb1 = np.array(embedding1).flatten()
        emb2 = np.array(embedding2).flatten()

        # Calculate distance based on metric
        if distance_metric == "cosine":
            # Cosine distance = 1 - cosine_similarity
            from scipy.spatial.distance import cosine
            distance = cosine(emb1, emb2)
        elif distance_metric == "euclidean":
            distance = np.linalg.norm(emb1 - emb2)
        elif distance_metric == "euclidean_l2":
            # L2 normalized euclidean distance
            emb1_norm = emb1 / np.linalg.norm(emb1)
            emb2_norm = emb2 / np.linalg.norm(emb2)
            distance = np.linalg.norm(emb1_norm - emb2_norm)
        else:
            raise ValueError(f"Unknown distance metric: {distance_metric}")

        # Use default threshold if not provided
        if threshold is None:
            threshold = self.DEFAULT_THRESHOLDS.get(distance_metric, 0.68)

        # Determine if same person
        is_same_person = distance < threshold

        # Calculate similarity score (0-1, higher is more similar)
        if distance_metric == "cosine":
            similarity = 1 - distance
        else:
            # For euclidean metrics, use exponential decay
            similarity = np.exp(-distance / threshold)

        # Calculate confidence (how certain we are about the decision)
        # Higher confidence when distance is far from threshold
        distance_from_threshold = abs(distance - threshold)
        confidence = min(1.0, distance_from_threshold / threshold)

        return {
            "is_same_person": bool(is_same_person),
            "distance": float(distance),
            "similarity": float(np.clip(similarity, 0, 1)),
            "confidence": float(confidence),
            "threshold_used": float(threshold),
            "distance_metric": distance_metric
        }


# Global service instance (singleton)
_service_instance: Optional[DeepFaceService] = None


def get_deepface_service() -> DeepFaceService:
    """
    Get the global DeepFace service instance.

    Returns:
        DeepFaceService singleton instance
    """
    global _service_instance

    if _service_instance is None:
        _service_instance = DeepFaceService()

    return _service_instance
