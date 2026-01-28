# Production Deployment

## Live URLs

| Service | URL | Platform |
|---------|-----|----------|
| **Frontend** | https://vara-web-eta.vercel.app | Vercel |
| **Backend API** | https://vara-api-yaqq.onrender.com | Render |
| **DeepFace Service** | https://vara-deepface.onrender.com | Render |
| **Database** | PostgreSQL via Supabase | Supabase |

## Vercel Configuration (Frontend)

**Project:** `vara-web` in `samruben96s-projects`

**Environment Variables (Production & Preview):**

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://vara-api-yaqq.onrender.com` |
| `VITE_SUPABASE_URL` | `https://vgwkptzwvoxtfaxmeuqn.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

**Build Configuration (vercel.json):**
- Build Command: `pnpm turbo build --filter=@vara/web`
- Output Directory: `apps/web/dist`
- Install Command: `pnpm install`
- Framework: Vite

**Deployment:**
```bash
# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View environment variables
vercel env ls
```

## Render Configuration (Backend API)

**Service:** `vara-api` (Web Service)

**Environment Variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | Or let Render set automatically |
| `WEB_URL` | `https://vara-web-eta.vercel.app` | **Critical for CORS** - must match frontend URL exactly, no trailing slash |
| `DATABASE_URL` | Supabase pooler connection string | Use `?pgbouncer=true` for connection pooling |
| `SUPABASE_URL` | `https://vgwkptzwvoxtfaxmeuqn.supabase.co` | |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Keep secret! |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret | Keep secret! |
| `OPENAI_API_KEY` | OpenAI API key | For CLIP embeddings |
| `TINEYE_API_KEY` | TinEye API key | **Primary** reverse image search engine |
| `GOOGLE_VISION_API_KEY` | Google Cloud API key | Fallback reverse image search |
| `SCAN_ENGINE` | `auto` | Options: `tineye`, `google-vision`, `auto` |
| `DEEPFACE_SERVICE_URL` | `https://vara-deepface.onrender.com` | Face recognition microservice URL |

**Build & Start Commands:**
- Build: `pnpm install && pnpm build --filter=@vara/api`
- Start: `node apps/api/dist/index.js`

## Supabase Configuration

**Project:** `vgwkptzwvoxtfaxmeuqn`

**Services Used:**
- PostgreSQL database (with pgvector extension)
- Authentication (email/password + OAuth providers)
- Storage (for protected images)

**Connection Strings:**
- Pooler (for API): Use port `6543` with `?pgbouncer=true`
- Direct (for migrations): Use port `5432`

## DeepFace Service Configuration (Face Recognition)

**Service:** `vara-deepface` (Docker Web Service on Render)

The DeepFace service is a Python microservice that provides face recognition capabilities for detecting face matches in protected images.

**Technology Stack:**
- Python 3.10 with FastAPI/Uvicorn
- DeepFace library with ArcFace model
- Multi-stage Docker build for optimized image size
- Health check endpoint for monitoring

**Environment Variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `LOG_LEVEL` | `INFO` | Logging verbosity (DEBUG, INFO, WARNING, ERROR) |
| `PORT` | `8001` | Service port |
| `HOST` | `0.0.0.0` | Bind address |
| `PRELOAD_MODELS` | `true` | Pre-download models during build (recommended for production) |

**Render Deployment:**
```bash
# Deploy from services/deepface-service directory
# Uses render.yaml blueprint configuration

# Service plan: Standard (minimum 2GB RAM for ML models)
# Health check: /api/v1/health
```

**API Endpoints:**
- `GET /api/v1/health` - Health check with model status
- `POST /api/v1/faces/verify` - Verify if two faces match
- `POST /api/v1/faces/represent` - Generate face embedding from image
- `POST /api/v1/faces/analyze` - Analyze face attributes (age, gender, emotion)

**Local Development:**
```bash
# Start with Docker Compose (includes all services)
docker-compose up deepface-service

# Or run standalone
cd services/deepface-service
docker build -t vara-deepface .
docker run -p 8001:8001 vara-deepface

# Test health endpoint
curl http://localhost:8001/api/v1/health
```

**Memory Requirements:**
- Minimum: 2GB RAM
- Recommended: 4GB RAM (for model caching)
- First request may take 10-30s for model loading

## TinEye Configuration (Reverse Image Search)

TinEye is the **primary** reverse image search engine for detecting unauthorized use of protected images across the web.

**API Access:**
- Sign up at: https://services.tineye.com/
- Plans: Pay-per-search or subscription bundles
- Free tier: Limited searches for testing

**Environment Variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `TINEYE_API_KEY` | Your TinEye API key | Required for TinEye engine |
| `SCAN_ENGINE` | `auto` | `tineye`, `google-vision`, or `auto` |

**Scan Engine Selection:**
- `tineye` - Always use TinEye (fails if no API key)
- `google-vision` - Always use Google Vision Web Detection
- `auto` (default) - Uses TinEye if `TINEYE_API_KEY` is set, otherwise falls back to Google Vision

**Recommended Configuration:**

| Setting | Default | Description |
|---------|---------|-------------|
| `limit` | 50 | Max results per search (1-100) |
| `backlink_limit` | 10 | Max backlinks per match result |

**Rate Limiting:**
- TinEye API returns HTTP 429 when rate limited
- The scan service implements exponential backoff (1s, 2s, 4s, max 3 retries)
- Monitor your API quota in the TinEye dashboard

**Response Handling:**
- Matches are deduplicated by domain
- Results include: source URL, domain, match score, crawl date, dimensions
- Backlinks provide additional URLs where the image appears

**Fallback Behavior:**
When TinEye is unavailable (rate limited, API error, or no key):
1. If `SCAN_ENGINE=auto`: Falls back to Google Vision
2. If `SCAN_ENGINE=tineye`: Fails with error (no fallback)
3. Failed scans are retried via BullMQ with exponential backoff

## Deployment Checklist

When deploying changes:

1. **Frontend changes only:**
   - Push to `main` branch (auto-deploys via Vercel GitHub integration)
   - Or run `vercel --prod` manually

2. **Backend changes only:**
   - Push to `main` branch (auto-deploys via Render GitHub integration)
   - Or trigger manual deploy in Render dashboard

3. **Database schema changes:**
   ```bash
   # Generate migration
   pnpm db:migrate:dev --name <migration_name>

   # Apply to production (run from local with production DATABASE_URL)
   DATABASE_URL="<production_url>" pnpm db:migrate:deploy
   ```

4. **Environment variable changes:**
   - Vercel: `vercel env add <NAME> production`
   - Render: Update in dashboard → Environment → Redeploy

5. **DeepFace service changes:**
   - Push to `main` branch (auto-deploys via Render GitHub integration)
   - Or trigger manual deploy in Render dashboard
   - Monitor first deployment - model download can take 5-10 minutes
   - Verify health: `curl https://vara-deepface.onrender.com/api/v1/health`

## Troubleshooting

### CORS Errors
If you see CORS errors in the browser console:
1. Check `WEB_URL` on Render matches the exact frontend URL
2. Ensure no trailing slash on `WEB_URL`
3. Redeploy backend after changing `WEB_URL`

**Verify CORS:**
```bash
curl -I -X OPTIONS https://vara-api-yaqq.onrender.com/api/v1/auth/login \
  -H "Origin: https://vara-web-eta.vercel.app" \
  -H "Access-Control-Request-Method: POST"
# Should return: access-control-allow-origin: https://vara-web-eta.vercel.app
```

### API Connection Issues
1. Verify `VITE_API_URL` on Vercel points to correct Render URL
2. Check Render service is running (not sleeping on free tier)
3. Test API directly: `curl https://vara-api-yaqq.onrender.com/api/v1/auth/login`

### Authentication Failures
1. Verify Supabase keys match between frontend (anon) and backend (service role)
2. Check `SUPABASE_JWT_SECRET` is set correctly on Render
3. Ensure Supabase project URL is consistent across all configs

### DeepFace Service Issues
1. **Slow first request**: Model loading takes 10-30s on first request. Use `PRELOAD_MODELS=true` in production.
2. **Out of memory**: Service requires minimum 2GB RAM. Use Standard plan on Render.
3. **Health check failing**: Check logs for model download errors. May need to redeploy.
4. **Face not detected**: Image may be too small, blurry, or face not clearly visible.
5. **Connection refused from API**: Verify `DEEPFACE_SERVICE_URL` is set correctly on backend.

**Test DeepFace locally:**
```bash
# Start service
docker-compose up deepface-service

# Test health
curl http://localhost:8001/api/v1/health

# Test face verification (requires two images)
curl -X POST http://localhost:8001/api/v1/faces/verify \
  -F "image1=@path/to/image1.jpg" \
  -F "image2=@path/to/image2.jpg"
```

### TinEye / Image Scanning Issues
1. **No results returned**: Image may be too new (not yet indexed by TinEye), or genuinely not found online.
2. **Rate limited (429)**: Check your TinEye quota. The service auto-retries with backoff.
3. **API key invalid**: Verify `TINEYE_API_KEY` is set correctly on Render.
4. **Fallback to Google Vision**: If TinEye fails and `SCAN_ENGINE=auto`, check logs for Google Vision results.
5. **Scan stuck in pending**: Check Redis connection and BullMQ worker status.

**Test image scanning:**
```bash
# Check which engine is configured
curl https://vara-api-yaqq.onrender.com/api/v1/health

# Trigger a scan via the API (requires auth)
# Scans are processed asynchronously via BullMQ
```

## Environment Variables Reference

### Web (apps/web)
```env
VITE_API_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### API (apps/api)
```env
# Server
PORT=
NODE_ENV=
API_URL=
WEB_URL=

# Database
DATABASE_URL=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=

# Redis
REDIS_URL=

# External APIs
OPENAI_API_KEY=
TINEYE_API_KEY=
GOOGLE_VISION_API_KEY=
HIBP_API_KEY=

# OAuth (via Supabase, but may need for direct API calls)
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
TIKTOK_CLIENT_ID=
TIKTOK_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
```
