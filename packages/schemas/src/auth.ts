import { z } from 'zod';
import { conferenceStatusSchema, roleKindSchema } from './tenancy.js';
import { paperStatusSchema } from './submission.js';
import { assignmentStatusSchema } from './review.js';

export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export type SignInInput = z.input<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().min(6, 'Code must be 6 digits').max(8, 'Code must be at most 8 characters'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const mfaEnrollSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export type MfaEnrollInput = z.infer<typeof mfaEnrollSchema>;

export const mfaVerifySchema = z.object({
  code: z.string().min(6, 'Code must be 6 digits').max(8, 'Code must be at most 8 characters'),
  trustDevice: z.boolean().optional(),
});

export type MfaVerifyInput = z.input<typeof mfaVerifySchema>;

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional(),
  twoFactorEnabled: z.boolean().nullable().optional(),
  createdAt: z.string().datetime(),
  hasPassword: z.boolean(),
  needsProfileSetup: z.boolean(),
});

export const accountSetupSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type AccountSetupInput = z.infer<typeof accountSetupSchema>;

export type UserProfile = z.infer<typeof userProfileSchema>;

export const meDashboardPaperSchema = z.object({
  id: z.string().uuid(),
  conferenceId: z.string().uuid(),
  conferenceName: z.string(),
  conferenceSlug: z.string(),
  title: z.string(),
  status: paperStatusSchema,
  updatedAt: z.string().datetime(),
});

export const meDashboardAssignmentSchema = z.object({
  id: z.string().uuid(),
  conferenceId: z.string().uuid(),
  conferenceName: z.string(),
  conferenceSlug: z.string(),
  paperId: z.string().uuid(),
  paperTitle: z.string(),
  status: assignmentStatusSchema,
  dueAt: z.string().datetime().nullable(),
  roundNumber: z.number().int(),
});

export const meDashboardOrganizerConferenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: conferenceStatusSchema,
  myRoles: z.array(roleKindSchema),
});

export const meDashboardSchema = z.object({
  authoredPapers: z.array(meDashboardPaperSchema),
  reviewerAssignments: z.array(meDashboardAssignmentSchema),
  organizerConferences: z.array(meDashboardOrganizerConferenceSchema),
  /** True when the user has ORG_ADMIN or PLATFORM_ADMIN on any membership (incl. org-scoped). */
  canCreateConference: z.boolean(),
});

export type MeDashboard = z.infer<typeof meDashboardSchema>;

export const sessionUserSchema = z.object({
  user: userProfileSchema,
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export const genericAuthMessageSchema = z.object({
  message: z.string(),
});

export type GenericAuthMessage = z.infer<typeof genericAuthMessageSchema>;

export const mfaEnrollResponseSchema = z.object({
  totpURI: z.string(),
  backupCodes: z.array(z.string()),
});

export type MfaEnrollResponse = z.infer<typeof mfaEnrollResponseSchema>;

/** Shared email job payload for pg-boss queue */
export const emailJobPayloadSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  replyTo: z.string().email().optional(),
  tags: z.array(z.string()).optional(),
  idempotencyKey: z.string().optional(),
});

export type EmailJobPayload = z.infer<typeof emailJobPayloadSchema>;

export const EMAIL_SEND_JOB_NAME = 'email.send' as const;
