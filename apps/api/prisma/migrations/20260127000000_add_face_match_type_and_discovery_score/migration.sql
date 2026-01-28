-- AlterEnum: Add FACE_MATCH to ImageMatchType
ALTER TYPE "ImageMatchType" ADD VALUE 'FACE_MATCH';

-- AlterTable: Add discoveryScore to image_matches
ALTER TABLE "image_matches" ADD COLUMN "discoveryScore" DOUBLE PRECISION;
