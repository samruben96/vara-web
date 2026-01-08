import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

/** Interval to check token expiry - 1 minute */
const TOKEN_CHECK_INTERVAL_MS = 60 * 1000;

/** Buffer time before expiry to trigger proactive refresh - 5 minutes */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface UseAuthSessionOptions {
  /** Whether to redirect to login on session expiry */
  redirectOnExpiry?: boolean;
  /** Custom redirect path on expiry */
  expiryRedirectPath?: string;
}

interface UseAuthSessionReturn {
  /** Manually refresh the session */
  refreshSession: () => Promise<boolean>;
  /** Sign out the user */
  signOut: () => Promise<void>;
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
}

/**
 * Hook that manages Supabase auth session synchronization with Zustand store.
 *
 * - Listens to auth state changes from Supabase
 * - Syncs session data (tokens, expiry) to Zustand store
 * - Proactively refreshes tokens before expiry
 * - Provides manual refresh and sign out functions
 *
 * @example
 * ```tsx
 * function App() {
 *   const { refreshSession, signOut } = useAuthSession();
 *   // Session state is automatically synced to useAuthStore
 * }
 * ```
 */
export function useAuthSession(options: UseAuthSessionOptions = {}): UseAuthSessionReturn {
  const { redirectOnExpiry = true, expiryRedirectPath = '/login' } = options;

  const navigate = useNavigate();
  const { login, logout, isAuthenticated, expiresAt } = useAuthStore();

  const isRefreshingRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Sync a Supabase session to the Zustand store
   */
  const syncSession = useCallback((session: Session | null) => {
    if (session?.user && session.access_token) {
      login(
        {
          id: session.user.id,
          email: session.user.email ?? '',
          emailVerified: !!session.user.email_confirmed_at,
          profile: null, // Profile is fetched separately via API
        },
        session.access_token,
        session.refresh_token,
        session.expires_at
      );
    } else {
      logout();
    }
  }, [login, logout]);

  /**
   * Refresh the current session
   * @returns true if refresh succeeded, false otherwise
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) {
      return false;
    }

    isRefreshingRef.current = true;

    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('[useAuthSession] Failed to refresh session:', error.message);
        return false;
      }

      if (data.session) {
        syncSession(data.session);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[useAuthSession] Unexpected error during refresh:', error);
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [syncSession]);

  /**
   * Sign out the user
   */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      // Clear local state first to ensure immediate UI update
      logout();

      // Attempt to sign out from Supabase (may fail if network is unavailable)
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.warn('[useAuthSession] Supabase sign out error:', error.message);
        // Continue with redirect even if API call fails - user is already logged out locally
      }
    } catch (error) {
      console.warn('[useAuthSession] Unexpected error during sign out:', error);
    } finally {
      if (redirectOnExpiry) {
        navigate(expiryRedirectPath, { replace: true });
      }
    }
  }, [logout, navigate, redirectOnExpiry, expiryRedirectPath]);

  /**
   * Schedule a proactive token refresh before expiry
   */
  const scheduleTokenRefresh = useCallback(() => {
    // Clear any existing scheduled refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    if (!expiresAt) return;

    const expiresAtMs = expiresAt * 1000;
    const timeUntilRefresh = expiresAtMs - Date.now() - REFRESH_BUFFER_MS;

    if (timeUntilRefresh <= 0) {
      // Token is already expired or will expire soon - refresh immediately
      refreshSession();
      return;
    }

    // Schedule refresh for later
    refreshTimeoutRef.current = setTimeout(async () => {
      const success = await refreshSession();
      if (!success && redirectOnExpiry) {
        // Refresh failed - sign out and redirect
        await signOut();
      }
    }, timeUntilRefresh);
  }, [expiresAt, refreshSession, signOut, redirectOnExpiry]);

  /**
   * Handle Supabase auth state changes
   */
  useEffect(() => {
    // Get initial session on mount
    const initializeSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      syncSession(session);
    };

    initializeSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            syncSession(session);
            break;
          case 'SIGNED_OUT':
            logout();
            if (redirectOnExpiry) {
              navigate(expiryRedirectPath, { replace: true });
            }
            break;
          case 'USER_UPDATED':
            if (session) {
              syncSession(session);
            }
            break;
          default:
            // Handle other events if needed
            break;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [syncSession, logout, navigate, redirectOnExpiry, expiryRedirectPath]);

  /**
   * Schedule proactive token refresh when expiry changes
   */
  useEffect(() => {
    if (isAuthenticated && expiresAt) {
      scheduleTokenRefresh();
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, expiresAt, scheduleTokenRefresh]);

  /**
   * Periodic check for token expiry (safety net)
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkInterval = setInterval(async () => {
      const { isTokenExpired, isTokenExpiringSoon } = useAuthStore.getState();

      if (isTokenExpired()) {
        // Token is already expired - try to refresh
        const success = await refreshSession();
        if (!success) {
          await signOut();
        }
      } else if (isTokenExpiringSoon()) {
        // Token will expire soon - proactively refresh
        await refreshSession();
      }
    }, TOKEN_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(checkInterval);
    };
  }, [isAuthenticated, refreshSession, signOut]);

  return {
    refreshSession,
    signOut,
    isRefreshing: isRefreshingRef.current,
  };
}
