-- Enhance Image Scanning Workflow
-- This migration adds fields and indexes to support:
-- 1. Job prioritization and progress tracking for scan jobs
-- 2. Worker assignment and retry logic for distributed processing
-- 3. Linking scan jobs to specific protected images
-- 4. Tracking first/last seen timestamps for image matches
-- 5. Preventing duplicate matches via unique constraint
-- 6. Scan and match counters on protected images

-- AlterTable: Add scanning workflow fields to image_matches
ALTER TABLE "image_matches" ADD COLUMN     "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "scanJobId" TEXT;

-- AlterTable: Add scan/match counters to protected_images
ALTER TABLE "protected_images" ADD COLUMN     "matchCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scanCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add priority, progress, retry, and worker fields to scan_jobs
ALTER TABLE "scan_jobs" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "protectedImageId" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workerId" TEXT;

-- CreateIndex: Index for finding image matches by scan job
CREATE INDEX "image_matches_scanJobId_idx" ON "image_matches"("scanJobId");

-- CreateIndex: Unique constraint to prevent duplicate matches for same image/source URL
CREATE UNIQUE INDEX "image_matches_protectedImageId_sourceUrl_key" ON "image_matches"("protectedImageId", "sourceUrl");

-- CreateIndex: Index for perceptual hash lookups on protected_images
CREATE INDEX "protected_images_hash_idx" ON "protected_images"("hash");

-- CreateIndex: Composite index for job queue queries (status, priority, creation order)
CREATE INDEX "scan_jobs_status_priority_createdAt_idx" ON "scan_jobs"("status", "priority", "createdAt");

-- CreateIndex: Index for finding scan jobs by protected image
CREATE INDEX "scan_jobs_protectedImageId_idx" ON "scan_jobs"("protectedImageId");

-- AddForeignKey: Link image matches to their discovering scan job
ALTER TABLE "image_matches" ADD CONSTRAINT "image_matches_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "scan_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Link scan jobs to the specific image being scanned
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_protectedImageId_fkey" FOREIGN KEY ("protectedImageId") REFERENCES "protected_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
