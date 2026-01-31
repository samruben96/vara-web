import { useRef, useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

type NavigationDirection = 'forward' | 'back' | 'same';

// Route depth map - deeper routes get higher numbers
const routeDepth: Record<string, number> = {
  '/dashboard': 0,
  '/images': 1,
  '/alerts': 1,
  '/protection-plan': 1,
  '/settings': 2,
  '/help': 2,
};

function getDepth(pathname: string): number {
  // Exact match first
  if (routeDepth[pathname] !== undefined) return routeDepth[pathname];
  // Check prefixes (e.g., /settings/profile)
  for (const [route, depth] of Object.entries(routeDepth)) {
    if (pathname.startsWith(route)) return depth;
  }
  return 0;
}

/**
 * Determines navigation direction based on route depth comparison.
 * Forward = navigating to a deeper route, Back = shallower route, Same = same depth.
 */
export function useNavigationDirection(): NavigationDirection {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prevPathname = useRef(pathname);
  const direction = useRef<NavigationDirection>('forward');

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      if (navigationType === 'POP') {
        direction.current = 'back';
      } else {
        const prevDepth = getDepth(prevPathname.current);
        const currentDepth = getDepth(pathname);

        if (currentDepth > prevDepth) {
          direction.current = 'forward';
        } else if (currentDepth < prevDepth) {
          direction.current = 'back';
        } else {
          direction.current = 'same';
        }
      }
      prevPathname.current = pathname;
    }
  }, [pathname, navigationType]);

  return direction.current;
}
