import { useState } from 'react';
import {
  Check,
  Circle,
  Clock,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import type { ProtectionPlanItem, ProtectionPlanItemStatus } from '@vara/shared';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';

interface PlanItemProps {
  item: ProtectionPlanItem;
  onStatusChange: (itemId: string, status: ProtectionPlanItemStatus) => void;
  isUpdating: boolean;
}

/** Status configuration with Vara's calming semantic colors */
const statusConfig: Record<
  ProtectionPlanItemStatus,
  { icon: typeof Check; color: string; bgColor: string; label: string }
> = {
  PENDING: {
    icon: Circle,
    color: 'text-foreground-subtle',
    bgColor: 'bg-muted hover:bg-muted-hover',
    label: 'Pending',
  },
  IN_PROGRESS: {
    icon: Clock,
    color: 'text-info',
    bgColor: 'bg-info-subtle hover:bg-info-muted',
    label: 'In Progress',
  },
  COMPLETED: {
    icon: Check,
    color: 'text-success',
    bgColor: 'bg-success-subtle',
    label: 'Completed',
  },
  SKIPPED: {
    icon: SkipForward,
    color: 'text-foreground-subtle',
    bgColor: 'bg-background-muted',
    label: 'Skipped',
  },
};

/**
 * Individual protection plan task item with checkbox and status management.
 * Supports the status flow: PENDING -> IN_PROGRESS -> COMPLETED (or SKIPPED)
 */
export function PlanItem({ item, onStatusChange, isUpdating }: PlanItemProps) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[item.status];
  const StatusIcon = config.icon;

  const isCompleted = item.status === 'COMPLETED';
  const isSkipped = item.status === 'SKIPPED';
  const isDone = isCompleted || isSkipped;

  /**
   * Handle clicking the checkbox/status button.
   * Cycles through: PENDING -> IN_PROGRESS -> COMPLETED
   */
  const handleStatusClick = () => {
    if (isUpdating || isSkipped) return;

    let newStatus: ProtectionPlanItemStatus;
    switch (item.status) {
      case 'PENDING':
        newStatus = 'IN_PROGRESS';
        break;
      case 'IN_PROGRESS':
        newStatus = 'COMPLETED';
        break;
      case 'COMPLETED':
        newStatus = 'PENDING'; // Allow unchecking
        break;
      default:
        return;
    }

    onStatusChange(item.id, newStatus);
  };

  /**
   * Handle skipping an item
   */
  const handleSkip = () => {
    if (isUpdating || isDone) return;
    onStatusChange(item.id, 'SKIPPED');
  };

  /**
   * Handle restoring a skipped item
   */
  const handleRestore = () => {
    if (isUpdating) return;
    onStatusChange(item.id, 'PENDING');
  };

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all',
        isDone
          ? 'bg-background-muted border-border/40'
          : 'bg-card border-border/40 hover:border-primary-muted hover:shadow-sm'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Button/Checkbox */}
        <button
          onClick={handleStatusClick}
          disabled={isUpdating || isSkipped}
          className={cn(
            'flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full transition-all',
            config.bgColor,
            !isDone && !isUpdating && 'cursor-pointer',
            isUpdating && 'cursor-wait opacity-50'
          )}
          aria-label={`Mark as ${item.status === 'COMPLETED' ? 'incomplete' : 'complete'}`}
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin text-foreground-subtle" />
          ) : (
            <StatusIcon className={cn('h-4 w-4', config.color)} />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3
                className={cn(
                  'font-serif font-medium transition-all',
                  isDone
                    ? 'text-foreground-muted line-through'
                    : 'text-foreground'
                )}
              >
                {item.title}
              </h3>
              <span
                className={cn(
                  'inline-block text-xs px-2 py-0.5 rounded-full mt-1',
                  isDone ? 'bg-muted text-muted-foreground' : 'bg-primary-subtle text-primary'
                )}
              >
                {item.category}
              </span>
            </div>

            {/* Expand Button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-foreground-subtle" />
              ) : (
                <ChevronDown className="h-4 w-4 text-foreground-subtle" />
              )}
            </button>
          </div>

          {/* Expanded Content */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className={cn('text-sm', isDone ? 'text-foreground-subtle' : 'text-foreground-muted')}>
                {item.description}
              </p>

              {/* Status Badge */}
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
                    item.status === 'COMPLETED' && 'bg-success-subtle text-success-foreground-subtle',
                    item.status === 'IN_PROGRESS' && 'bg-info-subtle text-info-foreground-subtle',
                    item.status === 'PENDING' && 'bg-muted text-muted-foreground',
                    item.status === 'SKIPPED' && 'bg-muted text-foreground-subtle'
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </span>

                {item.dueDate && (
                  <span className="text-xs text-foreground-muted">
                    Due: {new Date(item.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                {!isDone && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleStatusClick}
                      disabled={isUpdating}
                    >
                      {item.status === 'PENDING' ? 'Start Task' : 'Mark Complete'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSkip}
                      disabled={isUpdating}
                      className="text-foreground-muted"
                    >
                      <SkipForward className="h-4 w-4 mr-1" />
                      Skip
                    </Button>
                  </>
                )}

                {isSkipped && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRestore}
                    disabled={isUpdating}
                  >
                    Restore Task
                  </Button>
                )}

                {isCompleted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStatusClick}
                    disabled={isUpdating}
                    className="text-foreground-muted"
                  >
                    Mark Incomplete
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlanItem;
