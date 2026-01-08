import { useQuery } from '@tanstack/react-query';
import type { ProtectionPlan, ApiResponse } from '@vara/shared';
import { api } from '../lib/api';

// Query keys for caching
export const protectionPlanKeys = {
  all: ['protection-plan'] as const,
  detail: () => [...protectionPlanKeys.all, 'detail'] as const,
  items: () => [...protectionPlanKeys.all, 'items'] as const,
};

/**
 * Fetch the user's protection plan
 */
export function useProtectionPlan(enabled = true) {
  return useQuery<ApiResponse<ProtectionPlan>>({
    queryKey: protectionPlanKeys.detail(),
    queryFn: async () => {
      return api.get<ProtectionPlan>('/api/v1/protection-plan');
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Calculate protection score based on protection plan completion
 * Returns a percentage (0-100) based on completed items
 */
export function useProtectionScore(enabled = true) {
  const { data, isLoading, error } = useProtectionPlan(enabled);

  const score = (() => {
    if (!data?.data?.items || data.data.items.length === 0) {
      return 0;
    }

    const items = data.data.items;
    const completedItems = items.filter((item) => item.status === 'COMPLETED');
    const inProgressItems = items.filter((item) => item.status === 'IN_PROGRESS');

    // Calculate score: completed = 100%, in progress = 50%, pending = 0%
    const totalPoints = items.length * 100;
    const earnedPoints =
      completedItems.length * 100 + inProgressItems.length * 50;

    // Base score is 20% for having a protection plan
    const baseScore = 20;
    const completionScore = Math.round((earnedPoints / totalPoints) * 80);

    return Math.min(baseScore + completionScore, 100);
  })();

  return {
    score,
    isLoading,
    error,
    plan: data?.data,
  };
}

/**
 * Get protection plan stats for dashboard
 */
export function useProtectionPlanStats(enabled = true) {
  const { data, isLoading, error } = useProtectionPlan(enabled);

  const stats = (() => {
    if (!data?.data?.items) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        skipped: 0,
      };
    }

    const items = data.data.items;
    return {
      total: items.length,
      completed: items.filter((item) => item.status === 'COMPLETED').length,
      inProgress: items.filter((item) => item.status === 'IN_PROGRESS').length,
      pending: items.filter((item) => item.status === 'PENDING').length,
      skipped: items.filter((item) => item.status === 'SKIPPED').length,
    };
  })();

  return {
    stats,
    isLoading,
    error,
    plan: data?.data,
  };
}
