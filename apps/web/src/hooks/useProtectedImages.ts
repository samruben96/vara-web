import { useQuery } from '@tanstack/react-query';
import type { ProtectedImage, ApiResponse, PaginationMeta } from '@vara/shared';
import { api } from '../lib/api';

// Query keys for caching
export const imageKeys = {
  all: ['images'] as const,
  lists: () => [...imageKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number; status?: string }) =>
    [...imageKeys.lists(), filters] as const,
  details: () => [...imageKeys.all, 'detail'] as const,
  detail: (id: string) => [...imageKeys.details(), id] as const,
};

// API response type with pagination
interface ImagesListResponse {
  images: ProtectedImage[];
  pagination: PaginationMeta;
}

interface UseProtectedImagesOptions {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'ARCHIVED';
  enabled?: boolean;
}

/**
 * Fetch paginated list of protected images
 */
export function useProtectedImages(options: UseProtectedImagesOptions = {}) {
  const { page = 1, limit = 10, status, enabled = true } = options;

  return useQuery<ApiResponse<ImagesListResponse>>({
    queryKey: imageKeys.list({ page, limit, status }),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (status) params.set('status', status);

      return api.get<ImagesListResponse>(`/api/v1/images?${params.toString()}`);
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch a single protected image by ID
 */
export function useProtectedImage(id: string, enabled = true) {
  return useQuery<ApiResponse<ProtectedImage>>({
    queryKey: imageKeys.detail(id),
    queryFn: async () => {
      return api.get<ProtectedImage>(`/api/v1/images/${id}`);
    },
    enabled: enabled && !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch count of active protected images (for dashboard stats)
 */
export function useProtectedImageCount(enabled = true) {
  return useQuery<number>({
    queryKey: [...imageKeys.all, 'active-count'] as const,
    queryFn: async () => {
      // Fetch active images to get count from pagination
      const response = await api.get<ImagesListResponse>(
        '/api/v1/images?status=ACTIVE&limit=1'
      );
      return response.data.pagination.total;
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}
