import type { FastifyInstance } from 'fastify';
import { updateProtectionPlanItemSchema } from '@vara/shared';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';

export async function protectionPlanRoutes(app: FastifyInstance) {
  // Get protection plan
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user!.id;

    const plan = await prisma.protectionPlan.findFirst({
      where: { userId },
      include: {
        items: {
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!plan) {
      // Create a default plan if none exists
      const newPlan = await prisma.protectionPlan.create({
        data: {
          userId,
          items: {
            create: [
              {
                category: 'Getting Started',
                title: 'Complete your safety assessment',
                description: 'Answer a few questions to help us understand your needs.',
                priority: 1,
                status: 'PENDING',
              },
            ],
          },
        },
        include: {
          items: true,
        },
      });

      return reply.send({
        data: newPlan,
      });
    }

    return reply.send({
      data: plan,
    });
  });

  // Update protection plan item
  app.patch('/items/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = updateProtectionPlanItemSchema.parse(request.body);
    const userId = request.user!.id;

    // Verify item belongs to user's plan
    const item = await prisma.protectionPlanItem.findFirst({
      where: {
        id,
        plan: { userId },
      },
    });

    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Protection plan item not found');
    }

    const updatedItem = await prisma.protectionPlanItem.update({
      where: { id },
      data: { status },
    });

    return reply.send({
      data: updatedItem,
    });
  });

  // Regenerate protection plan based on current data
  app.post('/regenerate', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user!.id;

    // Get user's current risk profile
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    // Get counts of various items
    const [imageCount, alertCount, _completedItemCount] = await Promise.all([
      prisma.protectedImage.count({
        where: { userId, status: 'ACTIVE' },
      }),
      prisma.alert.count({
        where: { userId, status: { in: ['NEW', 'VIEWED'] } },
      }),
      prisma.protectionPlanItem.count({
        where: { plan: { userId }, status: 'COMPLETED' },
      }),
    ]);

    // Generate new items based on current state
    const newItems = [];

    if (imageCount === 0) {
      newItems.push({
        category: 'Images',
        title: 'Upload photos to protect',
        description:
          'Add photos of yourself so we can monitor for unauthorized use across the web.',
        priority: 1,
        status: 'PENDING' as const,
      });
    }

    if (alertCount > 0) {
      newItems.push({
        category: 'Alerts',
        title: 'Review pending alerts',
        description: `You have ${alertCount} alert${alertCount > 1 ? 's' : ''} that need${alertCount === 1 ? 's' : ''} your attention.`,
        priority: 2,
        status: 'PENDING' as const,
      });
    }

    if (profile?.riskLevel === 'HIGH' || profile?.riskLevel === 'CRITICAL') {
      newItems.push({
        category: 'Privacy',
        title: 'Review privacy settings',
        description:
          'Based on your risk level, we recommend reviewing your social media privacy settings.',
        priority: 3,
        status: 'PENDING' as const,
      });
    }

    newItems.push({
      category: 'Monitoring',
      title: 'Enable continuous monitoring',
      description: 'Keep your protection active by running regular scans.',
      priority: 4,
      status: 'PENDING' as const,
    });

    // Delete existing pending items and create new ones
    const existingPlan = await prisma.protectionPlan.findFirst({
      where: { userId },
    });

    if (existingPlan) {
      await prisma.protectionPlanItem.deleteMany({
        where: {
          planId: existingPlan.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      await prisma.protectionPlanItem.createMany({
        data: newItems.map((item) => ({
          ...item,
          planId: existingPlan.id,
        })),
      });

      await prisma.protectionPlan.update({
        where: { id: existingPlan.id },
        data: { lastUpdated: new Date() },
      });

      const updatedPlan = await prisma.protectionPlan.findUnique({
        where: { id: existingPlan.id },
        include: { items: { orderBy: [{ priority: 'asc' }] } },
      });

      return reply.send({
        data: updatedPlan,
      });
    }

    // Create new plan if none exists
    const newPlan = await prisma.protectionPlan.create({
      data: {
        userId,
        items: { create: newItems },
      },
      include: { items: true },
    });

    return reply.send({
      data: newPlan,
    });
  });
}
