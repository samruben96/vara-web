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
      color: 'text-success-700',
      bgColor: 'bg-success-100',
      description:
        'Your digital presence is relatively secure. We recommend some basic protective measures.',
    },
    MEDIUM: {
      label: 'Moderate Risk',
      color: 'text-warning-700',
      bgColor: 'bg-warning-100',
      description:
        'There are some areas where we can strengthen your digital safety.',
    },
    HIGH: {
      label: 'Elevated Risk',
      color: 'text-alert-700',
      bgColor: 'bg-alert-100',
      description:
        'We have identified areas that need attention. Your personalized plan will help address them.',
    },
    CRITICAL: {
      label: 'Priority Protection',
      color: 'text-alert-800',
      bgColor: 'bg-alert-100',
      description:
        'Your safety is our priority. We have prepared immediate protective measures for you.',
    },
  };

  // Use mock data if no results (for development/demo)
  const displayRiskLevel = riskLevel || 'MEDIUM';
  const riskConfig = riskLevelConfig[displayRiskLevel];

  // Mock protection plan items if none exist
  const planItems = protectionPlan?.items || [
    {
      id: '1',
      category: 'Privacy',
      title: 'Review social media privacy settings',
      description:
        'Ensure your accounts are set to private and limit who can see your posts.',
      priority: 1,
      status: 'PENDING' as const,
    },
    {
      id: '2',
      category: 'Image Protection',
      title: 'Upload photos for monitoring',
      description:
        'Add your photos so we can scan for unauthorized use across the web.',
      priority: 2,
      status: 'PENDING' as const,
    },
    {
      id: '3',
      category: 'Account Security',
      title: 'Enable two-factor authentication',
      description:
        'Add an extra layer of security to your important accounts.',
      priority: 3,
      status: 'PENDING' as const,
    },
    {
      id: '4',
      category: 'Digital Footprint',
      title: 'Review data broker exposure',
      description:
        'Check if your personal information is listed on data broker sites.',
      priority: 4,
      status: 'PENDING' as const,
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      {/* Success header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success-100">
          <Sparkles className="h-8 w-8 text-success-600" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
          Your protection plan is ready
        </h1>
        <p className="mt-2 text-neutral-600">
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
        <h2 className="font-semibold text-neutral-900">
          Your personalized action items
        </h2>

        <div className="space-y-3">
          {planItems.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              {/* Priority number */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                {index + 1}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-primary-600">
                    {item.category}
                  </span>
                </div>
                <h3 className="mt-1 font-medium text-neutral-900">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-neutral-600">
                  {item.description}
                </p>
              </div>

              {/* Status indicator */}
              <div className="shrink-0">
                {item.status === 'COMPLETED' ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success-100">
                    <Check className="h-4 w-4 text-success-600" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-neutral-300" />
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

        <p className="text-center text-sm text-neutral-500">
          You can always update your plan from the dashboard
        </p>
      </div>
    </div>
  );
}
