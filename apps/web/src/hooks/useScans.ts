import { useQuery } from '@tanstack/react-query';
import type { ScanJob, ApiResponse, PaginationMeta } from '@vara/shared';
import { api } from '../lib/api';

// Query keys for caching
export const scanKeys = {
  all: ['scans'] as const,
  lists: () => [...scanKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number; status?: string; type?: string }) =>
    [...scanKeys.lists(), filters] as const,
  details: () => [...scanKeys.all, 'detail'] as const,
  detail: (id: string) => [...scanKeys.details(), id] as const,
  weeklyCount: () => [...scanKeys.all, 'weekly-count'] as const,
};

// API response type with pagination
interface ScansListResponse {
  scans: ScanJob[];
  pagination: PaginationMeta;
}

interface UseScansOptions {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  enabled?: boolean;
}

/**
 * Fetch paginated list of scan jobs
 */
export function useScans(options: UseScansOptions = {}) {
  const { page = 1, limit = 10, status, type, enabled = true } = options;

  return useQuery<ApiResponse<ScansListResponse>>({
    queryKey: scanKeys.list({ page, limit, status, type }),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (status) params.set('status', status);
      if (type) params.set('type', type);

      return api.get<ScansListResponse>(`/api/v1/scans?${params.toString()}`);
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch a single scan job by ID
 */
export function useScan(id: string, enabled = true) {
  return useQuery<ApiResponse<ScanJob>>({
    queryKey: scanKeys.detail(id),
    queryFn: async () => {
      return api.get<ScanJob>(`/api/v1/scans/${id}`);
    },
    enabled: enabled && !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch count of scans completed this week (for dashboard stats)
 */
export function useWeeklyScanCount(enabled = true) {
  return useQuery<number>({
    queryKey: scanKeys.weeklyCount(),
    queryFn: async () => {
      // Get current date and calculate one week ago
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Fetch all completed scans with a high limit to get count
      // In production, this would ideally be a dedicated count endpoint
      const response = await api.get<ScansListResponse>(
        `/api/v1/scans?status=COMPLETED&limit=100`
      );

      // Filter scans from the last week
      const weeklyScans = response.data.scans.filter((scan) => {
        if (!scan.completedAt) return false;
        const completedDate = new Date(scan.completedAt);
        return completedDate >= oneWeekAgo;
      });

      return weeklyScans.length;
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Check if any scans are currently running
 */
export function useRunningScans(enabled = true) {
  return useQuery<ApiResponse<ScansListResponse>>({
    queryKey: [...scanKeys.lists(), 'running'] as const,
    queryFn: async () => {
      return api.get<ScansListResponse>('/api/v1/scans?status=RUNNING&limit=10');
    },
    enabled,
    staleTime: 10 * 1000, // 10 seconds - check more frequently for running scans
    refetchInterval: 10 * 1000, // Poll every 10 seconds when enabled
  });
}
