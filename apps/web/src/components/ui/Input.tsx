import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  showPasswordToggle?: boolean;
}

/**
 * Input component using Vara's calming color system
 *
 * Design Philosophy:
 * - Soft cream backgrounds with subtle borders
 * - Lavender focus states for pleasant interaction
 * - Coral (not red) for error states - supportive, not alarming
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, id, showPasswordToggle, ...props }, ref) => {
    const inputId = id || props.name;
    const [showPassword, setShowPassword] = useState(false);

    const isPasswordField = type === 'password';
    const shouldShowToggle = isPasswordField && showPasswordToggle;
    const inputType = shouldShowToggle && showPassword ? 'text' : type;

    return (
      <div className="space-y-1.5 sm:space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={inputType}
            id={inputId}
            className={cn(
              // Base styles - using 16px font to prevent iOS zoom on focus
              'w-full rounded-lg border bg-card px-4 py-3 sm:py-2.5',
              // Font size: 16px on mobile prevents iOS zoom, can be smaller on desktop
              'text-base sm:text-sm text-foreground',
              'placeholder:text-foreground-subtle',
              // Transition and focus styles
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2',
              // Touch-friendly minimum height
              'min-h-[48px] sm:min-h-[44px]',
              // Add padding for password toggle button
              shouldShowToggle && 'pr-12',
              // Error vs normal state
              error
                ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                : 'border-input focus:border-input-focus focus:ring-ring/20',
              className
            )}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />
          {shouldShowToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'p-1 rounded-md',
                'text-foreground-muted hover:text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring/20',
                'transition-colors duration-150'
              )}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-sm text-foreground-subtle">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
