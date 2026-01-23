"""
Perceptual image hashing service.

Uses imagehash library to compute perceptual hashes (pHash, dHash, wHash)
for image duplicate detection and similarity comparison.
"""

import io
import logging
from typing import Dict

from PIL import Image
import imagehash

# Configure logging
logger = logging.getLogger(__name__)


class ImageHashService:
    """
    Service for computing perceptual image hashes.

    Supports multiple hash algorithms:
    - pHash (perceptual hash): Best for general similarity detection
    - dHash (difference hash): Fast, good for exact duplicates
    - wHash (wavelet hash): Good for minor modifications

    Unlike CLIP, this service doesn't require model loading,
    so all methods are synchronous and fast.
    """

    # Default hash size (64 bits = 8x8)
    DEFAULT_HASH_SIZE = 8

    def compute_phash(self, image: Image.Image, hash_size: int = None) -> str:
        """
        Compute perceptual hash (pHash) for an image.

        pHash uses DCT (Discrete Cosine Transform) to capture
        the fundamental structure of the image. Best for general
        similarity detection.

        Args:
            image: PIL Image object
            hash_size: Size of hash (default 8 = 64 bits)

        Returns:
            Hexadecimal hash string
        """
        hash_size = hash_size or self.DEFAULT_HASH_SIZE

        try:
            # Ensure image is in RGB mode
            if image.mode != "RGB":
                image = image.convert("RGB")

            hash_value = imagehash.phash(image, hash_size=hash_size)
            return str(hash_value)

        except Exception as e:
            logger.error(f"Failed to compute pHash: {e}")
            raise ValueError(f"pHash computation failed: {e}")

    def compute_dhash(self, image: Image.Image, hash_size: int = None) -> str:
        """
        Compute difference hash (dHash) for an image.

        dHash computes the difference between adjacent pixels.
        Very fast and good for exact duplicate detection.

        Args:
            image: PIL Image object
            hash_size: Size of hash (default 8 = 64 bits)

        Returns:
            Hexadecimal hash string
        """
        hash_size = hash_size or self.DEFAULT_HASH_SIZE

        try:
            if image.mode != "RGB":
                image = image.convert("RGB")

            hash_value = imagehash.dhash(image, hash_size=hash_size)
            return str(hash_value)

        except Exception as e:
            logger.error(f"Failed to compute dHash: {e}")
            raise ValueError(f"dHash computation failed: {e}")

    def compute_whash(self, image: Image.Image, hash_size: int = None) -> str:
        """
        Compute wavelet hash (wHash) for an image.

        wHash uses Discrete Wavelet Transform (Haar wavelet)
        to capture image structure. Good for detecting minor
        modifications while remaining resistant to rescaling.

        Args:
            image: PIL Image object
            hash_size: Size of hash (default 8 = 64 bits)

        Returns:
            Hexadecimal hash string
        """
        hash_size = hash_size or self.DEFAULT_HASH_SIZE

        try:
            if image.mode != "RGB":
                image = image.convert("RGB")

            hash_value = imagehash.whash(image, hash_size=hash_size)
            return str(hash_value)

        except Exception as e:
            logger.error(f"Failed to compute wHash: {e}")
            raise ValueError(f"wHash computation failed: {e}")

    def compute_ahash(self, image: Image.Image, hash_size: int = None) -> str:
        """
        Compute average hash (aHash) for an image.

        aHash reduces the image to a hash_size x hash_size grayscale image
        and compares each pixel to the average. Fastest but less accurate.

        Args:
            image: PIL Image object
            hash_size: Size of hash (default 8 = 64 bits)

        Returns:
            Hexadecimal hash string
        """
        hash_size = hash_size or self.DEFAULT_HASH_SIZE

        try:
            if image.mode != "RGB":
                image = image.convert("RGB")

            hash_value = imagehash.average_hash(image, hash_size=hash_size)
            return str(hash_value)

        except Exception as e:
            logger.error(f"Failed to compute aHash: {e}")
            raise ValueError(f"aHash computation failed: {e}")

    def compute_all_hashes(self, image: Image.Image) -> Dict[str, str]:
        """
        Compute all supported hashes for an image.

        Args:
            image: PIL Image object

        Returns:
            Dictionary with hash type as key and hex hash as value
        """
        return {
            "phash": self.compute_phash(image),
            "dhash": self.compute_dhash(image),
            "whash": self.compute_whash(image),
            "ahash": self.compute_ahash(image)
        }

    @staticmethod
    def hamming_distance(hash1: str, hash2: str) -> int:
        """
        Compute Hamming distance between two hash strings.

        Lower distance means more similar images.
        - 0: Identical images
        - 1-10: Very similar (possibly same image with minor edits)
        - 10-20: Somewhat similar
        - 20+: Different images

        Args:
            hash1: First hexadecimal hash string
            hash2: Second hexadecimal hash string

        Returns:
            Hamming distance (number of differing bits)
        """
        try:
            h1 = imagehash.hex_to_hash(hash1)
            h2 = imagehash.hex_to_hash(hash2)
            return h1 - h2  # imagehash overloads - for Hamming distance

        except Exception as e:
            logger.error(f"Failed to compute Hamming distance: {e}")
            raise ValueError(f"Hamming distance computation failed: {e}")

    @staticmethod
    def hash_similarity(hash1: str, hash2: str) -> float:
        """
        Compute similarity between two hashes (0-1 scale).

        Args:
            hash1: First hexadecimal hash string
            hash2: Second hexadecimal hash string

        Returns:
            Similarity score (0-1, higher is more similar)
        """
        try:
            h1 = imagehash.hex_to_hash(hash1)
            h2 = imagehash.hex_to_hash(hash2)

            distance = h1 - h2
            # Hash is hash_size^2 bits, default 64 bits
            max_distance = len(h1.hash.flatten())

            similarity = 1 - (distance / max_distance)
            return max(0.0, min(1.0, similarity))

        except Exception as e:
            logger.error(f"Failed to compute hash similarity: {e}")
            raise ValueError(f"Hash similarity computation failed: {e}")


# Global service instance (singleton)
_hash_service_instance = None


def get_hash_service() -> ImageHashService:
    """
    Get the global ImageHash service instance.

    Returns:
        ImageHashService singleton instance
    """
    global _hash_service_instance

    if _hash_service_instance is None:
        _hash_service_instance = ImageHashService()

    return _hash_service_instance
