import type { ApiResponse, ApiError } from '@vara/shared';
import { useAuthStore } from '../stores/authStore';
import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/** Error codes that indicate token issues requiring refresh */
const TOKEN_ERROR_CODES = ['AUTH_TOKEN_EXPIRED', 'AUTH_INVALID_TOKEN', 'AUTH_UNAUTHORIZED'];

/** Symbol to mark requests that have already attempted a refresh */
const REFRESH_ATTEMPTED = Symbol('refreshAttempted');

interface RequestOptionsWithMeta extends RequestInit {
  [REFRESH_ATTEMPTED]?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Attempt to refresh the auth token using Supabase
   * @returns true if refresh succeeded, false otherwise
   */
  private async refreshToken(): Promise<boolean> {
    // If already refreshing, wait for the existing refresh to complete
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh via Supabase
   */
  private async performTokenRefresh(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        console.error('[ApiClient] Token refresh failed:', error?.message ?? 'No session returned');
        return false;
      }

      // Update the Zustand store with new tokens
      const { setTokens } = useAuthStore.getState();
      setTokens(
        data.session.access_token,
        data.session.refresh_token,
        data.session.expires_at ?? 0
      );

      return true;
    } catch (error) {
      console.error('[ApiClient] Unexpected error during token refresh:', error);
      return false;
    }
  }

  /**
   * Handle authentication failure by logging out and redirecting
   */
  private handleAuthFailure(): void {
    const { logout } = useAuthStore.getState();
    logout();

    // Redirect to login page
    // Using window.location to ensure clean navigation even outside React context
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/signup') {
      window.location.href = `/login?expired=true&from=${encodeURIComponent(currentPath)}`;
    }
  }

  /**
   * Make an API request with automatic token refresh on 401
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptionsWithMeta = {}
  ): Promise<ApiResponse<T>> {
    const { accessToken, isTokenExpired } = useAuthStore.getState();

    // Proactively refresh if token is expired
    if (accessToken && isTokenExpired()) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        this.handleAuthFailure();
        throw new ApiRequestError('Session expired', 'AUTH_SESSION_EXPIRED', 401);
      }
    }

    // Get potentially updated token after refresh
    const currentToken = useAuthStore.getState().accessToken;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(currentToken && { Authorization: `Bearer ${currentToken}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody: ApiError = await response.json().catch(() => ({
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred',
        },
      }));

      const errorCode = errorBody.error.code;

      // Handle 401 with token refresh (only if not already attempted)
      if (response.status === 401 && TOKEN_ERROR_CODES.includes(errorCode) && !options[REFRESH_ATTEMPTED]) {
        const refreshed = await this.refreshToken();

        if (refreshed) {
          // Retry the original request with the new token
          return this.request<T>(endpoint, {
            ...options,
            [REFRESH_ATTEMPTED]: true,
          });
        } else {
          // Refresh failed - log out user
          this.handleAuthFailure();
          throw new ApiRequestError('Session expired', 'AUTH_SESSION_EXPIRED', 401);
        }
      }

      throw new ApiRequestError(errorBody.error.message, errorCode, response.status);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }

  /**
   * Check if this is an authentication-related error
   */
  isAuthError(): boolean {
    return this.status === 401 || TOKEN_ERROR_CODES.includes(this.code);
  }
}

export const api = new ApiClient(API_URL);
