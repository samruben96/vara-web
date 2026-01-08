// Risk Level Configuration
export const RISK_LEVELS = {
  LOW: {
    label: 'Low',
    color: '#22C55E',
    description: 'Minimal digital exposure detected',
  },
  MEDIUM: {
    label: 'Moderate',
    color: '#F59E0B',
    description: 'Some areas need attention',
  },
  HIGH: {
    label: 'High',
    color: '#EF4444',
    description: 'Several vulnerabilities detected',
  },
  CRITICAL: {
    label: 'Critical',
    color: '#DC2626',
    description: 'Immediate action recommended',
  },
} as const;

// Alert Severity Configuration
export const ALERT_SEVERITIES = {
  INFO: {
    label: 'Information',
    color: '#3B82F6',
    priority: 1,
  },
  LOW: {
    label: 'Low',
    color: '#22C55E',
    priority: 2,
  },
  MEDIUM: {
    label: 'Moderate',
    color: '#F59E0B',
    priority: 3,
  },
  HIGH: {
    label: 'High',
    color: '#F97316',
    priority: 4,
  },
  CRITICAL: {
    label: 'Critical',
    color: '#EF4444',
    priority: 5,
  },
} as const;

// Platform Configuration
export const PLATFORMS = {
  INSTAGRAM: {
    name: 'Instagram',
    icon: 'instagram',
    oauthSupported: true,
  },
  TIKTOK: {
    name: 'TikTok',
    icon: 'tiktok',
    oauthSupported: true,
  },
  FACEBOOK: {
    name: 'Facebook',
    icon: 'facebook',
    oauthSupported: true,
  },
  TWITTER: {
    name: 'X (Twitter)',
    icon: 'twitter',
    oauthSupported: false,
  },
  LINKEDIN: {
    name: 'LinkedIn',
    icon: 'linkedin',
    oauthSupported: false,
  },
  YOUTUBE: {
    name: 'YouTube',
    icon: 'youtube',
    oauthSupported: false,
  },
  OTHER: {
    name: 'Other',
    icon: 'globe',
    oauthSupported: false,
  },
} as const;

// Image Upload Configuration
export const IMAGE_CONFIG = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  maxSizeMB: 10,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  maxImagesPerUser: 50,
} as const;

// Scan Configuration
export const SCAN_CONFIG = {
  imageScanning: {
    minSimilarityThreshold: 0.85,
    deepfakeConfidenceThreshold: 0.7,
  },
  behavioral: {
    followerSurgeThreshold: 50, // % increase
    suspiciousAccountThreshold: 0.6,
  },
  polling: {
    defaultIntervalMs: 30000,
    maxRetries: 3,
  },
} as const;

// API Routes
export const API_ROUTES = {
  auth: {
    signup: '/api/v1/auth/signup',
    login: '/api/v1/auth/login',
    logout: '/api/v1/auth/logout',
    refresh: '/api/v1/auth/refresh',
    forgotPassword: '/api/v1/auth/forgot-password',
    resetPassword: '/api/v1/auth/reset-password',
  },
  users: {
    me: '/api/v1/users/me',
  },
  onboarding: {
    questions: '/api/v1/onboarding/questions',
    responses: '/api/v1/onboarding/responses',
    results: '/api/v1/onboarding/results',
  },
  accounts: {
    list: '/api/v1/accounts',
    connect: (platform: string) => `/api/v1/accounts/connect/${platform}`,
    disconnect: (id: string) => `/api/v1/accounts/${id}`,
    sync: (id: string) => `/api/v1/accounts/${id}/sync`,
  },
  images: {
    list: '/api/v1/images',
    upload: '/api/v1/images/upload',
    delete: (id: string) => `/api/v1/images/${id}`,
    matches: (id: string) => `/api/v1/images/${id}/matches`,
  },
  alerts: {
    list: '/api/v1/alerts',
    get: (id: string) => `/api/v1/alerts/${id}`,
    updateStatus: (id: string) => `/api/v1/alerts/${id}/status`,
    action: (id: string) => `/api/v1/alerts/${id}/action`,
  },
  protectionPlan: {
    get: '/api/v1/protection-plan',
    updateItem: (id: string) => `/api/v1/protection-plan/items/${id}`,
    regenerate: '/api/v1/protection-plan/regenerate',
  },
  scans: {
    list: '/api/v1/scans',
    trigger: '/api/v1/scans/trigger',
    status: (id: string) => `/api/v1/scans/${id}/status`,
  },
} as const;

// Validation Limits
export const VALIDATION = {
  email: {
    maxLength: 255,
  },
  password: {
    minLength: 8,
    maxLength: 128,
  },
  displayName: {
    minLength: 2,
    maxLength: 50,
  },
} as const;
