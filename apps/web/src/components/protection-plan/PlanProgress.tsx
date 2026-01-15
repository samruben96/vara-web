import { Shield, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/cn';

interface PlanProgressProps {
  /** Protection score (0-100) */
  score: number;
  /** Stats breakdown */
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    skipped: number;
  };
  /** Whether data is loading */
  isLoading?: boolean;
}

/**
 * Visual progress indicator for protection plan completion.
 * Shows overall score and breakdown of task statuses.
 */
export function PlanProgress({ score, stats, isLoading }: PlanProgressProps) {
  // Determine score color based on level
  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-success';
    if (value >= 60) return 'text-info';
    if (value >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const getProgressColor = (value: number) => {
    if (value >= 80) return 'bg-success';
    if (value >= 60) return 'bg-info';
    if (value >= 40) return 'bg-warning';
    return 'bg-destructive';
  };

  const getEncouragementMessage = (value: number) => {
    if (value >= 80) return "Excellent work! Your protection is strong.";
    if (value >= 60) return "Good progress! Keep building your safety.";
    if (value >= 40) return "You're on your way to better protection.";
    return "Let's strengthen your digital safety together.";
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-primary-subtle to-primary-muted border border-primary-muted p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-primary-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-32 bg-primary-muted rounded" />
            <div className="h-4 w-48 bg-primary-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  const activeItems = stats.total - stats.skipped;
  const completionPercentage = activeItems > 0
    ? Math.round((stats.completed / activeItems) * 100)
    : 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary-subtle to-primary-muted border border-primary-muted p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Score Circle */}
        <div className="relative flex-shrink-0 mx-auto sm:mx-0">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-primary-muted"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 264} 264`}
              className={cn('transition-all duration-700', getScoreColor(score))}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className={cn('text-2xl font-bold', getScoreColor(score))}>
                {score}
              </span>
              <span className="text-sm text-foreground-subtle block -mt-1">score</span>
            </div>
          </div>
        </div>

        {/* Stats and Message */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Protection Progress
            </h2>
          </div>

          <p className="text-foreground-muted mb-4">
            {getEncouragementMessage(score)}
          </p>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-foreground-muted">
                {stats.completed} of {activeItems} tasks completed
              </span>
              <span className={cn('font-medium', getScoreColor(score))}>
                {completionPercentage}%
              </span>
            </div>
            <div className="h-2 bg-primary-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', getProgressColor(score))}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Stats Pills */}
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {stats.inProgress > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-info-subtle text-info">
                <TrendingUp className="h-3 w-3" />
                {stats.inProgress} in progress
              </span>
            )}
            {stats.pending > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-muted text-foreground-muted">
                {stats.pending} pending
              </span>
            )}
            {stats.skipped > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-muted text-foreground-subtle">
                {stats.skipped} skipped
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlanProgress;
