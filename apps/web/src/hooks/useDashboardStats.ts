import { useActiveAlertCount, useRecentAlerts } from './useAlerts';
import { useProtectedImageCount } from './useProtectedImages';
import { useProtectionScore } from './useProtectionPlan';
import { useWeeklyScanCount } from './useScans';

/**
 * Aggregate hook for all dashboard statistics
 * Fetches all required data in parallel for optimal performance
 */
export function useDashboardStats() {
  const {
    score: protectionScore,
    isLoading: isProtectionScoreLoading,
    error: protectionScoreError,
  } = useProtectionScore();

  const {
    data: activeAlertCount,
    isLoading: isAlertCountLoading,
    error: alertCountError,
  } = useActiveAlertCount();

  const {
    data: imageCount,
    isLoading: isImageCountLoading,
    error: imageCountError,
  } = useProtectedImageCount();

  const {
    data: weeklyScanCount,
    isLoading: isScanCountLoading,
    error: scanCountError,
  } = useWeeklyScanCount();

  const isLoading =
    isProtectionScoreLoading ||
    isAlertCountLoading ||
    isImageCountLoading ||
    isScanCountLoading;

  const hasError =
    protectionScoreError ||
    alertCountError ||
    imageCountError ||
    scanCountError;

  return {
    stats: {
      protectionScore: protectionScore ?? 0,
      activeAlerts: activeAlertCount ?? 0,
      protectedImages: imageCount ?? 0,
      weeklyScans: weeklyScanCount ?? 0,
    },
    isLoading,
    hasError,
    errors: {
      protectionScore: protectionScoreError,
      alerts: alertCountError,
      images: imageCountError,
      scans: scanCountError,
    },
  };
}

/**
 * Hook for fetching recent alerts for dashboard display
 */
export function useDashboardAlerts(limit = 5) {
  const { data, isLoading, error } = useRecentAlerts(limit);

  return {
    alerts: data?.data?.alerts ?? [],
    pagination: data?.data?.pagination,
    isLoading,
    error,
  };
}

export type DashboardStats = ReturnType<typeof useDashboardStats>['stats'];
