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
          'flex items-center gap-3 rounded-2xl border border-primary-muted bg-primary-subtle p-3 sm:p-4',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-muted">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary-foreground-subtle">
            {isPending ? 'Preparing scan...' : `Scanning ${scanTypeName} images...`}
          </p>
          <p className="text-xs text-primary mt-0.5">
            {isPending
              ? 'Your scan will begin shortly'
              : 'We\'re checking for unauthorized use of your images'}
          </p>
        </div>
        {/* Progress indicator - simulated for now */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-primary-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full animate-pulse"
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
          'flex items-center gap-3 rounded-2xl border p-3 sm:p-4',
          hasMatches
            ? 'border-warning-muted bg-warning-subtle'
            : 'border-success-muted bg-success-subtle',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            hasMatches ? 'bg-warning-muted' : 'bg-success-muted'
          )}
        >
          {hasMatches ? (
            <AlertCircle className="h-4 w-4 text-warning" />
          ) : (
            <CheckCircle className="h-4 w-4 text-success" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium',
              hasMatches ? 'text-warning-foreground-subtle' : 'text-success-foreground-subtle'
            )}
          >
            {hasMatches
              ? `${completedResult.matchesFound} potential match${completedResult.matchesFound !== 1 ? 'es' : ''} found`
              : 'Scan complete - no issues found'}
          </p>
          <p
            className={cn(
              'text-xs mt-0.5',
              hasMatches ? 'text-warning' : 'text-success'
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
              ? 'text-warning hover:bg-warning-muted active:bg-warning-subtle'
              : 'text-success hover:bg-success-muted active:bg-success-subtle'
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
          'flex items-center gap-3 rounded-2xl border border-success-muted bg-success-subtle p-3 sm:p-4',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-muted">
          <CheckCircle className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-success-foreground-subtle">Scan complete</p>
          <p className="text-xs text-success mt-0.5">
            Your images have been checked for unauthorized use
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex h-8 w-8 items-center justify-center rounded-full text-success hover:bg-success-muted active:bg-success-subtle transition-colors"
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
