import { useRef, useState } from 'react';
import { useDrag } from '@use-gesture/react';
import { cn } from '@/lib/cn';
import { useHaptics } from '@/hooks/mobile/useHaptics';

interface SwipeActionProps {
  /** Content to render */
  children: React.ReactNode;
  /** Called when swiped left past threshold */
  onSwipeLeft?: () => void;
  /** Called when swiped right past threshold */
  onSwipeRight?: () => void;
  /** Label for left swipe action */
  leftLabel?: string;
  /** Label for right swipe action */
  rightLabel?: string;
  /** Background color class for left swipe (default: bg-warning) */
  leftBgClass?: string;
  /** Background color class for right swipe (default: bg-success) */
  rightBgClass?: string;
  /** Swipe threshold in pixels (default: 80) */
  threshold?: number;
  /** Whether swipe is enabled (default: true) */
  enabled?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Swipeable wrapper for list items.
 * Only active on touch devices.
 * Swipe left = primary action (e.g., dismiss), swipe right = secondary action (e.g., mark viewed).
 */
export function SwipeAction({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel = 'Dismiss',
  rightLabel = 'Mark Viewed',
  leftBgClass = 'bg-warning',
  rightBgClass = 'bg-success',
  threshold = 80,
  enabled = true,
  className,
}: SwipeActionProps) {
  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const hasTriggeredHaptic = useRef(false);
  const { triggerHaptic } = useHaptics();

  // Only enable on touch devices
  const isTouchDevice =
    typeof window !== 'undefined' && 'ontouchstart' in window;

  const bind = useDrag(
    ({ movement: [mx], last, cancel, active }) => {
      if (!enabled || !isTouchDevice) {
        cancel();
        return;
      }

      // Apply elastic resistance beyond threshold
      const elasticX =
        Math.abs(mx) > threshold
          ? Math.sign(mx) * (threshold + (Math.abs(mx) - threshold) * 0.3)
          : mx;

      if (active) {
        setOffset(elasticX);

        // Trigger haptic at threshold crossing
        if (Math.abs(mx) >= threshold && !hasTriggeredHaptic.current) {
          triggerHaptic('medium');
          hasTriggeredHaptic.current = true;
        }
        if (Math.abs(mx) < threshold) {
          hasTriggeredHaptic.current = false;
        }
      }

      if (last) {
        hasTriggeredHaptic.current = false;

        if (mx < -threshold && onSwipeLeft) {
          // Animate out to the left
          setIsAnimating(true);
          setOffset(-threshold * 3);
          setTimeout(() => {
            onSwipeLeft();
            setOffset(0);
            setIsAnimating(false);
          }, 200);
        } else if (mx > threshold && onSwipeRight) {
          // Animate out to the right
          setIsAnimating(true);
          setOffset(threshold * 3);
          setTimeout(() => {
            onSwipeRight();
            setOffset(0);
            setIsAnimating(false);
          }, 200);
        } else {
          // Snap back
          setIsAnimating(true);
          setOffset(0);
          setTimeout(() => setIsAnimating(false), 200);
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      from: () => [offset, 0],
    },
  );

  if (!isTouchDevice || !enabled) {
    return <div className={className}>{children}</div>;
  }

  const isPastThreshold = Math.abs(offset) >= threshold;

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      {/* Background action indicators */}
      {offset < 0 && onSwipeLeft && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-end px-4',
            leftBgClass,
            isPastThreshold ? 'opacity-100' : 'opacity-50',
          )}
          style={{ width: Math.abs(offset) + 20 }}
        >
          <span className="text-sm font-medium text-white">{leftLabel}</span>
        </div>
      )}
      {offset > 0 && onSwipeRight && (
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex items-center justify-start px-4',
            rightBgClass,
            isPastThreshold ? 'opacity-100' : 'opacity-50',
          )}
          style={{ width: Math.abs(offset) + 20 }}
        >
          <span className="text-sm font-medium text-white">{rightLabel}</span>
        </div>
      )}

      {/* Swipeable content */}
      <div
        {...bind()}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isAnimating ? 'transform 200ms ease-out' : 'none',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default SwipeAction;
