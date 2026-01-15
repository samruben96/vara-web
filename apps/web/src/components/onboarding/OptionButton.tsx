import { forwardRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

interface OptionButtonProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  /** For multiple choice, show checkbox style instead of radio style */
  multiSelect?: boolean;
}

/**
 * Selectable option button with calming, supportive design
 * Used for quiz question options
 */
export const OptionButton = forwardRef<HTMLButtonElement, OptionButtonProps>(
  (
    {
      label,
      description,
      selected,
      onClick,
      disabled = false,
      className,
      multiSelect = false,
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'group relative w-full rounded-xl border-2 p-4 text-left transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          selected
            ? 'border-primary bg-primary-subtle'
            : 'border-border bg-card hover:border-primary/50 hover:bg-card-hover',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        role={multiSelect ? 'checkbox' : 'radio'}
        aria-checked={selected}
      >
        <div className="flex items-start gap-3">
          {/* Selection indicator */}
          <div
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-200',
              multiSelect ? 'rounded' : 'rounded-full',
              selected
                ? 'border-0 bg-primary'
                : 'border-2 border-border-strong bg-card group-hover:border-primary'
            )}
          >
            {selected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
          </div>

          {/* Label and description */}
          <div className="flex-1">
            <span
              className={cn(
                'block font-medium transition-colors duration-200',
                selected ? 'text-primary-active' : 'text-foreground'
              )}
            >
              {label}
            </span>
            {description && (
              <span
                className={cn(
                  'mt-1 block text-sm transition-colors duration-200',
                  selected ? 'text-primary' : 'text-foreground-muted'
                )}
              >
                {description}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }
);

OptionButton.displayName = 'OptionButton';
