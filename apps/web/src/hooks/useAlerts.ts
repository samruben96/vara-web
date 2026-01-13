import { useQuery } from '@tanstack/react-query';
import type { Alert, PaginationMeta } from '@vara/shared';
import { api } from '../lib/api';

// Query keys for caching
export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number; status?: string }) =>
    [...alertKeys.lists(), filters] as const,
  details: () => [...alertKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertKeys.details(), id] as const,
};

// API response structure (matches actual API response)
interface AlertsApiResponse {
  data: Alert[];
  meta: {
    pagination: PaginationMeta;
  };
}

interface UseAlertsOptions {
  page?: number;
  limit?: number;
  status?: string;
  enabled?: boolean;
}

/**
 * Fetch paginated list of alerts
 */
export function useAlerts(options: UseAlertsOptions = {}) {
  const { page = 1, limit = 10, status, enabled = true } = options;

  return useQuery<AlertsApiResponse>({
    queryKey: alertKeys.list({ page, limit, status }),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (status) params.set('status', status);

      const response = await api.get<Alert[]>(`/api/v1/alerts?${params.toString()}`);

      // The api.get returns { data: T, meta?: {...} }
      // So response.data is Alert[] and response.meta has pagination
      return {
        data: response.data,
        meta: response.meta || { pagination: { page, limit, total: 0, totalPages: 0 } },
      } as AlertsApiResponse;
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch a single alert by ID
 */
export function useAlert(id: string, enabled = true) {
  return useQuery<{ data: Alert }>({
    queryKey: alertKeys.detail(id),
    queryFn: async () => {
      return api.get<Alert>(`/api/v1/alerts/${id}`);
    },
    enabled: enabled && !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch count of alerts by status (for dashboard stats)
 * Returns count of NEW alerts (active alerts that need attention)
 */
export function useActiveAlertCount(enabled = true) {
  return useQuery<number>({
    queryKey: [...alertKeys.all, 'active-count'] as const,
    queryFn: async () => {
      const response = await api.get<Alert[]>('/api/v1/alerts?status=NEW&limit=1');
      return response.meta?.pagination?.total ?? 0;
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch recent alerts for dashboard display
 */
export function useRecentAlerts(limit = 5, enabled = true) {
  return useQuery<AlertsApiResponse>({
    queryKey: [...alertKeys.lists(), 'recent', limit] as const,
    queryFn: async () => {
      const response = await api.get<Alert[]>(`/api/v1/alerts?limit=${limit}&page=1`);
      return {
        data: response.data,
        meta: response.meta || { pagination: { page: 1, limit, total: 0, totalPages: 0 } },
      } as AlertsApiResponse;
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}
