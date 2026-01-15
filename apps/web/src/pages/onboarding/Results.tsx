import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Check, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { cn } from '../../lib/cn';
import type { RiskLevel } from '@vara/shared';

/**
 * Results page showing the generated protection plan
 * Displays risk level and personalized recommendations
 */
export function Results() {
  const navigate = useNavigate();
  const { riskLevel, protectionPlan, reset } = useOnboardingStore();

  // If no results, redirect back to quiz
  useEffect(() => {
    if (!riskLevel && !protectionPlan) {
      // Allow component to render with mock data for development
      // In production, this would redirect
      // navigate('/onboarding');
    }
  }, [riskLevel, protectionPlan, navigate]);

  // Handle continuing to dashboard
  const handleContinue = () => {
    reset();
    navigate('/dashboard');
  };

  // Risk level display configuration
  const riskLevelConfig: Record<
    RiskLevel,
    { label: string; color: string; bgColor: string; description: string }
  > = {
    LOW: {
      label: 'Low Risk',
      color: 'text-success-foreground-subtle',
      bgColor: 'bg-success-subtle',
      description:
        'Your digital presence is relatively secure. We recommend some basic protective measures.',
    },
    MEDIUM: {
      label: 'Moderate Risk',
      color: 'text-warning-foreground-subtle',
      bgColor: 'bg-warning-subtle',
      description:
        'There are some areas where we can strengthen your digital safety.',
    },
    HIGH: {
      label: 'Elevated Risk',
      color: 'text-alert-high-text',
      bgColor: 'bg-alert-high-bg',
      description:
        'We have identified areas that need attention. Your personalized plan will help address them.',
    },
    CRITICAL: {
      label: 'Priority Protection',
      color: 'text-alert-critical-text',
      bgColor: 'bg-alert-critical-bg',
      description:
        'Your safety is our priority. We have prepared immediate protective measures for you.',
    },
  };

  // Use mock data if no results (for development/demo)
  const displayRiskLevel = riskLevel || 'MEDIUM';
  const riskConfig = riskLevelConfig[displayRiskLevel];

  // Category labels for display (convert from API format to human-readable)
  const categoryLabels: Record<string, string> = {
    IMAGE_PROTECTION: 'Image Protection',
    ACCOUNT_SECURITY: 'Account Security',
    PRIVACY_SETTINGS: 'Privacy Settings',
    EMERGENCY_PLANNING: 'Emergency Planning',
    MONITORING_SETUP: 'Monitoring Setup',
    // Legacy categories for backward compatibility
    Images: 'Image Protection',
    Accounts: 'Account Security',
    Privacy: 'Privacy Settings',
  };

  // Mock protection plan items if none exist (for development/demo)
  const planItems = protectionPlan?.items || [
    {
      id: '1',
      category: 'ACCOUNT_SECURITY',
      title: 'Enable two-factor authentication',
      description:
        'Add an extra layer of security to your accounts. This simple step prevents most unauthorized access attempts.',
      priority: 1,
      status: 'PENDING' as const,
    },
    {
      id: '2',
      category: 'IMAGE_PROTECTION',
      title: 'Upload your photos for protection',
      description:
        'Add photos you want to monitor across the web. We will scan for unauthorized use and alert you if we find anything.',
      priority: 2,
      status: 'PENDING' as const,
    },
    {
      id: '3',
      category: 'PRIVACY_SETTINGS',
      title: 'Check for data breaches',
      description:
        'See if your email or personal information has appeared in known data breaches. Knowledge is the first step to protection.',
      priority: 3,
      status: 'PENDING' as const,
    },
    {
      id: '4',
      category: 'ACCOUNT_SECURITY',
      title: 'Connect your social accounts',
      description:
        'Link your social media accounts so we can monitor for suspicious activity and impersonation attempts.',
      priority: 4,
      status: 'PENDING' as const,
    },
    {
      id: '5',
      category: 'MONITORING_SETUP',
      title: 'Configure alert preferences',
      description:
        'Choose how and when you want to be notified about potential issues. Stay informed without feeling overwhelmed.',
      priority: 5,
      status: 'PENDING' as const,
    },
  ];

  // Helper to get display category name
  const getCategoryLabel = (category: string) =>
    categoryLabels[category] || category;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Success header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success-subtle">
          <Sparkles className="h-8 w-8 text-success" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          Your protection plan is ready
        </h1>
        <p className="mt-2 text-foreground-muted">
          Based on your answers, we've created a personalized safety plan.
        </p>
      </div>

      {/* Risk level card */}
      <div
        className={cn(
          'rounded-2xl p-6 text-center',
          riskConfig.bgColor
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <Shield className={cn('h-5 w-5', riskConfig.color)} />
          <span className={cn('font-semibold', riskConfig.color)}>
            {riskConfig.label}
          </span>
        </div>
        <p className={cn('mt-2 text-sm', riskConfig.color)}>
          {riskConfig.description}
        </p>
      </div>

      {/* Protection plan items */}
      <div className="space-y-4">
        <h2 className="font-semibold text-foreground">
          Your personalized action items
        </h2>

        <div className="space-y-3">
          {planItems.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              {/* Priority number */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-sm font-semibold text-primary">
                {index + 1}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-primary">
                    {getCategoryLabel(item.category)}
                  </span>
                </div>
                <h3 className="mt-1 font-medium text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-foreground-muted">
                  {item.description}
                </p>
              </div>

              {/* Status indicator */}
              <div className="shrink-0">
                {item.status === 'COMPLETED' ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success-subtle">
                    <Check className="h-4 w-4 text-success" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-border-strong" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA buttons */}
      <div className="space-y-4 pt-4">
        <Button size="lg" className="w-full gap-2" onClick={handleContinue}>
          <span>Go to dashboard</span>
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-center text-sm text-foreground-muted">
          You can always update your plan from the dashboard
        </p>
      </div>
    </div>
  );
}
