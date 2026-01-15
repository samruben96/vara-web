import { Shield, Clock, Image, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';

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
      ring: 'text-success',
      gradient: 'from-success-subtle via-success-muted to-success-subtle',
      border: 'border-success-muted',
      badge: 'bg-success-subtle text-success-foreground-subtle',
      glow: 'shadow-success-subtle',
    };
  }
  if (score >= 60) {
    // Good Standing - Lavender (calming, positive)
    return {
      text: 'text-primary',
      ring: 'text-primary',
      gradient: 'from-primary-subtle via-primary-muted to-primary-subtle',
      border: 'border-primary-muted',
      badge: 'bg-primary-subtle text-primary',
      glow: 'shadow-primary-subtle',
    };
  }
  if (score >= 40) {
    // Needs Attention - Coral light (warm attention)
    return {
      text: 'text-warning',
      ring: 'text-warning',
      gradient: 'from-warning-subtle via-warning-muted to-warning-subtle',
      border: 'border-warning-muted',
      badge: 'bg-warning-subtle text-warning-foreground-subtle',
      glow: 'shadow-warning-subtle',
    };
  }
  // At Risk - Coral deeper (urgent but not alarming)
  return {
    text: 'text-destructive',
    ring: 'text-destructive',
    gradient: 'from-destructive-subtle via-destructive-muted to-destructive-subtle',
    border: 'border-destructive-muted',
    badge: 'bg-destructive-subtle text-destructive-foreground-subtle',
    glow: 'shadow-destructive-subtle',
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
    <div className="rounded-2xl bg-gradient-to-br from-primary-subtle to-primary-muted border border-primary-muted p-6 sm:p-8 animate-pulse">
      <div className="flex flex-col items-center text-center">
        {/* Score circle skeleton */}
        <div className="h-36 w-36 sm:h-44 sm:w-44 rounded-full bg-primary-muted" />

        {/* Status label skeleton */}
        <div className="mt-4 h-6 w-24 rounded-full bg-primary-muted" />

        {/* Message skeleton */}
        <div className="mt-3 h-4 w-64 rounded bg-primary-muted" />

        {/* Stats skeleton */}
        <div className="mt-6 flex gap-6">
          <div className="h-12 w-24 rounded-lg bg-primary-muted" />
          <div className="h-12 w-24 rounded-lg bg-primary-muted" />
          <div className="h-12 w-24 rounded-lg bg-primary-muted" />
        </div>
      </div>
    </div>
  );
}

/**
 * Circular progress ring with animation
 */
function ProgressRing({
  score,
  colors,
  size = 176,
}: {
  score: number;
  colors: ReturnType<typeof getScoreColors>;
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        {/* Progress circle with animation */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={cn(
            'transition-all duration-1000 ease-out',
            colors.ring
          )}
          style={{
            filter: 'drop-shadow(0 0 6px currentColor)',
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-4xl sm:text-5xl font-bold', colors.text)}>
          {score}
        </span>
        <span className="text-sm text-foreground-muted -mt-1">Protection Score</span>
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
    <div
      className={cn(
        'rounded-2xl bg-gradient-to-br border p-6 sm:p-8',
        colors.gradient,
        colors.border
      )}
    >
      <div className="flex flex-col items-center text-center">
        {/* Large Progress Ring */}
        <div className={cn('rounded-full', colors.glow)}>
          <ProgressRing score={score} colors={colors} size={176} />
        </div>

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
