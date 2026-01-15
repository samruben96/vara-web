import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui';
import {
  OnboardingProgress,
  ProcessingAnimation,
  QuestionCard,
} from '../../components/onboarding';
import { useOnboardingStore } from '../../stores/onboardingStore';
import {
  useOnboardingQuestions,
  useSubmitOnboarding,
} from '../../hooks/useOnboarding';

/**
 * Main quiz page that cycles through onboarding questions
 * Handles navigation, progress, and submission
 */
export function Quiz() {
  const navigate = useNavigate();

  // Store state and actions
  const {
    responses,
    setQuestions,
    setResponse,
    nextQuestion,
    previousQuestion,
    getCurrentQuestion,
    isFirstQuestion,
    isLastQuestion,
    getProgress,
    canProceed,
  } = useOnboardingStore();

  // Fetch questions
  const { data: questionsData, isLoading: isLoadingQuestions } =
    useOnboardingQuestions();

  // Submit mutation
  const { mutate: submitOnboarding, isPending: isSubmitting } =
    useSubmitOnboarding();

  // Set questions when loaded
  useEffect(() => {
    if (questionsData?.data) {
      setQuestions(questionsData.data);
    }
  }, [questionsData, setQuestions]);

  const currentQuestion = getCurrentQuestion();
  const progress = getProgress();

  // Handle response change
  const handleResponseChange = useCallback(
    (value: string | string[]) => {
      if (currentQuestion) {
        setResponse(currentQuestion.id, value);
      }
    },
    [currentQuestion, setResponse]
  );

  // Handle next button click
  const handleNext = useCallback(() => {
    if (isLastQuestion()) {
      // Submit the quiz
      submitOnboarding(responses, {
        onSuccess: () => {
          navigate('/onboarding/results');
        },
      });
    } else {
      nextQuestion();
    }
  }, [isLastQuestion, nextQuestion, submitOnboarding, responses, navigate]);

  // Handle back button click
  const handleBack = useCallback(() => {
    if (isFirstQuestion()) {
      navigate('/onboarding');
    } else {
      previousQuestion();
    }
  }, [isFirstQuestion, navigate, previousQuestion]);

  // Loading state
  if (isLoadingQuestions) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-foreground-muted">Loading your questions...</p>
        </div>
      </div>
    );
  }

  // No questions state
  if (!currentQuestion) {
    return (
      <div className="text-center">
        <p className="text-foreground-muted">
          Unable to load questions. Please try again.
        </p>
        <Button
          variant="secondary"
          onClick={() => navigate('/onboarding')}
          className="mt-4"
        >
          Go back
        </Button>
      </div>
    );
  }

  const currentValue = responses[currentQuestion.id];

  return (
    <>
      {/* Processing animation overlay */}
      <ProcessingAnimation isVisible={isSubmitting} />

      <div className="animate-fade-in space-y-8">
        {/* Progress indicator */}
        <OnboardingProgress
          current={progress.current}
          total={progress.total}
        />

        {/* Question card with transition */}
        <div key={currentQuestion.id} className="min-h-[300px]">
          <QuestionCard
            question={currentQuestion}
            value={currentValue}
            onChange={handleResponseChange}
          />
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={isSubmitting}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isFirstQuestion() ? 'Back to intro' : 'Previous'}
            </span>
            <span className="sm:hidden">Back</span>
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed() || isSubmitting}
            isLoading={isSubmitting}
            className="gap-2"
          >
            <span>{isLastQuestion() ? 'See my plan' : 'Continue'}</span>
            {!isSubmitting && !isLastQuestion() && (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Skip option for non-required questions */}
        {!isLastQuestion() && (
          <div className="text-center">
            <button
              type="button"
              onClick={nextQuestion}
              className="text-sm text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Skip this question
            </button>
          </div>
        )}
      </div>
    </>
  );
}
