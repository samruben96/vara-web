import type { FastifyInstance } from 'fastify';
import { updateProfileSchema } from '@vara/shared';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';

export async function userRoutes(app: FastifyInstance) {
  // Get current user
  app.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: { profile: true },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    return reply.send({
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        profile: user.profile,
      },
    });
  });

  // Update current user profile
  app.patch('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = updateProfileSchema.parse(request.body);

    const profile = await prisma.userProfile.update({
      where: { userId: request.user!.id },
      data: {
        displayName: body.displayName,
      },
    });

    return reply.send({
      data: profile,
    });
  });

  // Delete current user account
  app.delete('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user!.id;

    // Delete all user data
    await prisma.$transaction([
      prisma.alert.deleteMany({ where: { userId } }),
      prisma.imageMatch.deleteMany({
        where: { protectedImage: { userId } },
      }),
      prisma.protectedImage.deleteMany({ where: { userId } }),
      prisma.onboardingResponse.deleteMany({ where: { userId } }),
      prisma.protectionPlanItem.deleteMany({
        where: { plan: { userId } },
      }),
      prisma.protectionPlan.deleteMany({ where: { userId } }),
      prisma.connectedAccount.deleteMany({ where: { userId } }),
      prisma.scanJob.deleteMany({ where: { userId } }),
      prisma.userProfile.delete({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return reply.status(204).send();
  });
}
