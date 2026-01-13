/**
 * Protection Plan Generator
 *
 * Generates personalized protection plan items based on onboarding quiz responses.
 * Items follow Vara's design philosophy: supportive, actionable, and non-alarming.
 */

// Categories for plan items
export const PLAN_CATEGORIES = {
  IMAGE_PROTECTION: 'IMAGE_PROTECTION',
  ACCOUNT_SECURITY: 'ACCOUNT_SECURITY',
  PRIVACY_SETTINGS: 'PRIVACY_SETTINGS',
  EMERGENCY_PLANNING: 'EMERGENCY_PLANNING',
  MONITORING_SETUP: 'MONITORING_SETUP',
} as const;

export type PlanCategory = typeof PLAN_CATEGORIES[keyof typeof PLAN_CATEGORIES];

export interface PlanItemTemplate {
  category: PlanCategory;
  title: string;
  description: string;
  priority: number; // 1 = highest
  triggers: TriggerCondition[];
}

interface TriggerCondition {
  questionId: string;
  values: string[]; // Values that trigger this item
  priorityBoost?: number; // Optional priority boost when triggered
}

interface OnboardingResponse {
  questionId: string;
  response: unknown;
}

// ============================================================================
// Plan Item Templates
// ============================================================================

const PLAN_ITEM_TEMPLATES: PlanItemTemplate[] = [
  // IMAGE_PROTECTION items
  {
    category: PLAN_CATEGORIES.IMAGE_PROTECTION,
    title: 'Upload your photos for protection',
    description: 'Add photos you want to monitor across the web. We will scan for unauthorized use and alert you if we find anything.',
    priority: 2,
    triggers: [
      { questionId: 'photo-sharing', values: ['sometimes', 'frequently'] },
      { questionId: 'threat-concerns', values: ['image-misuse', 'deepfakes', 'impersonation'] },
      { questionId: 'unauthorized-use', values: ['yes-minor', 'yes-serious', 'unsure'] },
      { questionId: 'safety-priority', values: ['images'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.IMAGE_PROTECTION,
    title: 'Enable deepfake detection',
    description: 'Turn on advanced scanning to detect AI-generated images using your likeness. This provides an extra layer of protection.',
    priority: 1,
    triggers: [
      { questionId: 'threat-concerns', values: ['deepfakes'] },
      { questionId: 'online-presence', values: ['active', 'public-figure'] },
      { questionId: 'unauthorized-use', values: ['yes-serious'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.IMAGE_PROTECTION,
    title: 'Review image privacy settings',
    description: 'Check who can see and download your photos on social platforms. Small changes can significantly reduce unauthorized sharing.',
    priority: 3,
    triggers: [
      { questionId: 'photo-sharing', values: ['sometimes', 'frequently'] },
      { questionId: 'threat-concerns', values: ['image-misuse'] },
    ],
  },

  // ACCOUNT_SECURITY items
  {
    category: PLAN_CATEGORIES.ACCOUNT_SECURITY,
    title: 'Connect your social accounts',
    description: 'Link your social media accounts so we can monitor for suspicious activity and impersonation attempts.',
    priority: 2,
    triggers: [
      { questionId: 'platform-count', values: ['2-3', '4-5', '6+'] },
      { questionId: 'online-presence', values: ['moderate', 'active', 'public-figure'] },
      { questionId: 'threat-concerns', values: ['impersonation', 'stalking'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.ACCOUNT_SECURITY,
    title: 'Enable two-factor authentication',
    description: 'Add an extra layer of security to your accounts. This simple step prevents most unauthorized access attempts.',
    priority: 1,
    triggers: [
      { questionId: 'harassment-experience', values: ['sometimes', 'frequently'] },
      { questionId: 'relationship-concerns', values: ['past-concerns', 'current-mild', 'current-serious'] },
      { questionId: 'online-presence', values: ['active', 'public-figure'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.ACCOUNT_SECURITY,
    title: 'Audit connected apps and permissions',
    description: 'Review which apps have access to your social accounts. Removing unused connections reduces your exposure.',
    priority: 3,
    triggers: [
      { questionId: 'platform-count', values: ['4-5', '6+'] },
      { questionId: 'harassment-experience', values: ['sometimes', 'frequently'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.ACCOUNT_SECURITY,
    title: 'Update your passwords',
    description: 'Strong, unique passwords for each account are your first line of defense. We can help you create a secure system.',
    priority: 2,
    triggers: [
      { questionId: 'relationship-concerns', values: ['past-concerns', 'current-mild', 'current-serious'] },
      { questionId: 'threat-concerns', values: ['stalking', 'doxxing'] },
    ],
  },

  // PRIVACY_SETTINGS items
  {
    category: PLAN_CATEGORIES.PRIVACY_SETTINGS,
    title: 'Check for data breaches',
    description: 'See if your email or personal information has appeared in known data breaches. Knowledge is the first step to protection.',
    priority: 2,
    triggers: [
      { questionId: 'safety-priority', values: ['privacy', 'monitoring'] },
      { questionId: 'online-presence', values: ['moderate', 'active', 'public-figure'] },
      { questionId: 'threat-concerns', values: ['doxxing'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.PRIVACY_SETTINGS,
    title: 'Review profile visibility settings',
    description: 'Adjust who can find and view your profiles. Small tweaks can make a big difference in controlling your digital footprint.',
    priority: 2,
    triggers: [
      { questionId: 'online-presence', values: ['active', 'public-figure'] },
      { questionId: 'threat-concerns', values: ['stalking', 'doxxing'] },
      { questionId: 'safety-priority', values: ['privacy'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.PRIVACY_SETTINGS,
    title: 'Remove personal info from data brokers',
    description: 'Your information may be listed on data broker sites. We can guide you through requesting removal.',
    priority: 3,
    triggers: [
      { questionId: 'threat-concerns', values: ['doxxing', 'stalking'] },
      { questionId: 'relationship-concerns', values: ['current-mild', 'current-serious'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.PRIVACY_SETTINGS,
    title: 'Audit your digital footprint',
    description: 'Discover where your information appears online. Understanding your exposure helps you take targeted action.',
    priority: 3,
    triggers: [
      { questionId: 'online-presence', values: ['active', 'public-figure'] },
      { questionId: 'safety-priority', values: ['privacy'] },
    ],
  },

  // EMERGENCY_PLANNING items
  {
    category: PLAN_CATEGORIES.EMERGENCY_PLANNING,
    title: 'Set up safety contacts',
    description: 'Choose trusted people who can be notified if something concerning happens. You are not alone in this.',
    priority: 1,
    triggers: [
      { questionId: 'relationship-concerns', values: ['current-mild', 'current-serious'] },
      { questionId: 'harassment-experience', values: ['frequently'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.EMERGENCY_PLANNING,
    title: 'Create an evidence preservation plan',
    description: 'Learn how to safely document and store evidence if you need it later. Being prepared gives you options.',
    priority: 2,
    triggers: [
      { questionId: 'relationship-concerns', values: ['current-mild', 'current-serious'] },
      { questionId: 'harassment-experience', values: ['sometimes', 'frequently'] },
      { questionId: 'unauthorized-use', values: ['yes-serious'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.EMERGENCY_PLANNING,
    title: 'Review emergency resources',
    description: 'Familiarize yourself with support organizations and reporting options. It helps to know your choices ahead of time.',
    priority: 2,
    triggers: [
      { questionId: 'relationship-concerns', values: ['current-serious'] },
      { questionId: 'harassment-experience', values: ['frequently'] },
    ],
  },

  // MONITORING_SETUP items
  {
    category: PLAN_CATEGORIES.MONITORING_SETUP,
    title: 'Configure alert preferences',
    description: 'Choose how and when you want to be notified about potential issues. Stay informed without feeling overwhelmed.',
    priority: 2,
    triggers: [
      { questionId: 'safety-priority', values: ['monitoring'] },
      { questionId: 'harassment-experience', values: ['sometimes', 'frequently'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.MONITORING_SETUP,
    title: 'Set up follower monitoring',
    description: 'Enable tracking for suspicious follower patterns and account activity. We will watch so you can relax.',
    priority: 3,
    triggers: [
      { questionId: 'threat-concerns', values: ['stalking', 'harassment'] },
      { questionId: 'online-presence', values: ['active', 'public-figure'] },
    ],
  },
  {
    category: PLAN_CATEGORIES.MONITORING_SETUP,
    title: 'Enable impersonation detection',
    description: 'We will continuously scan for fake profiles using your name or photos. Get alerted the moment something appears.',
    priority: 1,
    triggers: [
      { questionId: 'threat-concerns', values: ['impersonation'] },
      { questionId: 'online-presence', values: ['public-figure'] },
      { questionId: 'unauthorized-use', values: ['yes-minor', 'yes-serious'] },
    ],
  },
];

// ============================================================================
// Core Generator Logic
// ============================================================================

/**
 * Calculates a match score for a plan item based on quiz responses.
 * Higher scores indicate stronger relevance to the user's situation.
 */
function calculateItemScore(
  template: PlanItemTemplate,
  responses: OnboardingResponse[]
): number {
  let score = 0;
  let matchedTriggers = 0;

  for (const trigger of template.triggers) {
    const response = responses.find((r) => r.questionId === trigger.questionId);
    if (!response) continue;

    const responseValues = Array.isArray(response.response)
      ? response.response
      : [response.response];

    // Check if any response value matches the trigger values
    const hasMatch = responseValues.some((val) =>
      trigger.values.includes(val as string)
    );

    if (hasMatch) {
      matchedTriggers++;
      score += 1 + (trigger.priorityBoost || 0);
    }
  }

  // Bonus for multiple trigger matches (indicates high relevance)
  if (matchedTriggers >= 2) {
    score += matchedTriggers * 0.5;
  }

  return score;
}

/**
 * Generates a personalized protection plan based on onboarding responses.
 * Returns 5-8 items tailored to the user's specific concerns and risk profile.
 */
export function generateProtectionPlan(
  responses: OnboardingResponse[],
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): Array<{
  category: string;
  title: string;
  description: string;
  priority: number;
  status: 'PENDING';
}> {
  // Score each template based on relevance to responses
  const scoredTemplates = PLAN_ITEM_TEMPLATES.map((template) => ({
    template,
    score: calculateItemScore(template, responses),
  }));

  // Filter to items with positive scores (at least one trigger matched)
  const relevantItems = scoredTemplates.filter((item) => item.score > 0);

  // Sort by score (descending), then by priority (ascending)
  relevantItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.template.priority - b.template.priority;
  });

  // Determine target count based on risk level
  const targetCounts: Record<string, { min: number; max: number }> = {
    LOW: { min: 5, max: 6 },
    MEDIUM: { min: 5, max: 7 },
    HIGH: { min: 6, max: 8 },
    CRITICAL: { min: 7, max: 8 },
  };

  const { min, max } = targetCounts[riskLevel] || { min: 5, max: 8 };

  // Select items ensuring category diversity
  const selectedItems: Array<{
    template: PlanItemTemplate;
    score: number;
  }> = [];
  const categoryCount: Record<string, number> = {};

  // First pass: ensure at least one item per category if available
  for (const item of relevantItems) {
    const category = item.template.category;
    if (!categoryCount[category] && selectedItems.length < max) {
      selectedItems.push(item);
      categoryCount[category] = 1;
    }
  }

  // Second pass: fill remaining slots with highest-scoring items
  for (const item of relevantItems) {
    if (selectedItems.length >= max) break;
    if (selectedItems.includes(item)) continue;

    const category = item.template.category;
    // Limit any single category to 3 items max
    if ((categoryCount[category] || 0) < 3) {
      selectedItems.push(item);
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    }
  }

  // If we don't have enough items, add essential defaults
  if (selectedItems.length < min) {
    const essentialDefaults = [
      {
        category: PLAN_CATEGORIES.IMAGE_PROTECTION,
        title: 'Upload your photos for protection',
        description: 'Add photos you want to monitor across the web. We will scan for unauthorized use and alert you if we find anything.',
        priority: 2,
      },
      {
        category: PLAN_CATEGORIES.ACCOUNT_SECURITY,
        title: 'Connect your social accounts',
        description: 'Link your social media accounts so we can monitor for suspicious activity and impersonation attempts.',
        priority: 2,
      },
      {
        category: PLAN_CATEGORIES.PRIVACY_SETTINGS,
        title: 'Check for data breaches',
        description: 'See if your email or personal information has appeared in known data breaches. Knowledge is the first step to protection.',
        priority: 2,
      },
      {
        category: PLAN_CATEGORIES.MONITORING_SETUP,
        title: 'Configure alert preferences',
        description: 'Choose how and when you want to be notified about potential issues. Stay informed without feeling overwhelmed.',
        priority: 3,
      },
      {
        category: PLAN_CATEGORIES.ACCOUNT_SECURITY,
        title: 'Enable two-factor authentication',
        description: 'Add an extra layer of security to your accounts. This simple step prevents most unauthorized access attempts.',
        priority: 1,
      },
    ];

    for (const def of essentialDefaults) {
      if (selectedItems.length >= min) break;
      // Check if we already have this item
      const alreadyIncluded = selectedItems.some(
        (item) => item.template.title === def.title
      );
      if (!alreadyIncluded) {
        selectedItems.push({
          template: def as PlanItemTemplate,
          score: 0.5, // Low score to place after matched items
        });
      }
    }
  }

  // Re-sort final selection by priority
  selectedItems.sort((a, b) => a.template.priority - b.template.priority);

  // Assign final priorities (1 through N)
  return selectedItems.map((item, index) => ({
    category: item.template.category,
    title: item.template.title,
    description: item.template.description,
    priority: index + 1,
    status: 'PENDING' as const,
  }));
}

/**
 * Gets a summary of what areas the plan focuses on based on categories.
 * Useful for showing users what their plan emphasizes.
 */
export function getPlanFocusAreas(
  planItems: Array<{ category: string }>
): string[] {
  const categoryLabels: Record<string, string> = {
    [PLAN_CATEGORIES.IMAGE_PROTECTION]: 'Image Protection',
    [PLAN_CATEGORIES.ACCOUNT_SECURITY]: 'Account Security',
    [PLAN_CATEGORIES.PRIVACY_SETTINGS]: 'Privacy Settings',
    [PLAN_CATEGORIES.EMERGENCY_PLANNING]: 'Emergency Planning',
    [PLAN_CATEGORIES.MONITORING_SETUP]: 'Monitoring Setup',
  };

  const categories = [...new Set(planItems.map((item) => item.category))];
  return categories.map((cat) => categoryLabels[cat] || cat);
}
