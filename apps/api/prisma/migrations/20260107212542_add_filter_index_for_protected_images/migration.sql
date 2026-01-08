-- CreateIndex
-- This composite index optimizes filter queries for protected images:
-- - 'scanned': WHERE userId AND status != ARCHIVED AND lastScanned IS NOT NULL
-- - 'not_scanned': WHERE userId AND status != ARCHIVED AND lastScanned IS NULL
CREATE INDEX "protected_images_userId_status_lastScanned_idx" ON "protected_images"("userId", "status", "lastScanned");
