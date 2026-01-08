import { useEffect, useLayoutEffect } from 'react';

// Use useLayoutEffect on client, useEffect on server
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Hook to lock body scroll when a modal/drawer is open
 * @param lock - Whether to lock the scroll
 */
export function useLockBodyScroll(lock: boolean): void {
  useIsomorphicLayoutEffect(() => {
    if (!lock) return;

    // Save original styles
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;

    // Get current scroll position
    const scrollY = window.scrollY;

    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Lock the body
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    // iOS Safari fix - position the body to prevent background scrolling
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      // Restore original styles
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [lock]);
}

/**
 * Hook to prevent pull-to-refresh on specific elements
 * Useful for swipeable components
 */
export function usePreventPullToRefresh(
  ref: React.RefObject<HTMLElement>,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled || !ref.current) return;

    const element = ref.current;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const currentY = e.touches[0].clientY;
      const scrollTop = element.scrollTop;

      // Prevent pull-to-refresh when at the top and trying to pull down
      if (scrollTop <= 0 && currentY > startY) {
        e.preventDefault();
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [ref, enabled]);
}
