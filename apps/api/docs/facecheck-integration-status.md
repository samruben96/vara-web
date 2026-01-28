# FaceCheck.id Integration Status

## Overview

FaceCheck.id is a face-based web search API integrated into Vara's image scanning pipeline. It performs biometric face matching to find different photos of the same person across the web — filling a gap where TinEye finds image copies and SerpAPI finds visually similar content, but neither searches for other photos containing the same face.

**Status: Functional — In Testing**

---

## Architecture

```
Image Scan Trigger
  → BullMQ Worker (image-scan.worker.ts)
    → ReverseImageService.scanWithPersonDiscovery()
      → [Parallel] SerpAPI + FaceCheck
        → FaceCheckEngine.discoverByUpload()
          → FaceCheckClient.uploadImage()     POST /api/upload_pic
          → FaceCheckClient.searchWithPolling() POST /api/search (polls)
          → FaceCheckClient.deletePic()        POST /api/delete_pic (cleanup)
      → TinEye expansion on each candidate
    → Worker stores results:
      - PERSON_CANDIDATE (SerpAPI)
      - FACE_MATCH (FaceCheck, score >= 80)
      - EXACT_COPY / ALTERED_COPY (TinEye)
    → Alert creation for high-confidence face matches
```

---

## Files Created / Modified

### New Files (4)

| File | Lines | Purpose |
|------|-------|---------|
| `src/config/facecheck.config.ts` | 138 | Zod-validated config from env vars |
| `src/services/scan/person-discovery/facecheck.types.ts` | 160 | Types, error codes, constants |
| `src/services/scan/person-discovery/facecheck.client.ts` | 476 | HTTP client (upload, poll, delete, retry) |
| `src/services/scan/person-discovery/facecheck.engine.ts` | 231 | PersonDiscoveryEngine implementation |

### Modified Files (6)

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added `FACE_MATCH` to ImageMatchType enum, `discoveryScore Float?` to ImageMatch |
| `prisma/migrations/20260127000000_*/migration.sql` | Manual migration for enum + column |
| `src/services/scan/person-discovery/interfaces.ts` | Added `'facecheck'` to PersonDiscoveryProvider, `score?` to candidate |
| `src/services/scan/person-discovery/index.ts` | Added all FaceCheck exports |
| `src/services/ai/reverse-image.service.ts` | Parallel FaceCheck + SerpAPI, deduplication, cached image buffer |
| `src/workers/image-scan.worker.ts` | FACE_MATCH storage, alerts for score >= 80, platform typing |

### Test Files (5, ~231 tests)

| File | Tests | Covers |
|------|-------|--------|
| `person-discovery/__tests__/facecheck.client.test.ts` | 63 | Upload, polling, retry, cleanup, errors |
| `person-discovery/__tests__/facecheck.engine.test.ts` | 46 | Discovery methods, availability, mapping |
| `config/__tests__/facecheck.config.test.ts` | 48 | Zod validation, env vars, edge cases |
| `ai/__tests__/reverse-image-facecheck.test.ts` | 31 | Pipeline integration, deduplication |
| `workers/__tests__/image-scan-facecheck.worker.test.ts` | 43 | FACE_MATCH storage, alert creation |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FACECHECK_ENGINE` | Yes | `off` | Set to `facecheck` to enable |
| `FACECHECK_API_KEY` | Yes | — | API key (sent as Authorization header) |
| `FACECHECK_DEMO` | No | `true` | Use demo endpoint (free tier) |
| `FACECHECK_MIN_SCORE` | No | `70` | Minimum match score (0-100) |
| `FACECHECK_API_URL` | No | `https://facecheck.id` | API base URL (must be HTTPS) |
| `FACECHECK_POLL_INTERVAL` | No | `3000` | Poll interval in ms |
| `FACECHECK_MAX_POLL_TIME` | No | `600000` | Max poll time in ms (10 min, max 15 min) |

---

## What's Done

### Core Implementation
- [x] FaceCheck HTTP client with retry, polling, cleanup
- [x] PersonDiscoveryEngine implementation (discoverByUpload, discoverByImageUrl, isAvailable)
- [x] Zod-validated configuration with safe defaults
- [x] Error hierarchy (Auth, Upload, Credit, Timeout, Cancelled)
- [x] Integration into reverse-image scanning pipeline (parallel with SerpAPI)
- [x] Candidate deduplication (prefers FaceCheck over SerpAPI)
- [x] FACE_MATCH storage in worker with discoveryScore
- [x] Alert creation for high-confidence matches (score >= 80)
- [x] Prisma schema + migration (FACE_MATCH enum, discoveryScore field)

### Security Hardening Applied
- [x] Base64 thumbnails never stored (stripped in normalizeMatches)
- [x] API key masked in all logs (****last4)
- [x] Authorization header (not deprecated apikey)
- [x] Image cleanup in finally block (deletePic always called)
- [x] HTTPS enforcement on apiBaseUrl (Zod refine)
- [x] AbortSignal listener cleanup (prevents accumulation)
- [x] FormData factory pattern (retry-safe body re-creation)
- [x] deletePic timeout (10s via AbortController)
- [x] Cached image buffer (avoids double download for FaceCheck + TinEye)

### Testing
- [x] 231 tests across 5 test files (all passing)
- [x] Test header assertions updated to match `Authorization` header
- [x] Polling timeout increased to 10 minutes for free tier

---

## What's Remaining

### Must Fix Before Production

1. **SSRF Protection in discoverByImageUrl** (High)
   - Location: `facecheck.engine.ts` line ~133
   - Issue: No URL validation before fetching — could fetch internal IPs
   - Fix: Add private IP range validation before `fetch(imageUrl, ...)`

2. **Response Body Size Limit** (High)
   - Location: `facecheck.engine.ts` line ~145
   - Issue: `response.arrayBuffer()` called without size check
   - Fix: Check Content-Length header or implement streaming with 10MB limit

3. **HTTPS-Only URL Validation** (Medium)
   - Location: `facecheck.client.ts` `sanitizeUrl()` line ~98
   - Issue: Accepts both HTTP and HTTPS despite docs saying HTTPS-only
   - Fix: Change condition to only allow `https:` protocol

### Nice to Have

4. **Zod Validation on API Responses** (Low)
   - Add Zod schemas for FaceCheck API responses (upload, search, info)
   - Currently using TypeScript type assertions with manual field checks

5. **Integration Tests** (Low)
   - End-to-end test with mocked FaceCheck API
   - Full pipeline: upload → scan → store → alert

6. **Monitoring** (Low)
   - Log FaceCheck credit balance on startup
   - Track polling timeout frequency
   - Alert on credit exhaustion

---

## Testing in UI

### How to Test
1. Set env vars (`FACECHECK_ENGINE=facecheck`, `FACECHECK_API_KEY=<key>`)
2. Restart API server
3. Upload a protected image in the web app
4. Click "Scan Images"
5. Watch API server logs

### Log Lines to Watch

**Success flow:**
```
[FaceCheckClient] Initialized (key: ****<last4>, demo: true)
[FaceCheckEngine] Starting face discovery by upload...
[FaceCheckClient] Upload successful, id_search: <8chars>...
[FaceCheckClient] Starting search polling (interval: 3000ms, timeout: 600s, demo: true)
[FaceCheckClient] Polling attempt 1 (3s / 600s) - waiting...
[FaceCheckClient] Search complete: N matches found in Xs
[FaceCheckClient] Deleted uploaded image: <8chars>...
[FaceCheckEngine] Discovery complete: N candidates from N matches
[ReverseImageService] Person discovery: N candidates (facecheck: N, serpapi: N)
```

**Error indicators:**
```
[FaceCheckEngine] Discovery failed: <error message>
[FaceCheckClient] Search timed out after Xms
[FaceCheckClient] Request returned 401 (auth error)
[FaceCheckClient] Request returned 402 (insufficient credits)
```

### Notes
- Free/demo tier is slow — polling may run for several minutes before results appear
- Max polling time is now 10 minutes (was 5)
- Double-pressing scan is safe — API returns 409 if scan already running
- TinEye is currently disabled (env vars commented out) — re-enable when ready
