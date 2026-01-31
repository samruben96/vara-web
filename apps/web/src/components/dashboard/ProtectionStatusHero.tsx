import { Shield, Clock, Image, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Skeleton } from '../ui';
import { ProtectionRing } from '../ui/ProtectionRing';

interface ProtectionStatusHeroProps {
  /** Protection score (0-100) */
  score: number;
  /** Number of protected images */
  protectedImages: number;
  /** Number of active alerts */
  activeAlerts: number;
  /** Last scan completion timestamp */
  lastScanAt?: Date | string | null;
  /** Whether data is loading */
  isLoading?: boolean;
}

/**
 * Get status label based on protection score
 */
function getStatusLabel(score: number): string {
  if (score >= 80) return 'Protected';
  if (score >= 60) return 'Good Standing';
  if (score >= 40) return 'Needs Attention';
  return 'At Risk';
}

/**
 * Get supportive message based on score
 */
function getStatusMessage(score: number): string {
  if (score >= 80) return "Your digital presence is well protected. Keep up the great work!";
  if (score >= 60) return "You're making good progress. A few more steps will strengthen your protection.";
  if (score >= 40) return "Let's work together to improve your digital safety.";
  return "We're here to help you build stronger protection.";
}

/**
 * Get score-based color classes for different elements
 * Uses Vara's calming semantic color palette
 */
function getScoreColors(score: number) {
  if (score >= 80) {
    // Protected - Mint (safety, success)
    return {
      text: 'text-success',
      badge: 'bg-success-subtle text-success-foreground-subtle',
    };
  }
  if (score >= 60) {
    // Good Standing - Lavender (calming, positive)
    return {
      text: 'text-primary',
      badge: 'bg-primary-subtle text-primary',
    };
  }
  if (score >= 40) {
    // Needs Attention - Coral light (warm attention)
    return {
      text: 'text-warning',
      badge: 'bg-warning-subtle text-warning-foreground-subtle',
    };
  }
  // At Risk - Coral deeper (urgent but not alarming)
  return {
    text: 'text-destructive',
    badge: 'bg-destructive-subtle text-destructive-foreground-subtle',
  };
}

/**
 * Format relative time for last scan
 */
function formatLastScan(date: Date | string | null | undefined): string {
  if (!date) return 'No scans yet';

  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return then.toLocaleDateString();
}

/**
 * Loading skeleton for the hero
 */
function HeroSkeleton() {
  return (
    <div className="bg-background-subtle rounded-2xl border border-border/40 p-6 sm:p-8 animate-pulse">
      <div className="flex flex-col items-center text-center">
        {/* Score circle skeleton */}
        <Skeleton variant="circle" className="h-36 w-36 sm:h-44 sm:w-44" />

        {/* Status label skeleton */}
        <Skeleton variant="rect" className="mt-4 h-6 w-24 rounded-full" />

        {/* Message skeleton */}
        <Skeleton variant="line" className="mt-3 w-64" />

        {/* Stats skeleton */}
        <div className="mt-6 flex gap-6">
          <Skeleton variant="rect" width={96} height={48} className="rounded-lg" />
          <Skeleton variant="rect" width={96} height={48} className="rounded-lg" />
          <Skeleton variant="rect" width={96} height={48} className="rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Protection Status Hero Component
 *
 * A prominent dashboard hero showing the user's overall protection status
 * with a large circular progress indicator, status label, and key stats.
 */
export function ProtectionStatusHero({
  score,
  protectedImages,
  activeAlerts,
  lastScanAt,
  isLoading,
}: ProtectionStatusHeroProps) {
  if (isLoading) {
    return <HeroSkeleton />;
  }

  const colors = getScoreColors(score);
  const statusLabel = getStatusLabel(score);
  const statusMessage = getStatusMessage(score);

  return (
    <div className="bg-background-subtle rounded-2xl border border-border/40 p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        {/* Large Protection Ring */}
        <ProtectionRing variant="score" score={score} size={176} />

        {/* Status Badge */}
        <div className="mt-4">
          <span
            className={cn(
              'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium',
              colors.badge
            )}
          >
            <Shield className="h-4 w-4" />
            {statusLabel}
          </span>
        </div>

        {/* Supportive Message */}
        <p className="mt-3 text-foreground-muted max-w-md text-sm sm:text-base">
          {statusMessage}
        </p>

        {/* Key Stats */}
        <div className="mt-6 flex flex-wrap justify-center gap-4 sm:gap-6">
          {/* Images Protected */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/60 border border-border">
            <Image className="h-4 w-4 text-primary" />
            <div className="text-left">
              <p className="text-lg font-semibold text-foreground">{protectedImages}</p>
              <p className="text-xs text-foreground-muted">Images Protected</p>
            </div>
          </div>

          {/* Active Alerts */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/60 border border-border">
            <AlertTriangle className={cn(
              'h-4 w-4',
              activeAlerts > 0 ? 'text-warning' : 'text-success'
            )} />
            <div className="text-left">
              <p className="text-lg font-semibold text-foreground">{activeAlerts}</p>
              <p className="text-xs text-foreground-muted">
                {activeAlerts === 0 ? 'No Alerts' : 'Active Alerts'}
              </p>
            </div>
          </div>

          {/* Last Scan */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/60 border border-border">
            <Clock className="h-4 w-4 text-primary" />
            <div className="text-left">
              <p className="text-lg font-semibold text-foreground">
                {formatLastScan(lastScanAt)}
              </p>
              <p className="text-xs text-foreground-muted">Last Scan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProtectionStatusHero;
