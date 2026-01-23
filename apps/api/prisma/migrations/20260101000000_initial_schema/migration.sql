-- Vara Initial Schema Migration
-- This migration creates all base tables and indexes for the Vara platform.
-- It consolidates the original db push and all incremental migrations.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'YOUTUBE', 'OTHER');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('IMAGE_MISUSE', 'FAKE_PROFILE', 'DATA_BREACH', 'SUSPICIOUS_FOLLOWER', 'BEHAVIORAL_CHANGE', 'DEEPFAKE_DETECTED', 'PROFILE_IMPERSONATION', 'FACE_MATCH');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NEW', 'VIEWED', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ImageMatchType" AS ENUM ('EXACT', 'SIMILAR', 'MODIFIED', 'DEEPFAKE');

-- CreateEnum
CREATE TYPE "ImageMatchStatus" AS ENUM ('NEW', 'REVIEWED', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScanJobType" AS ENUM ('IMAGE_SCAN', 'PROFILE_SCAN', 'BREACH_CHECK', 'BEHAVIORAL_ANALYSIS', 'FULL_SCAN');

-- CreateEnum
CREATE TYPE "ScanJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProtectionPlanItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_responses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "permissions" JSONB,
    "lastSynced" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protected_images" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "embedding" vector(512),
    "hash" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScanned" TIMESTAMP(3),
    "status" "ImageStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "faceEmbedding" vector(512),
    "faceDetected" BOOLEAN NOT NULL DEFAULT false,
    "faceConfidence" DOUBLE PRECISION,
    "faceMetadata" JSONB,

    CONSTRAINT "protected_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_matches" (
    "id" TEXT NOT NULL,
    "protectedImageId" TEXT NOT NULL,
    "scanJobId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "platform" TEXT,
    "similarity" DOUBLE PRECISION NOT NULL,
    "matchType" "ImageMatchType" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ImageMatchStatus" NOT NULL DEFAULT 'NEW',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "AlertStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "actionedAt" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protection_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protection_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protection_plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "status" "ProtectionPlanItemStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protection_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "protectedImageId" TEXT,
    "type" "ScanJobType" NOT NULL,
    "status" "ScanJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "workerId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_responses_userId_questionId_key" ON "onboarding_responses"("userId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "connected_accounts_userId_platform_key" ON "connected_accounts"("userId", "platform");

-- CreateIndex
CREATE INDEX "protected_images_userId_status_idx" ON "protected_images"("userId", "status");

-- CreateIndex
CREATE INDEX "protected_images_userId_status_lastScanned_idx" ON "protected_images"("userId", "status", "lastScanned");

-- CreateIndex
CREATE INDEX "protected_images_hash_idx" ON "protected_images"("hash");

-- CreateIndex
CREATE INDEX "protected_images_userId_faceDetected_idx" ON "protected_images"("userId", "faceDetected");

-- CreateIndex
CREATE INDEX "image_matches_protectedImageId_status_idx" ON "image_matches"("protectedImageId", "status");

-- CreateIndex
CREATE INDEX "image_matches_scanJobId_idx" ON "image_matches"("scanJobId");

-- CreateIndex
CREATE UNIQUE INDEX "image_matches_protectedImageId_sourceUrl_key" ON "image_matches"("protectedImageId", "sourceUrl");

-- CreateIndex
CREATE INDEX "alerts_userId_status_idx" ON "alerts"("userId", "status");

-- CreateIndex
CREATE INDEX "alerts_userId_createdAt_idx" ON "alerts"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "protection_plans_userId_key" ON "protection_plans"("userId");

-- CreateIndex
CREATE INDEX "protection_plan_items_planId_status_idx" ON "protection_plan_items"("planId", "status");

-- CreateIndex
CREATE INDEX "scan_jobs_userId_status_idx" ON "scan_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "scan_jobs_userId_createdAt_idx" ON "scan_jobs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "scan_jobs_status_priority_createdAt_idx" ON "scan_jobs"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "scan_jobs_protectedImageId_idx" ON "scan_jobs"("protectedImageId");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_responses" ADD CONSTRAINT "onboarding_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protected_images" ADD CONSTRAINT "protected_images_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_matches" ADD CONSTRAINT "image_matches_protectedImageId_fkey" FOREIGN KEY ("protectedImageId") REFERENCES "protected_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_matches" ADD CONSTRAINT "image_matches_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "scan_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protection_plans" ADD CONSTRAINT "protection_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protection_plan_items" ADD CONSTRAINT "protection_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "protection_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_protectedImageId_fkey" FOREIGN KEY ("protectedImageId") REFERENCES "protected_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: HNSW index for vector similarity search on image embeddings
CREATE INDEX IF NOT EXISTS "protected_images_embedding_idx"
ON "protected_images"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- CreateIndex: HNSW index for face embedding similarity search (partial index)
CREATE INDEX IF NOT EXISTS "protected_images_faceEmbedding_idx"
ON "protected_images"
USING hnsw ("faceEmbedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE "faceEmbedding" IS NOT NULL;
