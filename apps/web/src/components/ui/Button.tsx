import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

const buttonVariants = cva(
  // Base styles with mobile-friendly touch feedback
  [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
    'transition-all duration-150',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    // Mobile touch feedback
    'active:scale-[0.98] touch-manipulation',
    '-webkit-tap-highlight-color-transparent',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 active:bg-primary-700',
        secondary:
          'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 focus:ring-neutral-500 active:bg-neutral-100',
        ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:ring-neutral-500 active:bg-neutral-200',
        danger: 'bg-alert-600 text-white hover:bg-alert-700 focus:ring-alert-500 active:bg-alert-700',
        link: 'text-primary-600 underline-offset-4 hover:underline focus:ring-primary-500',
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
