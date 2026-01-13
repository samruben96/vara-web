# Image Scanning Infrastructure

This document describes the image scanning system implemented for Vara's digital safety platform.

## Overview

The scanning infrastructure enables users to scan their protected images for:
- **Unauthorized use** - Finding copies of images on other websites
- **Deepfake detection** - Identifying AI-manipulated versions
- **Data breaches** - Checking if email/accounts have been compromised

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Fastify API   │────▶│   Redis Queue   │
│   (React)       │     │   (Port 4000)   │     │   (BullMQ)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │◀────│   Workers       │◀────│   AI Services   │
│   (pgvector)    │     │   (Background)  │     │   (Mock/Real)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## User Flow

1. User visits `/images` page
2. Clicks "Scan All Images" or individual image scan button
3. Frontend calls `POST /api/v1/scans/trigger`
4. API creates `ScanJob` record and queues job to BullMQ
5. Worker picks up job and processes:
   - Downloads image from Supabase Storage
   - Generates CLIP embedding (512-dimensional vector)
   - Generates perceptual hash
   - Runs reverse image search
   - Runs deepfake detection
   - Stores embedding in pgvector
   - Creates `ImageMatch` records for matches found
   - Creates `Alert` if threats detected
6. Frontend polls `GET /api/v1/scans?status=RUNNING,PENDING` every 3 seconds
7. Shows completion with results ("No issues found" or "X matches found")

---

## API Keys Required

### Currently Configured (Required)

| Service | Environment Variable | Purpose | Status |
|---------|---------------------|---------|--------|
| **Supabase** | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Database, Auth, Storage | ✅ Configured |
| **Redis** | `REDIS_URL` | Job queue for background scanning | ✅ Configured |

### AI Services (Optional - Mock Mode Available)

All AI services run in **mock mode** by default. This is suitable for development and testing. Add API keys to enable real scanning:

| Service | Environment Variable | Purpose | Get Key From | Status |
|---------|---------------------|---------|--------------|--------|
| **OpenAI** | `OPENAI_API_KEY` | CLIP image embeddings for similarity search | [platform.openai.com](https://platform.openai.com/api-keys) | Ready |
| **TinEye** | `TINEYE_API_KEY` | Reverse image search (primary) | [tineye.com/api](https://tineye.com/api) | Mock only |
| **Google Vision** | `GOOGLE_VISION_API_KEY` | Reverse image search (fallback) | [console.cloud.google.com](https://console.cloud.google.com/apis/library/vision.googleapis.com) | **Integrated** |
| **Have I Been Pwned** | `HIBP_API_KEY` | Data breach detection | [haveibeenpwned.com/API/Key](https://haveibeenpwned.com/API/Key) | Mock only |
| **Deepfake API** | `DEEPFAKE_API_KEY`, `DEEPFAKE_API_ENDPOINT` | AI manipulation detection | Various providers (Sensity, Microsoft, etc.) | Mock only |

> **Note**: Google Vision API is now integrated as a fallback for reverse image search. The service will use TinEye if configured, otherwise Google Vision, otherwise mock mode. See `apps/api/src/services/ai/reverse-image.service.ts` for implementation.

### Mock Mode Behavior

When API keys are not configured, services run in mock mode:

- **CLIP Service**: Generates random 512-dimensional normalized vectors (deterministic per image)
- **Perceptual Hash**: Generates hash based on image buffer SHA-256
- **Reverse Image Search**: Returns empty results 85% of time, 1 mock match 15% of time
- **Deepfake Detection**: Returns `isDeepfake=false` 95% of time
- **Breach Check**: Returns mock breach data occasionally for testing

---

## Files Created/Modified

### Backend (apps/api)

#### Configuration
- `src/config/redis.ts` - Redis connection management

#### Queues
- `src/queues/index.ts` - Queue definitions (IMAGE_SCAN, PROFILE_SCAN, BREACH_CHECK)

#### Workers
- `src/workers/index.ts` - Worker entry point
- `src/workers/init.ts` - Server-side worker initialization
- `src/workers/image-scan.worker.ts` - Image processing worker
- `src/workers/breach.worker.ts` - Data breach check worker

#### AI Services
- `src/services/ai/index.ts` - Service exports
- `src/services/ai/clip.service.ts` - CLIP embedding generation
- `src/services/ai/perceptual-hash.service.ts` - Image hashing
- `src/services/ai/reverse-image.service.ts` - Reverse image search
- `src/services/ai/deepfake.service.ts` - Deepfake detection

#### Utilities
- `src/services/vector/similarity.ts` - pgvector similarity search
- `src/utils/alert-creator.ts` - Alert creation from scan results

#### Routes
- `src/routes/scans.ts` - Updated with queue integration and health endpoint

### Frontend (apps/web)

#### Hooks
- `src/hooks/useScans.ts` - Added `useTriggerScan`, `useTriggerImageScan`, `useActiveScan`

#### Components
- `src/components/ScanStatus/ScanStatus.tsx` - Scan progress display

#### Pages
- `src/pages/ProtectedImages.tsx` - Added scan buttons and status display

### Database

#### Migrations Applied
1. `20260112153328_enhance_image_scanning_workflow` - Schema enhancements
2. `20260112153329_add_pgvector_hnsw_index` - Vector similarity index

#### Schema Changes
- `ScanJob`: Added `protectedImageId`, `priority`, `progress`, `retryCount`, `workerId`
- `ImageMatch`: Added `scanJobId`, `firstSeenAt`, `lastSeenAt`, unique constraint
- `ProtectedImage`: Added `scanCount`, `matchCount`, hash index

---

## Running the System

### Development

```bash
# 1. Ensure Redis is running
docker run -d -p 6379:6379 redis
# Or if already running, verify with:
redis-cli ping

# 2. Ensure environment variables are set
# apps/api/.env should contain:
# REDIS_URL=redis://localhost:6379

# 3. Run migrations (if needed)
pnpm db:migrate

# 4. Start development server (workers start automatically)
pnpm dev
```

### Verifying Workers

```bash
# Check health endpoint
curl http://localhost:4000/api/v1/scans/health

# Expected response:
{
  "data": {
    "status": "ok",
    "workers": {
      "count": 2,
      "status": [
        { "name": "image-scan", "running": true, "paused": false },
        { "name": "breach-check", "running": true, "paused": false }
      ]
    },
    "queues": {
      "stats": [
        { "name": "image-scan", "waiting": 0, "active": 0, "completed": 5 },
        { "name": "breach-check", "waiting": 0, "active": 0, "completed": 0 }
      ]
    }
  }
}
```

---

## Scan Types

### IMAGE_SCAN
Processes protected images through the AI pipeline:
1. Downloads image from Supabase Storage
2. Generates CLIP embedding (512-dim vector) for similarity search
3. Generates perceptual hash for quick duplicate detection
4. Runs reverse image search across web
5. Runs deepfake detection
6. Creates `ImageMatch` records for matches above 85% similarity
7. Creates `Alert` for concerning matches

### BREACH_CHECK
Checks user's email against known data breaches:
1. Queries Have I Been Pwned API
2. Creates `DATA_BREACH` alert if breaches found
3. Includes breach details (name, date, exposed data types)

### PROFILE_SCAN (Not Yet Implemented)
Future: Social account monitoring for behavioral changes.

### FULL_SCAN
Triggers both IMAGE_SCAN and BREACH_CHECK.

---

## Alert Severity Levels

| Severity | Trigger | Example |
|----------|---------|---------|
| **CRITICAL** | Deepfake with >90% confidence | AI-manipulated version of your image |
| **HIGH** | Exact match (>95% similar) or deepfake | Your exact image found on another site |
| **MEDIUM** | Similar match (85-95%) or breach with passwords | Similar image detected online |
| **LOW** | Modified image or breach without passwords | Potentially modified version found |

---

## Rate Limiting

| Queue | Rate Limit | Concurrency | Reason |
|-------|------------|-------------|--------|
| image-scan | 10/minute | 5 jobs | CPU intensive, API limits |
| breach-check | 40/minute | 2 jobs | HIBP API rate limits |

---

## Retry Strategy

Jobs use exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 5 seconds delay
- Attempt 3: 10 seconds delay (final)

Failed jobs are kept for 7 days for debugging.

---

## Monitoring

### Console Logs
Workers log to console with `[ImageScanWorker]` and `[BreachWorker]` prefixes:
```
[ImageScanWorker] Starting job image-scan-xxx for scan xxx
[ImageScanWorker] Processing image 1/3: xxx
[ImageScanWorker] Generating CLIP embedding for image xxx
[ImageScanWorker] Completed job: 3 images processed, 0 matches found
```

### Health Endpoint
`GET /api/v1/scans/health` returns worker and queue status.

### Database
Query `scan_jobs` table for job history:
```sql
SELECT id, type, status, progress, "createdAt", "completedAt", result
FROM scan_jobs
WHERE "userId" = 'xxx'
ORDER BY "createdAt" DESC;
```

---

## Troubleshooting

### "Workers not initialized"
- Check `REDIS_URL` is set in `apps/api/.env`
- Verify Redis is running: `redis-cli ping`

### "relation 'ProtectedImage' does not exist"
- Raw SQL queries must use actual table names (`protected_images`) not Prisma model names
- This was fixed in the worker code

### Scan stuck in PENDING
- Check Redis connection
- Check worker logs for errors
- Verify health endpoint shows workers running

### No matches found (mock mode)
- This is expected - mock mode returns empty results 85% of the time
- Add real API keys for actual scanning

---

## Future Enhancements

1. **Profile Scanning** - Monitor connected social accounts for suspicious activity
2. **Scheduled Scans** - Automatic periodic scanning
3. **Batch Processing** - Optimize for large image libraries
4. **Real-time Notifications** - WebSocket/SSE for instant alerts
5. **Similarity Search** - Find similar images across all users (with consent)
