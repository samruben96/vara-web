"""
DeepFace Face Recognition Microservice

A FastAPI-based microservice for face embedding extraction and comparison
using the DeepFace library with ArcFace backend.
"""

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.schemas import (
    CompareFacesRequest,
    CompareFacesResponse,
    DistanceMetric,
    ErrorCode,
    ErrorDetail,
    ErrorResponse,
    ExtractEmbeddingRequest,
    ExtractEmbeddingResponse,
    FacialArea,
    HealthResponse,
    ImageType,
    # CLIP schemas
    CLIPEmbedRequest,
    CLIPEmbedResponse,
    CLIPCompareRequest,
    CLIPCompareResponse,
    # Hash schemas
    HashComputeRequest,
    HashComputeResponse,
)
from app.services.embedding import DeepFaceService, get_deepface_service
from app.services.clip_embedding import CLIPService, get_clip_service
from app.services.image_hash import ImageHashService, get_hash_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Application Lifespan
# -----------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.

    Note: We do NOT preload the model here to avoid slow startup.
    Model is lazy-loaded on first request instead.
    """
    logger.info("DeepFace service starting up...")
    logger.info("Model will be lazy-loaded on first embedding request")

    yield

    logger.info("DeepFace service shutting down...")


# -----------------------------------------------------------------------------
# FastAPI Application
# -----------------------------------------------------------------------------

app = FastAPI(
    title="DeepFace Face Recognition Service",
    description="Face embedding extraction and comparison using ArcFace model",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Exception Handlers
# -----------------------------------------------------------------------------

def create_error_response(
    code: ErrorCode,
    message: str,
    details: dict = None,
    status_code: int = status.HTTP_400_BAD_REQUEST
) -> JSONResponse:
    """Create a standardized error response."""
    error_response = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=message,
            details=details
        )
    )
    return JSONResponse(
        status_code=status_code,
        content=error_response.model_dump()
    )


# -----------------------------------------------------------------------------
# API Routes
# -----------------------------------------------------------------------------

@app.get(
    "/api/v1/health",
    summary="Health Check",
    description="Check service health and model status"
)
async def health_check():
    """
    Health check endpoint.

    Returns service status and whether models are loaded.
    """
    deepface_service = get_deepface_service()
    clip_service = get_clip_service()

    return {
        "status": "healthy",
        "version": "1.1.0",
        "models": {
            "deepface": {
                "name": DeepFaceService.MODEL_NAME,
                "embedding_dimensions": DeepFaceService.EMBEDDING_DIMENSIONS,
                "loaded": deepface_service.is_model_loaded
            },
            "clip": {
                "name": CLIPService.MODEL_NAME,
                "embedding_dimensions": CLIPService.EMBEDDING_DIMENSIONS,
                "loaded": clip_service.is_model_loaded
            }
        },
        # Keep legacy fields for backwards compatibility
        "model": DeepFaceService.MODEL_NAME,
        "embedding_dimensions": DeepFaceService.EMBEDDING_DIMENSIONS,
        "model_loaded": deepface_service.is_model_loaded
    }


@app.post(
    "/api/v1/extract-embedding",
    response_model=ExtractEmbeddingResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input or no face detected"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Extract Face Embedding",
    description="Extract a 512-dimensional face embedding from an image"
)
async def extract_embedding(request: ExtractEmbeddingRequest):
    """
    Extract face embedding from an image.

    Accepts either base64-encoded image data or a URL to download.
    Returns a 512-dimensional embedding vector suitable for face comparison.

    The model is lazy-loaded on first request (may take 10-30 seconds).
    """
    start_time = time.time()
    service = get_deepface_service()

    try:
        # Get image bytes based on input type
        if request.image_type == ImageType.URL:
            try:
                image_bytes = await service.download_image(request.image)
            except ValueError as e:
                return create_error_response(
                    code=ErrorCode.DOWNLOAD_FAILED,
                    message=str(e),
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        else:
            try:
                image_bytes = service.decode_base64_image(request.image)
            except ValueError as e:
                return create_error_response(
                    code=ErrorCode.INVALID_IMAGE,
                    message=str(e),
                    status_code=status.HTTP_400_BAD_REQUEST
                )

        # Validate and open image
        try:
            image = service.validate_image(image_bytes)
        except ValueError as e:
            return create_error_response(
                code=ErrorCode.INVALID_IMAGE,
                message=str(e),
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Extract embedding
        try:
            embedding, metadata = service.extract_embedding(
                image=image,
                enforce_detection=request.enforce_detection,
                align=request.align
            )
        except ValueError as e:
            error_message = str(e).lower()

            if "no face" in error_message or "could not find" in error_message:
                return create_error_response(
                    code=ErrorCode.NO_FACE_DETECTED,
                    message="No face detected in the image",
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            elif "multiple" in error_message:
                return create_error_response(
                    code=ErrorCode.MULTIPLE_FACES_DETECTED,
                    message=str(e),
                    details={"face_count": metadata.get("face_count", 0) if "metadata" in dir() else None},
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            else:
                return create_error_response(
                    code=ErrorCode.MODEL_ERROR,
                    message=str(e),
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        processing_time_ms = (time.time() - start_time) * 1000

        # Build response
        facial_area_data = metadata.get("facial_area", {})
        facial_area = FacialArea(
            x=facial_area_data.get("x", 0),
            y=facial_area_data.get("y", 0),
            w=facial_area_data.get("w", 0),
            h=facial_area_data.get("h", 0)
        )

        return ExtractEmbeddingResponse(
            embedding=embedding.tolist(),
            face_count=metadata.get("face_count", 1),
            face_confidence=metadata.get("face_confidence", 0.99),
            facial_area=facial_area,
            processing_time_ms=round(processing_time_ms, 2)
        )

    except Exception as e:
        logger.exception(f"Unexpected error in extract_embedding: {e}")
        return create_error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Internal error: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@app.post(
    "/api/v1/compare-faces",
    response_model=CompareFacesResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Compare Face Embeddings",
    description="Compare two face embeddings to determine if they are the same person"
)
async def compare_faces(request: CompareFacesRequest) -> CompareFacesResponse:
    """
    Compare two face embeddings.

    Takes two 512-dimensional embedding vectors and returns whether they
    represent the same person, along with distance and similarity metrics.
    """
    service = get_deepface_service()

    try:
        result = service.compare_embeddings(
            embedding1=request.embedding1,
            embedding2=request.embedding2,
            distance_metric=request.distance_metric.value,
            threshold=request.threshold
        )

        return CompareFacesResponse(
            is_same_person=result["is_same_person"],
            distance=result["distance"],
            similarity=result["similarity"],
            confidence=result["confidence"],
            threshold_used=result["threshold_used"],
            distance_metric=DistanceMetric(result["distance_metric"])
        )

    except ValueError as e:
        return create_error_response(
            code=ErrorCode.INVALID_EMBEDDING,
            message=str(e),
            status_code=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.exception(f"Unexpected error in compare_faces: {e}")
        return create_error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Internal error: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# -----------------------------------------------------------------------------
# Additional Utility Endpoints
# -----------------------------------------------------------------------------

@app.post(
    "/api/v1/warm-up",
    summary="Warm Up Models",
    description="Explicitly load all models into memory (useful after deployment)"
)
async def warm_up_models():
    """
    Explicitly trigger model loading for all models.

    Useful to call after deployment to ensure all models are loaded
    before receiving real traffic.
    """
    results = {}
    
    # Warm up DeepFace model
    deepface_service = get_deepface_service()
    if deepface_service.is_model_loaded:
        results["deepface"] = {"status": "already_loaded", "model": DeepFaceService.MODEL_NAME}
    else:
        start_time = time.time()
        try:
            deepface_service._ensure_model_loaded()
            elapsed = time.time() - start_time
            results["deepface"] = {
                "status": "loaded",
                "model": DeepFaceService.MODEL_NAME,
                "load_time_seconds": round(elapsed, 2)
            }
        except Exception as e:
            logger.exception(f"Failed to warm up DeepFace model: {e}")
            results["deepface"] = {"status": "failed", "error": str(e)}

    # Warm up CLIP model
    clip_service = get_clip_service()
    if clip_service.is_model_loaded:
        results["clip"] = {"status": "already_loaded", "model": CLIPService.MODEL_NAME}
    else:
        start_time = time.time()
        try:
            clip_service._ensure_model_loaded()
            elapsed = time.time() - start_time
            results["clip"] = {
                "status": "loaded",
                "model": CLIPService.MODEL_NAME,
                "load_time_seconds": round(elapsed, 2)
            }
        except Exception as e:
            logger.exception(f"Failed to warm up CLIP model: {e}")
            results["clip"] = {"status": "failed", "error": str(e)}

    return results


@app.get(
    "/api/v1/model-info",
    summary="Model Information",
    description="Get detailed information about all available models"
)
async def get_model_info():
    """Get information about all available models."""
    deepface_service = get_deepface_service()
    clip_service = get_clip_service()
    
    return {
        "deepface": {
            "model_name": DeepFaceService.MODEL_NAME,
            "embedding_dimensions": DeepFaceService.EMBEDDING_DIMENSIONS,
            "supported_distance_metrics": [m.value for m in DistanceMetric],
            "default_thresholds": DeepFaceService.DEFAULT_THRESHOLDS,
            "detector_backend": "retinaface",
            "loaded": deepface_service.is_model_loaded,
            "notes": "Best accuracy for face recognition, 512-dim embeddings"
        },
        "clip": {
            "model_name": CLIPService.MODEL_NAME,
            "embedding_dimensions": CLIPService.EMBEDDING_DIMENSIONS,
            "loaded": clip_service.is_model_loaded,
            "notes": "General-purpose image embeddings, good for visual similarity"
        },
        "hash": {
            "algorithms": ["phash", "dhash", "whash", "ahash"],
            "hash_size": 8,
            "notes": "Perceptual hashing for exact/near-duplicate detection"
        }
    }


# -----------------------------------------------------------------------------
# CLIP Endpoints
# -----------------------------------------------------------------------------

@app.post(
    "/api/v1/clip/embed",
    response_model=CLIPEmbedResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Generate CLIP Embedding",
    description="Generate a 512-dimensional CLIP embedding from an image",
    tags=["CLIP"]
)
async def clip_embed(request: CLIPEmbedRequest):
    """
    Generate CLIP embedding from an image.

    Accepts either base64-encoded image data or a URL to download.
    Returns a 512-dimensional embedding vector suitable for similarity search.

    The model is lazy-loaded on first request (may take 10-20 seconds).
    """
    start_time = time.time()
    clip_service = get_clip_service()
    deepface_service = get_deepface_service()  # For image download/decode utilities

    try:
        # Get image bytes based on input type
        if request.image_url:
            try:
                image_bytes = await deepface_service.download_image(request.image_url)
            except ValueError as e:
                return create_error_response(
                    code=ErrorCode.DOWNLOAD_FAILED,
                    message=str(e),
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        else:
            try:
                image_bytes = deepface_service.decode_base64_image(request.image_base64)
            except ValueError as e:
                return create_error_response(
                    code=ErrorCode.INVALID_IMAGE,
                    message=str(e),
                    status_code=status.HTTP_400_BAD_REQUEST
                )

        # Validate and open image
        try:
            image = deepface_service.validate_image(image_bytes)
        except ValueError as e:
            return create_error_response(
                code=ErrorCode.INVALID_IMAGE,
                message=str(e),
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Extract CLIP embedding
        try:
            embedding = clip_service.extract_embedding(image)
        except ValueError as e:
            return create_error_response(
                code=ErrorCode.CLIP_ERROR,
                message=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        processing_time_ms = (time.time() - start_time) * 1000

        return CLIPEmbedResponse(
            embedding=embedding.tolist(),
            success=True,
            processing_time_ms=round(processing_time_ms, 2)
        )

    except Exception as e:
        logger.exception(f"Unexpected error in clip_embed: {e}")
        return create_error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Internal error: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@app.post(
    "/api/v1/clip/compare",
    response_model=CLIPCompareResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Compare Images with CLIP",
    description="Compare two images using CLIP embeddings and cosine similarity",
    tags=["CLIP"]
)
async def clip_compare(request: CLIPCompareRequest):
    """
    Compare two images using CLIP embeddings.

    Downloads both images, generates CLIP embeddings, and computes
    cosine similarity between them.

    Returns similarity score from 0-1 (higher means more similar).
    """
    start_time = time.time()
    clip_service = get_clip_service()
    deepface_service = get_deepface_service()

    try:
        # Download and process first image
        try:
            image1_bytes = await deepface_service.download_image(request.image1_url)
            image1 = deepface_service.validate_image(image1_bytes)
        except ValueError as e:
            return create_error_response(
                code=ErrorCode.DOWNLOAD_FAILED,
                message=f"Failed to load image1: {str(e)}",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Download and process second image
        try:
            image2_bytes = await deepface_service.download_image(request.image2_url)
            image2 = deepface_service.validate_image(image2_bytes)
        except ValueError as e:
            return create_error_response(
                code=ErrorCode.DOWNLOAD_FAILED,
                message=f"Failed to load image2: {str(e)}",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Extract embeddings and compute similarity
        try:
            embedding1 = clip_service.extract_embedding(image1)
            embedding2 = clip_service.extract_embedding(image2)
            similarity = clip_service.compute_similarity(embedding1, embedding2)
        except ValueError as e:
            return create_error_response(
                code=ErrorCode.CLIP_ERROR,
                message=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        processing_time_ms = (time.time() - start_time) * 1000

        return CLIPCompareResponse(
            similarity=round(similarity, 6),
            success=True,
            processing_time_ms=round(processing_time_ms, 2)
        )

    except Exception as e:
        logger.exception(f"Unexpected error in clip_compare: {e}")
        return create_error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Internal error: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# -----------------------------------------------------------------------------
# Perceptual Hash Endpoints
# -----------------------------------------------------------------------------

@app.post(
    "/api/v1/hash/compute",
    response_model=HashComputeResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Compute Perceptual Hashes",
    description="Compute multiple perceptual hashes (pHash, dHash, wHash, aHash) for an image",
    tags=["Hash"]
)
async def hash_compute(request: HashComputeRequest):
    """
    Compute perceptual hashes for an image.

    Accepts either base64-encoded image data or a URL to download.
    Returns multiple hash types for different use cases:
    - pHash: Best for general similarity detection
    - dHash: Fast, good for exact duplicate detection
    - wHash: Good for detecting minor modifications
    - aHash: Fastest but less accurate
    """
    start_time = time.time()
    hash_service = get_hash_service()
    deepface_service = get_deepface_service()

    try:
        # Get image bytes based on input type
        if request.image_url:
            try:
                image_bytes = await deepface_service.download_image(request.image_url)
            except ValueError as e:
                return create_error_response(
                    code=ErrorCode.DOWNLOAD_FAILED,
                    message=str(e),
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        else:
            try:
                image_bytes = deepface_service.decode_base64_image(request.image_base64)
            except ValueError as e:
                return create_error_response(
                    code=ErrorCode.INVALID_IMAGE,
                    message=str(e),
                    status_code=status.HTTP_400_BAD_REQUEST
                )

        # Validate and open image
        try:
            image = deepface_service.validate_image(image_bytes)
        except ValueError as e:
            return create_error_response(
                code=ErrorCode.INVALID_IMAGE,
                message=str(e),
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Compute all hashes
        try:
            hashes = hash_service.compute_all_hashes(image)
        except ValueError as e:
            return create_error_response(
                code=ErrorCode.HASH_ERROR,
                message=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        processing_time_ms = (time.time() - start_time) * 1000

        return HashComputeResponse(
            phash=hashes["phash"],
            dhash=hashes["dhash"],
            whash=hashes["whash"],
            ahash=hashes["ahash"],
            success=True,
            processing_time_ms=round(processing_time_ms, 2)
        )

    except Exception as e:
        logger.exception(f"Unexpected error in hash_compute: {e}")
        return create_error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Internal error: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# -----------------------------------------------------------------------------
# Main Entry Point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8001))
    host = os.getenv("HOST", "0.0.0.0")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=os.getenv("RELOAD", "false").lower() == "true",
        log_level="info"
    )
