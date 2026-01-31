import { useState, useCallback, useRef } from 'react';

interface UsePullToRefreshOptions {
  /** Async function to call on refresh */
  onRefresh: () => Promise<void>;
  /** Pull distance threshold in pixels (default: 80) */
  threshold?: number;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
}

interface PullToRefreshState {
  /** Whether refreshing is in progress */
  isRefreshing: boolean;
  /** Current pull distance (0 when not pulling) */
  pullDistance: number;
  /** Pull progress as 0-1 fraction */
  progress: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  enabled = true,
}: UsePullToRefreshOptions): PullToRefreshState & {
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
} {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || !isTouchDevice || isRefreshing) return;
    const touch = e.touches[0];
    if (touch && window.scrollY === 0) {
      startY.current = touch.clientY;
      isPulling.current = true;
    }
  }, [enabled, isTouchDevice, isRefreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;

    const touch = e.touches[0];
    if (!touch) return;
    const currentY = touch.clientY;
    const diff = currentY - startY.current;

    if (diff > 0 && window.scrollY === 0) {
      // Apply resistance as pull increases
      const resistance = Math.min(diff * 0.5, threshold * 1.5);
      setPullDistance(resistance);
    } else {
      isPulling.current = false;
      setPullDistance(0);
    }
  }, [isRefreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Hold at threshold during refresh
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);

  return {
    isRefreshing,
    pullDistance,
    progress,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
