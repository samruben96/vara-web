# DeepFace Face Recognition Service

A FastAPI microservice for face embedding extraction and comparison using DeepFace with the ArcFace model.

## Overview

This service provides face recognition capabilities for the Vara platform:

- **Face Embedding Extraction**: Generate 512-dimensional embeddings from images
- **Face Comparison**: Compare embeddings to determine if two faces belong to the same person
- **High Accuracy**: Uses ArcFace model (state-of-the-art accuracy) with RetinaFace detector

## Quick Start

### Prerequisites

- Python 3.10+
- pip or pipenv

### Installation

```bash
cd services/deepface-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Service

```bash
# Development
python -m app.main

# Or with uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

The service will be available at `http://localhost:8001`.

### API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

## API Endpoints

### Health Check

```bash
GET /api/v1/health
```

Returns service health status and whether the model is loaded.

**Response:**
```json
{
  "status": "healthy",
  "model": "ArcFace",
  "embedding_dimensions": 512,
  "model_loaded": true,
  "version": "1.0.0"
}
```

### Extract Embedding

```bash
POST /api/v1/extract-embedding
```

Extract a 512-dimensional face embedding from an image.

**Request (Base64):**
```json
{
  "image": "<base64-encoded-image>",
  "image_type": "base64",
  "enforce_detection": true,
  "align": true
}
```

**Request (URL):**
```json
{
  "image": "https://example.com/face.jpg",
  "image_type": "url",
  "enforce_detection": true,
  "align": true
}
```

**Response:**
```json
{
  "embedding": [0.123, -0.456, ...],  // 512 floats
  "face_count": 1,
  "face_confidence": 0.99,
  "facial_area": {
    "x": 100,
    "y": 50,
    "w": 200,
    "h": 250
  },
  "processing_time_ms": 245.5
}
```

**Error Codes:**
- `NO_FACE_DETECTED`: No face found in the image
- `MULTIPLE_FACES_DETECTED`: More than one face detected (when enforce_detection=true)
- `INVALID_IMAGE`: Image is corrupted or invalid format
- `DOWNLOAD_FAILED`: Failed to download image from URL

### Compare Faces

```bash
POST /api/v1/compare-faces
```

Compare two face embeddings to determine if they represent the same person.

**Request:**
```json
{
  "embedding1": [0.123, -0.456, ...],
  "embedding2": [0.234, -0.567, ...],
  "threshold": 0.68,
  "distance_metric": "cosine"
}
```

**Response:**
```json
{
  "is_same_person": true,
  "distance": 0.35,
  "similarity": 0.65,
  "confidence": 0.49,
  "threshold_used": 0.68,
  "distance_metric": "cosine"
}
```

**Distance Metrics:**
- `cosine` (default): Best for normalized embeddings
- `euclidean`: Absolute distance
- `euclidean_l2`: L2-normalized euclidean

### Warm Up Model

```bash
POST /api/v1/warm-up
```

Explicitly load the model into memory. Useful after deployment.

**Response:**
```json
{
  "status": "loaded",
  "model": "ArcFace",
  "load_time_seconds": 15.2
}
```

### Model Information

```bash
GET /api/v1/model-info
```

Get detailed information about the face recognition model.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8001 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `CORS_ORIGINS` | * | Allowed CORS origins (comma-separated) |
| `RELOAD` | false | Enable hot reload (development) |

## Model Details

### ArcFace

- **Embedding Dimensions**: 512
- **Architecture**: ResNet-based with additive angular margin loss
- **Accuracy**: State-of-the-art on LFW (99.83%)
- **Speed**: ~200ms per face on CPU, ~50ms on GPU

### RetinaFace Detector

- **Detection Accuracy**: Best-in-class, handles:
  - Multiple face angles
  - Partial occlusion
  - Various lighting conditions
- **Outputs**: Face bounding box + 5 facial landmarks

### Default Thresholds

| Metric | Threshold | Same Person If |
|--------|-----------|----------------|
| cosine | 0.68 | distance < 0.68 |
| euclidean | 4.15 | distance < 4.15 |
| euclidean_l2 | 1.13 | distance < 1.13 |

## Performance Considerations

### First Request Latency

The model is **lazy-loaded** on first request to avoid slow startup. The first embedding extraction will take 10-30 seconds while the model loads. Subsequent requests are fast (~200ms).

**Recommendation**: Call `/api/v1/warm-up` after deployment to pre-load the model.

### Memory Usage

- Model loaded: ~2GB RAM
- GPU acceleration: Recommended for production

### Throughput

- CPU: ~5 faces/second
- GPU (NVIDIA): ~20 faces/second

## Docker

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ app/

# Expose port
EXPOSE 8001

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

Build and run:
```bash
docker build -t deepface-service .
docker run -p 8001:8001 deepface-service
```

## Integration with Vara

This service is called by the main Vara API for:

1. **Image Upload**: Extract embedding when user uploads protected image
2. **Scan Jobs**: Compare protected image embeddings against found images
3. **Match Detection**: Determine if found images match user's protected images

### Example Integration (Node.js)

```typescript
import axios from 'axios';

const DEEPFACE_URL = process.env.DEEPFACE_SERVICE_URL || 'http://localhost:8001';

async function extractEmbedding(imageBase64: string): Promise<number[]> {
  const response = await axios.post(`${DEEPFACE_URL}/api/v1/extract-embedding`, {
    image: imageBase64,
    image_type: 'base64',
    enforce_detection: true,
    align: true
  });

  return response.data.embedding;
}

async function compareFaces(emb1: number[], emb2: number[]): Promise<boolean> {
  const response = await axios.post(`${DEEPFACE_URL}/api/v1/compare-faces`, {
    embedding1: emb1,
    embedding2: emb2,
    distance_metric: 'cosine'
  });

  return response.data.is_same_person;
}
```

## Troubleshooting

### "No face detected" errors

- Ensure image has a clear, unobstructed face
- Try setting `enforce_detection: false` to get embedding anyway
- Check image resolution (minimum ~100x100 pixels for face)

### Slow first request

- This is expected (model loading)
- Call `/api/v1/warm-up` after deployment
- Consider using GPU for faster inference

### Memory issues

- Service requires ~2GB RAM with model loaded
- Use Docker memory limits: `docker run -m 4g ...`

## License

Proprietary - Vara Platform

## References

- [DeepFace GitHub](https://github.com/serengil/deepface)
- [ArcFace Paper](https://arxiv.org/abs/1801.07698)
- [RetinaFace Paper](https://arxiv.org/abs/1905.00641)
