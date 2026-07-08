import { initContract } from '@ts-rest/core';
import {
  registrationSchema,
  registrationDetailSchema,
  registrationListSchema,
  registrationListQuerySchema,
  studentVerificationListQuerySchema,
  createRegistrationSchema,
  initiatePaymentSchema,
  initiatePaymentResponseSchema,
  initiateStudentDocUploadSchema,
  initiateStudentDocUploadResponseSchema,
  completeStudentDocUploadSchema,
  studentVerificationSchema,
  studentVerificationListSchema,
  reviewVerificationSchema,
  refundSchema,
  extendDeadlineSchema,
  invoiceSchema,
  billingActionResponseSchema,
  problemEnvelopeSchema,
} from '@openconferences/schemas';
import { z } from 'zod';

const c = initContract();

const conferenceParams = z.object({
  conferenceId: z.string().uuid(),
});

const paperParams = z.object({
  conferenceId: z.string().uuid(),
  paperId: z.string().uuid(),
});

const registrationParams = z.object({
  conferenceId: z.string().uuid(),
  registrationId: z.string().uuid(),
});

const verificationParams = z.object({
  conferenceId: z.string().uuid(),
  verificationId: z.string().uuid(),
});

const idempotencyHeaders = z.object({
  'idempotency-key': z.string().min(1).max(128),
});

export const billingContract = c.router({
  getRegistration: {
    method: 'GET',
    path: '/conferences/:conferenceId/papers/:paperId/registration',
    pathParams: paperParams,
    responses: {
      200: registrationDetailSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Get registration for an accepted paper',
  },
  createRegistration: {
    method: 'POST',
    path: '/conferences/:conferenceId/papers/:paperId/registration',
    pathParams: paperParams,
    body: createRegistrationSchema,
    responses: {
      201: registrationSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
      422: problemEnvelopeSchema,
    },
    summary: 'Choose registration audience (REGULAR/STUDENT)',
  },
  initiateStudentDocUpload: {
    method: 'POST',
    path: '/conferences/:conferenceId/papers/:paperId/registration/student-verification/initiate',
    pathParams: paperParams,
    body: initiateStudentDocUploadSchema,
    responses: {
      200: initiateStudentDocUploadResponseSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      422: problemEnvelopeSchema,
    },
    summary: 'Presign upload for student verification document',
  },
  completeStudentDocUpload: {
    method: 'POST',
    path: '/conferences/:conferenceId/papers/:paperId/registration/student-verification/complete',
    pathParams: paperParams,
    body: completeStudentDocUploadSchema,
    responses: {
      201: studentVerificationSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      422: problemEnvelopeSchema,
    },
    summary: 'Finalize student verification document upload',
  },
  initiatePayment: {
    method: 'POST',
    path: '/conferences/:conferenceId/papers/:paperId/registration/payment',
    pathParams: paperParams,
    headers: idempotencyHeaders,
    body: initiatePaymentSchema,
    responses: {
      200: initiatePaymentResponseSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
      422: problemEnvelopeSchema,
    },
    summary: 'Initiate payment for registration',
  },
  getInvoice: {
    method: 'GET',
    path: '/conferences/:conferenceId/papers/:paperId/registration/invoice',
    pathParams: paperParams,
    responses: {
      200: invoiceSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Download invoice for captured payment',
  },
  listRegistrations: {
    method: 'GET',
    path: '/conferences/:conferenceId/registrations',
    pathParams: conferenceParams,
    query: registrationListQuerySchema,
    responses: {
      200: registrationListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List all registrations for a conference (organizer)',
  },
  listStudentVerifications: {
    method: 'GET',
    path: '/conferences/:conferenceId/student-verifications',
    pathParams: conferenceParams,
    query: studentVerificationListQuerySchema,
    responses: {
      200: studentVerificationListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List pending student verifications (organizer)',
  },
  reviewStudentVerification: {
    method: 'POST',
    path: '/conferences/:conferenceId/student-verifications/:verificationId/review',
    pathParams: verificationParams,
    body: reviewVerificationSchema,
    responses: {
      200: billingActionResponseSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Approve, clarify, or reject a student verification',
  },
  refundRegistration: {
    method: 'POST',
    path: '/conferences/:conferenceId/registrations/:registrationId/refund',
    pathParams: registrationParams,
    body: refundSchema,
    responses: {
      200: billingActionResponseSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Refund a registration payment (MFA-gated)',
  },
  extendRegistrationDeadline: {
    method: 'POST',
    path: '/conferences/:conferenceId/registrations/:registrationId/extend-deadline',
    pathParams: registrationParams,
    body: extendDeadlineSchema,
    responses: {
      200: billingActionResponseSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Extend registration deadline (MFA-gated)',
  },
});

export const webhookContract = c.router({
  razorpay: {
    method: 'POST',
    path: '/webhooks/razorpay',
    body: c.type<{ [key: string]: unknown }>(),
    responses: {
      200: z.object({ received: z.boolean() }),
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
    },
    summary: 'Razorpay payment webhook (raw body verified)',
  },
  zeptomail: {
    method: 'POST',
    path: '/webhooks/zeptomail',
    body: c.type<{ [key: string]: unknown }>(),
    responses: {
      200: z.object({ received: z.boolean() }),
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
    },
    summary: 'Zepto Mail bounce/complaint webhook',
  },
});

export type BillingContract = typeof billingContract;
export type WebhookContract = typeof webhookContract;
