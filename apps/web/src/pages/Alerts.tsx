import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  Shield,
  AlertTriangle,
  Image,
  User,
  Database,
  Eye,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronRight,
  Loader2,
  Inbox,
  Trash2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cn } from '../lib/cn';
import { Button } from '../components/ui/Button';
import { AlertDetailPanel } from '../components/AlertDetailPanel';
import { useAlerts, alertKeys } from '../hooks/useAlerts';
import { api } from '../lib/api';
import type { Alert, AlertType, AlertSeverity, AlertStatus } from '@vara/shared';

type AlertFilter = 'all' | 'NEW' | 'VIEWED' | 'ACTIONED' | 'DISMISSED';

// Severity configuration with calming colors (per CLAUDE.md design philosophy)
const severityConfig: Record<AlertSeverity, { label: string; color: string; bgColor: string; icon: typeof AlertTriangle }> = {
  CRITICAL: {
    label: 'Critical',
    color: 'text-rose-700',
    bgColor: 'bg-rose-50 border-rose-200',
    icon: AlertTriangle,
  },
  HIGH: {
    label: 'High',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: AlertTriangle,
  },
  MEDIUM: {
    label: 'Medium',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50 border-yellow-200',
    icon: Eye,
  },
  LOW: {
    label: 'Low',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: Eye,
  },
  INFO: {
    label: 'Info',
    color: 'text-neutral-600',
    bgColor: 'bg-neutral-50 border-neutral-200',
    icon: Bell,
  },
};

// Alert type icons and labels
const alertTypeConfig: Record<AlertType, { label: string; icon: typeof Image }> = {
  IMAGE_MISUSE: { label: 'Image Found Online', icon: Image },
  FAKE_PROFILE: { label: 'Fake Profile', icon: User },
  DATA_BREACH: { label: 'Data Breach', icon: Database },
  SUSPICIOUS_FOLLOWER: { label: 'Suspicious Activity', icon: Eye },
  BEHAVIORAL_CHANGE: { label: 'Behavior Change', icon: AlertTriangle },
  DEEPFAKE_DETECTED: { label: 'Deepfake Detected', icon: AlertTriangle },
  PROFILE_IMPERSONATION: { label: 'Impersonation', icon: User },
};

// Status badge configuration
const statusConfig: Record<AlertStatus, { label: string; color: string }> = {
  NEW: { label: 'New', color: 'bg-primary-100 text-primary-700' },
  VIEWED: { label: 'Viewed', color: 'bg-blue-100 text-blue-700' },
  ACTIONED: { label: 'Actioned', color: 'bg-green-100 text-green-700' },
  DISMISSED: { label: 'Dismissed', color: 'bg-neutral-100 text-neutral-600' },
};

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface AlertCardProps {
  alert: Alert;
  onDismiss: (id: string) => void;
  onMarkViewed: (id: string) => void;
  onViewDetails: (id: string) => void;
  isUpdating: boolean;
}

function AlertCard({ alert, onDismiss, onMarkViewed, onViewDetails, isUpdating }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const severity = severityConfig[alert.severity];
  const alertType = alertTypeConfig[alert.type];
  const status = statusConfig[alert.status];
  const SeverityIcon = severity.icon;
  const TypeIcon = alertType.icon;

  const handleExpandKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(!expanded);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open details if clicking on buttons or links
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;
    onViewDetails(alert.id);
  };

  const metadata = alert.metadata as {
    sourceUrl?: string;
    platform?: string;
    similarity?: number;
    matchId?: string;
    isMock?: boolean;
    breaches?: Array<{ name: string; breachDate: string; dataClasses: string[] }>;
  } | null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.target.toString().includes('button')) {
          onViewDetails(alert.id);
        }
      }}
      className={cn(
        'rounded-xl border p-4 transition-all cursor-pointer',
        'hover:shadow-md hover:border-primary-300',
        severity.bgColor,
        alert.status === 'NEW' && 'ring-2 ring-primary-200',
        alert.status === 'DISMISSED' && 'opacity-60'
      )}
      aria-label={`View details for alert: ${alert.title}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', severity.bgColor)}>
          <SeverityIcon className={cn('h-5 w-5', severity.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', status.color)}>
              {status.label}
            </span>
            {metadata?.isMock && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                Test Data
              </span>
            )}
            <span className="text-xs text-neutral-500 flex items-center gap-1">
              <TypeIcon className="h-3 w-3" />
              {alertType.label}
            </span>
            <span className="text-xs text-neutral-400">
              {formatDate(alert.createdAt)}
            </span>
          </div>


          <h3 className="mt-1 font-semibold text-neutral-900">{alert.title}</h3>
          <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{alert.description}</p>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          onKeyDown={handleExpandKeyDown}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse alert details' : 'Expand alert details'}
          className="p-1 hover:bg-white/50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          <ChevronRight className={cn('h-5 w-5 text-neutral-400 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-current/10">
          {/* Similarity score */}
          {metadata?.similarity && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-neutral-600">Similarity:</span>
              <div className="flex-1 h-2 bg-white/50 rounded-full overflow-hidden max-w-32">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${metadata.similarity * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-neutral-700">
                {Math.round(metadata.similarity * 100)}%
              </span>
            </div>
          )}

          {/* Source URL */}
          {metadata?.sourceUrl && (
            <div className="mb-3">
              <span className="text-sm text-neutral-600">Found at:</span>
              <a
                href={metadata.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
              >
                {metadata.platform || new URL(metadata.sourceUrl).hostname}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Breach details */}
          {metadata?.breaches && metadata.breaches.length > 0 && (
            <div className="mb-3">
              <span className="text-sm font-medium text-neutral-700 block mb-2">Affected breaches:</span>
              <ul className="space-y-1">
                {metadata.breaches.slice(0, 3).map((breach, idx) => (
                  <li key={idx} className="text-sm text-neutral-600 flex items-center gap-2">
                    <Database className="h-3 w-3" />
                    {breach.name} ({breach.breachDate})
                  </li>
                ))}
                {metadata.breaches.length > 3 && (
                  <li className="text-sm text-neutral-500">
                    +{metadata.breaches.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(alert.id);
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details & Next Steps
            </Button>

            {alert.status === 'NEW' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkViewed(alert.id);
                }}
                disabled={isUpdating}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark as Viewed
              </Button>
            )}

            {alert.status !== 'DISMISSED' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(alert.id);
                }}
                disabled={isUpdating}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
            )}

            {metadata?.sourceUrl && !metadata?.isMock && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(metadata.sourceUrl, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View Source
              </Button>
            )}
            {metadata?.isMock && (
              <span className="text-xs text-purple-600 italic ml-2">
                This is simulated test data for demonstration purposes
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Alerts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const filter = (searchParams.get('filter') as AlertFilter) || 'all';
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useAlerts({
    page: 1,
    limit: 50,
    status: filter === 'all' ? undefined : filter,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatus }) => {
      return api.patch(`/api/v1/alerts/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update alert');
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return api.delete('/api/v1/alerts/all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      toast.success('All alerts cleared', {
        duration: 2000,
        style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to clear alerts');
    },
  });

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all alerts? This cannot be undone.')) {
      clearAllMutation.mutate();
    }
  };

  const handleDismiss = useCallback((id: string) => {
    updateStatusMutation.mutate({ id, status: 'DISMISSED' });
    toast.success('Alert archived', {
      duration: 2000,
      style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
    });
  }, [updateStatusMutation]);

  const handleMarkViewed = useCallback((id: string) => {
    updateStatusMutation.mutate({ id, status: 'VIEWED' });
  }, [updateStatusMutation]);

  const handleMarkActioned = useCallback((id: string) => {
    updateStatusMutation.mutate({ id, status: 'ACTIONED' });
    toast.success('Alert marked as handled', {
      duration: 2000,
      style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
    });
  }, [updateStatusMutation]);

  const handleViewDetails = useCallback((id: string) => {
    setSelectedAlertId(id);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedAlertId(null);
  }, []);

  const alerts = data?.data || [];
  const hasAlerts = alerts.length > 0;

  // Count alerts by status for filter badges
  const newCount = alerts.filter((a: Alert) => a.status === 'NEW').length;

  const filterOptions: { value: AlertFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All Alerts' },
    { value: 'NEW', label: 'New', count: filter === 'all' ? newCount : undefined },
    { value: 'VIEWED', label: 'Viewed' },
    { value: 'ACTIONED', label: 'Actioned' },
    { value: 'DISMISSED', label: 'Dismissed' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Alerts</h1>
          <p className="mt-1 text-neutral-600">
            Stay informed about potential concerns with your digital presence
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasAlerts && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={clearAllMutation.isPending}
              className="text-neutral-500 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
          <Shield className="h-8 w-8 text-primary-500" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Filter alerts by status">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            role="tab"
            aria-selected={filter === option.value}
            aria-controls="alerts-list"
            onClick={() => setSearchParams(option.value === 'all' ? {} : { filter: option.value })}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              filter === option.value
                ? 'bg-primary-100 text-primary-700'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            )}
          >
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                {option.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
          <p className="text-rose-700">Unable to load alerts. Please try again.</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !hasAlerts && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <Shield className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="mt-6 text-xl font-semibold text-neutral-900">
            {filter === 'all' ? 'No Threats Detected' : 'All Clear'}
          </h2>
          <p className="mt-2 text-green-700 font-medium">
            {filter === 'all'
              ? "We're actively monitoring your digital presence"
              : `No ${filter.toLowerCase()} alerts to show`}
          </p>
          <p className="mt-3 max-w-md text-neutral-600">
            {filter === 'all'
              ? "Your protected images and connected accounts are being continuously scanned. We'll notify you immediately if we detect anything concerning."
              : "Try adjusting your filters to see other alerts."}
          </p>
          {filter === 'all' && (
            <div className="mt-6 flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span>Protection active</span>
            </div>
          )}
        </div>
      )}

      {/* Alerts List */}
      {!isLoading && !error && hasAlerts && (
        <div id="alerts-list" role="tabpanel" className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDismiss={handleDismiss}
              onMarkViewed={handleMarkViewed}
              onViewDetails={handleViewDetails}
              isUpdating={updateStatusMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Info Footer */}
      <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
        <div className="flex items-start gap-3">
          <Inbox className="h-5 w-5 text-neutral-400 mt-0.5" />
          <div>
            <p className="text-sm text-neutral-600">
              <strong className="text-neutral-700">How alerts work:</strong> We scan your protected images
              and connected accounts for potential misuse. When we find something concerning, you'll see
              it here with recommended actions.
            </p>
          </div>
        </div>
      </div>

      {/* Alert Detail Panel */}
      <AlertDetailPanel
        alertId={selectedAlertId}
        onClose={handleCloseDetails}
        onDismiss={handleDismiss}
        onMarkViewed={handleMarkViewed}
        onMarkActioned={handleMarkActioned}
        isUpdating={updateStatusMutation.isPending}
      />
    </div>
  );
}

// Default export for lazy loading
export default Alerts;
