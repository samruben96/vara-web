# TinEye Integration - Migration Notes

## Overview

TinEye is now the **expansion/evidence** engine for Vara's image protection scanning, working alongside Person Discovery (SerpAPI) in a two-phase pipeline. Google Vision Web Detection remains available as a fallback.

## Architecture Update: Person Discovery + TinEye

### The Problem

TinEye excels at finding exact or altered copies of the same image, but it cannot find "photos of the same person" across different images. For comprehensive protection, we need both capabilities:

1. **Visual similarity search** - Find other images that likely contain the same person
2. **Exact/altered copy detection** - Find where specific images have spread online

### Solution: Two-Phase Pipeline

**Phase 1: Person Discovery** (SerpAPI - Google Lens / Bing)
- Finds visually similar images that may contain the same person
- Uses reverse image search via Google Lens or Bing Visual Search
- Returns candidates ranked by visual similarity
- Ideal for finding profile photos, social media images, and articles about the person

**Phase 2: TinEye Expansion**
- For each candidate from Phase 1, runs TinEye to find exact/altered copies
- Provides evidence of where each candidate image has spread
- Detects modifications, crops, and reposts of the candidate images

### Flow Diagram

```
                    +------------------+
                    |  Protected Image |
                    +--------+---------+
                             |
                             v
              +-----------------------------+
              |  Phase 1: Person Discovery  |
              |         (SerpAPI)           |
              |  Google Lens / Bing Visual  |
              +-------------+---------------+
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
       +---------+     +---------+     +---------+
       |Candidate|     |Candidate|     |Candidate|
       |  #1     |     |  #2     |     |  #3     |
       +----+----+     +----+----+     +----+----+
            |               |               |
            v               v               v
     +------+-------+ +-----+--------+ +----+---------+
     |Phase 2:      | |Phase 2:      | |Phase 2:      |
     |TinEye        | |TinEye        | |TinEye        |
     |Expansion     | |Expansion     | |Expansion     |
     +--------------+ +--------------+ +--------------+
            |               |               |
            v               v               v
       +--------+      +--------+      +--------+
       | Copies |      | Copies |      | Copies |
       | Found  |      | Found  |      | Found  |
       +--------+      +--------+      +--------+
```

### Match Types

| Match Type | Source | Description |
|------------|--------|-------------|
| `PERSON_CANDIDATE` | SerpAPI | Visually similar image, likely same person |
| `EXACT_COPY` | TinEye | Exact duplicate of a candidate image |
| `ALTERED_COPY` | TinEye | Modified/cropped version of a candidate |
| `SIMILAR` | TinEye | Visually similar to a candidate |

### Database Relationships

```
ProtectedImage
    |
    +-- ImageMatch (matchType: PERSON_CANDIDATE)  <-- From SerpAPI
            |
            +-- ImageMatch (parentCandidateId)    <-- TinEye expansion
            +-- ImageMatch (parentCandidateId)    <-- TinEye expansion
```

All results from a single scan share the same `candidateGroupId` for tracking.

---

## What Changed

### New Scan Engine Architecture

The image scanning system now supports multiple engines with automatic fallback:

| Engine | Status | Use Case |
|--------|--------|----------|
| **TinEye** | Primary (recommended) | More accurate, dedicated reverse image search service |
| **Google Vision** | Fallback | Web Detection API, used when TinEye unavailable |

### Configuration

Set these environment variables on Render:

```bash
# Required for TinEye (Phase 2: Expansion)
TINEYE_API_KEY=your-api-key

# Required for Person Discovery (Phase 1)
SERPAPI_API_KEY=your-serpapi-key

# Engine selection (optional)
SCAN_ENGINE=auto                    # TinEye engine mode: auto, tineye, google-vision
PERSON_DISCOVERY_ENGINE=serpapi     # Person discovery mode: serpapi, off

# Person Discovery limits
PERSON_DISCOVERY_MAX_CANDIDATES=20  # Max candidates from Phase 1
MAX_TINEYE_EXPANSIONS=10            # Max candidates to expand with TinEye
```

**SCAN_ENGINE Options:**
- `auto` (default) - Uses TinEye if API key is set, falls back to Google Vision
- `tineye` - Always use TinEye (fails if no API key)
- `google-vision` - Always use Google Vision

**PERSON_DISCOVERY_ENGINE Options:**
- `serpapi` - Use SerpAPI for Google Lens / Bing reverse image search
- `off` - Disable person discovery (TinEye-only mode)

### Rate Limiting

TinEye API implements rate limiting. The scan service handles this automatically:

1. On HTTP 429 response, waits with exponential backoff
2. Retry sequence: 1s, 2s, 4s (max 3 retries)
3. If still rate limited, falls back to Google Vision (if `SCAN_ENGINE=auto`)
4. Failed scans are re-queued via BullMQ for later retry

### Recommended Defaults

| Setting | Value | Description |
|---------|-------|-------------|
| `limit` | 50 | Results per search (max: 100) |
| `backlink_limit` | 10 | Backlinks per match |

These defaults balance thoroughness with API quota conservation.

## Deployment Steps

### 1. Get TinEye API Key

1. Sign up at https://services.tineye.com/
2. Choose a plan (pay-per-search or subscription)
3. Copy your API key from the dashboard

### 2. Update Render Environment

1. Go to Render Dashboard > vara-api > Environment
2. Add new variable: `TINEYE_API_KEY` = your key
3. Optionally set: `SCAN_ENGINE` = `auto` (or `tineye` for TinEye-only)
4. Click "Save Changes"
5. Redeploy the service

### 3. Verify Deployment

```bash
# Check service health
curl https://vara-api-yaqq.onrender.com/api/v1/health

# Monitor logs for scan activity
# Look for: "Using TinEye scan engine" or "Falling back to Google Vision"
```

## Rollback

To revert to Google Vision only:

1. Set `SCAN_ENGINE=google-vision` on Render
2. Redeploy

TinEye API key can remain configured for future use.

## API Quota Monitoring

Monitor your TinEye usage at: https://services.tineye.com/dashboard

Consider:
- Setting up usage alerts
- Adjusting `limit` parameter if quota is constrained
- Using `auto` mode to fall back gracefully when quota is exhausted

## Code Locations

| Component | Path |
|-----------|------|
| Person Discovery Service | `apps/api/src/services/scan/person-discovery.service.ts` |
| SerpAPI Client | `apps/api/src/services/scan/serpapi.client.ts` |
| TinEye Service | `apps/api/src/services/scan/tineye.service.ts` |
| Scan Engine Factory | `apps/api/src/services/scan/scan-engine.factory.ts` |
| Scan Worker | `apps/api/src/workers/scan.worker.ts` |
| Types | `apps/api/src/services/scan/types.ts` |

## Scan Types

| Scan Type | Description | Engines Used |
|-----------|-------------|--------------|
| `IMAGE_SCAN` | Legacy: TinEye-only scan for exact copies | TinEye |
| `PERSON_DISCOVERY` | New: Two-phase person discovery + expansion | SerpAPI + TinEye |

To trigger a person discovery scan:
```bash
curl -X POST https://vara-api-yaqq.onrender.com/api/v1/scans/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PERSON_DISCOVERY",
    "protectedImageId": "your-image-id"
  }'
```

## Performance Tuning (January 2026)

### Transaction Timeout Fix

When processing large batches (50-100+ matches from Person Discovery + TinEye expansion), the database transaction was timing out. This has been fixed:

| Setting | Before | After |
|---------|--------|-------|
| Transaction timeout | 30 seconds | **120 seconds (2 min)** |
| Max connection wait | 10 seconds | **15 seconds** |

**Why 120 seconds?**
- Person Discovery can return 50+ candidates
- Each candidate can have 10+ TinEye expansion matches
- Total: 100-600+ database upsert operations
- Each upsert takes 100-200ms under load
- 600 ops × 200ms = 120 seconds worst case

**Monitoring:** The worker logs a warning when batch size exceeds 500 operations:
```
[ImageScanWorker] Large batch detected: 623 operations (52 candidates, 521 tineye matches, 50 original matches)
```

### Prisma Query Logging

Query logging is now **disabled by default** to prevent log flooding during batch operations.

**Enable for debugging:**
```bash
# In .env or command line
PRISMA_LOG_QUERIES=true pnpm dev
```

| Environment | Default Logs | With PRISMA_LOG_QUERIES=true |
|-------------|-------------|------------------------------|
| Development | `error`, `warn` | `error`, `warn`, `query` |
| Production | `error` | `error`, `query` |

### Alert Creation Optimization

Alerts are now created **after** the transaction commits (not inside it):
- Prevents database connection contention
- Transaction only handles ImageMatch upserts
- Alerts created sequentially after successful commit

This change reduced transaction duration by ~40% for large batches.

---

## Questions?

Check the troubleshooting section in CLAUDE.md under "TinEye / Image Scanning Issues".
