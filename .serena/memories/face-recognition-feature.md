# Face Recognition Feature Documentation

## Overview

The face recognition feature allows Vara to detect and match faces in protected images, enabling detection of unauthorized use of a user's likeness online.

## Architecture

### Components

1. **DeepFace Service** (`services/deepface-service/`)
   - Python FastAPI microservice
   - Uses DeepFace library with ArcFace model
   - Generates 512-dimensional face embeddings
   - Runs on port 8001

2. **Face Embedding Service** (`apps/api/src/services/ai/face-embedding.service.ts`)
   - TypeScript service that calls DeepFace API
   - Handles face detection, embedding generation, and verification
   - Integrates with image scan worker

3. **Database Schema** (Prisma)
   - `faceEmbedding`: vector(512) - Face embedding for similarity search
   - `faceDetected`: boolean - Whether a face was detected
   - `faceConfidence`: float - Detection confidence (0.0-1.0)
   - `faceMetadata`: JSON - Bounding box, landmarks, model info

### API Endpoints (DeepFace Service)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check with model status |
| `/api/v1/faces/represent` | POST | Generate face embedding from image |
| `/api/v1/faces/verify` | POST | Verify if two faces match |
| `/api/v1/faces/analyze` | POST | Analyze face attributes |

### Database Indexes

```sql
-- Composite index for filtering images with detected faces
CREATE INDEX "protected_images_userId_faceDetected_idx" 
ON "protected_images"("userId", "faceDetected");

-- HNSW index for face embedding similarity search (partial)
CREATE INDEX "protected_images_faceEmbedding_idx"
ON "protected_images"
USING hnsw ("faceEmbedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE "faceEmbedding" IS NOT NULL;
```

## Local Development

### Starting Services

```bash
# Start DeepFace service
docker-compose up deepface-service

# Or build fresh if Dockerfile changed
docker-compose up deepface-service --build

# Start API and web
pnpm dev
```

### Testing Face Detection

```bash
# Check health
curl http://localhost:8001/api/v1/health

# Generate embedding from image
curl -X POST http://localhost:8001/api/v1/faces/represent \
  -F "image=@path/to/image.jpg"

# Verify two faces match
curl -X POST http://localhost:8001/api/v1/faces/verify \
  -F "image1=@face1.jpg" \
  -F "image2=@face2.jpg"
```

## Production Deployment

### Render Configuration

- **Service**: `vara-deepface` (Docker Web Service)
- **Plan**: Standard (minimum 2GB RAM for ML models)
- **Health Check**: `/api/v1/health`
- **Environment Variables**:
  - `LOG_LEVEL`: INFO
  - `PORT`: 8001
  - `HOST`: 0.0.0.0
  - `PRELOAD_MODELS`: true (recommended)

### Memory Requirements

- Minimum: 2GB RAM
- Recommended: 4GB RAM (for model caching)
- First request may take 10-30s for model loading

## Troubleshooting

### Docker Build Errors

**Package `libgl1-mesa-glx` not found:**
- This package was renamed to `libgl1` in newer Debian versions
- Fixed in Dockerfile on 2026-01-14

### Slow First Request

- Model loading takes 10-30s on first request
- Use `PRELOAD_MODELS=true` in production to pre-download models during build

### Face Not Detected

The face detection pipeline has been optimized for better detection rates:

**Image Preprocessing (Node.js)**:
- EXIF orientation is automatically normalized before detection
- Images are upscaled if smallest dimension < 480px
- Images are downscaled if largest dimension > 2048px
- See `apps/api/src/utils/image-preprocessing.ts`

**Detection Thresholds (Python DeepFace)**:
- Confidence threshold lowered from 0.8 to 0.5 for relaxed detection
- Multi-backend fallback: retinaface -> mtcnn -> opencv
- Minimum face size: 5% of image dimension (down from 10%)

**Environment Variables** (set in .env or Render):
| Variable | Default | Description |
|----------|---------|-------------|
| `FACE_MIN_IMAGE_DIMENSION` | 480 | Upscale images smaller than this |
| `FACE_MAX_IMAGE_DIMENSION` | 2048 | Downscale images larger than this |
| `FACE_NORMALIZE_EXIF` | true | Auto-rotate based on EXIF |
| `FACE_MIN_CONFIDENCE` | 0.5 | Detection confidence threshold |
| `FACE_MIN_SIZE_PERCENT` | 0.05 | Min face size as % of image |

**Common causes of detection failure**:
- Image may be blurry or low resolution
- Face may be obscured, at extreme angle, or partially cropped
- Lighting conditions may be poor
- For profile shots, try `mtcnn` or `opencv` backends directly

### Connection Refused from API

- Verify `DEEPFACE_SERVICE_URL` is set correctly on backend
- Check DeepFace service is running: `curl http://localhost:8001/api/v1/health`

## Integration with Image Scanning

Face detection is automatically triggered during image scans:

1. User uploads image to Protected Images
2. User triggers scan (single image or "Scan All")
3. Image scan worker calls `FaceEmbeddingService.processImage()`
4. If face detected:
   - Embedding stored in `faceEmbedding` column
   - `faceDetected` set to `true`
   - `faceConfidence` and `faceMetadata` populated
5. Future: Face similarity search for finding matches online

## Files

- `services/deepface-service/` - Python microservice
- `apps/api/src/services/ai/face-embedding.service.ts` - API integration
- `apps/api/src/workers/image-scan.worker.ts` - Scan worker integration
- `apps/api/prisma/schema.prisma` - Database schema with face fields
