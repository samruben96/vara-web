import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  OnboardingQuestion,
  RiskLevel,
  ProtectionPlan,
  ApiResponse,
} from '@vara/shared';
import { api } from '../lib/api';
import { useOnboardingStore, type OnboardingResponses } from '../stores/onboardingStore';

// Query keys for caching
export const onboardingKeys = {
  all: ['onboarding'] as const,
  questions: () => [...onboardingKeys.all, 'questions'] as const,
  results: () => [...onboardingKeys.all, 'results'] as const,
};

// API response types
interface OnboardingResultsResponse {
  riskLevel: RiskLevel;
  protectionPlan: ProtectionPlan;
}

// Static questions data (matching the requirements)
const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'online-presence',
    question: 'How would you describe your online presence?',
    description: 'This helps us understand your visibility and potential exposure.',
    type: 'SINGLE_CHOICE',
    order: 1,
    conditionalOn: null,
    options: [
      {
        value: 'minimal',
        label: 'Minimal',
        description: 'I rarely use social media or share online',
        riskWeight: 1,
      },
      {
        value: 'moderate',
        label: 'Moderate',
        description: 'I have a few accounts and share occasionally',
        riskWeight: 2,
      },
      {
        value: 'active',
        label: 'Active',
        description: 'I regularly post and engage on multiple platforms',
        riskWeight: 3,
      },
      {
        value: 'public-figure',
        label: 'Public Figure',
        description: 'I have a significant following or public presence',
        riskWeight: 4,
      },
    ],
  },
  {
    id: 'harassment-experience',
    question: 'Have you experienced online harassment?',
    description: 'Your answer helps us prioritize the right protections.',
    type: 'SINGLE_CHOICE',
    order: 2,
    conditionalOn: null,
    options: [
      {
        value: 'never',
        label: 'Never',
        description: 'I have not experienced online harassment',
        riskWeight: 1,
      },
      {
        value: 'rarely',
        label: 'Rarely',
        description: 'Once or twice, minor incidents',
        riskWeight: 2,
      },
      {
        value: 'sometimes',
        label: 'Sometimes',
        description: 'Occasional unwanted contact or comments',
        riskWeight: 3,
      },
      {
        value: 'frequently',
        label: 'Frequently',
        description: 'Regular or ongoing harassment',
        riskWeight: 4,
      },
    ],
  },
  {
    id: 'threat-concerns',
    question: 'What concerns you most about online safety?',
    description: 'Select all that apply to you.',
    type: 'MULTIPLE_CHOICE',
    order: 3,
    conditionalOn: null,
    options: [
      {
        value: 'harassment',
        label: 'Harassment',
        description: 'Unwanted messages, comments, or contact',
      },
      {
        value: 'stalking',
        label: 'Stalking',
        description: 'Someone monitoring or following my activity',
      },
      {
        value: 'impersonation',
        label: 'Impersonation',
        description: 'Fake accounts pretending to be me',
      },
      {
        value: 'image-misuse',
        label: 'Image Misuse',
        description: 'My photos being shared without consent',
      },
      {
        value: 'deepfakes',
        label: 'Deepfakes',
        description: 'AI-generated fake images or videos of me',
      },
      {
        value: 'doxxing',
        label: 'Doxxing',
        description: 'My personal information being exposed',
      },
    ],
  },
  {
    id: 'photo-sharing',
    question: 'How often do you share photos of yourself online?',
    description: 'This helps us understand your image protection needs.',
    type: 'SINGLE_CHOICE',
    order: 4,
    conditionalOn: null,
    options: [
      {
        value: 'never',
        label: 'Never',
        description: 'I don\'t share photos of myself',
        riskWeight: 1,
      },
      {
        value: 'rarely',
        label: 'Rarely',
        description: 'Only with close friends/family',
        riskWeight: 2,
      },
      {
        value: 'sometimes',
        label: 'Sometimes',
        description: 'Occasional posts on social media',
        riskWeight: 3,
      },
      {
        value: 'frequently',
        label: 'Frequently',
        description: 'Regular photo sharing publicly',
        riskWeight: 4,
      },
    ],
  },
  {
    id: 'relationship-concerns',
    question: 'Are there relationship situations affecting your safety?',
    description: 'Your privacy is protected. This helps us recommend appropriate measures.',
    type: 'SINGLE_CHOICE',
    order: 5,
    conditionalOn: null,
    options: [
      {
        value: 'no-concerns',
        label: 'No concerns',
        description: 'I feel safe in my relationships',
        riskWeight: 1,
      },
      {
        value: 'past-concerns',
        label: 'Past concerns',
        description: 'Previous relationship issues, now resolved',
        riskWeight: 2,
      },
      {
        value: 'current-mild',
        label: 'Some concerns',
        description: 'Current relationship with some worries',
        riskWeight: 3,
      },
      {
        value: 'current-serious',
        label: 'Serious concerns',
        description: 'Active safety concerns from a relationship',
        riskWeight: 4,
      },
    ],
  },
  {
    id: 'platform-count',
    question: 'How many social platforms do you actively use?',
    description: 'More platforms means more areas to protect.',
    type: 'SCALE',
    order: 6,
    conditionalOn: null,
    options: [
      { value: '1', label: '1', description: 'One platform' },
      { value: '2-3', label: '2-3', description: 'A few platforms' },
      { value: '4-5', label: '4-5', description: 'Several platforms' },
      { value: '6+', label: '6+', description: 'Many platforms' },
    ],
  },
  {
    id: 'unauthorized-use',
    question: 'Have your photos ever been used without your permission?',
    description: 'This helps us prioritize image monitoring for you.',
    type: 'SINGLE_CHOICE',
    order: 7,
    conditionalOn: null,
    options: [
      {
        value: 'no',
        label: 'No, not that I know of',
        riskWeight: 1,
      },
      {
        value: 'unsure',
        label: 'I\'m not sure',
        description: 'I haven\'t checked',
        riskWeight: 2,
      },
      {
        value: 'yes-minor',
        label: 'Yes, minor incident',
        description: 'Photo was reposted without credit',
        riskWeight: 3,
      },
      {
        value: 'yes-serious',
        label: 'Yes, serious incident',
        description: 'Photo was misused in a harmful way',
        riskWeight: 4,
      },
    ],
  },
  {
    id: 'safety-priority',
    question: 'What\'s most important to you right now?',
    description: 'This helps us prioritize your protection plan.',
    type: 'SINGLE_CHOICE',
    order: 8,
    conditionalOn: null,
    options: [
      {
        value: 'privacy',
        label: 'Protecting my privacy',
        description: 'Keeping my personal information secure',
      },
      {
        value: 'images',
        label: 'Protecting my images',
        description: 'Preventing photo misuse',
      },
      {
        value: 'harassment',
        label: 'Stopping harassment',
        description: 'Dealing with unwanted contact',
      },
      {
        value: 'monitoring',
        label: 'Knowing if something happens',
        description: 'Being alerted to potential threats',
      },
    ],
  },
];

/**
 * Fetch onboarding questions
 * Uses static data for now, can be replaced with API call
 */
export function useOnboardingQuestions() {
  return useQuery<ApiResponse<OnboardingQuestion[]>>({
    queryKey: onboardingKeys.questions(),
    queryFn: async () => {
      // For now, return static questions
      // In production: return api.get('/onboarding/questions');
      return {
        data: ONBOARDING_QUESTIONS,
      };
    },
    staleTime: Infinity, // Questions don't change often
  });
}

/**
 * Transform frontend responses format to backend API format
 * Frontend: { 'question-id': 'value' | ['value1', 'value2'] }
 * Backend: { responses: [{ questionId: 'question-id', response: 'value' }] }
 */
function transformResponsesToApiFormat(responses: OnboardingResponses) {
  return {
    responses: Object.entries(responses).map(([questionId, response]) => ({
      questionId,
      response,
    })),
  };
}

/**
 * Submit onboarding responses and get results
 */
export function useSubmitOnboarding() {
  const queryClient = useQueryClient();
  const { setResults, setSubmitting } = useOnboardingStore();

  return useMutation<OnboardingResultsResponse, Error, OnboardingResponses>({
    mutationFn: async (responses) => {
      setSubmitting(true);

      try {
        // Transform responses to the format the backend expects
        const apiPayload = transformResponsesToApiFormat(responses);

        // Submit to the backend API
        const response = await api.post<OnboardingResultsResponse>(
          '/api/v1/onboarding/responses',
          apiPayload
        );

        return response.data;
      } finally {
        setSubmitting(false);
      }
    },
    onSuccess: (data) => {
      setResults(data.riskLevel, data.protectionPlan);
      queryClient.invalidateQueries({ queryKey: onboardingKeys.results() });
    },
  });
}

// Note: Risk level calculation and protection plan generation
// are now handled server-side in the backend API at /api/v1/onboarding/responses
