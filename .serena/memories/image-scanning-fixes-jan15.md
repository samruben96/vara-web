# Image Scanning Fixes - January 15, 2026

## Summary

Fixed several issues in the image scanning workflow related to duplicate matches and false positives.

## Issues Fixed

### 1. Unique Constraint Error on Re-scans

**Problem**: `prisma.imageMatch.create()` failed with "Unique constraint failed on (protectedImageId, sourceUrl)" when scanning an image that had been scanned before.

**Solution**: Changed to `upsert()` in `apps/api/src/workers/image-scan.worker.ts:398`

```typescript
// Before: prisma.imageMatch.create({...})
// After:
const imageMatch = await prisma.imageMatch.upsert({
  where: {
    protectedImageId_sourceUrl: {
      protectedImageId: image.id,
      sourceUrl: match.sourceUrl,
    },
  },
  create: { /* new match data */ },
  update: {
    scanJobId,
    similarity: match.similarity,
    matchType,
    lastSeenAt: new Date(),
  },
});
```

### 2. Duplicate Alerts on Re-scans

**Problem**: Every re-scan created new alerts for existing matches.

**Solution**: Added check for existing match before creating alert:

```typescript
const existingMatch = await prisma.imageMatch.findUnique({...});
const isNewMatch = !existingMatch;

// Only create alert for NEW matches
if (isNewMatch) {
  await createAlertFromMatch(...);
}
```

### 3. False Positives from Face Mismatch

**Problem**: Google Vision's "visuallySimilarImages" returned images of different people. DeepFace correctly identified face mismatches but the code still saved them as matches and created alerts.

**Solution**: Changed face mismatch handling to skip instead of just marking:

```typescript
// Before:
extendedMatch.faceVerified = false;

// After:
skippedFaceMismatch++;
continue; // Skip this match entirely
```

## Current Architecture

### Image Matching Pipeline

1. **Google Vision API** - Reverse image search finds potential matches
   - Returns: fullMatchingImages, partialMatchingImages, pagesWithMatchingImages, visuallySimilarImages
   - Problem: visuallySimilarImages often returns false positives (similar-looking but different people)

2. **DeepFace Service** - Face verification
   - Self-hosted Python microservice at `services/deepface-service/`
   - Uses ArcFace model for 512-dim face embeddings
   - Correctly identifies face mismatches
   - **Working well**

3. **CLIP Embeddings** - Semantic image similarity
   - **NOT YET IMPLEMENTED** - returns mock data
   - Log message: `[ClipService] Real CLIP API not yet implemented, using mock`
   - Would help filter matches by comparing image embeddings

4. **Perceptual Hashing** - Visual fingerprinting
   - **MOCK IMPLEMENTATION** - not real hashes

## Implemented Improvements (January 15, 2026)

### Tiered Match Type Filtering

Implemented confidence-based filtering for Google Vision match types to reduce false positives:

**MATCH_TYPE_CONFIG** (in `image-scan.worker.ts`):

| Match Type | Confidence | Face Required | CLIP Required | Min Threshold | Auto Alert |
|------------|------------|---------------|---------------|---------------|------------|
| fullMatchingImages | HIGH | No | No | 0.70 | Yes |
| partialMatchingImages | MEDIUM_HIGH | Yes | No | 0.75 | Yes |
| pagesWithMatchingImages | MEDIUM | Yes | Yes | 0.80 | Yes |
| visuallySimilarImages | LOW | Yes | Yes | 0.85 | No (flagged) |

**Key Changes:**

1. **ReverseImageMatch interface** now includes `matchSourceType` field
2. **processGoogleVisionResults** tracks which category each match came from
3. **processImage** uses tiered filtering with per-type thresholds
4. **CLIP verification** added for medium/low confidence matches
5. **FLAGGED_FOR_REVIEW** status added for low-confidence matches (no auto-alert)

**Schema Change:**
- Added `FLAGGED_FOR_REVIEW` to `ImageMatchStatus` enum in Prisma schema

### Detailed Skip Logging

Added debug logs for all skip reasons:
- "Skipping {matchType} - below threshold: {similarity}"
- "Skipping {matchType} - face mismatch"
- "Skipping {matchType} - CLIP similarity too low: {clipSimilarity}"
- "Flagging {matchType} for review - low confidence"

## Remaining Tasks

### CLIP Service Still Mock
- The CLIP service returns mock embeddings (cosine similarity comparison works but values are random)
- Phase 2: Replace with real OpenAI CLIP API or self-hosted model

## Files Modified

- `apps/api/src/workers/image-scan.worker.ts` - Main scan worker with upsert and face skip fixes
- `apps/api/src/utils/alert-creator.ts` - Alert creation (unchanged but reviewed)
- `apps/api/src/services/ai/clip.service.ts` - CLIP service (still mock)
- `apps/api/src/services/ai/face-embedding.service.ts` - DeepFace integration (working)

## Related Memories

- `face-recognition-feature` - DeepFace service documentation
