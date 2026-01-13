import type { FastifyInstance } from 'fastify';
import { paginationSchema, updateAlertStatusSchema, alertActionSchema } from '@vara/shared';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';

export async function alertRoutes(app: FastifyInstance) {
  // List alerts
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const { page, limit } = paginationSchema.parse(request.query);
    const userId = request.user!.id;

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where: { userId },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.alert.count({
        where: { userId },
      }),
    ]);

    return reply.send({
      data: alerts,
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

  // Get alert details
  app.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const alert = await prisma.alert.findFirst({
      where: { id, userId },
    });

    if (!alert) {
      throw new AppError(404, 'ALERT_NOT_FOUND', 'Alert not found');
    }

    // Mark as viewed if first time viewing
    if (alert.status === 'NEW') {
      await prisma.alert.update({
        where: { id },
        data: { status: 'VIEWED', viewedAt: new Date() },
      });
    }

    return reply.send({
      data: alert,
    });
  });

  // Update alert status
  app.patch('/:id/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = updateAlertStatusSchema.parse(request.body);
    const userId = request.user!.id;

    const alert = await prisma.alert.findFirst({
      where: { id, userId },
    });

    if (!alert) {
      throw new AppError(404, 'ALERT_NOT_FOUND', 'Alert not found');
    }

    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: {
        status,
        viewedAt: status === 'VIEWED' && !alert.viewedAt ? new Date() : alert.viewedAt,
        actionedAt: status === 'ACTIONED' ? new Date() : alert.actionedAt,
      },
    });

    return reply.send({
      data: updatedAlert,
    });
  });

  // Clear all alerts
  app.delete('/all', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user!.id;

    const result = await prisma.alert.deleteMany({
      where: { userId },
    });

    return reply.send({
      data: {
        deleted: result.count,
        message: `Deleted ${result.count} alerts`,
      },
    });
  });

  // Take action on alert
  app.post('/:id/action', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { action, notes } = alertActionSchema.parse(request.body);
    const userId = request.user!.id;

    const alert = await prisma.alert.findFirst({
      where: { id, userId },
    });

    if (!alert) {
      throw new AppError(404, 'ALERT_NOT_FOUND', 'Alert not found');
    }

    // Record the action in metadata
    const metadata = {
      ...(alert.metadata as object || {}),
      action,
      actionNotes: notes,
      actionTakenAt: new Date().toISOString(),
    };

    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: {
        status: action === 'DISMISS' || action === 'MARK_SAFE' ? 'DISMISSED' : 'ACTIONED',
        actionedAt: new Date(),
        metadata,
      },
    });

    return reply.send({
      data: updatedAlert,
    });
  });
}
