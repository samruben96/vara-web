import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

/**
 * Skeleton variants using CVA for consistent loading placeholders.
 *
 * Uses Vara's dedicated skeleton design tokens (`--skeleton`, `--skeleton-shimmer`)
 * which adapt automatically in light and dark mode.
 *
 * Animation respects `prefers-reduced-motion` via CSS.
 */
const skeletonVariants = cva(
  // Base styles shared by all variants
  'bg-skeleton',
  {
    variants: {
      /** Visual shape variant */
      variant: {
        line: 'h-4 w-full rounded',
        circle: 'rounded-full',
        card: 'rounded-2xl w-full',
        image: 'aspect-square rounded-2xl w-full',
        rect: 'rounded-lg',
      },
      /** Animation style */
      animation: {
        pulse: 'animate-pulse',
        shimmer: 'skeleton-shimmer',
        none: '',
      },
    },
    defaultVariants: {
      variant: 'rect',
      animation: 'pulse',
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /** Use shimmer gradient effect instead of default pulse */
  shimmer?: boolean;
  /** Width override -- accepts a number (px) or CSS string */
  width?: string | number;
  /** Height override -- accepts a number (px) or CSS string */
  height?: string | number;
}

/**
 * Resolves a dimension value to a CSS-compatible string.
 * Numbers are treated as pixel values; strings are passed through.
 */
function toCssDimension(value: string | number): string {
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * Unified skeleton loading placeholder component.
 *
 * Provides five visual variants (`line`, `circle`, `card`, `image`, `rect`)
 * and two animation modes (`pulse` and `shimmer`). All instances are hidden
 * from assistive technology via `aria-hidden`.
 *
 * @example
 * ```tsx
 * // Basic text line placeholder
 * <Skeleton variant="line" />
 *
 * // Avatar placeholder
 * <Skeleton variant="circle" width={40} height={40} />
 *
 * // Card with shimmer effect
 * <Skeleton variant="card" height={200} shimmer />
 * ```
 */
export function Skeleton({
  variant,
  animation,
  shimmer = false,
  width,
  height,
  className,
  style,
  ...props
}: SkeletonProps): React.JSX.Element {
  // The `shimmer` boolean prop is a convenience shorthand for `animation="shimmer"`
  const resolvedAnimation = shimmer ? 'shimmer' : animation;

  return (
    <div
      aria-hidden="true"
      className={cn(
        skeletonVariants({ variant, animation: resolvedAnimation }),
        className
      )}
      style={{
        ...style,
        ...(width != null ? { width: toCssDimension(width) } : {}),
        ...(height != null ? { height: toCssDimension(height) } : {}),
      }}
      {...props}
    />
  );
}

Skeleton.displayName = 'Skeleton';

// ---------------------------------------------------------------------------
// Convenience exports
// ---------------------------------------------------------------------------

/** Text line skeleton placeholder */
export function SkeletonLine(props: Omit<SkeletonProps, 'variant'>): React.JSX.Element {
  return <Skeleton {...props} variant="line" />;
}

SkeletonLine.displayName = 'SkeletonLine';

/** Circular skeleton placeholder (avatars, icons) */
export function SkeletonCircle(props: Omit<SkeletonProps, 'variant'>): React.JSX.Element {
  return <Skeleton {...props} variant="circle" />;
}

SkeletonCircle.displayName = 'SkeletonCircle';

/** Card skeleton placeholder */
export function SkeletonCard(props: Omit<SkeletonProps, 'variant'>): React.JSX.Element {
  return <Skeleton {...props} variant="card" />;
}

SkeletonCard.displayName = 'SkeletonCard';

/** Image skeleton placeholder */
export function SkeletonImage(props: Omit<SkeletonProps, 'variant'>): React.JSX.Element {
  return <Skeleton {...props} variant="image" />;
}

SkeletonImage.displayName = 'SkeletonImage';

export { skeletonVariants };
export default Skeleton;
