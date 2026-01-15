import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Button variants using Vara's calming color system
 *
 * Design Philosophy:
 * - Primary: Lavender-based for main actions
 * - Secondary: Subtle, card-based for supporting actions
 * - Destructive: Coral (not red) for soft warnings
 * - Ghost/Outline: Minimal emphasis options
 */
const buttonVariants = cva(
  // Base styles with mobile-friendly touch feedback
  [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
    'transition-all duration-150',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50',
    // Mobile touch feedback
    'active:scale-[0.98] touch-manipulation',
    '-webkit-tap-highlight-color-transparent',
  ].join(' '),
  {
    variants: {
      variant: {
        // Primary - Lavender for main CTA
        primary: [
          'bg-primary text-primary-foreground',
          'hover:bg-primary-hover',
          'active:bg-primary-active',
          'focus:ring-ring',
        ].join(' '),

        // Secondary - Card-based for supporting actions
        secondary: [
          'border border-border bg-card text-card-foreground',
          'hover:bg-card-hover hover:border-border-strong',
          'focus:ring-ring',
        ].join(' '),

        // Ghost - Minimal emphasis
        ghost: [
          'text-foreground-muted',
          'hover:bg-muted hover:text-foreground',
          'focus:ring-ring',
        ].join(' '),

        // Outline - Clear boundary with primary color
        outline: [
          'border border-primary bg-transparent text-primary',
          'hover:bg-primary-subtle',
          'focus:ring-ring',
        ].join(' '),

        // Destructive - Coral-based soft approach (not harsh red)
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:bg-destructive-hover',
          'focus:ring-destructive',
        ].join(' '),

        // Destructive outline variant
        'destructive-outline': [
          'border border-destructive bg-transparent text-destructive',
          'hover:bg-destructive-subtle',
          'focus:ring-destructive',
        ].join(' '),

        // Success - Mint-based for positive actions
        success: [
          'bg-success text-success-foreground',
          'hover:bg-success-hover',
          'focus:ring-success',
        ].join(' '),

        // Link style
        link: [
          'text-primary underline-offset-4',
          'hover:underline hover:text-primary-hover',
          'focus:ring-ring',
        ].join(' '),
      },
      size: {
        // Mobile-first sizing with minimum 44px touch targets
        sm: 'h-10 sm:h-9 px-3 text-sm min-h-touch',
        md: 'h-12 sm:h-11 px-4 text-sm sm:text-base min-h-touch',
        lg: 'h-14 sm:h-12 px-6 text-base min-h-touch-lg',
        icon: 'h-11 w-11 sm:h-10 sm:w-10 min-h-touch min-w-touch',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { buttonVariants };
