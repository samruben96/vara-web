import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@vara/shared';

/** Buffer time (in ms) before token expiry to trigger refresh - 5 minutes */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: AuthUser, accessToken: string, refreshToken?: string, expiresAt?: number) => void;
  logout: () => void;

  // Token management
  setTokens: (accessToken: string, refreshToken: string, expiresAt: number) => void;
  isTokenExpired: () => boolean;
  isTokenExpiringSoon: () => boolean;
  getTimeUntilExpiry: () => number | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setAccessToken: (token) =>
        set({
          accessToken: token,
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      login: (user, accessToken, refreshToken, expiresAt) =>
        set({
          user,
          accessToken,
          refreshToken: refreshToken ?? null,
          expiresAt: expiresAt ?? null,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          isAuthenticated: false,
        }),

      setTokens: (accessToken, refreshToken, expiresAt) =>
        set({
          accessToken,
          refreshToken,
          expiresAt,
        }),

      isTokenExpired: () => {
        const { expiresAt } = get();
        if (!expiresAt) return false;
        return Date.now() >= expiresAt * 1000;
      },

      isTokenExpiringSoon: () => {
        const { expiresAt } = get();
        if (!expiresAt) return false;
        const expiresAtMs = expiresAt * 1000;
        return Date.now() >= expiresAtMs - TOKEN_EXPIRY_BUFFER_MS;
      },

      getTimeUntilExpiry: () => {
        const { expiresAt } = get();
        if (!expiresAt) return null;
        const timeRemaining = expiresAt * 1000 - Date.now();
        return timeRemaining > 0 ? timeRemaining : 0;
      },
    }),
    {
      name: 'vara-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
