# Facial Recognition Research for Vara

**Date:** 2026-01-12
**Status:** Research Complete - Awaiting Implementation Decision

---

## Executive Summary

Google Vision's reverse image search finds **visually similar images** (same colors, composition), but NOT photos of the same person. For Vara's use case of detecting unauthorized image use and impersonation, we need **facial recognition** technology.

This document outlines the research findings and recommended approaches.

---

## Key Finding: OpenAI Cannot Be Used for Face Recognition

### Why Not?

1. **GPT-4 Vision explicitly blocks face identification** - OpenAI has taken a "principled stand" against facial recognition
2. **CLIP captures image similarity, not facial identity** - Two photos of the same person in different clothes/settings will have LOW similarity scores
3. **Legal liability** - OpenAI/Microsoft are facing BIPA lawsuits over biometric data
4. **Policy restriction** - Face recognition is listed as an "always-prohibited use case" in OpenAI's terms

### What CLIP Does vs What We Need

| Feature | CLIP (Current) | Face Recognition (Needed) |
|---------|---------------|---------------------------|
| Purpose | "What's in this image?" | "Who is this person?" |
| Similarity basis | Colors, composition, objects | Facial features, identity |
| Same person, different photo | Low similarity | High similarity |
| Different person, similar scene | High similarity | Low similarity |

---

## Two Components Needed

### 1. Web Face Search (Find faces online)
Services that crawl the web and maintain indexed databases of faces.

### 2. Face Embedding (Local processing)
Generate face vectors for comparison and storage in our database.

---

## Web Face Search Services Comparison

### Tier 1: APIs with Web Crawling (Can search the internet)

| Service | API Available | Cost | Database | Best For |
|---------|--------------|------|----------|----------|
| **FaceCheck.ID** | Yes (REST) | ~$0.30/search | Large | Social media, dating sites, mugshots |
| **lenso.ai** | Yes (Full) | $2,800/mo (5K searches) | Large | Developer integration |
| **PimEyes** | Business only | Custom pricing | 900M+ images | Largest database |
| **Social Catfish** | Via Orbitly | $28-199/mo | Dating sites | Catfish detection |

### FaceCheck.ID API Details (Recommended for MVP)

**Endpoint:** `https://facecheck.id/api/`

**Workflow:**
```
1. POST /api/upload_pic (upload face image)
   → Returns: { "id_search": "unique-search-id" }

2. POST /api/search (execute search)
   → Body: { "id_search": "...", "with_progress": true }

3. Response contains:
   - progress: 0-100%
   - output.items[]: Array of matches
     - score: Confidence (0-100)
     - url: Source webpage
     - base64: Thumbnail
```

**Pricing:**
| Package | Credits | Price | Per Search |
|---------|---------|-------|------------|
| Just Peek | 36 | ~$6 | ~$0.50 |
| Rookie Sleuth | 150 | ~$25 | ~$0.50 |
| Private Eye | 400 | ~$67 | ~$0.50 |
| Deep Investigator | 2,000 | ~$200 | ~$0.30 |
| The Professional | 10,000 | ~$597 | ~$0.18 |

*1 search = 3 credits; 1 credit = $0.10 USD*

### lenso.ai API Details

**Documentation:** https://github.com/lenso-ai/reverse-image-search-api

**Pricing:** $2,800/month for Developer tier
- 5,000 API calls/month
- 5,000 results
- 500 alerts
- Priority support
- 20% discount for annual

**Limitations:**
- Face search requires separate agreement
- Regional restrictions may apply

---

## Face Embedding Libraries (Self-Hosted)

These generate face vectors for local comparison but **cannot search the web**.

| Library | Language | Accuracy (LFW) | Embedding Size | License |
|---------|----------|----------------|----------------|---------|
| **DeepFace** | Python | 99.63% | 512-dim | MIT |
| **InsightFace/ArcFace** | Python | 99.83% | 512-dim | Apache 2.0 |
| **face-api.js** | JavaScript | 99.38% | 128-dim | MIT |
| **OpenFace** | Python | 93.80% | 128-dim | Apache 2.0 |

### DeepFace (Recommended)

```python
from deepface import DeepFace

# Generate embedding
embedding = DeepFace.represent(
    img_path="photo.jpg",
    model_name="ArcFace"  # Best accuracy
)

# Compare two faces
result = DeepFace.verify(
    img1_path="photo1.jpg",
    img2_path="photo2.jpg"
)
# Returns: { "verified": True, "distance": 0.25, "threshold": 0.68 }
```

### face-api.js (Browser-based)

```javascript
// Load models
await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

// Detect and get descriptor
const detection = await faceapi
  .detectSingleFace(image)
  .withFaceLandmarks()
  .withFaceDescriptor();

// Compare faces (Euclidean distance)
const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
// Match if distance < 0.6
```

---

## Cloud Face APIs (No Web Search)

These can detect/compare faces but **only within your own database**.

| Service | Pricing | Free Tier | Web Search |
|---------|---------|-----------|------------|
| **AWS Rekognition** | $1/1K images | 1K images/mo | No |
| **Azure Face API** | $0.40-1/1K | Limited | No |
| **Google Cloud Vision** | $1.50/1K | 1K/mo | No |
| **Clarifai** | $30-300/mo | 1K/mo | No |

---

## Recommended Architecture for Vara

```
┌─────────────────────────────────────────────────────────────┐
│                     User Uploads Photo                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  [Browser] face-api.js validates face exists                │
│  - Quick client-side check before upload                    │
│  - Reduces invalid uploads                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  [Server] DeepFace/InsightFace extracts face embedding      │
│  - 512-dimensional vector                                   │
│  - Crop face region for cleaner embedding                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  [Database] Store face embedding in pgvector                │
│  - Alongside existing CLIP embedding                        │
│  - Separate column: face_embedding vector(512)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  [API] FaceCheck.ID searches web for matching faces         │
│  - Returns URLs where face appears                          │
│  - Includes confidence scores                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  [Server] Compare found images against stored embedding     │
│  - Verify matches are actually the same person              │
│  - Filter false positives                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  [Alerts] Generate user-friendly alerts                     │
│  - "Your face was found on dating-site.com"                 │
│  - Include confidence score and recommended actions         │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema Updates Needed

### ProtectedImage Model Additions

```prisma
model ProtectedImage {
  // Existing fields...
  embedding       Unsupported("vector(512)")  // CLIP embedding

  // New face-related fields
  faceEmbedding   Unsupported("vector(512)")?  // Face embedding (nullable)
  faceDetected    Boolean  @default(false)
  faceConfidence  Float?   // Detection confidence
  faceMetadata    Json?    // Bounding box, landmarks, etc.
}
```

### New Alert Types

```prisma
enum AlertType {
  // Existing...
  IMAGE_MISUSE
  FAKE_PROFILE
  DATA_BREACH
  BEHAVIORAL_RISK

  // New face-specific types
  FACE_MATCH           // Face found on unauthorized site
  IMPERSONATION        // Same face used in fake profile
  IDENTITY_THEFT_RISK  // Multiple matches across platforms
}
```

---

## New Service Structure

```
apps/api/src/services/ai/
├── clip.service.ts           (existing - image embeddings)
├── perceptual-hash.service.ts (existing - duplicate detection)
├── reverse-image.service.ts  (existing - Google Vision)
├── deepfake.service.ts       (existing - deepfake detection)
├── face-embedding.service.ts (NEW - extract face embeddings)
├── face-search.service.ts    (NEW - FaceCheck.ID API integration)
└── index.ts                  (update exports)
```

---

## Legal and Compliance Requirements

### Regulations to Consider

| Regulation | Jurisdiction | Key Requirements |
|------------|--------------|------------------|
| **BIPA** | Illinois, USA | Written consent, data retention policy, $1K-5K per violation |
| **GDPR** | EU | Explicit consent, DPIA required, right to deletion |
| **CCPA** | California | Biometric = sensitive data, deletion rights |

### Compliance Checklist

- [ ] Explicit consent form for face data collection
- [ ] Privacy policy updated with biometric data handling
- [ ] Data Protection Impact Assessment (DPIA) for EU users
- [ ] Right to deletion workflow for face embeddings
- [ ] Only allow users to search for their OWN face
- [ ] Clear data retention policy (auto-delete after X days)
- [ ] Regional restrictions for strict jurisdictions
- [ ] Regular bias audits (accuracy varies by demographic)

### Privacy-First Design

1. **Verify identity** - Ensure uploaded face matches account owner
2. **No third-party searches** - Users cannot search for others' faces
3. **Minimal retention** - Delete embeddings when no longer needed
4. **Encryption** - Face embeddings encrypted at rest
5. **Audit trail** - Log all face-related operations

---

## Cost Estimates

### Monthly Cost Projections

| Users | Searches/User | Total Searches | FaceCheck.ID Cost |
|-------|---------------|----------------|-------------------|
| 100 | 5 | 500 | ~$150 |
| 1,000 | 5 | 5,000 | ~$1,500 |
| 10,000 | 5 | 50,000 | ~$9,000 |

### Alternative: lenso.ai

| Volume | Monthly Cost | Per Search |
|--------|--------------|------------|
| 5,000 | $2,800 | $0.56 |
| 10,000+ | Custom | Contact |

---

## Implementation Phases

### Phase 1: MVP (FaceCheck.ID Integration)
- Integrate FaceCheck.ID API
- Basic face search on scan
- Alerts for face matches

### Phase 2: Enhanced Processing
- Add DeepFace for local face embedding
- Store face embeddings in pgvector
- Cross-reference found images

### Phase 3: Advanced Features
- Client-side face validation (face-api.js)
- Impersonation detection across platforms
- Face match confidence scoring

### Phase 4: Scale & Optimize
- Evaluate lenso.ai for higher volumes
- Consider PimEyes Business API
- Optimize embedding storage

---

## Decision Needed

Choose one approach to start:

1. **FaceCheck.ID API** (~$0.30/search)
   - Pros: Well-documented, affordable, searches social/dating sites
   - Cons: Third-party dependency, Bitcoin payment

2. **lenso.ai API** ($2,800/month)
   - Pros: Full API access, reliable
   - Cons: High fixed cost, 5K search limit

3. **Self-hosted DeepFace** (free)
   - Pros: Free, privacy-focused
   - Cons: No web search capability (internal comparison only)

---

## Sources

- [FaceCheck.ID API Documentation](https://facecheck.id/Face-Search/API)
- [lenso.ai API](https://lenso.ai/en/page/api)
- [lenso.ai GitHub](https://github.com/lenso-ai/reverse-image-search-api)
- [PimEyes](https://pimeyes.com)
- [DeepFace GitHub](https://github.com/serengil/deepface)
- [InsightFace GitHub](https://github.com/deepinsight/insightface)
- [face-api.js GitHub](https://github.com/justadudewhohacks/face-api.js)
- [AWS Rekognition Pricing](https://aws.amazon.com/rekognition/pricing/)
- [Azure Face API](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/face-api/)
- [GDPR and Facial Recognition](https://www.gdpr-advisor.com/gdpr-and-facial-recognition-privacy-implications-and-legal-considerations/)
- [Illinois BIPA](https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004)
