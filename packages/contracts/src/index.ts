import { initContract } from '@ts-rest/core';
import {
  healthResponseSchema,
  readinessResponseSchema,
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  accountSetupSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  mfaEnrollSchema,
  mfaVerifySchema,
  userProfileSchema,
  meDashboardSchema,
  genericAuthMessageSchema,
  mfaEnrollResponseSchema,
  problemEnvelopeSchema,
} from '@openconferences/schemas';
import { organizationsContract, conferencesContract } from './tenancy.js';
import { submissionContract } from './submission.js';
import { reviewContract } from './review.js';
import { billingContract, webhookContract } from './billing.js';
import { messagingContract } from './messaging.js';
import { analyticsContract } from './analytics.js';

const c = initContract();

export const healthContract = c.router({
  healthz: {
    method: 'GET',
    path: '/healthz',
    responses: {
      200: healthResponseSchema,
    },
    summary: 'Liveness probe',
  },
  readyz: {
    method: 'GET',
    path: '/readyz',
    responses: {
      200: readinessResponseSchema,
      503: readinessResponseSchema,
    },
    summary: 'Readiness probe',
  },
});

export type HealthContract = typeof healthContract;

export const authContract = c.router({
  signUp: {
    method: 'POST',
    path: '/auth/sign-up',
    body: signUpSchema,
    responses: {
      200: genericAuthMessageSchema,
      400: problemEnvelopeSchema,
      429: problemEnvelopeSchema,
    },
    summary: 'Register a new user account',
  },
  signIn: {
    method: 'POST',
    path: '/auth/sign-in',
    body: signInSchema,
    responses: {
      200: genericAuthMessageSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      429: problemEnvelopeSchema,
    },
    summary: 'Sign in with email and password',
  },
  signOut: {
    method: 'POST',
    path: '/auth/sign-out',
    body: c.noBody(),
    responses: {
      200: genericAuthMessageSchema,
      401: problemEnvelopeSchema,
    },
    summary: 'Sign out and revoke session',
  },
  verifyEmail: {
    method: 'POST',
    path: '/auth/verify-email',
    body: verifyEmailSchema,
    responses: {
      200: genericAuthMessageSchema,
      400: problemEnvelopeSchema,
    },
    summary: 'Verify email address with a one-time code',
  },
  resendVerification: {
    method: 'POST',
    path: '/auth/resend-verification',
    body: resendVerificationSchema,
    responses: {
      200: genericAuthMessageSchema,
      429: problemEnvelopeSchema,
    },
    summary: 'Resend email verification OTP',
  },
  forgotPassword: {
    method: 'POST',
    path: '/auth/forgot-password',
    body: forgotPasswordSchema,
    responses: {
      200: genericAuthMessageSchema,
      429: problemEnvelopeSchema,
    },
    summary: 'Request password reset email',
  },
  resetPassword: {
    method: 'POST',
    path: '/auth/reset-password',
    body: resetPasswordSchema,
    responses: {
      200: genericAuthMessageSchema,
      400: problemEnvelopeSchema,
    },
    summary: 'Reset password with token',
  },
  mfaEnroll: {
    method: 'POST',
    path: '/auth/mfa/enroll',
    body: mfaEnrollSchema,
    responses: {
      200: mfaEnrollResponseSchema,
      401: problemEnvelopeSchema,
    },
    summary: 'Begin TOTP MFA enrollment',
  },
  mfaVerify: {
    method: 'POST',
    path: '/auth/mfa/verify',
    body: mfaVerifySchema,
    responses: {
      200: genericAuthMessageSchema,
      401: problemEnvelopeSchema,
    },
    summary: 'Verify TOTP code during sign-in or enrollment',
  },
  me: {
    method: 'GET',
    path: '/auth/me',
    responses: {
      200: userProfileSchema,
      401: problemEnvelopeSchema,
    },
    summary: 'Get current authenticated user profile',
  },
  setupAccount: {
    method: 'POST',
    path: '/auth/account/setup',
    body: accountSetupSchema,
    responses: {
      200: genericAuthMessageSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Set display name and password for passwordless accounts',
  },
  dashboard: {
    method: 'GET',
    path: '/me/dashboard',
    responses: {
      200: meDashboardSchema,
      401: problemEnvelopeSchema,
    },
    summary: 'Cross-conference aggregated dashboard home',
  },
});

export type AuthContract = typeof authContract;

export const apiContract = c.router({
  health: healthContract,
  auth: authContract,
  organizations: organizationsContract,
  conferences: conferencesContract,
  submission: submissionContract,
  review: reviewContract,
  billing: billingContract,
  webhooks: webhookContract,
  messaging: messagingContract,
  analytics: analyticsContract,
});

export type ApiContract = typeof apiContract;

export { organizationsContract, conferencesContract } from './tenancy.js';
export type { OrganizationsContract, ConferencesContract } from './tenancy.js';
export { submissionContract } from './submission.js';
export type { SubmissionContract } from './submission.js';
export { reviewContract } from './review.js';
export type { ReviewContract } from './review.js';
export { billingContract, webhookContract } from './billing.js';
export type { BillingContract, WebhookContract } from './billing.js';
export { messagingContract } from './messaging.js';
export type { MessagingContract } from './messaging.js';
export { analyticsContract } from './analytics.js';
export type { AnalyticsContract } from './analytics.js';
