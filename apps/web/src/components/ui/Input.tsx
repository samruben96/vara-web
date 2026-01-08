import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="space-y-1.5 sm:space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            // Base styles - using 16px font to prevent iOS zoom on focus
            'w-full rounded-lg border bg-white px-4 py-3 sm:py-2.5',
            // Font size: 16px on mobile prevents iOS zoom, can be smaller on desktop
            'text-base sm:text-sm text-neutral-900',
            'placeholder:text-neutral-400',
            // Transition and focus styles
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2',
            // Touch-friendly minimum height
            'min-h-[48px] sm:min-h-[44px]',
            // Error vs normal state
            error
              ? 'border-alert-500 focus:border-alert-500 focus:ring-alert-500/20'
              : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500/20',
            className
          )}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-alert-600"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-sm text-neutral-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
