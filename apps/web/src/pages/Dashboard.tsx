import { Shield, AlertTriangle, Image, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useDashboardStats, useDashboardAlerts } from '../hooks/useDashboardStats';
import { useScans } from '../hooks/useScans';
import { ProtectionStatusHero } from '../components/dashboard';
import type { Alert, AlertSeverity } from '@vara/shared';

// Helper to format relative time
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return then.toLocaleDateString();
}

// Helper to get severity badge class
function getSeverityBadgeClass(severity: AlertSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'badge-error';
    case 'HIGH':
      return 'badge-error';
    case 'MEDIUM':
      return 'badge-warning';
    case 'LOW':
      return 'badge-success';
    case 'INFO':
    default:
      return 'badge-info';
  }
}

// Helper to get severity icon background
function getSeverityIconBg(severity: AlertSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-alert-critical-bg';
    case 'HIGH':
      return 'bg-alert-high-bg';
    case 'MEDIUM':
      return 'bg-alert-medium-bg';
    case 'LOW':
      return 'bg-alert-low-bg';
    case 'INFO':
    default:
      return 'bg-alert-info-bg';
  }
}

// Helper to get severity icon color
function getSeverityIconColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'text-alert-critical-icon';
    case 'HIGH':
      return 'text-alert-high-icon';
    case 'MEDIUM':
      return 'text-alert-medium-icon';
    case 'LOW':
      return 'text-alert-low-icon';
    case 'INFO':
    default:
      return 'text-alert-info-icon';
  }
}

// Loading skeleton for stat cards
function StatCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-muted" />
        <div className="h-4 w-12 rounded bg-muted" />
      </div>
      <div className="mt-3 sm:mt-4">
        <div className="h-7 sm:h-8 w-16 rounded bg-muted" />
        <div className="mt-1.5 sm:mt-2 h-4 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

// Loading skeleton for alert items
function AlertSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/40 p-3 sm:flex-row sm:items-start sm:gap-4 sm:p-4 animate-pulse">
      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-muted flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-5 w-48 max-w-full rounded bg-muted" />
        <div className="mt-2 h-4 w-full rounded bg-muted" />
        <div className="mt-2 h-3 w-20 rounded bg-muted" />
      </div>
      <div className="h-6 w-16 rounded bg-muted self-start" />
    </div>
  );
}

// Alert card component - mobile-optimized with keyboard accessibility
function AlertCard({ alert, onClick }: { alert: Alert; onClick?: () => void }) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`${alert.severity} alert: ${alert.title}`}
      className="flex flex-col gap-3 rounded-2xl border border-border/40 p-3 sm:flex-row sm:items-start sm:gap-4 sm:p-4 transition-colors hover:bg-card-hover active:bg-muted cursor-pointer touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      {/* Icon and badge row on mobile */}
      <div className="flex items-center justify-between sm:contents">
        <div
          className={`flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full ${getSeverityIconBg(alert.severity)}`}
        >
          {alert.severity === 'INFO' ? (
            <Shield className={`h-4 w-4 sm:h-5 sm:w-5 ${getSeverityIconColor(alert.severity)}`} />
          ) : (
            <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 ${getSeverityIconColor(alert.severity)}`} />
          )}
        </div>
        {/* Badge visible on mobile row */}
        <span className={`sm:hidden ${getSeverityBadgeClass(alert.severity)}`}>
          {alert.severity.charAt(0) + alert.severity.slice(1).toLowerCase()}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm sm:text-base">{alert.title}</p>
        <p className="mt-1 text-xs sm:text-sm text-foreground-muted line-clamp-2">{alert.description}</p>
        <p className="mt-1.5 sm:mt-2 text-xs text-foreground-subtle">
          {formatRelativeTime(alert.createdAt)}
        </p>
      </div>

      {/* Badge hidden on mobile (shown above) */}
      <span className={`hidden sm:inline-flex self-start whitespace-nowrap ${getSeverityBadgeClass(alert.severity)}`}>
        {alert.severity.charAt(0) + alert.severity.slice(1).toLowerCase()}
      </span>
    </div>
  );
}

// Empty state for alerts
function EmptyAlertsState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle">
        <Shield className="h-6 w-6 text-success" />
      </div>
      <p className="mt-4 font-medium text-foreground">All clear!</p>
      <p className="mt-1 text-sm text-foreground-muted">
        No alerts to show. Your digital presence is being monitored.
      </p>
    </div>
  );
}

// Error state component
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-destructive-subtle p-4 text-destructive-foreground-subtle">
      <AlertTriangle className="h-5 w-5" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const displayName = user?.profile?.displayName || user?.email?.split('@')[0] || 'there';

  // Fetch dashboard stats
  const { stats, isLoading: isStatsLoading, hasError: hasStatsError } = useDashboardStats();

  // Fetch recent alerts
  const {
    alerts,
    isLoading: isAlertsLoading,
    error: alertsError,
  } = useDashboardAlerts(5);

  // Fetch last completed scan for the hero
  const { data: scansData, isLoading: isScansLoading } = useScans({
    status: 'COMPLETED',
    limit: 1,
    enabled: true,
  });

  // Get the most recent completed scan timestamp
  const lastScanAt = scansData?.data?.scans?.[0]?.completedAt ?? null;

  // Determine change indicators for activity stats
  const getScanChange = (count: number): { text: string; type: 'positive' | 'negative' | 'neutral' } => {
    if (count === 0) return { text: 'No scans', type: 'neutral' };
    return { text: 'Normal', type: 'neutral' };
  };

  const getScoreChange = (score: number): { text: string; type: 'positive' | 'negative' | 'neutral' } => {
    if (score >= 80) return { text: 'Strong', type: 'positive' };
    if (score >= 50) return { text: 'Improving', type: 'neutral' };
    return { text: 'Needs attention', type: 'negative' };
  };

  const scanChange = getScanChange(stats.weeklyScans);
  const scoreChange = getScoreChange(stats.protectionScore);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Welcome - responsive typography */}
      <div>
        <h1 className="text-xl sm:text-2xl font-serif font-bold text-foreground">
          Welcome back, {displayName}
        </h1>
        <p className="mt-1 text-sm sm:text-base text-foreground-muted">
          Here's an overview of your digital safety status.
        </p>
      </div>

      {/* Protection Status Hero */}
      {hasStatsError ? (
        <ErrorState message="Unable to load your protection status. Please try refreshing the page." />
      ) : (
        <ProtectionStatusHero
          score={stats.protectionScore}
          protectedImages={stats.protectedImages}
          activeAlerts={stats.activeAlerts}
          lastScanAt={lastScanAt}
          isLoading={isStatsLoading || isScansLoading}
        />
      )}

      {/* Activity Summary - Compact stats row */}
      <div className="grid gap-3 grid-cols-2 sm:gap-4">
        {isStatsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <div className="card">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary-subtle">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <span
                  className={`text-xs sm:text-sm font-medium ${scanChange.type === 'positive' ? 'text-success' : 'text-foreground-subtle'}`}
                >
                  {scanChange.text}
                </span>
              </div>
              <div className="mt-3 sm:mt-4">
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.weeklyScans}</p>
                <p className="text-xs sm:text-sm text-foreground-muted">Scans This Week</p>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary-subtle">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <span
                  className={`text-xs sm:text-sm font-medium ${scoreChange.type === 'positive' ? 'text-success' : scoreChange.type === 'negative' ? 'text-destructive' : 'text-foreground-subtle'}`}
                >
                  {scoreChange.text}
                </span>
              </div>
              <div className="mt-3 sm:mt-4">
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.protectionScore}%</p>
                <p className="text-xs sm:text-sm text-foreground-muted">Protection Score</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Actions - 2x2 grid on mobile */}
      <div className="card">
        <h2 className="text-base sm:text-lg font-serif font-semibold text-foreground">Quick Actions</h2>
        <div className="mt-3 sm:mt-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => navigate('/images')}
            className="rounded-xl border border-border/40 p-3 sm:p-4 text-left transition-colors hover:border-primary hover:bg-primary-subtle active:bg-primary-muted touch-manipulation min-h-touch"
          >
            <Image className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <p className="mt-2 font-medium text-sm sm:text-base text-foreground">Upload Photos</p>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-foreground-muted line-clamp-1">Add images to protect</p>
          </button>
          <button
            onClick={() => navigate('/alerts')}
            className="rounded-xl border border-border/40 p-3 sm:p-4 text-left transition-colors hover:border-primary hover:bg-primary-subtle active:bg-primary-muted touch-manipulation min-h-touch"
          >
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <p className="mt-2 font-medium text-sm sm:text-base text-foreground">View Alerts</p>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-foreground-muted line-clamp-1">
              {stats.activeAlerts > 0
                ? `${stats.activeAlerts} need attention`
                : 'No active alerts'}
            </p>
          </button>
          <button
            onClick={() => navigate('/protection-plan')}
            className="rounded-xl border border-border/40 p-3 sm:p-4 text-left transition-colors hover:border-primary hover:bg-primary-subtle active:bg-primary-muted touch-manipulation min-h-touch"
          >
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <p className="mt-2 font-medium text-sm sm:text-base text-foreground">Protection Plan</p>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-foreground-muted line-clamp-1">Review your safety tasks</p>
          </button>
          <button
            onClick={() => navigate('/images')}
            className="rounded-xl border border-border/40 p-3 sm:p-4 text-left transition-colors hover:border-primary hover:bg-primary-subtle active:bg-primary-muted touch-manipulation min-h-touch"
          >
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <p className="mt-2 font-medium text-sm sm:text-base text-foreground">Run Scan</p>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-foreground-muted line-clamp-1">Start a new safety scan</p>
          </button>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-serif font-semibold text-foreground">Recent Alerts</h2>
          <button
            onClick={() => navigate('/alerts')}
            className="text-sm font-medium text-primary hover:text-primary-hover active:text-primary-active touch-manipulation min-h-touch flex items-center px-2 -mr-2"
          >
            View all
          </button>
        </div>
        <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
          {isAlertsLoading ? (
            <>
              <AlertSkeleton />
              <AlertSkeleton />
            </>
          ) : alertsError ? (
            <ErrorState message="Unable to load recent alerts. Please try again later." />
          ) : alerts.length === 0 ? (
            <EmptyAlertsState />
          ) : (
            alerts.map((alert: Alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onClick={() => navigate('/alerts')}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Default export for lazy loading
export default Dashboard;
