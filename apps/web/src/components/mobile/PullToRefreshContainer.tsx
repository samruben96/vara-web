import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { usePullToRefresh } from '../../hooks/mobile/usePullToRefresh';

interface PullToRefreshContainerProps {
  /** Async function to call on refresh */
  onRefresh: () => Promise<void>;
  /** Content to wrap */
  children: React.ReactNode;
  /** Whether enabled (default: true) */
  enabled?: boolean;
  /** Pull threshold in px (default: 80) */
  threshold?: number;
  /** Additional class */
  className?: string;
}

/**
 * Pull-to-refresh container for mobile views.
 * Shows a circular progress indicator that fills as user pulls down.
 * Only active on touch devices when scrolled to top.
 */
export function PullToRefreshContainer({
  onRefresh,
  children,
  enabled = true,
  threshold = 80,
  className,
}: PullToRefreshContainerProps) {
  const { isRefreshing, pullDistance, progress, handlers } = usePullToRefresh({
    onRefresh,
    threshold,
    enabled,
  });

  return (
    <div className={cn('relative', className)} {...handlers}>
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
          style={{ height: isRefreshing ? threshold : pullDistance }}
        >
          {isRefreshing ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <svg
              className="h-6 w-6 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                className="text-muted"
                stroke="currentColor"
              />
              <circle
                cx="12"
                cy="12"
                r="10"
                className="text-primary"
                stroke="currentColor"
                strokeDasharray={`${progress * 62.83} 62.83`}
                transform="rotate(-90 12 12)"
              />
            </svg>
          )}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translateY(0)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefreshContainer;
