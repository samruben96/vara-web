import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paginationSchema } from '@vara/shared';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { createAlertFromMatch } from '../utils/alert-creator';
import type { ImageMatchType } from '../generated/prisma/client.js';

/**
 * Match Review Routes
 *
 * Handles manual review workflow for flagged image matches.
 * Low-confidence matches are flagged for user review to confirm or dismiss.
 */

/**
 * Error codes for match review operations
 */
const MATCH_ERROR_CODES = {
  NOT_FOUND: 'MATCH_NOT_FOUND',
  UNAUTHORIZED: 'MATCH_UNAUTHORIZED',
  INVALID_STATUS: 'MATCH_INVALID_STATUS',
  ALREADY_REVIEWED: 'MATCH_ALREADY_REVIEWED',
} as const;

/**
 * Zod schema for validating route parameters with UUID id
 */
const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * Review status values for matches
 */
const REVIEW_STATUS = {
  ACTIVE: 'ACTIVE',
  FLAGGED_FOR_REVIEW: 'FLAGGED_FOR_REVIEW',
  CONFIRMED: 'CONFIRMED',
  DISMISSED: 'DISMISSED',
} as const;

export async function matchRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/matches/flagged
   *
   * Returns all matches with reviewStatus = 'FLAGGED_FOR_REVIEW' for the authenticated user.
   * Includes related protected image data for context.
   *
   * Query params:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 10)
   *
   * Response: { data: ImageMatch[], meta: { pagination: {...} } }
   */
  app.get('/flagged', { preHandler: [requireAuth] }, async (request, reply) => {
    const { page, limit } = paginationSchema.parse(request.query);
    const userId = request.user!.id;

    // Find flagged matches for images belonging to the authenticated user
    const [matches, total] = await Promise.all([
      prisma.imageMatch.findMany({
        where: {
          reviewStatus: REVIEW_STATUS.FLAGGED_FOR_REVIEW,
          protectedImage: {
            userId,
          },
        },
        include: {
          protectedImage: {
            select: {
              id: true,
              storageUrl: true,
              uploadedAt: true,
              status: true,
              faceDetected: true,
            },
          },
        },
        orderBy: { detectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imageMatch.count({
        where: {
          reviewStatus: REVIEW_STATUS.FLAGGED_FOR_REVIEW,
          protectedImage: {
            userId,
          },
        },
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

  /**
   * POST /api/v1/matches/:id/confirm
   *
   * Confirms a flagged match as a real/valid match.
   * - Updates reviewStatus to 'CONFIRMED'
   * - Sets reviewedAt timestamp
   * - Sets reviewedBy to the current user's ID
   * - Creates an alert for the confirmed match
   *
   * Response: { data: { match: ImageMatch, alert: Alert } }
   */
  app.post('/:id/confirm', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const userId = request.user!.id;

    // Fetch the match with its protected image to verify ownership
    const match = await prisma.imageMatch.findUnique({
      where: { id },
      include: {
        protectedImage: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!match) {
      throw new AppError(404, MATCH_ERROR_CODES.NOT_FOUND, 'Match not found');
    }

    // Verify the match belongs to the authenticated user
    if (match.protectedImage.userId !== userId) {
      throw new AppError(403, MATCH_ERROR_CODES.UNAUTHORIZED, 'You do not have permission to review this match');
    }

    // Verify the match is in FLAGGED_FOR_REVIEW status
    if (match.reviewStatus !== REVIEW_STATUS.FLAGGED_FOR_REVIEW) {
      if (match.reviewStatus === REVIEW_STATUS.CONFIRMED || match.reviewStatus === REVIEW_STATUS.DISMISSED) {
        throw new AppError(
          409,
          MATCH_ERROR_CODES.ALREADY_REVIEWED,
          `This match has already been reviewed and ${match.reviewStatus.toLowerCase()}`
        );
      }
      throw new AppError(
        400,
        MATCH_ERROR_CODES.INVALID_STATUS,
        'Only flagged matches can be confirmed. This match is not flagged for review.'
      );
    }

    // Update the match status
    const updatedMatch = await prisma.imageMatch.update({
      where: { id },
      data: {
        reviewStatus: REVIEW_STATUS.CONFIRMED,
        reviewedAt: new Date(),
        reviewedBy: userId,
        // Also update the main status to REVIEWED to indicate action was taken
        status: 'REVIEWED',
      },
      include: {
        protectedImage: {
          select: {
            id: true,
            storageUrl: true,
            uploadedAt: true,
            status: true,
          },
        },
      },
    });

    // Create an alert for the confirmed match
    // Map confidence string to faceConfidence level
    let faceConfidenceLevel: 'high' | 'medium' | 'low' | undefined;
    if (match.confidence === 'HIGH') {
      faceConfidenceLevel = 'high';
    } else if (match.confidence === 'MEDIUM_HIGH' || match.confidence === 'MEDIUM') {
      faceConfidenceLevel = 'medium';
    } else if (match.confidence === 'LOW') {
      faceConfidenceLevel = 'low';
    }

    await createAlertFromMatch(userId, {
      id: match.id,
      protectedImageId: match.protectedImageId,
      sourceUrl: match.sourceUrl,
      platform: match.platform,
      similarity: match.similarity,
      matchType: match.matchType as ImageMatchType,
      confidence: match.confidence as 'HIGH' | 'MEDIUM_HIGH' | 'MEDIUM' | 'LOW' | undefined,
      faceVerified: match.faceVerified as 'VERIFIED' | 'NO_FACE_DETECTED' | 'MISMATCH' | undefined,
      faceSimilarity: match.clipSimilarity ?? undefined,
      faceConfidence: faceConfidenceLevel,
    });

    // Fetch the created alert (most recent alert for this match)
    const alert = await prisma.alert.findFirst({
      where: {
        userId,
        metadata: {
          path: ['matchId'],
          equals: match.id,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    request.log.info(
      { matchId: id, userId, alertId: alert?.id },
      'Match confirmed and alert created'
    );

    return reply.send({
      data: {
        match: updatedMatch,
        alert,
      },
    });
  });

  /**
   * POST /api/v1/matches/:id/dismiss
   *
   * Dismisses a flagged match as a false positive.
   * - Updates reviewStatus to 'DISMISSED'
   * - Sets reviewedAt timestamp
   * - Sets reviewedBy to the current user's ID
   * - Does NOT create an alert
   *
   * Response: { data: ImageMatch }
   */
  app.post('/:id/dismiss', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const userId = request.user!.id;

    // Fetch the match with its protected image to verify ownership
    const match = await prisma.imageMatch.findUnique({
      where: { id },
      include: {
        protectedImage: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!match) {
      throw new AppError(404, MATCH_ERROR_CODES.NOT_FOUND, 'Match not found');
    }

    // Verify the match belongs to the authenticated user
    if (match.protectedImage.userId !== userId) {
      throw new AppError(403, MATCH_ERROR_CODES.UNAUTHORIZED, 'You do not have permission to review this match');
    }

    // Verify the match is in FLAGGED_FOR_REVIEW status
    if (match.reviewStatus !== REVIEW_STATUS.FLAGGED_FOR_REVIEW) {
      if (match.reviewStatus === REVIEW_STATUS.CONFIRMED || match.reviewStatus === REVIEW_STATUS.DISMISSED) {
        throw new AppError(
          409,
          MATCH_ERROR_CODES.ALREADY_REVIEWED,
          `This match has already been reviewed and ${match.reviewStatus.toLowerCase()}`
        );
      }
      throw new AppError(
        400,
        MATCH_ERROR_CODES.INVALID_STATUS,
        'Only flagged matches can be dismissed. This match is not flagged for review.'
      );
    }

    // Update the match status
    const updatedMatch = await prisma.imageMatch.update({
      where: { id },
      data: {
        reviewStatus: REVIEW_STATUS.DISMISSED,
        reviewedAt: new Date(),
        reviewedBy: userId,
        // Also update the main status to DISMISSED
        status: 'DISMISSED',
      },
      include: {
        protectedImage: {
          select: {
            id: true,
            storageUrl: true,
            uploadedAt: true,
            status: true,
          },
        },
      },
    });

    request.log.info({ matchId: id, userId }, 'Match dismissed as false positive');

    return reply.send({
      data: updatedMatch,
    });
  });
}
