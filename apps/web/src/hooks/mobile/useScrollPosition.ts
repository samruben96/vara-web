import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Module-level Map to persist across component re-renders
const scrollPositions = new Map<string, number>();
const MAX_ENTRIES = 20;

/**
 * Saves and restores scroll position per route.
 * Only restores on POP (back/forward) navigation to avoid
 * conflicting with ScrollToTop which handles PUSH navigations.
 * Uses LRU eviction when entries exceed MAX_ENTRIES.
 */
export function useScrollPosition() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      // Save scroll position of the route we're leaving
      scrollPositions.set(prevPathname.current, window.scrollY);

      // LRU eviction
      if (scrollPositions.size > MAX_ENTRIES) {
        const firstKey = scrollPositions.keys().next().value;
        if (firstKey) scrollPositions.delete(firstKey);
      }

      // Only restore on POP (back/forward) navigation
      if (navigationType === 'POP') {
        const savedPosition = scrollPositions.get(pathname);
        if (savedPosition !== undefined) {
          requestAnimationFrame(() => {
            window.scrollTo(0, savedPosition);
          });
        }
      }

      prevPathname.current = pathname;
    }
  }, [pathname, navigationType]);

  useEffect(() => {
    const saveOnHide = () => {
      scrollPositions.set(pathname, window.scrollY);
    };
    window.addEventListener('pagehide', saveOnHide);
    return () => {
      scrollPositions.set(pathname, window.scrollY);
      window.removeEventListener('pagehide', saveOnHide);
    };
  }, [pathname]);
}
