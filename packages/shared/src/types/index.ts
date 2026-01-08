// User Types
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string | null;
  riskLevel: RiskLevel;
  onboardingCompleted: boolean;
  protectionPlanId: string | null;
  createdAt: Date;
}

// Enums
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Platform =
  | 'INSTAGRAM'
  | 'TIKTOK'
  | 'FACEBOOK'
  | 'TWITTER'
  | 'LINKEDIN'
  | 'YOUTUBE'
  | 'OTHER';

export type AlertType =
  | 'IMAGE_MISUSE'
  | 'FAKE_PROFILE'
  | 'DATA_BREACH'
  | 'SUSPICIOUS_FOLLOWER'
  | 'BEHAVIORAL_CHANGE'
  | 'DEEPFAKE_DETECTED'
  | 'PROFILE_IMPERSONATION';

export type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'NEW' | 'VIEWED' | 'ACTIONED' | 'DISMISSED';

export type ImageMatchType = 'EXACT' | 'SIMILAR' | 'MODIFIED' | 'DEEPFAKE';

export type ImageMatchStatus = 'NEW' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';

export type ImageStatus = 'ACTIVE' | 'ARCHIVED';

export type ScanJobType =
  | 'IMAGE_SCAN'
  | 'PROFILE_SCAN'
  | 'BREACH_CHECK'
  | 'BEHAVIORAL_ANALYSIS'
  | 'FULL_SCAN';

export type ScanJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type ProtectionPlanItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

// Connected Accounts
export interface ConnectedAccount {
  id: string;
  userId: string;
  platform: Platform;
  platformUserId: string;
  lastSynced: Date | null;
  createdAt: Date;
}

// Protected Images
export interface ProtectedImage {
  id: string;
  userId: string;
  storageUrl: string;
  signedUrl?: string;
  uploadedAt: Date;
  lastScanned: Date | null;
  status: ImageStatus;
  archivedAt: Date | null;
}

// Image Matches
export interface ImageMatch {
  id: string;
  protectedImageId: string;
  sourceUrl: string;
  platform: string | null;
  similarity: number;
  matchType: ImageMatchType;
  detectedAt: Date;
  status: ImageMatchStatus;
}

// Alerts
export interface Alert {
  id: string;
  userId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  metadata: Record<string, unknown> | null;
  status: AlertStatus;
  createdAt: Date;
  viewedAt: Date | null;
  actionedAt: Date | null;
}

// Protection Plan
export interface ProtectionPlan {
  id: string;
  userId: string;
  generatedAt: Date;
  lastUpdated: Date;
  items: ProtectionPlanItem[];
}

export interface ProtectionPlanItem {
  id: string;
  planId: string;
  category: string;
  title: string;
  description: string;
  priority: number;
  status: ProtectionPlanItemStatus;
  dueDate: Date | null;
}

// Onboarding
export interface OnboardingQuestion {
  id: string;
  question: string;
  description: string | null;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SCALE' | 'TEXT';
  options: OnboardingOption[] | null;
  order: number;
  conditionalOn: ConditionalLogic | null;
}

export interface OnboardingOption {
  value: string;
  label: string;
  description?: string;
  riskWeight?: number;
}

export interface ConditionalLogic {
  questionId: string;
  values: string[];
}

export interface OnboardingResponse {
  id: string;
  userId: string;
  questionId: string;
  response: unknown;
  createdAt: Date;
}

// Scan Jobs
export interface ScanJob {
  id: string;
  userId: string;
  type: ScanJobType;
  status: ScanJobStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: PaginationMeta;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Auth Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  profile: UserProfile | null;
}
