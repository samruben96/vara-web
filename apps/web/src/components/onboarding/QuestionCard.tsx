import { useCallback } from 'react';
import type { OnboardingQuestion } from '@vara/shared';
import { cn } from '../../lib/cn';
import { OptionButton } from './OptionButton';

interface QuestionCardProps {
  question: OnboardingQuestion;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  className?: string;
}

/**
 * Displays a single onboarding question with appropriate input based on type
 * Supports single choice, multiple choice, and scale questions
 */
export function QuestionCard({
  question,
  value,
  onChange,
  className,
}: QuestionCardProps) {
  const handleSingleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
    },
    [onChange]
  );

  const handleMultiSelect = useCallback(
    (optionValue: string) => {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValues);
    },
    [value, onChange]
  );

  const isMultipleChoice = question.type === 'MULTIPLE_CHOICE';

  return (
    <div
      className={cn('animate-fade-in space-y-6', className)}
      role="group"
      aria-labelledby={`question-${question.id}`}
    >
      {/* Question header */}
      <div className="space-y-2">
        <h2
          id={`question-${question.id}`}
          className="text-xl font-semibold text-neutral-900 sm:text-2xl"
        >
          {question.question}
        </h2>
        {question.description && (
          <p className="text-neutral-600">{question.description}</p>
        )}
        {isMultipleChoice && (
          <p className="text-sm text-neutral-500">Select all that apply</p>
        )}
      </div>

      {/* Options */}
      {question.type === 'SINGLE_CHOICE' && question.options && (
        <div className="space-y-3" role="radiogroup">
          {question.options.map((option) => (
            <OptionButton
              key={option.value}
              label={option.label}
              description={option.description}
              selected={value === option.value}
              onClick={() => handleSingleSelect(option.value)}
              multiSelect={false}
            />
          ))}
        </div>
      )}

      {question.type === 'MULTIPLE_CHOICE' && question.options && (
        <div className="space-y-3" role="group">
          {question.options.map((option) => {
            const selectedValues = Array.isArray(value) ? value : [];
            return (
              <OptionButton
                key={option.value}
                label={option.label}
                description={option.description}
                selected={selectedValues.includes(option.value)}
                onClick={() => handleMultiSelect(option.value)}
                multiSelect={true}
              />
            );
          })}
        </div>
      )}

      {question.type === 'SCALE' && question.options && (
        <div className="space-y-4">
          {/* Scale buttons */}
          <div className="flex justify-between gap-2">
            {question.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSingleSelect(option.value)}
                className={cn(
                  'flex-1 rounded-lg border-2 py-3 text-center font-medium transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  value === option.value
                    ? 'border-primary-500 bg-primary-100 text-primary-700'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-300 hover:bg-neutral-50'
                )}
                role="radio"
                aria-checked={value === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* Scale labels */}
          {question.options.length > 0 && (
            <div className="flex justify-between px-1 text-xs text-neutral-500">
              <span>{question.options[0]?.description || 'Low'}</span>
              <span>
                {question.options[question.options.length - 1]?.description ||
                  'High'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
