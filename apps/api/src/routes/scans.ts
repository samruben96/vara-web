import type { FastifyInstance } from 'fastify';
import { paginationSchema, triggerScanSchema } from '@vara/shared';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { addImageScanJob, addProfileScanJob, addBreachCheckJob, getQueueStats } from '../queues';
import { getActiveWorkers } from '../workers/init';

export async function scanRoutes(app: FastifyInstance) {
  // List scan jobs
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const { page, limit } = paginationSchema.parse(request.query);
    const userId = request.user!.id;

    const [scans, total] = await Promise.all([
      prisma.scanJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.scanJob.count({
        where: { userId },
      }),
    ]);

    return reply.send({
      data: scans,
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

  // Trigger a new scan
  app.post('/trigger', { preHandler: [requireAuth] }, async (request, reply) => {
    const { type, targetId } = triggerScanSchema.parse(request.body);
    const userId = request.user!.id;

    // Check for existing pending/running scan of same type
    const existingScan = await prisma.scanJob.findFirst({
      where: {
        userId,
        type,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (existingScan) {
      throw new AppError(
        409,
        'SCAN_ALREADY_RUNNING',
        'A scan of this type is already in progress'
      );
    }

    // If scanning specific image, verify it exists
    if (type === 'IMAGE_SCAN' && targetId) {
      const image = await prisma.protectedImage.findFirst({
        where: { id: targetId, userId, status: 'ACTIVE' },
      });

      if (!image) {
        throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image not found');
      }
    }

    // Create scan job
    const scan = await prisma.scanJob.create({
      data: {
        userId,
        type,
        status: 'PENDING',
        result: targetId ? { targetId } : undefined,
      },
    });

    // Add job to BullMQ queue based on scan type
    // Jobs will be processed by worker processes
    switch (type) {
      case 'IMAGE_SCAN':
        await addImageScanJob({
          scanJobId: scan.id,
          userId,
          targetId,
        });
        break;
      case 'PROFILE_SCAN':
        await addProfileScanJob({
          scanJobId: scan.id,
          userId,
          accountId: targetId,
        });
        break;
      case 'BREACH_CHECK': {
        // Get user email for breach check
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (user) {
          await addBreachCheckJob({
            scanJobId: scan.id,
            userId,
            email: user.email,
          });
        }
        break;
      }
      // BEHAVIORAL_ANALYSIS and FULL_SCAN not yet implemented
      default:
        request.log.warn({ type }, 'Scan type not yet implemented for queue processing');
    }

    return reply.status(202).send({
      data: scan,
    });
  });

  // Health check for workers and queues
  // This endpoint is public for monitoring systems
  // NOTE: Must be defined BEFORE /:id/status to avoid route conflicts
  app.get('/health', async (_request, reply) => {
    const workers = getActiveWorkers();
    const queueStats = await getQueueStats();

    const workerStatus = workers.map((worker) => ({
      name: worker.name,
      running: worker.isRunning(),
      paused: worker.isPaused(),
    }));

    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      workers: {
        count: workers.length,
        status: workerStatus,
        enabled: workers.length > 0,
      },
      queues: queueStats
        ? {
            enabled: true,
            stats: queueStats,
          }
        : {
            enabled: false,
            message: 'Queues disabled - REDIS_URL not configured',
          },
    };

    return reply.send({
      data: response,
    });
  });

  // Get scan status
  app.get('/:id/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const scan = await prisma.scanJob.findFirst({
      where: { id, userId },
    });

    if (!scan) {
      throw new AppError(404, 'SCAN_NOT_FOUND', 'Scan not found');
    }

    return reply.send({
      data: scan,
    });
  });
}
