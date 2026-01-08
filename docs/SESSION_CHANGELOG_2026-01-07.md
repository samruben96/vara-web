# Session Changelog - January 7, 2026

## Summary
Fixed critical image display bug and implemented new filter system for Protected Images page.

---

## Bug Fixes

### 1. Images Not Displaying in Gallery
**Problem:** Uploaded images showed broken image icons instead of the actual photos.

**Root Cause:** Two issues:
1. **API Response Structure Mismatch** - Frontend expected `data.data.images` but API returned `data.data` as a raw array
2. **Private Storage URLs** - Supabase private bucket URLs require signed URLs for access

**Solution:**
- Fixed API response structure to return `{ data: { images: [...], pagination: {...} } }`
- Added `generateSignedUrl()` helper to create temporary 1-hour signed URLs
- Both list and single image endpoints now return `signedUrl` field

**Files Changed:**
- `apps/api/src/routes/images.ts` - Lines 94-107 (signed URL generation), 168-188 (response structure)

---

## New Features

### 2. New Image Filter System
**Previous:** All | Active | Archived tabs

**New:** All Images | Scanned | Not Scanned | Archived tabs

| Filter | Shows | Badge |
|--------|-------|-------|
| All Images | All non-archived images | Mixed |
| Scanned | Images with `lastScanned` set | "Protected" (green) |
| Not Scanned | Images without `lastScanned` | "Not Scanned" (amber) |
| Archived | Archived images | "Archived" (gray) |

**Backend Changes:**
- Changed query parameter from `status` to `filter`
- Filter values: `all`, `scanned`, `not_scanned`, `archived`
- `all` now shows all non-archived images (was showing only ACTIVE)

**Frontend Changes:**
- Updated filter tabs with new labels and icons
- Badge now displays based on `lastScanned` status (not just `status` field)
- Uses amber color for "Not Scanned" badge

**Files Changed:**
- `apps/api/src/routes/images.ts` - Lines 112-154 (filter logic)
- `apps/web/src/pages/ProtectedImages.tsx` - Lines 10, 94-119, 192-220
- `apps/web/src/hooks/useImages.ts` - Updated to use `filter` parameter

### 3. Archive Timestamp Tracking
**Purpose:** Support 7-day auto-deletion of archived images

**Changes:**
- Added `archivedAt` field to `ProtectedImage` model
- DELETE endpoint now sets both `status: 'ARCHIVED'` and `archivedAt: new Date()`

**Files Changed:**
- `apps/api/prisma/schema.prisma` - Added `archivedAt DateTime?` field
- `apps/api/src/routes/images.ts` - Lines 237-242

### 4. Placeholder Pages
Added placeholder pages for navigation completeness:

- `/alerts` - Alerts page
- `/protection-plan` - Protection Plan page
- `/settings` - Settings page

**Files Created:**
- `apps/web/src/pages/Alerts.tsx`
- `apps/web/src/pages/ProtectionPlan.tsx`
- `apps/web/src/pages/Settings.tsx`

**Files Changed:**
- `apps/web/src/App.tsx` - Added imports and routes (lines 11-13, 54-56)

---

## Database Migrations

### Migration: add_archived_at_to_protected_images
```sql
ALTER TABLE "ProtectedImage" ADD COLUMN "archivedAt" TIMESTAMP(3);
```

Run with: `pnpm db:push` or `cd apps/api && npx prisma db push`

---

## API Changes

### GET /api/v1/images
**Query Parameters Changed:**
- Removed: `status` (ACTIVE | ARCHIVED)
- Added: `filter` (all | scanned | not_scanned | archived)

**Response Structure Changed:**
```typescript
// Before
{ data: ProtectedImage[], meta: { pagination } }

// After
{ data: { images: ProtectedImageWithSignedUrl[], pagination } }
```

**New Field in Response:**
```typescript
interface ProtectedImageWithSignedUrl extends ProtectedImage {
  signedUrl: string | null; // Temporary URL valid for 1 hour
}
```

### GET /api/v1/images/:id
**Response Structure Changed:**
- Now includes `signedUrl` field

### DELETE /api/v1/images/:id
**Behavior Changed:**
- Now sets `archivedAt` timestamp alongside `status: 'ARCHIVED'`

---

## Running the Application

Both servers run from the project root with a single command:

```bash
pnpm dev
```

This uses Turborepo to run both `apps/api` and `apps/web` in parallel.

---

## Future Work (TODO)

- [ ] Implement scheduled job to auto-delete images 7+ days after archiving
- [ ] Add signed URL refresh mechanism for long sessions
- [ ] Implement actual image scanning functionality to set `lastScanned`
