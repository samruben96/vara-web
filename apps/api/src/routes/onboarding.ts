import type { FastifyInstance } from 'fastify';
import { submitOnboardingSchema } from '@vara/shared';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/auth';
import {
  generateProtectionPlan,
  getPlanFocusAreas,
} from '../services/protectionPlanGenerator';

// Onboarding questions (matching frontend question IDs for consistency)
const ONBOARDING_QUESTIONS = [
  {
    id: 'online-presence',
    question: 'How would you describe your online presence?',
    description: 'This helps us understand your visibility and potential exposure.',
    type: 'SINGLE_CHOICE' as const,
    options: [
      { value: 'minimal', label: 'Minimal', riskWeight: 1 },
      { value: 'moderate', label: 'Moderate', riskWeight: 2 },
      { value: 'active', label: 'Active', riskWeight: 3 },
      { value: 'public-figure', label: 'Public Figure', riskWeight: 4 },
    ],
    order: 1,
    conditionalOn: null,
  },
  {
    id: 'harassment-experience',
    question: 'Have you experienced online harassment?',
    description: 'Your answer helps us prioritize the right protections.',
    type: 'SINGLE_CHOICE' as const,
    options: [
      { value: 'never', label: 'Never', riskWeight: 1 },
      { value: 'rarely', label: 'Rarely', riskWeight: 2 },
      { value: 'sometimes', label: 'Sometimes', riskWeight: 3 },
      { value: 'frequently', label: 'Frequently', riskWeight: 4 },
    ],
    order: 2,
    conditionalOn: null,
  },
  {
    id: 'threat-concerns',
    question: 'What concerns you most about online safety?',
    description: 'Select all that apply to you.',
    type: 'MULTIPLE_CHOICE' as const,
    options: [
      { value: 'harassment', label: 'Harassment', riskWeight: 1 },
      { value: 'stalking', label: 'Stalking', riskWeight: 2 },
      { value: 'impersonation', label: 'Impersonation', riskWeight: 2 },
      { value: 'image-misuse', label: 'Image Misuse', riskWeight: 3 },
      { value: 'deepfakes', label: 'Deepfakes', riskWeight: 4 },
      { value: 'doxxing', label: 'Doxxing', riskWeight: 3 },
    ],
    order: 3,
    conditionalOn: null,
  },
  {
    id: 'photo-sharing',
    question: 'How often do you share photos of yourself online?',
    description: 'This helps us understand your image protection needs.',
    type: 'SINGLE_CHOICE' as const,
    options: [
      { value: 'never', label: 'Never', riskWeight: 1 },
      { value: 'rarely', label: 'Rarely', riskWeight: 2 },
      { value: 'sometimes', label: 'Sometimes', riskWeight: 3 },
      { value: 'frequently', label: 'Frequently', riskWeight: 4 },
    ],
    order: 4,
    conditionalOn: null,
  },
  {
    id: 'relationship-concerns',
    question: 'Are there relationship situations affecting your safety?',
    description: 'Your privacy is protected. This helps us recommend appropriate measures.',
    type: 'SINGLE_CHOICE' as const,
    options: [
      { value: 'no-concerns', label: 'No concerns', riskWeight: 1 },
      { value: 'past-concerns', label: 'Past concerns', riskWeight: 2 },
      { value: 'current-mild', label: 'Some concerns', riskWeight: 3 },
      { value: 'current-serious', label: 'Serious concerns', riskWeight: 4 },
    ],
    order: 5,
    conditionalOn: null,
  },
  {
    id: 'platform-count',
    question: 'How many social platforms do you actively use?',
    description: 'More platforms means more areas to protect.',
    type: 'SINGLE_CHOICE' as const,
    options: [
      { value: '1', label: '1', riskWeight: 1 },
      { value: '2-3', label: '2-3', riskWeight: 2 },
      { value: '4-5', label: '4-5', riskWeight: 3 },
      { value: '6+', label: '6+', riskWeight: 4 },
    ],
    order: 6,
    conditionalOn: null,
  },
  {
    id: 'unauthorized-use',
    question: 'Have your photos ever been used without your permission?',
    description: 'This helps us prioritize image monitoring for you.',
    type: 'SINGLE_CHOICE' as const,
    options: [
      { value: 'no', label: 'No, not that I know of', riskWeight: 1 },
      { value: 'unsure', label: "I'm not sure", riskWeight: 2 },
      { value: 'yes-minor', label: 'Yes, minor incident', riskWeight: 3 },
      { value: 'yes-serious', label: 'Yes, serious incident', riskWeight: 4 },
    ],
    order: 7,
    conditionalOn: null,
  },
  {
    id: 'safety-priority',
    question: "What's most important to you right now?",
    description: 'This helps us prioritize your protection plan.',
    type: 'SINGLE_CHOICE' as const,
    options: [
      { value: 'privacy', label: 'Protecting my privacy', riskWeight: 1 },
      { value: 'images', label: 'Protecting my images', riskWeight: 2 },
      { value: 'harassment', label: 'Stopping harassment', riskWeight: 3 },
      { value: 'monitoring', label: 'Knowing if something happens', riskWeight: 4 },
    ],
    order: 8,
    conditionalOn: null,
  },
];

function calculateRiskLevel(responses: Array<{ questionId: string; response: unknown }>): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  let totalWeight = 0;
  let maxPossibleWeight = 0;

  for (const resp of responses) {
    const question = ONBOARDING_QUESTIONS.find((q) => q.id === resp.questionId);
    if (!question?.options) continue;

    if (Array.isArray(resp.response)) {
      // Multiple choice
      for (const value of resp.response) {
        const option = question.options.find((o) => o.value === value);
        if (option) totalWeight += option.riskWeight || 0;
      }
      maxPossibleWeight += question.options.length * 4;
    } else {
      // Single choice
      const option = question.options.find((o) => o.value === resp.response);
      if (option) totalWeight += option.riskWeight || 0;
      maxPossibleWeight += 4;
    }
  }

  const riskScore = totalWeight / maxPossibleWeight;

  if (riskScore >= 0.75) return 'CRITICAL';
  if (riskScore >= 0.5) return 'HIGH';
  if (riskScore >= 0.25) return 'MEDIUM';
  return 'LOW';
}

export async function onboardingRoutes(app: FastifyInstance) {
  // Get onboarding questions
  app.get('/questions', { preHandler: [requireAuth] }, async (_request, reply) => {
    return reply.send({
      data: ONBOARDING_QUESTIONS,
    });
  });

  // Submit onboarding responses
  app.post('/responses', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = submitOnboardingSchema.parse(request.body);
    const userId = request.user!.id;

    // Save responses
    await prisma.onboardingResponse.createMany({
      data: body.responses.map((r) => ({
        userId,
        questionId: r.questionId,
        response: r.response,
      })),
    });

    // Calculate risk level
    const riskLevel = calculateRiskLevel(body.responses);

    // Update user profile
    await prisma.userProfile.update({
      where: { userId },
      data: {
        riskLevel,
        onboardingCompleted: true,
      },
    });

    // Generate personalized protection plan items based on responses
    const planItems = generateProtectionPlan(body.responses, riskLevel);

    // Create the protection plan with personalized items
    const plan = await prisma.protectionPlan.create({
      data: {
        userId,
        items: {
          create: planItems,
        },
      },
      include: {
        items: {
          orderBy: { priority: 'asc' },
        },
      },
    });

    // Get focus areas for the response
    const focusAreas = getPlanFocusAreas(planItems);

    return reply.status(201).send({
      data: {
        riskLevel,
        protectionPlan: plan,
        focusAreas,
      },
    });
  });

  // Get onboarding results (for users who already completed)
  app.get('/results', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user!.id;

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    const responses = await prisma.onboardingResponse.findMany({
      where: { userId },
    });

    return reply.send({
      data: {
        completed: profile?.onboardingCompleted ?? false,
        riskLevel: profile?.riskLevel,
        responses,
      },
    });
  });
}
