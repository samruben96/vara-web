import { cn } from '../../lib/cn';

interface OnboardingProgressProps {
  current: number;
  total: number;
  className?: string;
}

/**
 * Progress indicator for onboarding quiz
 * Shows current step and a smooth progress bar
 */
export function OnboardingProgress({
  current,
  total,
  className,
}: OnboardingProgressProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-neutral-700">
          Step {current} of {total}
        </span>
        <span className="text-neutral-500">{Math.round(percentage)}% complete</span>
      </div>

      {/* Progress bar container */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        {/* Animated progress fill */}
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Step ${current} of ${total}`}
        />
      </div>

      {/* Step dots for visual reference */}
      <div className="flex justify-between px-1">
        {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={cn(
              'h-1.5 w-1.5 rounded-full transition-colors duration-300',
              step <= current ? 'bg-primary-500' : 'bg-neutral-300'
            )}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
