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
from PIL import Image, ExifTags

# Configure logging
logger = logging.getLogger(__name__)

# Image preprocessing configuration
MIN_IMAGE_DIMENSION = int(os.getenv("MIN_IMAGE_DIMENSION", "480"))
MAX_IMAGE_DIMENSION = int(os.getenv("MAX_IMAGE_DIMENSION", "2048"))

# Face detection thresholds (relaxed for better detection rates)
# Default confidence threshold is lowered from typical 0.8 to 0.5
FACE_DETECTION_CONFIDENCE = float(os.getenv("FACE_DETECTION_CONFIDENCE", "0.5"))
# Minimum face size as percentage of image (lowered from typical 10% to 5%)
MIN_FACE_SIZE_PERCENT = float(os.getenv("MIN_FACE_SIZE_PERCENT", "0.05"))


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
        Validate, open, and preprocess image from bytes.

        Preprocessing includes:
        1. EXIF orientation normalization (auto-rotate based on metadata)
        2. Minimum dimension enforcement (upscale if too small for face detection)
        3. Maximum dimension enforcement (downscale to prevent memory issues)

        Args:
            image_bytes: Raw image bytes

        Returns:
            PIL Image object (preprocessed)

        Raises:
            ValueError: If image is invalid or corrupted
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image.verify()  # Verify image integrity

            # Re-open after verify (verify() invalidates the image)
            image = Image.open(io.BytesIO(image_bytes))

            original_size = image.size
            logger.debug(f"Original image size: {original_size}, mode: {image.mode}")

            # Step 1: Handle EXIF orientation
            image = self._normalize_exif_orientation(image)

            # Step 2: Convert to RGB if necessary (handles RGBA, P, etc.)
            if image.mode != "RGB":
                image = image.convert("RGB")

            # Step 3: Enforce dimension constraints
            image = self._enforce_dimensions(image)

            if image.size != original_size:
                logger.info(f"Image preprocessed: {original_size} -> {image.size}")

            return image

        except Exception as e:
            raise ValueError(f"Invalid or corrupted image: {e}")

    def _normalize_exif_orientation(self, image: Image.Image) -> Image.Image:
        """
        Normalize image orientation based on EXIF metadata.

        Many images from cameras/phones have EXIF orientation tags that
        indicate how the image should be rotated for proper display.
        This method applies that rotation so face detection works correctly.

        Args:
            image: PIL Image object

        Returns:
            Rotated PIL Image if EXIF orientation indicates rotation needed
        """
        try:
            # Get EXIF data
            exif = image.getexif()
            if not exif:
                return image

            # Find the orientation tag
            orientation_key = None
            for tag, name in ExifTags.TAGS.items():
                if name == "Orientation":
                    orientation_key = tag
                    break

            if orientation_key is None or orientation_key not in exif:
                return image

            orientation = exif[orientation_key]

            # Apply rotation based on orientation value
            # See: https://sirv.com/help/articles/rotate-photos-to-be-upright/
            rotation_map = {
                1: None,            # Normal (no rotation)
                2: Image.FLIP_LEFT_RIGHT,  # Mirrored horizontal
                3: Image.ROTATE_180,       # Rotated 180
                4: Image.FLIP_TOP_BOTTOM,  # Mirrored vertical
                5: (Image.FLIP_LEFT_RIGHT, Image.ROTATE_90),  # Mirrored horizontal + 90 CW
                6: Image.ROTATE_270,       # Rotated 90 CW (270 CCW)
                7: (Image.FLIP_LEFT_RIGHT, Image.ROTATE_270), # Mirrored horizontal + 90 CCW
                8: Image.ROTATE_90,        # Rotated 90 CCW
            }

            transform = rotation_map.get(orientation)
            if transform is None:
                return image

            if isinstance(transform, tuple):
                # Multiple transforms needed
                for t in transform:
                    image = image.transpose(t)
                logger.debug(f"Applied EXIF orientation {orientation} (multiple transforms)")
            else:
                image = image.transpose(transform)
                logger.debug(f"Applied EXIF orientation {orientation}")

            return image

        except Exception as e:
            logger.warning(f"Failed to process EXIF orientation: {e}")
            return image

    def _enforce_dimensions(self, image: Image.Image) -> Image.Image:
        """
        Enforce minimum and maximum dimension constraints.

        - If smallest dimension < MIN_IMAGE_DIMENSION: upscale
        - If largest dimension > MAX_IMAGE_DIMENSION: downscale
        - Maintains aspect ratio

        Args:
            image: PIL Image object

        Returns:
            Resized PIL Image if needed
        """
        width, height = image.size
        min_dim = min(width, height)
        max_dim = max(width, height)

        # Check if upscaling needed
        if min_dim < MIN_IMAGE_DIMENSION and min_dim > 0:
            scale_factor = MIN_IMAGE_DIMENSION / min_dim
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.debug(f"Upscaled image from {width}x{height} to {new_width}x{new_height}")

        # Check if downscaling needed
        elif max_dim > MAX_IMAGE_DIMENSION:
            scale_factor = MAX_IMAGE_DIMENSION / max_dim
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)

            # Don't downscale if it would violate min dimension
            if min(new_width, new_height) >= MIN_IMAGE_DIMENSION:
                image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                logger.debug(f"Downscaled image from {width}x{height} to {new_width}x{new_height}")
            else:
                logger.debug(f"Skipping downscale - would violate min dimension")

        return image

    def extract_embedding(
        self,
        image: Image.Image,
        enforce_detection: bool = True,
        align: bool = True
    ) -> Tuple[np.ndarray, dict]:
        """
        Extract face embedding from an image.

        Uses a multi-backend detection strategy for improved success rates:
        1. Try retinaface (best accuracy) first
        2. Fall back to mtcnn if retinaface fails
        3. Fall back to opencv if mtcnn fails

        Detection thresholds are relaxed via environment variables:
        - FACE_DETECTION_CONFIDENCE: minimum confidence (default 0.5, down from 0.8)
        - MIN_FACE_SIZE_PERCENT: minimum face size as % of image (default 5%)

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

        # Calculate minimum face size in pixels based on image dimensions
        width, height = image.size
        min_face_pixels = int(min(width, height) * MIN_FACE_SIZE_PERCENT)
        logger.debug(f"Image: {width}x{height}, min face size: {min_face_pixels}px")

        # Detector backends to try, in order of preference
        # retinaface is most accurate but can miss some faces
        # mtcnn is good balance of speed/accuracy
        # opencv is fastest but less accurate (good fallback)
        detector_backends = ["retinaface", "mtcnn", "opencv"]

        # Save image to temporary file (DeepFace requires file path)
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            try:
                image.save(tmp.name, format="JPEG", quality=95)

                result = None
                last_error = None
                used_backend = None

                for backend in detector_backends:
                    try:
                        logger.debug(f"Trying face detection with backend: {backend}")

                        # Extract embedding using DeepFace
                        result = self._deepface.represent(
                            img_path=tmp.name,
                            model_name=self.MODEL_NAME,
                            enforce_detection=enforce_detection,
                            align=align,
                            detector_backend=backend
                        )

                        # Check if we got valid results
                        if result and (not isinstance(result, list) or len(result) > 0):
                            used_backend = backend
                            logger.info(f"Face detected using {backend} backend")
                            break

                    except Exception as e:
                        last_error = e
                        error_msg = str(e).lower()

                        # If it's a "no face detected" error, try next backend
                        if "face" in error_msg and "detect" in error_msg:
                            logger.debug(f"No face detected with {backend}, trying next backend")
                            continue

                        # For other errors, log and try next backend
                        logger.warning(f"Backend {backend} failed: {e}")
                        continue

                # If no backend succeeded, raise the last error
                if result is None or (isinstance(result, list) and len(result) == 0):
                    if last_error:
                        raise last_error
                    raise ValueError("No faces detected in image (all backends failed)")

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

            # Filter faces by minimum confidence threshold
            confident_faces = [
                face for face in result
                if face.get("face_confidence", 0.99) >= FACE_DETECTION_CONFIDENCE
            ]

            if not confident_faces:
                logger.debug(
                    f"All {len(result)} detected faces below confidence threshold "
                    f"({FACE_DETECTION_CONFIDENCE})"
                )
                # Use all faces if none meet threshold (relaxed mode)
                confident_faces = result

            if len(confident_faces) > 1 and enforce_detection:
                raise ValueError(f"Multiple faces detected ({len(confident_faces)})")

            # Use the face with highest confidence
            face_data = max(confident_faces, key=lambda f: f.get("face_confidence", 0))
        else:
            face_data = result

        embedding = np.array(face_data["embedding"])

        # Extract metadata
        metadata = {
            "face_count": len(result) if isinstance(result, list) else 1,
            "face_confidence": face_data.get("face_confidence", 0.99),
            "facial_area": face_data.get("facial_area", {"x": 0, "y": 0, "w": 0, "h": 0}),
            "detector_backend": used_backend
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
