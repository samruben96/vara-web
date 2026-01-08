import { z } from 'zod';
import { VALIDATION } from '../constants';

// Common Schemas
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .max(VALIDATION.email.maxLength, `Email must be less than ${VALIDATION.email.maxLength} characters`);

export const passwordSchema = z
  .string()
  .min(VALIDATION.password.minLength, `Password must be at least ${VALIDATION.password.minLength} characters`)
  .max(VALIDATION.password.maxLength, `Password must be less than ${VALIDATION.password.maxLength} characters`)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const displayNameSchema = z
  .string()
  .min(VALIDATION.displayName.minLength, `Name must be at least ${VALIDATION.displayName.minLength} characters`)
  .max(VALIDATION.displayName.maxLength, `Name must be less than ${VALIDATION.displayName.maxLength} characters`)
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

// Auth Schemas
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Profile Schemas
export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
});

// Onboarding Schemas
export const onboardingResponseSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  response: z.union([
    z.string(),
    z.array(z.string()),
    z.number(),
  ]),
});

export const submitOnboardingSchema = z.object({
  responses: z.array(onboardingResponseSchema),
});

// Image Schemas
export const uploadImageSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= 10 * 1024 * 1024,
    'Image must be less than 10MB'
  ).refine(
    (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    'Image must be JPEG, PNG, or WebP'
  ),
});

// Alert Schemas
export const alertStatusSchema = z.enum(['NEW', 'VIEWED', 'ACTIONED', 'DISMISSED']);

export const updateAlertStatusSchema = z.object({
  status: alertStatusSchema,
});

export const alertActionSchema = z.object({
  action: z.enum(['DISMISS', 'REPORT', 'ESCALATE', 'MARK_SAFE']),
  notes: z.string().max(1000).optional(),
});

// Protection Plan Schemas
export const protectionPlanItemStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']);

export const updateProtectionPlanItemSchema = z.object({
  status: protectionPlanItemStatusSchema,
});

// Scan Schemas
export const triggerScanSchema = z.object({
  type: z.enum(['IMAGE_SCAN', 'PROFILE_SCAN', 'BREACH_CHECK', 'BEHAVIORAL_ANALYSIS', 'FULL_SCAN']),
  targetId: z.string().uuid().optional(),
});

// Pagination Schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Type exports from schemas
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type OnboardingResponseInput = z.infer<typeof onboardingResponseSchema>;
export type SubmitOnboardingInput = z.infer<typeof submitOnboardingSchema>;
export type UpdateAlertStatusInput = z.infer<typeof updateAlertStatusSchema>;
export type AlertActionInput = z.infer<typeof alertActionSchema>;
export type UpdateProtectionPlanItemInput = z.infer<typeof updateProtectionPlanItemSchema>;
export type TriggerScanInput = z.infer<typeof triggerScanSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
