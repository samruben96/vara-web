import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProtectedImage, ApiResponse, PaginationMeta } from '@vara/shared';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Query keys for caching
export const imageKeys = {
  all: ['images'] as const,
  lists: () => [...imageKeys.all, 'list'] as const,
  list: (filters: ImageFilters) => [...imageKeys.lists(), filters] as const,
  details: () => [...imageKeys.all, 'detail'] as const,
  detail: (id: string) => [...imageKeys.details(), id] as const,
};

// Types
export interface ImageFilters {
  page?: number;
  limit?: number;
  filter?: 'all' | 'scanned' | 'not_scanned' | 'archived';
}

// API now returns { data: ProtectedImage[], meta: { pagination } }
export interface ImagesApiResponse {
  data: ProtectedImage[];
  meta?: {
    pagination: PaginationMeta;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Validation constants
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface FileValidationError {
  type: 'invalid_type' | 'file_too_large';
  message: string;
}

/**
 * Validate a file before upload
 */
export function validateImageFile(file: File): FileValidationError | null {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      type: 'invalid_type',
      message: 'Please upload a JPEG, PNG, or WebP image.',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      type: 'file_too_large',
      message: 'Image must be smaller than 10MB.',
    };
  }

  return null;
}

/**
 * Fetch list of protected images
 */
export function useImages(filters: ImageFilters = {}) {
  const { page = 1, limit = 20, filter } = filters;

  return useQuery<ImagesApiResponse>({
    queryKey: imageKeys.list(filters),
    queryFn: async () => {
      const token = useAuthStore.getState().accessToken;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (filter && filter !== 'all') {
        params.append('filter', filter);
      }

      const response = await fetch(`${API_URL}/api/v1/images?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: { message: 'Failed to fetch images' },
        }));
        throw new Error(error.error?.message || 'Failed to fetch images');
      }

      return response.json();
    },
  });
}

/**
 * Upload an image with progress tracking
 */
export function useUploadImage() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<ProtectedImage>,
    Error,
    { file: File; onProgress?: (progress: UploadProgress) => void }
  >({
    mutationFn: async ({ file, onProgress }) => {
      const token = useAuthStore.getState().accessToken;

      // Validate file first
      const validationError = validateImageFile(file);
      if (validationError) {
        throw new Error(validationError.message);
      }

      const formData = new FormData();
      formData.append('file', file);

      // Use XMLHttpRequest for progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error?.message || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was cancelled'));
        });

        xhr.open('POST', `${API_URL}/api/v1/images/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        // Note: Don't set Content-Type for multipart/form-data - browser sets it with boundary
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      // Invalidate the images list to refetch
      queryClient.invalidateQueries({ queryKey: imageKeys.lists() });
    },
  });
}

/**
 * Delete a protected image
 */
export function useDeleteImage() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (imageId) => {
      const token = useAuthStore.getState().accessToken;

      const response = await fetch(`${API_URL}/api/v1/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: { message: 'Failed to delete image' },
        }));
        throw new Error(error.error?.message || 'Failed to delete image');
      }
    },
    onSuccess: () => {
      // Invalidate the images list to refetch
      queryClient.invalidateQueries({ queryKey: imageKeys.lists() });
    },
  });
}
