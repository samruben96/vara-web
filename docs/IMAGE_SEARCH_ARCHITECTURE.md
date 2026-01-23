# Image Search Architecture & Roadmap

## Overview

Vara's image protection system detects unauthorized use of user photos across the web. This document outlines the current architecture and future roadmap for expanding coverage.

## Current Architecture (Phase 1) ✅

```
User's Protected Image
         ↓
   Google Vision API
   (Reverse Image Search)
         ↓
┌─────────────────────────────────┐
│   Match Types Returned:         │
│   - fullMatchingImages (HIGH)   │
│   - partialMatchingImages (MED) │
│   - pagesWithMatchingImages     │
│   - visuallySimilarImages (LOW) │
└─────────────────────────────────┘
         ↓
   CLIP Verification
   (Filter false positives)
         ↓
   DeepFace Verification
   (Confirm face matches)
         ↓
   Confidence-Based Alerts
```

### Current Limitations
- Single search source (Google Vision)
- Different search engines index different parts of the web
- Some sites block Google but not Bing (and vice versa)
- No coverage of sites not indexed by Google

---

## Phase 2: Multi-Source Search Architecture

### Target Architecture

```
User's Protected Image
         ↓
         ↓ (Parallel Searches)
         ↓
┌────────────────────────────────────────────────────────────┐
│                   SEARCH SOURCES                           │
├──────────────┬──────────────┬──────────────┬──────────────┤
│ Google       │ Bing Visual  │ TinEye       │ Yandex       │
│ Vision API   │ Search API   │ API          │ Images       │
│              │              │              │              │
│ Best for:    │ Best for:    │ Best for:    │ Best for:    │
│ - General    │ - Microsoft  │ - Exact      │ - Russian/   │
│   web        │   ecosystem  │   copies     │   EU sites   │
│ - Social     │ - Bing-      │ - Modified   │ - Sites not  │
│   media      │   indexed    │   versions   │   in Google  │
│              │   sites      │ - Low false  │              │
│              │              │   positives  │              │
├──────────────┴──────────────┴──────────────┴──────────────┤
│ Cost/search: │ Cost/search: │ Cost/search: │ Cost/search: │
│ ~$1.50/1000  │ Free tier    │ ~$0.20/each  │ Free (scrape)│
└────────────────────────────────────────────────────────────┘
         ↓
         ↓ (Merge & Deduplicate by URL)
         ↓
┌────────────────────────────────────────────────────────────┐
│                 VERIFICATION PIPELINE                      │
├────────────────────────────────────────────────────────────┤
│  1. Deduplicate results (same URL from multiple sources)   │
│  2. CLIP Verification (semantic similarity > 0.75)         │
│  3. DeepFace Verification (face match if face detected)    │
│  4. Perceptual Hash Check (detect modifications)           │
└────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────┐
│                 CONFIDENCE SCORING                         │
├────────────────────────────────────────────────────────────┤
│  Sources agreeing + verification results = confidence      │
│                                                            │
│  HIGH:   Multiple sources + CLIP + Face match              │
│  MEDIUM: One source + CLIP match + No face detected        │
│  LOW:    One source + CLIP borderline                      │
│  REVIEW: One source + No CLIP verification possible        │
└────────────────────────────────────────────────────────────┘
         ↓
   Alerts / Flagged for Review
```

### Search Source Details

#### 1. Google Vision API (Current)
- **Endpoint:** `vision.googleapis.com/v1/images:annotate`
- **Feature:** `WEB_DETECTION`
- **Returns:** fullMatchingImages, partialMatchingImages, pagesWithMatchingImages, visuallySimilarImages
- **Pricing:** $1.50 per 1,000 images
- **File:** `apps/api/src/services/ai/google-vision.service.ts`

#### 2. Bing Visual Search API (To Add)
- **Endpoint:** `api.bing.microsoft.com/v7.0/images/visualsearch`
- **Auth:** Ocp-Apim-Subscription-Key header
- **Returns:** PagesIncluding, VisualSearch results
- **Pricing:** Free tier (1,000/month), then $3/1,000
- **Docs:** https://docs.microsoft.com/en-us/bing/search-apis/bing-visual-search/

```typescript
// Example implementation
interface BingVisualSearchResult {
  pagesIncluding: Array<{
    hostPageUrl: string;
    hostPageDisplayUrl: string;
    thumbnailUrl: string;
  }>;
  visuallySimilarImages: Array<{
    thumbnailUrl: string;
    contentUrl: string;
  }>;
}
```

#### 3. TinEye API (To Add)
- **Endpoint:** `api.tineye.com/rest/search`
- **Auth:** API key
- **Returns:** Exact and modified matches with backlinks
- **Pricing:** $0.20 per search (bundles available)
- **Docs:** https://services.tineye.com/developers/tineyeapi
- **Key Advantage:** Very low false positives, finds modified versions

```typescript
// Example implementation
interface TinEyeResult {
  matches: Array<{
    domain: string;
    backlinks: Array<{
      url: string;
      backlink: string;
    }>;
    score: number;
  }>;
}
```

#### 4. Yandex Images (Optional - Scraping)
- **No official API** - requires scraping
- **Best for:** Russian/Eastern European sites
- **Consideration:** Terms of service, rate limiting
- **Implementation:** Playwright/Puppeteer browser automation

#### 5. Google Custom Search API (Alternative to Vision)
- **Endpoint:** `customsearch.googleapis.com/customsearch/v1`
- **Feature:** `searchType=image` with `imgUrl` parameter
- **Pricing:** Free 100/day, then $5/1,000
- **Note:** Different results than Vision API

---

## Phase 3: Build Internal Database

### User-Confirmed Matches Database

When users confirm a match is real:

```sql
-- Store for future searches
INSERT INTO confirmed_matches (
  source_url,
  clip_embedding,  -- vector(512)
  phash,
  domain,
  detected_at,
  confirmed_by_user_id,
  match_type  -- 'exact', 'modified', 'deepfake'
)
```

**Benefits:**
- Free searches against known bad sites
- Help other users automatically
- Build database of problematic domains
- Track repeat offenders

### High-Risk Site Crawling

Target sites to proactively crawl:

| Category | Examples | Priority |
|----------|----------|----------|
| Adult content aggregators | (various) | HIGH |
| Revenge porn sites | (various) | HIGH |
| Dating profiles | Public profiles | MEDIUM |
| AI image generators | Civitai galleries | MEDIUM |
| Forums with image sharing | Reddit, 4chan | LOW |

**Architecture:**

```
Scheduled Crawler
      ↓
  Extract Images
      ↓
  Generate CLIP Embedding
      ↓
  Store in pgvector
      ↓
  Index by domain/date
```

**Storage Estimate:**
- 1M images × 512 floats × 4 bytes = ~2GB vectors
- pgvector can handle 10M+ vectors efficiently
- Cost: ~$50/month hosting

---

## Phase 4: Partnerships & Scale

### Potential Partners

| Organization | What They Offer | Access |
|--------------|-----------------|--------|
| **StopNCII.org** | Hash database of reported NCII images | Partnership application |
| **Meta (Facebook)** | Cross-platform hash sharing | Business partnership |
| **NCMEC** | PhotoDNA for CSAM detection | Requires vetting |
| **Thorn** | Anti-trafficking tech | Nonprofit partnership |

### Common Crawl Processing

- **What:** Free web archive, ~250TB/month
- **Cost to process:** ~$50-100k one-time for images
- **Result:** Index of ~1B web images with CLIP embeddings
- **Storage:** ~2TB for embeddings alone

---

## Implementation Priority

### Immediate (Phase 2a) - Add Bing
```
Effort: ~2-3 hours
Cost: Free tier available
Impact: +20-30% coverage
```

### Short-term (Phase 2b) - Add TinEye
```
Effort: ~2-3 hours
Cost: ~$0.20/search
Impact: Much better exact match detection
```

### Medium-term (Phase 3) - Internal Database
```
Effort: ~1-2 days
Cost: Minimal (use existing pgvector)
Impact: Free searches, community protection
```

### Long-term (Phase 4) - Partnerships
```
Effort: Business development
Cost: Variable
Impact: Access to specialized databases
```

---

## API Cost Comparison

| Service | Free Tier | Paid Rate | Best For |
|---------|-----------|-----------|----------|
| Google Vision | 1,000/month | $1.50/1,000 | General web |
| Bing Visual | 1,000/month | $3/1,000 | Microsoft ecosystem |
| TinEye | None | $0.20/search | Exact matches |
| Google Custom Search | 100/day | $5/1,000 | Alternative results |
| Internal DB (pgvector) | Unlimited | ~$0.001/search | Known bad sites |

**Cost Optimization Strategy:**
1. Check internal DB first (free)
2. Use free tiers of Bing/Google
3. TinEye for high-priority scans only
4. Batch searches during off-peak

---

## File Structure for Multi-Source Search

```
apps/api/src/services/ai/
├── reverse-image.service.ts      # Orchestrates all sources
├── google-vision.service.ts      # Google Vision API ✅
├── bing-visual.service.ts        # Bing Visual Search (TO ADD)
├── tineye.service.ts             # TinEye API (TO ADD)
├── clip.service.ts               # CLIP verification ✅
├── face-embedding.service.ts     # DeepFace verification ✅
└── internal-search.service.ts    # pgvector search (TO ADD)
```

---

## Environment Variables Needed

```env
# Current
GOOGLE_VISION_API_KEY=xxx
DEEPFACE_SERVICE_URL=http://localhost:8001

# To Add
BING_VISUAL_SEARCH_KEY=xxx
TINEYE_API_KEY=xxx
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| False positive rate | ~5% | <1% |
| Web coverage | ~60% | ~85% |
| Detection time | ~20s | ~30s (more sources) |
| Cost per scan | ~$0.002 | ~$0.005 |

---

## References

- [Google Vision API Docs](https://cloud.google.com/vision/docs/detecting-web)
- [Bing Visual Search Docs](https://docs.microsoft.com/en-us/bing/search-apis/bing-visual-search/)
- [TinEye API Docs](https://services.tineye.com/developers/tineyeapi)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [CLIP Paper](https://arxiv.org/abs/2103.00020)

---

*Last Updated: January 15, 2026*
