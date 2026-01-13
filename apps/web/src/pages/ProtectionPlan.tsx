import { useMemo } from 'react';
import {
  Shield,
  RefreshCw,
  Loader2,
  AlertCircle,
  Sparkles,
  Target,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ProtectionPlanItem, ProtectionPlanItemStatus } from '@vara/shared';
import { cn } from '../lib/cn';
import { Button } from '../components/ui/Button';
import { PlanProgress, PlanItem } from '../components/protection-plan';
import {
  useProtectionPlan,
  useProtectionScore,
  useProtectionPlanStats,
  useProtectionPlanMutations,
} from '../hooks/useProtectionPlan';

/**
 * Protection Plan page - displays personalized action items to improve digital safety.
 * Items are organized by category with progress tracking and status management.
 */
export function ProtectionPlan() {
  const { data, isLoading, error } = useProtectionPlan();
  const { score, isLoading: scoreLoading } = useProtectionScore();
  const { stats, isLoading: statsLoading } = useProtectionPlanStats();
  const { updateItemStatus, regeneratePlan } = useProtectionPlanMutations();

  const plan = data?.data;
  const items = useMemo(() => plan?.items ?? [], [plan?.items]);

  // Group items by category
  const categorizedItems = useMemo(() => {
    const categories = new Map<string, ProtectionPlanItem[]>();

    items.forEach((item) => {
      const existing = categories.get(item.category) ?? [];
      categories.set(item.category, [...existing, item]);
    });

    // Sort categories: items with pending/in-progress first, then by first item priority
    return Array.from(categories.entries()).sort(([, itemsA], [, itemsB]) => {
      const aHasActive = itemsA.some(
        (i) => i.status === 'PENDING' || i.status === 'IN_PROGRESS'
      );
      const bHasActive = itemsB.some(
        (i) => i.status === 'PENDING' || i.status === 'IN_PROGRESS'
      );

      if (aHasActive && !bHasActive) return -1;
      if (!aHasActive && bHasActive) return 1;

      return (itemsA[0]?.priority ?? 0) - (itemsB[0]?.priority ?? 0);
    });
  }, [items]);

  /**
   * Handle status update for a plan item
   */
  const handleStatusChange = (itemId: string, status: ProtectionPlanItemStatus) => {
    updateItemStatus.mutate(
      { itemId, status },
      {
        onSuccess: () => {
          const messages: Record<ProtectionPlanItemStatus, string> = {
            COMPLETED: 'Great progress! Task marked as complete.',
            IN_PROGRESS: 'Task started. You got this!',
            PENDING: 'Task restored to pending.',
            SKIPPED: 'Task skipped. You can always come back to it.',
          };

          toast.success(messages[status], {
            duration: 2000,
            style: {
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
            },
          });
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update task');
        },
      }
    );
  };

  /**
   * Handle regenerating the protection plan
   */
  const handleRegenerate = () => {
    regeneratePlan.mutate(undefined, {
      onSuccess: () => {
        toast.success('Protection plan refreshed with new recommendations!', {
          duration: 3000,
          icon: <Sparkles className="h-5 w-5 text-primary-500" />,
        });
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to regenerate plan');
      },
    });
  };

  // Loading state
  if (isLoading || scoreLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Protection Plan</h1>
            <p className="mt-1 text-neutral-600">Loading your personalized safety roadmap...</p>
          </div>
          <Shield className="h-8 w-8 text-primary-500" />
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Protection Plan</h1>
            <p className="mt-1 text-neutral-600">Your personalized safety roadmap</p>
          </div>
          <Shield className="h-8 w-8 text-primary-500" />
        </div>
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
          <p className="text-rose-700">Unable to load your protection plan. Please try again.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Protection Plan</h1>
            <p className="mt-1 text-neutral-600">Your personalized safety roadmap</p>
          </div>
          <Shield className="h-8 w-8 text-primary-500" />
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100">
            <Target className="h-10 w-10 text-primary-600" />
          </div>
          <h2 className="mt-6 text-xl font-semibold text-neutral-900">
            Your Plan is Ready to Start
          </h2>
          <p className="mt-3 max-w-md text-neutral-600">
            We'll generate personalized protection tasks based on your profile and activity.
            Click below to create your first action items.
          </p>
          <Button
            variant="primary"
            className="mt-6"
            onClick={handleRegenerate}
            isLoading={regeneratePlan.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate My Plan
          </Button>
        </div>
      </div>
    );
  }

  // Check if all active items are completed
  const allCompleted = stats.completed === stats.total - stats.skipped && stats.completed > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Protection Plan</h1>
          <p className="mt-1 text-neutral-600">
            Your personalized roadmap to stronger digital safety
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRegenerate}
            disabled={regeneratePlan.isPending}
          >
            {regeneratePlan.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1 hidden sm:inline">Refresh</span>
          </Button>
          <Shield className="h-8 w-8 text-primary-500" />
        </div>
      </div>

      {/* Progress Header */}
      <PlanProgress score={score} stats={stats} />

      {/* All Completed Celebration */}
      {allCompleted && (
        <div className="rounded-xl bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 p-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-green-800">
            Amazing Work!
          </h2>
          <p className="mt-1 text-green-700 max-w-md mx-auto">
            You've completed all your protection tasks. Your digital safety is looking strong.
            Keep monitoring and we'll add new recommendations as needed.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={handleRegenerate}
            disabled={regeneratePlan.isPending}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Check for New Tasks
          </Button>
        </div>
      )}

      {/* Category Sections */}
      <div className="space-y-8">
        {categorizedItems.map(([category, categoryItems]) => {
          const completedInCategory = categoryItems.filter(
            (i) => i.status === 'COMPLETED'
          ).length;
          const activeInCategory = categoryItems.filter(
            (i) => i.status !== 'SKIPPED'
          ).length;

          return (
            <section key={category} className="space-y-3">
              {/* Category Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-800">
                  {category}
                </h2>
                <span className="text-sm text-neutral-500">
                  {completedInCategory} of {activeInCategory} completed
                </span>
              </div>

              {/* Category Progress Bar */}
              <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    completedInCategory === activeInCategory
                      ? 'bg-green-500'
                      : 'bg-primary-500'
                  )}
                  style={{
                    width: `${activeInCategory > 0 ? (completedInCategory / activeInCategory) * 100 : 0}%`,
                  }}
                />
              </div>

              {/* Items */}
              <div className="space-y-3">
                {categoryItems.map((item) => (
                  <PlanItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    isUpdating={
                      updateItemStatus.isPending &&
                      updateItemStatus.variables?.itemId === item.id
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-neutral-600">
              <strong className="text-neutral-700">How your plan works:</strong> We analyze your
              risk profile, connected accounts, and protected images to create personalized action
              items. Complete tasks at your own pace - every step strengthens your digital safety.
              Your plan updates automatically as your situation changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Default export for lazy loading
export default ProtectionPlan;
