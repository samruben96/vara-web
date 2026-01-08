import { create } from 'zustand';
import type { OnboardingQuestion, RiskLevel, ProtectionPlan } from '@vara/shared';

export interface OnboardingResponses {
  [questionId: string]: string | string[];
}

interface OnboardingState {
  // Quiz state
  questions: OnboardingQuestion[];
  currentQuestionIndex: number;
  responses: OnboardingResponses;
  isLoading: boolean;

  // Results state
  riskLevel: RiskLevel | null;
  protectionPlan: ProtectionPlan | null;
  isSubmitting: boolean;

  // Actions
  setQuestions: (questions: OnboardingQuestion[]) => void;
  setResponse: (questionId: string, value: string | string[]) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  goToQuestion: (index: number) => void;
  setLoading: (loading: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setResults: (riskLevel: RiskLevel, protectionPlan: ProtectionPlan) => void;
  reset: () => void;

  // Computed helpers
  getCurrentQuestion: () => OnboardingQuestion | null;
  isFirstQuestion: () => boolean;
  isLastQuestion: () => boolean;
  getProgress: () => { current: number; total: number; percentage: number };
  canProceed: () => boolean;
}

const initialState = {
  questions: [],
  currentQuestionIndex: 0,
  responses: {},
  isLoading: false,
  riskLevel: null,
  protectionPlan: null,
  isSubmitting: false,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialState,

  setQuestions: (questions) => set({ questions }),

  setResponse: (questionId, value) =>
    set((state) => ({
      responses: {
        ...state.responses,
        [questionId]: value,
      },
    })),

  nextQuestion: () =>
    set((state) => ({
      currentQuestionIndex: Math.min(
        state.currentQuestionIndex + 1,
        state.questions.length - 1
      ),
    })),

  previousQuestion: () =>
    set((state) => ({
      currentQuestionIndex: Math.max(state.currentQuestionIndex - 1, 0),
    })),

  goToQuestion: (index) =>
    set((state) => ({
      currentQuestionIndex: Math.max(
        0,
        Math.min(index, state.questions.length - 1)
      ),
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setSubmitting: (submitting) => set({ isSubmitting: submitting }),

  setResults: (riskLevel, protectionPlan) =>
    set({ riskLevel, protectionPlan }),

  reset: () => set(initialState),

  getCurrentQuestion: () => {
    const { questions, currentQuestionIndex } = get();
    return questions[currentQuestionIndex] || null;
  },

  isFirstQuestion: () => {
    const { currentQuestionIndex } = get();
    return currentQuestionIndex === 0;
  },

  isLastQuestion: () => {
    const { questions, currentQuestionIndex } = get();
    return currentQuestionIndex === questions.length - 1;
  },

  getProgress: () => {
    const { questions, currentQuestionIndex } = get();
    const total = questions.length;
    const current = currentQuestionIndex + 1;
    const percentage = total > 0 ? (current / total) * 100 : 0;
    return { current, total, percentage };
  },

  canProceed: () => {
    const { questions, currentQuestionIndex, responses } = get();
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return false;

    const response = responses[currentQuestion.id];
    if (!response) return false;

    // For multiple choice, ensure at least one option is selected
    if (Array.isArray(response)) {
      return response.length > 0;
    }

    // For single choice and scale, ensure a value is selected
    return response.length > 0;
  },
}));
