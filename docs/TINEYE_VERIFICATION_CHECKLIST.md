# TinEye Integration Verification Checklist

This checklist provides step-by-step verification procedures for the TinEye reverse image search integration and the Person Discovery pipeline. Use this after deployment or when troubleshooting issues.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Verification](#environment-verification)
3. [API Health Checks](#api-health-checks)
4. [Functional Testing](#functional-testing)
5. [Database Verification](#database-verification)
6. [Alert System Verification](#alert-system-verification)
7. [Rate Limit Testing](#rate-limit-testing)
8. [Fallback Behavior Testing](#fallback-behavior-testing)
9. [Worker Logs Review](#worker-logs-review)
10. [Match Score Interpretation](#match-score-interpretation)
11. [Person Discovery Verification](#person-discovery-verification)
12. [Common Issues and Solutions](#common-issues-and-solutions)

---

## Prerequisites

Before starting verification, ensure you have:

- [ ] Access to Render dashboard for vara-api
- [ ] Access to Supabase dashboard for database
- [ ] TinEye API key from https://services.tineye.com/
- [ ] `curl` or similar HTTP client installed
- [ ] Access to application logs

---

## Environment Verification

### 1. Verify API Key Configuration

**On Render:**

1. [ ] Navigate to Render Dashboard > vara-api > Environment
2. [ ] Confirm `TINEYE_API_KEY` is set (value hidden is okay)
3. [ ] Confirm `SCAN_ENGINE` is set to `auto` or `tineye`

**Via CLI (if you have Render CLI):**
```bash
render env --service vara-api | grep TINEYE
```

### 2. Verify Engine Selection Mode

| SCAN_ENGINE Value | Expected Behavior |
|-------------------|-------------------|
| `auto` (default) | Use TinEye if configured, fall back to Google Vision |
| `tineye` | Always use TinEye (error if not configured) |
| `google-vision` | Always use Google Vision |

- [ ] `SCAN_ENGINE` is set appropriately for your use case

### 3. Verify Related Environment Variables

- [ ] `GOOGLE_VISION_API_KEY` is set (for fallback support)
- [ ] `DATABASE_URL` is set (for storing scan results)
- [ ] `REDIS_URL` is set (for BullMQ scan job queue)

---

## API Health Checks

### 1. Check Overall API Health

```bash
curl -s https://vara-api-yaqq.onrender.com/api/v1/health | jq
```

- [ ] Response includes `status: "healthy"` or similar
- [ ] No errors in response

### 2. Test TinEye Connectivity (via Application)

If you have a TinEye health endpoint exposed:
```bash
# If endpoint exists
curl -s https://vara-api-yaqq.onrender.com/api/v1/scan/health | jq
```

### 3. Verify TinEye API Directly (Optional)

Using the API key directly:
```bash
curl -H "X-API-KEY: YOUR_TINEYE_API_KEY" \
  "https://api.tineye.com/rest/image_count/" | jq
```

Expected response:
```json
{
  "code": 200,
  "results": 75000000000
}
```

- [ ] TinEye API responds with code 200
- [ ] Results show billions of indexed images

### 4. Check Remaining API Quota

```bash
curl -H "X-API-KEY: YOUR_TINEYE_API_KEY" \
  "https://api.tineye.com/rest/remaining_searches/" | jq
```

- [ ] Response shows `total_remaining_searches`
- [ ] Quota is sufficient for testing (>10 searches)
- [ ] Note bundle expiration dates

---

## Functional Testing

### 1. Trigger a Scan via API

**Using a test image URL:**

```bash
# Get an auth token first (use your test credentials)
TOKEN="your-jwt-token"

# Trigger a scan (adjust endpoint based on your API)
curl -X POST https://vara-api-yaqq.onrender.com/api/v1/scans/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "IMAGE_SCAN",
    "protectedImageId": "your-test-image-id"
  }' | jq
```

- [ ] Scan job is created successfully
- [ ] Response includes job ID

### 2. Test with Known Image (Melon Cat)

The TinEye "melon cat" image is guaranteed to return results:

```bash
# Test via TinEye API directly
curl -H "X-API-KEY: YOUR_TINEYE_API_KEY" \
  "https://api.tineye.com/rest/search/?image_url=https://tineye.com/images/meloncat.jpg&limit=5" | jq
```

- [ ] Response includes matches
- [ ] `results.matches` array has > 0 items
- [ ] Match scores are reasonable (0-100)

### 3. Upload a Protected Image and Scan

1. [ ] Upload a test image via the Vara web application
2. [ ] Note the protected image ID
3. [ ] Trigger a scan for that image
4. [ ] Wait for scan completion (check job status)
5. [ ] Verify scan results are stored

---

## Database Verification

### 1. Check ScanJob Records

Connect to Supabase and run:

```sql
-- Recent scan jobs
SELECT id, user_id, type, status, started_at, completed_at, error_message
FROM "ScanJob"
WHERE type = 'IMAGE_SCAN'
ORDER BY created_at DESC
LIMIT 10;
```

- [ ] Jobs show status progression: PENDING -> RUNNING -> COMPLETED/FAILED
- [ ] No unexpected FAILED jobs with TinEye errors
- [ ] Completed jobs have result data

### 2. Check ImageMatch Records

```sql
-- Recent image matches
SELECT im.id, im.source_url, im.platform, im.similarity, im.match_type, im.detected_at, im.status
FROM "ImageMatch" im
JOIN "ProtectedImage" pi ON im.protected_image_id = pi.id
ORDER BY im.detected_at DESC
LIMIT 20;
```

- [ ] Matches are being stored
- [ ] Similarity scores are in expected range (0.0 - 1.0)
- [ ] Domains are captured correctly
- [ ] Match types are set appropriately

### 3. Verify Scan Results JSON

```sql
-- Check detailed scan results
SELECT id, result->'provider' as provider, 
       result->'stats'->'totalResults' as total_results,
       result->'stats'->'queryTimeMs' as query_time_ms
FROM "ScanJob"
WHERE status = 'COMPLETED' AND result IS NOT NULL
ORDER BY completed_at DESC
LIMIT 5;
```

- [ ] Provider shows 'tineye'
- [ ] Total results are captured
- [ ] Query time is reasonable (<5000ms typically)

---

## Alert System Verification

### 1. Check Alert Creation for Matches

```sql
-- Recent alerts from image scanning
SELECT a.id, a.type, a.severity, a.title, a.status, a.created_at
FROM "Alert" a
WHERE a.type = 'IMAGE_MISUSE'
ORDER BY a.created_at DESC
LIMIT 10;
```

- [ ] Alerts are created when matches are found
- [ ] Severity levels match match scores:
  - HIGH: score >= 80
  - MEDIUM: score 50-79
  - LOW: score < 50

### 2. Verify Alert Metadata

```sql
-- Check alert metadata includes match details
SELECT a.id, a.metadata
FROM "Alert" a
WHERE a.type = 'IMAGE_MISUSE'
ORDER BY a.created_at DESC
LIMIT 1;
```

- [ ] Metadata includes match source URL
- [ ] Metadata includes domain
- [ ] Metadata includes similarity score

### 3. Test Alert Notification (if configured)

1. [ ] Trigger a scan that will produce matches
2. [ ] Verify email notification is sent (if enabled)
3. [ ] Verify in-app notification appears

---

## Rate Limit Testing

### 1. Verify Rate Limit Configuration

Check the codebase defaults:
```
Max retries: 5
Base delay: 1000ms
Max delay: 30000ms
Jitter factor: 0.1
```

- [ ] Configuration matches expected values

### 2. Monitor for Rate Limit Errors

In application logs, look for:
```
[TinEyeEngine] Rate limited (attempt X/Y), retrying in Zms
```

- [ ] Retries are happening with exponential backoff
- [ ] System recovers after rate limit clears

### 3. Check for Fallback Activation

If using `SCAN_ENGINE=auto`:
- [ ] When rate limited, system falls back to Google Vision
- [ ] Logs show: "Falling back to Google Vision due to TinEye error"

---

## Fallback Behavior Testing

### 1. Test Google Vision Fallback

Temporarily disable TinEye to test fallback:

```bash
# Set SCAN_ENGINE to google-vision temporarily
# Then trigger a scan
```

- [ ] Scans complete successfully with Google Vision
- [ ] Results show `provider: 'google-vision'`

### 2. Test Mock Mode Fallback (Development)

With no API keys configured:

- [ ] Service enters mock mode
- [ ] Mock results have `isMock: true`
- [ ] Domain includes `.example.com`

### 3. Verify Fallback Chain

```
TinEye (primary)
    ↓ (on error/rate limit)
Google Vision (fallback)
    ↓ (on error/no key)
Mock Mode (development only)
```

- [ ] Fallback chain works as expected

---

## Worker Logs Review

### 1. Check Scan Worker Startup

Look for in logs:
```
[ReverseImageService] Running with TinEye API (primary engine)
```

- [ ] Worker starts with correct engine selection
- [ ] No startup errors related to TinEye

### 2. Monitor Scan Processing

During scans, look for:
```
[ReverseImageService] TinEye search completed in Xms, found Y matches (high: A, medium: B, low: C)
```

- [ ] Searches complete in reasonable time
- [ ] Match breakdown is logged

### 3. Check for Warnings

Look for warning messages:
```
[ReverseImageService] TinEye warnings: ...
```

- [ ] Note any API warnings
- [ ] Address warnings if they indicate issues

### 4. Error Patterns to Watch For

| Error Pattern | Likely Cause | Action |
|---------------|--------------|--------|
| `TINEYE_INVALID_API_KEY` | Wrong or expired key | Update API key |
| `TINEYE_RATE_LIMITED` | Too many requests | Wait or reduce frequency |
| `TINEYE_QUOTA_EXHAUSTED` | No searches left | Purchase more quota |
| `TINEYE_NETWORK_ERROR` | Connectivity issue | Check network/firewall |
| `TINEYE_TIMEOUT` | Slow response | Increase timeout or retry |

---

## Match Score Interpretation

### TinEye Score Ranges

| Score Range | Confidence | Interpretation | Recommended Action |
|-------------|------------|----------------|-------------------|
| 80-100 | HIGH | Exact or near-exact match | Investigate immediately |
| 50-79 | MEDIUM | Modified/cropped version | Review for context |
| 20-49 | LOW | Weak similarity | Verify manually |
| <20 | VERY LOW | Likely false positive | Usually safe to dismiss |

### Similarity to Score Conversion

TinEye returns scores 0-100. The service converts to similarity 0.0-1.0:
```
similarity = score / 100
```

### Match Source Types

| Source Type | Description | Reliability |
|-------------|-------------|-------------|
| `fullMatchingImages` | Exact pixel match | Very High |
| `partialMatchingImages` | Cropped/modified | High |
| `pagesWithMatchingImages` | Found on a webpage | High |
| `visuallySimilarImages` | Similar looking | Medium |

---

## Person Discovery Verification

Person Discovery uses SerpAPI (Google Lens / Bing) to find visually similar images of the same person, then expands each candidate with TinEye to find copies.

### Configuration Checklist

- [ ] `SERPAPI_API_KEY` is set in Render environment
- [ ] `PERSON_DISCOVERY_ENGINE` is set to `serpapi` (not `off`)
- [ ] `PERSON_DISCOVERY_MAX_CANDIDATES` is configured (default: 20)
- [ ] `MAX_TINEYE_EXPANSIONS` is configured (default: 10)
- [ ] `TINEYE_API_KEY` is set (for expansion phase)

### Verify SerpAPI Configuration

**On Render:**

1. [ ] Navigate to Render Dashboard > vara-api > Environment
2. [ ] Confirm `SERPAPI_API_KEY` is set
3. [ ] Confirm `PERSON_DISCOVERY_ENGINE` is set to `serpapi`

**Test SerpAPI directly (optional):**
```bash
# Test Google Lens search
curl "https://serpapi.com/search?engine=google_lens&api_key=YOUR_KEY&url=https://example.com/test-image.jpg"
```

### Sample Test Run

1. Upload a test image with a clearly visible face
2. Trigger a person discovery scan:
   ```bash
   curl -X POST https://vara-api-yaqq.onrender.com/api/v1/scans/trigger \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "PERSON_DISCOVERY",
       "protectedImageId": "your-test-image-id"
     }'
   ```
3. Monitor logs for:
   ```
   [PersonDiscoveryService] Starting person discovery scan...
   [PersonDiscoveryService] Found X candidates via Google Lens
   [PersonDiscoveryService] Running TinEye expansion on Y candidates
   [PersonDiscoveryService] Expansion complete: Z total results
   ```
4. Check job status for completion

### Database Verification

**Check for Person Candidates:**
```sql
-- Find person discovery candidates
SELECT id, source_url, match_type, discovery_engine, similarity, detected_at
FROM "ImageMatch"
WHERE match_type = 'PERSON_CANDIDATE'
ORDER BY detected_at DESC
LIMIT 10;
```

**Check for TinEye Expansion Results:**
```sql
-- Find expansion results (have parent candidate)
SELECT im.id, im.source_url, im.match_type, im.verification_engine,
       im.parent_candidate_id, im.candidate_group_id
FROM "ImageMatch" im
WHERE im.parent_candidate_id IS NOT NULL
ORDER BY im.detected_at DESC
LIMIT 20;
```

**Verify Candidate Groups:**
```sql
-- Group results by candidate group
SELECT candidate_group_id, 
       COUNT(*) as total_matches,
       COUNT(CASE WHEN match_type = 'PERSON_CANDIDATE' THEN 1 END) as candidates,
       COUNT(CASE WHEN parent_candidate_id IS NOT NULL THEN 1 END) as expansions
FROM "ImageMatch"
WHERE candidate_group_id IS NOT NULL
GROUP BY candidate_group_id
ORDER BY MAX(detected_at) DESC
LIMIT 5;
```

### Expected Results

| Field | Expected Value | Notes |
|-------|----------------|-------|
| `matchType` | `PERSON_CANDIDATE` | For SerpAPI results |
| `matchType` | `EXACT_COPY`, `ALTERED_COPY` | For TinEye expansion results |
| `discoveryEngine` | `google_lens` or `bing_visual_search` | Source of candidate |
| `verificationEngine` | `tineye` | Source of expansion |
| `parentCandidateId` | UUID of parent | Links expansion to candidate |
| `candidateGroupId` | UUID | Groups all results from one scan |

### Logs to Monitor

**Successful Person Discovery:**
```
[PersonDiscoveryService] Starting person discovery for image abc123
[PersonDiscoveryService] SerpAPI search completed: 15 candidates found
[PersonDiscoveryService] Filtering candidates: 12 passed similarity threshold
[PersonDiscoveryService] Running TinEye expansion on 10 candidates (max: 10)
[PersonDiscoveryService] Candidate 1/10: Found 5 copies via TinEye
[PersonDiscoveryService] Candidate 2/10: Found 0 copies via TinEye
...
[PersonDiscoveryService] Scan complete: 12 candidates, 23 total expansions
```

**Rate Limiting:**
```
[PersonDiscoveryService] SerpAPI rate limited, waiting 5s before retry
[PersonDiscoveryService] TinEye rate limited during expansion, skipping candidate
```

### Troubleshooting Person Discovery

| Issue | Symptoms | Solutions |
|-------|----------|-----------|
| No candidates found | Scan completes with 0 candidates | 1. Check SerpAPI quota<br>2. Verify image has a detectable face<br>3. Ensure image is publicly accessible<br>4. Try a different image with clearer subject |
| TinEye expansion timeout | Candidates found but no expansions | 1. Reduce `MAX_TINEYE_EXPANSIONS`<br>2. Check TinEye quota<br>3. Increase timeout settings |
| SerpAPI rate limiting | `SERPAPI_RATE_LIMITED` errors | 1. Check SerpAPI quota<br>2. Reduce scan frequency<br>3. Enable `SERPAPI_CACHE_TTL` |
| Missing expansion results | Candidates exist but no children | 1. Verify `TINEYE_API_KEY` is set<br>2. Check TinEye quota<br>3. Review logs for TinEye errors |
| Duplicate candidates | Same URL appears multiple times | 1. Check deduplication logic<br>2. Verify `candidateGroupId` grouping |

### Quick Verification Commands

**Check Person Discovery Configuration:**
```bash
# Via API health check (if exposed)
curl -s https://vara-api-yaqq.onrender.com/api/v1/scan/config | jq
```

**Monitor Live Scan:**
```bash
# Tail Render logs during a scan
render logs --service vara-api --tail 50 | grep PersonDiscovery
```

**Check SerpAPI Quota:**
```bash
curl "https://serpapi.com/account?api_key=YOUR_KEY" | jq '.searches_remaining'
```

---

## Common Issues and Solutions

### Issue: No matches found for known images

**Symptoms:**
- Scans complete but return 0 matches
- Known test images return no results

**Solutions:**
1. Verify TinEye API is responding:
   ```bash
   curl -H "X-API-KEY: KEY" "https://api.tineye.com/rest/image_count/"
   ```
2. Test with melon cat URL (guaranteed results)
3. Check if image is too small (< 100x100 pixels)
4. Ensure image is publicly accessible

### Issue: All scans returning rate limit errors

**Symptoms:**
- `TINEYE_RATE_LIMITED` errors in logs
- Retries exhausted

**Solutions:**
1. Check TinEye dashboard for rate limit status
2. Reduce scan frequency
3. Implement scan batching/queuing
4. Upgrade TinEye plan for higher limits

### Issue: Quota exhausted

**Symptoms:**
- `TINEYE_QUOTA_EXHAUSTED` errors
- `totalRemainingSearches: 0`

**Solutions:**
1. Purchase additional TinEye searches
2. Enable Google Vision fallback (`SCAN_ENGINE=auto`)
3. Prioritize scans for high-risk images only

### Issue: Slow scan performance

**Symptoms:**
- Query times > 10 seconds
- Timeouts occurring

**Solutions:**
1. Reduce `limit` parameter (default 50)
2. Reduce `backlink_limit` parameter
3. Check image size (large images are slower)
4. Verify network connectivity to TinEye

### Issue: Fallback not working

**Symptoms:**
- TinEye errors but no Google Vision fallback
- Service crashes on TinEye failure

**Solutions:**
1. Verify `SCAN_ENGINE=auto` (not `tineye`)
2. Ensure `GOOGLE_VISION_API_KEY` is set
3. Check Google Vision API quota/billing
4. Review error handling in logs

### Issue: Incorrect match scores

**Symptoms:**
- Very low scores for obvious matches
- Very high scores for dissimilar images

**Solutions:**
1. Review image quality (compression artifacts can affect matching)
2. Check if image has been heavily modified
3. Verify correct image is being scanned
4. Report potential API issue to TinEye support

---

## Quick Reference Commands

### Health Check
```bash
curl -s https://vara-api-yaqq.onrender.com/api/v1/health | jq
```

### Check TinEye Quota
```bash
curl -H "X-API-KEY: YOUR_KEY" "https://api.tineye.com/rest/remaining_searches/" | jq
```

### Test Search (Melon Cat)
```bash
curl -H "X-API-KEY: YOUR_KEY" \
  "https://api.tineye.com/rest/search/?image_url=https://tineye.com/images/meloncat.jpg&limit=3" | jq
```

### Check Recent Scan Jobs (SQL)
```sql
SELECT * FROM "ScanJob" WHERE type = 'IMAGE_SCAN' ORDER BY created_at DESC LIMIT 5;
```

### View Worker Logs (Render)
```bash
# Via Render Dashboard: Services > vara-api > Logs
# Or via Render CLI:
render logs --service vara-api --tail 100
```

---

## Verification Sign-Off

| Verification Item | Status | Date | Notes |
|-------------------|--------|------|-------|
| Environment configured | [ ] | | |
| TinEye API responding | [ ] | | |
| Quota sufficient | [ ] | | |
| Scans producing results | [ ] | | |
| Matches stored in DB | [ ] | | |
| Alerts generated | [ ] | | |
| Fallback working | [ ] | | |
| Logs show correct behavior | [ ] | | |

**Verified by:** _________________
**Date:** _________________
**Notes:** _________________
