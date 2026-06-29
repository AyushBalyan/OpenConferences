import { initContract } from '@ts-rest/core';
import {
  healthResponseSchema,
  readinessResponseSchema,
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  mfaEnrollSchema,
  mfaVerifySchema,
  userProfileSchema,
  genericAuthMessageSchema,
  mfaEnrollResponseSchema,
  problemEnvelopeSchema,
} from '@openconferences/schemas';

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
    summary: 'Verify email address with token',
  },
  resendVerification: {
    method: 'POST',
    path: '/auth/resend-verification',
    body: resendVerificationSchema,
    responses: {
      200: genericAuthMessageSchema,
      429: problemEnvelopeSchema,
    },
    summary: 'Resend email verification link',
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
});

export type AuthContract = typeof authContract;

export const apiContract = c.router({
  health: healthContract,
  auth: authContract,
});

export type ApiContract = typeof apiContract;
