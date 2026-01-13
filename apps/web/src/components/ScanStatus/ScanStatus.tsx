import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { ScanJob } from '@vara/shared';

export interface ScanStatusProps {
  /** Active scan job to display progress for */
  activeScan: ScanJob | null;
  /** Whether a scan was recently completed */
  recentlyCompleted?: boolean;
  /** Results from the completed scan */
  completedResult?: {
    matchesFound: number;
    imagesScanned: number;
  } | null;
  /** Callback when the status banner is dismissed */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ScanStatus - Displays current scan progress or completion status
 *
 * Shows a calm, reassuring progress indicator while scans are running,
 * and success/results messaging when complete.
 */
export function ScanStatus({
  activeScan,
  recentlyCompleted,
  completedResult,
  onDismiss,
  className,
}: ScanStatusProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [autoDismissTimer, setAutoDismissTimer] = useState<NodeJS.Timeout | null>(null);

  // Show status when there's an active scan or recent completion
  useEffect(() => {
    if (activeScan || recentlyCompleted) {
      setIsVisible(true);
    }
  }, [activeScan, recentlyCompleted]);

  // Auto-dismiss completed status after 5 seconds
  useEffect(() => {
    if (recentlyCompleted && !activeScan) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, 5000);
      setAutoDismissTimer(timer);

      return () => {
        clearTimeout(timer);
      };
    }
    // Only clear timer when scan starts again, not on every render
    return () => {
      // Cleanup handled by the timeout's own return
    };
  }, [recentlyCompleted, activeScan, onDismiss]);

  // Clear timer when scan becomes active again
  useEffect(() => {
    if (activeScan && autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      setAutoDismissTimer(null);
    }
  }, [activeScan, autoDismissTimer]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
    }
    onDismiss?.();
  };

  if (!isVisible) {
    return null;
  }

  // Determine scan type display name
  const getScanTypeName = (type: string): string => {
    switch (type) {
      case 'IMAGE_SCAN':
        return 'image';
      case 'FULL_SCAN':
        return 'full';
      case 'BREACH_CHECK':
        return 'breach';
      default:
        return '';
    }
  };

  // Active scan in progress
  if (activeScan && (activeScan.status === 'RUNNING' || activeScan.status === 'PENDING')) {
    const scanTypeName = getScanTypeName(activeScan.type);
    const isPending = activeScan.status === 'PENDING';

    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 p-3 sm:p-4',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
          <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary-900">
            {isPending ? 'Preparing scan...' : `Scanning ${scanTypeName} images...`}
          </p>
          <p className="text-xs text-primary-700 mt-0.5">
            {isPending
              ? 'Your scan will begin shortly'
              : 'We\'re checking for unauthorized use of your images'}
          </p>
        </div>
        {/* Progress indicator - simulated for now */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-primary-200 overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full animate-pulse"
              style={{ width: isPending ? '10%' : '50%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Scan completed
  if (recentlyCompleted && completedResult) {
    const hasMatches = completedResult.matchesFound > 0;

    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border p-3 sm:p-4',
          hasMatches
            ? 'border-amber-200 bg-amber-50'
            : 'border-success-200 bg-success-50',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            hasMatches ? 'bg-amber-100' : 'bg-success-100'
          )}
        >
          {hasMatches ? (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle className="h-4 w-4 text-success-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium',
              hasMatches ? 'text-amber-900' : 'text-success-900'
            )}
          >
            {hasMatches
              ? `${completedResult.matchesFound} potential match${completedResult.matchesFound !== 1 ? 'es' : ''} found`
              : 'Scan complete - no issues found'}
          </p>
          <p
            className={cn(
              'text-xs mt-0.5',
              hasMatches ? 'text-amber-700' : 'text-success-700'
            )}
          >
            {hasMatches
              ? 'Review your alerts for more details'
              : `Checked ${completedResult.imagesScanned} image${completedResult.imagesScanned !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
            hasMatches
              ? 'text-amber-600 hover:bg-amber-100 active:bg-amber-200'
              : 'text-success-600 hover:bg-success-100 active:bg-success-200'
          )}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Generic completion without details
  if (recentlyCompleted) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 p-3 sm:p-4',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-100">
          <CheckCircle className="h-4 w-4 text-success-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-success-900">Scan complete</p>
          <p className="text-xs text-success-700 mt-0.5">
            Your images have been checked for unauthorized use
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex h-8 w-8 items-center justify-center rounded-full text-success-600 hover:bg-success-100 active:bg-success-200 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return null;
}

export default ScanStatus;
