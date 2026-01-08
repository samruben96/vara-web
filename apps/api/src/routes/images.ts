import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { z } from 'zod';
import { paginationSchema } from '@vara/shared';
import { prisma } from '../config/prisma';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';

// Allowed MIME types for image uploads
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Maximum file size in bytes (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Supabase Storage bucket name
const STORAGE_BUCKET = 'protected-images';

/**
 * Validates the uploaded file meets requirements
 */
function validateFile(file: MultipartFile): void {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype as AllowedMimeType)) {
    throw new AppError(
      400,
      'INVALID_FILE_TYPE',
      `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    );
  }
}

/**
 * Generates a unique, secure filename for storage
 * Uses UUID to prevent URL guessing attacks
 */
function generateSecureFilename(mimetype: string): string {
  const uuid = crypto.randomUUID();
  const extension = getFileExtension(mimetype);
  return `${uuid}${extension}`;
}

/**
 * Gets file extension from MIME type
 */
function getFileExtension(mimetype: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return extensions[mimetype] || '.bin';
}

/**
 * Ensures the storage bucket exists, creating it if necessary
 */
async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();

  const bucketExists = buckets?.some((bucket) => bucket.name === STORAGE_BUCKET);

  if (!bucketExists) {
    const { error } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
      public: false, // Private bucket - images accessed via signed URLs
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    });

    if (error) {
      throw new AppError(500, 'STORAGE_ERROR', `Failed to create storage bucket: ${error.message}`);
    }
  }
}

/**
 * Extracts the storage path from a full storage URL
 * URL format: supabase_url/storage/v1/object/bucket/path
 */
function extractStoragePath(storageUrl: string): string | null {
  const prefix = `/storage/v1/object/${STORAGE_BUCKET}/`;
  const index = storageUrl.indexOf(prefix);
  if (index === -1) return null;
  return storageUrl.substring(index + prefix.length);
}

// Signed URL expiration time in seconds (1 hour)
const SIGNED_URL_EXPIRY = 3600;

/**
 * Generates a signed URL for accessing a protected image
 */
async function generateSignedUrl(
  storageUrl: string,
  logger?: { warn: (obj: object, msg: string) => void }
): Promise<string | null> {
  const path = extractStoragePath(storageUrl);
  if (!path) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error) {
    logger?.warn({ error, storageUrl }, 'Failed to generate signed URL');
    return null;
  }

  return data.signedUrl;
}

/**
 * Zod schema for validating image filter query parameter
 */
const imageFilterSchema = z.enum(['all', 'scanned', 'not_scanned', 'archived']).default('all');

/**
 * Zod schema for validating route parameters with UUID id
 */
const paramsSchema = z.object({ id: z.string().uuid() });

export async function imageRoutes(app: FastifyInstance) {
  // List protected images
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const { page, limit } = paginationSchema.parse(request.query);
    const query = request.query as Record<string, unknown>;
    const filter = imageFilterSchema.parse(query.filter);
    const userId = request.user!.id;

    // Build where clause based on filter
    type WhereClause = {
      userId: string;
      status?: 'ACTIVE' | 'ARCHIVED';
      NOT?: { status: 'ARCHIVED' };
      lastScanned?: null | { not: null };
    };

    let whereClause: WhereClause;

    switch (filter) {
      case 'archived':
        whereClause = { userId, status: 'ARCHIVED' };
        break;
      case 'scanned':
        whereClause = {
          userId,
          NOT: { status: 'ARCHIVED' },
          lastScanned: { not: null },
        };
        break;
      case 'not_scanned':
        whereClause = {
          userId,
          NOT: { status: 'ARCHIVED' },
          lastScanned: null,
        };
        break;
      case 'all':
      default:
        whereClause = { userId, NOT: { status: 'ARCHIVED' } };
        break;
    }

    const [images, total] = await Promise.all([
      prisma.protectedImage.findMany({
        where: whereClause,
        orderBy: { uploadedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.protectedImage.count({
        where: whereClause,
      }),
    ]);

    // Generate signed URLs for all images
    const imagesWithSignedUrls = await Promise.all(
      images.map(async (image) => {
        const signedUrl = await generateSignedUrl(image.storageUrl, request.log);
        return {
          ...image,
          signedUrl,
        };
      })
    );

    return reply.send({
      data: imagesWithSignedUrls,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });

  // Upload image to Supabase Storage
  app.post('/upload', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user!.id;

    // Get the uploaded file from multipart form data
    const file = await request.file();

    if (!file) {
      throw new AppError(400, 'NO_FILE_PROVIDED', 'No image file was provided in the request');
    }

    // Validate file type
    validateFile(file);

    // Read the file buffer
    const buffer = await file.toBuffer();

    // Validate file size (double-check in case multipart limit was bypassed)
    if (buffer.length > MAX_FILE_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Ensure the storage bucket exists
    await ensureBucketExists();

    // Generate a secure, unique filename
    // Files are stored in user-specific directories for organization
    const filename = generateSecureFilename(file.mimetype);
    const storagePath = `${userId}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.mimetype,
        upsert: false, // Don't overwrite existing files
      });

    if (uploadError) {
      request.log.error({ error: uploadError }, 'Failed to upload image to Supabase Storage');
      throw new AppError(500, 'UPLOAD_FAILED', `Failed to upload image: ${uploadError.message}`);
    }

    // Get the storage URL (private URL - will need signed URLs for access)
    // Format: supabase_url/storage/v1/object/bucket/path
    const storageUrl = `${env.SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`;

    // TODO: Future enhancements
    // 1. Generate CLIP embedding for image similarity search (requires OpenAI API)
    // 2. Compute perceptual hash for quick duplicate detection
    // 3. Perform virus scanning before storage
    // 4. Queue initial image scan job for misuse detection

    // Create database record
    const image = await prisma.protectedImage.create({
      data: {
        userId,
        storageUrl,
        status: 'ACTIVE',
        // embedding: null, // TODO: Generate CLIP embedding
        // hash: null, // TODO: Compute perceptual hash
      },
    });

    // Log successful upload
    request.log.info({ imageId: image.id, userId, storagePath }, 'Image uploaded successfully');

    return reply.status(201).send({
      data: image,
    });
  });

  // Get image details
  app.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const userId = request.user!.id;

    const image = await prisma.protectedImage.findFirst({
      where: { id, userId },
    });

    if (!image) {
      throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image not found');
    }

    // Generate signed URL for the image
    const signedUrl = await generateSignedUrl(image.storageUrl, request.log);

    return reply.send({
      data: {
        ...image,
        signedUrl,
      },
    });
  });

  // Delete image
  app.delete('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const userId = request.user!.id;

    // Get the image first to retrieve storageUrl for storage deletion
    const image = await prisma.protectedImage.findFirst({
      where: { id, userId },
      select: { storageUrl: true },
    });

    // Use atomic update to prevent race conditions
    // This ensures we only archive if the record exists and belongs to the user
    const result = await prisma.protectedImage.updateMany({
      where: { id, userId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image not found');
    }

    // Delete from Supabase Storage (after successful DB update)
    // We do this after the atomic update to ensure consistency
    if (image?.storageUrl) {
      const storagePath = extractStoragePath(image.storageUrl);
      if (storagePath) {
        const { error: deleteError } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .remove([storagePath]);

        if (deleteError) {
          // Log but don't fail the request - the file may not exist
          request.log.warn({ error: deleteError, storagePath }, 'Failed to delete image from storage');
        }
      }
    }

    request.log.info({ imageId: id, userId }, 'Image deleted successfully');

    return reply.status(204).send();
  });

  // Get matches for an image
  app.get('/:id/matches', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const { page, limit } = paginationSchema.parse(request.query);
    const userId = request.user!.id;

    // Verify image belongs to user
    const image = await prisma.protectedImage.findFirst({
      where: { id, userId },
    });

    if (!image) {
      throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image not found');
    }

    const [matches, total] = await Promise.all([
      prisma.imageMatch.findMany({
        where: { protectedImageId: id },
        orderBy: { detectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imageMatch.count({
        where: { protectedImageId: id },
      }),
    ]);

    return reply.send({
      data: matches,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });
}
