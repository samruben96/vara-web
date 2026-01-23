"""
Pydantic schemas for the DeepFace API.

Defines request/response models with validation for face recognition endpoints.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class ImageType(str, Enum):
    """Supported image input types."""
    BASE64 = "base64"
    URL = "url"


class DistanceMetric(str, Enum):
    """Supported distance metrics for face comparison."""
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    EUCLIDEAN_L2 = "euclidean_l2"


class ErrorCode(str, Enum):
    """Standard error codes for the API."""
    NO_FACE_DETECTED = "NO_FACE_DETECTED"
    MULTIPLE_FACES_DETECTED = "MULTIPLE_FACES_DETECTED"
    INVALID_IMAGE = "INVALID_IMAGE"
    MODEL_ERROR = "MODEL_ERROR"
    INVALID_EMBEDDING = "INVALID_EMBEDDING"
    DOWNLOAD_FAILED = "DOWNLOAD_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    CLIP_ERROR = "CLIP_ERROR"
    HASH_ERROR = "HASH_ERROR"


# -----------------------------------------------------------------------------
# Request Schemas
# -----------------------------------------------------------------------------

class ExtractEmbeddingRequest(BaseModel):
    """Request schema for extracting face embeddings from an image."""

    image: str = Field(
        ...,
        description="Image data as base64 string or URL",
        min_length=1
    )
    image_type: ImageType = Field(
        default=ImageType.BASE64,
        description="Type of image input: 'base64' or 'url'"
    )
    enforce_detection: bool = Field(
        default=True,
        description="Raise error if no face is detected. Set False to get embedding anyway."
    )
    align: bool = Field(
        default=True,
        description="Align face before extracting embedding for better accuracy"
    )

    @field_validator("image")
    @classmethod
    def validate_image(cls, v: str) -> str:
        """Ensure image string is not empty or whitespace."""
        if not v or not v.strip():
            raise ValueError("Image cannot be empty")
        return v.strip()


class CompareFacesRequest(BaseModel):
    """Request schema for comparing two face embeddings."""

    embedding1: list[float] = Field(
        ...,
        description="First face embedding vector (512 dimensions for ArcFace)"
    )
    embedding2: list[float] = Field(
        ...,
        description="Second face embedding vector (512 dimensions for ArcFace)"
    )
    threshold: Optional[float] = Field(
        default=None,
        description="Custom threshold for same-person determination. Uses model default if not provided.",
        ge=0.0,
        le=2.0
    )
    distance_metric: DistanceMetric = Field(
        default=DistanceMetric.COSINE,
        description="Distance metric for comparison"
    )

    @field_validator("embedding1", "embedding2")
    @classmethod
    def validate_embedding_dimensions(cls, v: list[float]) -> list[float]:
        """Validate embedding has correct dimensions for ArcFace (512)."""
        if len(v) != 512:
            raise ValueError(f"Embedding must have 512 dimensions, got {len(v)}")
        return v


# -----------------------------------------------------------------------------
# CLIP Request Schemas
# -----------------------------------------------------------------------------

class CLIPEmbedRequest(BaseModel):
    """Request schema for extracting CLIP embeddings from an image."""

    image_url: Optional[str] = Field(
        default=None,
        description="URL of the image to embed"
    )
    image_base64: Optional[str] = Field(
        default=None,
        description="Base64-encoded image data"
    )

    @field_validator("image_url", "image_base64", mode="before")
    @classmethod
    def validate_not_empty(cls, v):
        """Ensure strings are not empty or whitespace."""
        if v is not None and isinstance(v, str):
            v = v.strip()
            if not v:
                return None
        return v

    def model_post_init(self, __context):
        """Validate that at least one image source is provided."""
        if not self.image_url and not self.image_base64:
            raise ValueError("Either image_url or image_base64 must be provided")


class CLIPCompareRequest(BaseModel):
    """Request schema for comparing two images using CLIP embeddings."""

    image1_url: str = Field(
        ...,
        description="URL of the first image",
        min_length=1
    )
    image2_url: str = Field(
        ...,
        description="URL of the second image",
        min_length=1
    )

    @field_validator("image1_url", "image2_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Ensure URL is not empty or whitespace."""
        if not v or not v.strip():
            raise ValueError("URL cannot be empty")
        return v.strip()


# -----------------------------------------------------------------------------
# Hash Request Schemas
# -----------------------------------------------------------------------------

class HashComputeRequest(BaseModel):
    """Request schema for computing perceptual hashes from an image."""

    image_url: Optional[str] = Field(
        default=None,
        description="URL of the image to hash"
    )
    image_base64: Optional[str] = Field(
        default=None,
        description="Base64-encoded image data"
    )

    @field_validator("image_url", "image_base64", mode="before")
    @classmethod
    def validate_not_empty(cls, v):
        """Ensure strings are not empty or whitespace."""
        if v is not None and isinstance(v, str):
            v = v.strip()
            if not v:
                return None
        return v

    def model_post_init(self, __context):
        """Validate that at least one image source is provided."""
        if not self.image_url and not self.image_base64:
            raise ValueError("Either image_url or image_base64 must be provided")


# -----------------------------------------------------------------------------
# Response Schemas
# -----------------------------------------------------------------------------

class FacialArea(BaseModel):
    """Bounding box coordinates for detected face."""
    x: int = Field(..., description="X coordinate of top-left corner")
    y: int = Field(..., description="Y coordinate of top-left corner")
    w: int = Field(..., description="Width of bounding box")
    h: int = Field(..., description="Height of bounding box")


class ExtractEmbeddingResponse(BaseModel):
    """Response schema for successful embedding extraction."""

    embedding: list[float] = Field(
        ...,
        description="512-dimensional face embedding vector"
    )
    face_count: int = Field(
        ...,
        description="Number of faces detected in the image",
        ge=0
    )
    face_confidence: float = Field(
        ...,
        description="Confidence score for face detection (0-1)",
        ge=0.0,
        le=1.0
    )
    facial_area: FacialArea = Field(
        ...,
        description="Bounding box of the detected face"
    )
    processing_time_ms: float = Field(
        ...,
        description="Time taken to process the image in milliseconds",
        ge=0
    )


class CompareFacesResponse(BaseModel):
    """Response schema for face comparison."""

    is_same_person: bool = Field(
        ...,
        description="Whether the two embeddings are determined to be the same person"
    )
    distance: float = Field(
        ...,
        description="Distance between the two embeddings",
        ge=0
    )
    similarity: float = Field(
        ...,
        description="Similarity score (0-1, higher is more similar)",
        ge=0.0,
        le=1.0
    )
    confidence: float = Field(
        ...,
        description="Confidence in the comparison result (0-1)",
        ge=0.0,
        le=1.0
    )
    threshold_used: float = Field(
        ...,
        description="Threshold used for same-person determination"
    )
    distance_metric: DistanceMetric = Field(
        ...,
        description="Distance metric used for comparison"
    )


class HealthResponse(BaseModel):
    """Response schema for health check endpoint."""

    status: str = Field(
        default="healthy",
        description="Service health status"
    )
    model: str = Field(
        default="ArcFace",
        description="Face recognition model in use"
    )
    embedding_dimensions: int = Field(
        default=512,
        description="Dimensions of embedding vectors"
    )
    model_loaded: bool = Field(
        ...,
        description="Whether the model is currently loaded in memory"
    )
    version: str = Field(
        default="1.0.0",
        description="Service version"
    )


class ErrorDetail(BaseModel):
    """Error detail for API error responses."""

    code: ErrorCode = Field(
        ...,
        description="Machine-readable error code"
    )
    message: str = Field(
        ...,
        description="Human-readable error message"
    )
    details: Optional[dict] = Field(
        default=None,
        description="Additional error context"
    )


class ErrorResponse(BaseModel):
    """Standard error response format."""

    error: ErrorDetail = Field(
        ...,
        description="Error information"
    )


# -----------------------------------------------------------------------------
# CLIP Response Schemas
# -----------------------------------------------------------------------------

class CLIPEmbedResponse(BaseModel):
    """Response schema for CLIP embedding extraction."""

    embedding: list[float] = Field(
        ...,
        description="512-dimensional CLIP embedding vector"
    )
    success: bool = Field(
        default=True,
        description="Whether the operation was successful"
    )
    processing_time_ms: float = Field(
        ...,
        description="Time taken to process the image in milliseconds",
        ge=0
    )


class CLIPCompareResponse(BaseModel):
    """Response schema for CLIP image comparison."""

    similarity: float = Field(
        ...,
        description="Cosine similarity between images (0-1, higher is more similar)",
        ge=0.0,
        le=1.0
    )
    success: bool = Field(
        default=True,
        description="Whether the operation was successful"
    )
    processing_time_ms: float = Field(
        ...,
        description="Time taken to process both images in milliseconds",
        ge=0
    )


# -----------------------------------------------------------------------------
# Hash Response Schemas
# -----------------------------------------------------------------------------

class HashComputeResponse(BaseModel):
    """Response schema for perceptual hash computation."""

    phash: str = Field(
        ...,
        description="Perceptual hash (DCT-based, best for general similarity)"
    )
    dhash: str = Field(
        ...,
        description="Difference hash (fast, good for exact duplicates)"
    )
    whash: str = Field(
        ...,
        description="Wavelet hash (good for minor modifications)"
    )
    ahash: str = Field(
        ...,
        description="Average hash (fastest but less accurate)"
    )
    success: bool = Field(
        default=True,
        description="Whether the operation was successful"
    )
    processing_time_ms: float = Field(
        ...,
        description="Time taken to compute hashes in milliseconds",
        ge=0
    )
