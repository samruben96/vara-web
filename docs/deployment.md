# Production Deployment

## Live URLs

| Service | URL | Platform |
|---------|-----|----------|
| **Frontend** | https://vara-web-eta.vercel.app | Vercel |
| **Backend API** | https://vara-api-yaqq.onrender.com | Render (free tier) |
| **Database** | PostgreSQL via Supabase | Supabase |
| **Redis** | Upstash (for BullMQ) | Upstash (free tier, optional) |

> **Note:** DeepFace service is not deployed. The API falls back to mock mode automatically when `DEEPFACE_SERVICE_URL` is unset.

## Local Development (No Docker Required)

All services are hosted — just run the API and frontend locally:

```bash
pnpm install
pnpm dev          # Starts web + api in dev mode
```

Your local `apps/api/.env` should point at Supabase for the database and optionally Upstash for Redis.
If `REDIS_URL` is not set, background workers are disabled but the API still works.

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

**Service:** `vara-api` (Web Service, free tier)
**Service ID:** `srv-d5is16fpm1nc73fg4fmg`
**Region:** Virginia

**Environment Variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | |
| `API_URL` | `https://vara-api-yaqq.onrender.com` | |
| `WEB_URL` | `https://vara-web-eta.vercel.app` | **Critical for CORS** - no trailing slash |
| `DATABASE_URL` | Supabase pooler connection string | Use `?pgbouncer=true` |
| `SUPABASE_URL` | `https://vgwkptzwvoxtfaxmeuqn.supabase.co` | |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Keep secret! |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret | Keep secret! |
| `OPENAI_API_KEY` | OpenAI API key | For CLIP embeddings |
| `TINEYE_API_KEY` | TinEye API key | **Primary** reverse image search engine |
| `GOOGLE_VISION_API_KEY` | Google Cloud API key | Fallback reverse image search |
| `SCAN_ENGINE` | `auto` | Options: `tineye`, `google-vision`, `auto` |
| `PERSON_DISCOVERY_ENGINE` | `serpapi` | Options: `serpapi`, `off` |
| `FACECHECK_ENGINE` | `off` | Options: `facecheck`, `off` |
| `REDIS_URL` | Upstash Redis URL | Optional — workers disabled if unset |

**Build & Start Commands:**
- Root Dir: `apps/api`
- Build: `cd ../.. && NODE_ENV=development pnpm install --ignore-scripts && pnpm turbo build --filter=@vara/api && pnpm --filter=@vara/api db:generate`
- Start: `node dist/index.js`

**Render CLI:**
```bash
# Trigger a deploy
render deploys create srv-d5is16fpm1nc73fg4fmg --confirm

# View logs
render logs -r srv-d5is16fpm1nc73fg4fmg --tail

# List recent deploys
render deploys list srv-d5is16fpm1nc73fg4fmg --output json
```

**Blueprint:** The `render.yaml` at the repo root defines the API service configuration.

## Supabase Configuration

**Project:** `vgwkptzwvoxtfaxmeuqn`

**Services Used:**
- PostgreSQL database (with pgvector extension)
- Authentication (email/password + OAuth providers)
- Storage (for protected images)

**Connection Strings:**
- Pooler (for API runtime): Use port `6543` with `?pgbouncer=true`
- Direct (for migrations): Use port `5432`

## Upstash Redis Configuration (Optional)

Redis powers BullMQ background job queues (image scanning, breach checks).
The API works without it — background workers are simply disabled.

**Setup:**
1. Sign up at https://console.upstash.com/
2. Create a Redis database (free tier: 10K commands/day, 256MB)
3. Copy the `REDIS_URL` (starts with `rediss://...`)
4. Set it on Render and in your local `.env`

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

**Rate Limiting:**
- TinEye API returns HTTP 429 when rate limited
- The scan service implements exponential backoff (1s, 2s, 4s, max 3 retries)
- Monitor your API quota in the TinEye dashboard

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
   - Or: `render deploys create srv-d5is16fpm1nc73fg4fmg --confirm`

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
   - Or via API: `curl -X PUT -H 'Authorization: Bearer <key>' ...`

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
3. Test API directly: `curl https://vara-api-yaqq.onrender.com/api/v1/health`

### Render Free Tier Cold Starts
The free tier spins down after 15 minutes of inactivity. First request after sleep takes ~30-60s.
To keep it warm, consider an external cron ping (e.g., UptimeRobot free tier).

### Authentication Failures
1. Verify Supabase keys match between frontend (anon) and backend (service role)
2. Check `SUPABASE_JWT_SECRET` is set correctly on Render
3. Ensure Supabase project URL is consistent across all configs

### TinEye / Image Scanning Issues
1. **No results returned**: Image may be too new (not yet indexed by TinEye), or genuinely not found online.
2. **Rate limited (429)**: Check your TinEye quota. The service auto-retries with backoff.
3. **API key invalid**: Verify `TINEYE_API_KEY` is set correctly on Render.
4. **Fallback to Google Vision**: If TinEye fails and `SCAN_ENGINE=auto`, check logs for Google Vision results.
5. **Scan stuck in pending**: Check Redis connection and BullMQ worker status.

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

# Database (Supabase)
DATABASE_URL=
DIRECT_URL=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=

# Redis (Upstash - optional)
REDIS_URL=

# External APIs
OPENAI_API_KEY=
TINEYE_API_KEY=
GOOGLE_VISION_API_KEY=
HIBP_API_KEY=
SERPAPI_API_KEY=
FACECHECK_API_KEY=
```
