import { z } from 'zod';
import { feeScheduleSchema } from './tenancy.js';
import { cursorPaginationQuerySchema } from './pagination.js';

export const feeAudienceSchema = z.enum(['REGULAR', 'STUDENT']);
export const feeTimingSchema = z.enum(['EARLY', 'REGULAR']);
export const paymentStatusSchema = z.enum([
  'CREATED',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);
export const paymentKindSchema = z.enum(['INITIAL', 'ADDITIONAL', 'REFUND']);
export const registrationStatusSchema = z.enum([
  'PENDING',
  'AWAITING_VERIFICATION',
  'ADDITIONAL_PAYMENT_REQUIRED',
  'PAID',
  'CANCELLED',
  'REFUNDED',
  'DISCARDED_NONPAYMENT',
]);
export const verificationStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CLARIFICATION_REQUESTED',
]);

export const billingFeeScheduleSchema = feeScheduleSchema.extend({
  earlyBirdEndsAt: z.string().datetime().nullable().optional(),
  registrationDeadlineAt: z.string().datetime().nullable().optional(),
});

export const BILLING_COUNTRIES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );
export const billingCountrySchema = z
  .string()
  .length(2)
  .refine((country) => BILLING_COUNTRIES.includes(country), 'Select a valid country');

export const paymentQuoteSchema = z.object({
  amountMinor: z.number().int().positive(),
  regularAmountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  timing: feeTimingSchema,
  isAdditionalPaper: z.boolean(),
});

export const registrationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  paperId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  billingCountry: billingCountrySchema.nullable().optional(),
  billingName: z.string().nullable().optional(),
  billingEmail: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  billingTaxId: z.string().nullable().optional(),
  billingAffiliation: z.string().nullable().optional(),
  isAdditionalPaper: z.boolean().optional(),
  audience: feeAudienceSchema,
  lockedTiming: feeTimingSchema.nullable(),
  amountDueMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: registrationStatusSchema,
  version: z.number().int(),
  windowOpensAt: z.string().datetime(),
  deadlineAt: z.string().datetime(),
  additionalGraceUntil: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createRegistrationSchema = z.object({
  billingName: z.string().trim().min(1, 'Enter the billing name').max(150).optional(),
  billingEmail: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  billingAddress: z.string().trim().min(1, 'Enter the billing address').max(400).optional(),
  billingTaxId: z.string().trim().max(50).optional(),
  audience: feeAudienceSchema,
  billingCountry: billingCountrySchema.optional(),
  billingAffiliation: z
    .string()
    .trim()
    .min(1, 'Enter your affiliation for the invoice')
    .max(300)
    .optional(),
});

export const registrationListSchema = z.object({
  data: z.array(
    registrationSchema.extend({
      paperTitle: z.string().optional(),
      paperSubmittedAt: z.string().datetime().nullable().optional(),
    }),
  ),
  nextCursor: z.string().uuid().nullable(),
});

export const registrationListStatusFilterSchema = z.union([
  registrationStatusSchema,
  z.enum(['at-risk', 'unpaid', 'paid']),
]);

export const registrationListQuerySchema = cursorPaginationQuerySchema.extend({
  status: registrationListStatusFilterSchema.optional(),
  audience: feeAudienceSchema.optional(),
});

export const paymentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  registrationId: z.string().uuid(),
  provider: z.string(),
  providerOrderId: z.string().nullable(),
  providerPaymentId: z.string().nullable(),
  status: paymentStatusSchema,
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  kind: paymentKindSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const initiatePaymentSchema = z.object({});

export const verifyPaymentSchema = z.object({
  razorpay_payment_id: z
    .string()
    .regex(/^pay_[A-Za-z0-9]+$/)
    .max(100),
  razorpay_order_id: z
    .string()
    .regex(/^order_[A-Za-z0-9]+$/)
    .max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});
export const verifyPaymentResponseSchema = z.object({
  verified: z.literal(true),
  captured: z.boolean(),
  registration: registrationSchema,
});

export const initiatePaymentResponseSchema = z.object({
  paymentId: z.string().uuid(),
  provider: z.string(),
  orderId: z.string(),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  keyId: z.string(),
  registration: registrationSchema,
});

export const studentVerificationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  registrationId: z.string().uuid(),
  fileAssetId: z.string().uuid(),
  reviewedById: z.string().uuid().nullable(),
  status: verificationStatusSchema,
  note: z.string().nullable(),
  submittedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const studentVerificationListSchema = z.object({
  data: z.array(
    studentVerificationSchema.extend({
      paperTitle: z.string().optional(),
      paperSubmittedAt: z.string().datetime().nullable().optional(),
      registrationAudience: feeAudienceSchema.optional(),
    }),
  ),
  nextCursor: z.string().uuid().nullable(),
});

export const studentVerificationListQuerySchema = cursorPaginationQuerySchema;

export const initiateStudentDocUploadSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(10_485_760),
});

export const initiateStudentDocUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  objectKey: z.string(),
  expiresInSeconds: z.number().int(),
});

export const completeStudentDocUploadSchema = z.object({
  objectKey: z.string().min(1),
});

export const reviewVerificationSchema = z.object({
  action: z.enum(['APPROVE', 'CLARIFY', 'REJECT']),
  note: z.string().max(2000).optional(),
});

export const refundSchema = z.object({
  amountMinor: z.number().int().positive(),
  reason: z.string().min(1).max(1000),
  version: z.number().int(),
});

export const extendDeadlineSchema = z.object({
  deadlineAt: z.string().datetime(),
  version: z.number().int(),
});

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  number: z.string(),
  issuedAt: z.string().datetime(),
  downloadUrl: z.string().url().optional(),
  expiresInSeconds: z.number().int().optional(),
});

export const registrationDetailSchema = registrationSchema.extend({
  payments: z.array(paymentSchema).optional(),
  latestVerification: studentVerificationSchema.nullable().optional(),
  invoice: invoiceSchema.nullable().optional(),
  feeSchedule: billingFeeScheduleSchema.optional(),
  earlyBirdEndsAt: z.string().datetime().nullable().optional(),
  paymentQuote: paymentQuoteSchema.nullable().optional(),
  paymentQuoteError: z.string().nullable().optional(),
});

export const billingActionResponseSchema = z.object({
  registration: registrationSchema,
  message: z.string(),
});

export const INVOICE_GENERATE_JOB_NAME = 'invoice.generate' as const;
export const DISCARD_SWEEP_JOB_NAME = 'registration.discard_sweep' as const;
export const PAYMENT_RECONCILE_JOB_NAME = 'payment.reconcile' as const;

export const invoiceGenerateJobPayloadSchema = z.object({
  paymentId: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  registrationId: z.string().uuid(),
});

export const discardSweepJobPayloadSchema = z.object({
  conferenceId: z.string().uuid().optional(),
});

export const paymentReconcileJobPayloadSchema = z.object({
  paymentId: z.string().uuid().optional(),
});

export type FeeAudience = z.infer<typeof feeAudienceSchema>;
export type FeeTiming = z.infer<typeof feeTimingSchema>;
export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;
export type RegistrationDto = z.infer<typeof registrationSchema>;
export type PaymentDto = z.infer<typeof paymentSchema>;
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type InitiatePaymentResponse = z.infer<typeof initiatePaymentResponseSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type PaymentQuote = z.infer<typeof paymentQuoteSchema>;
export type StudentVerificationDto = z.infer<typeof studentVerificationSchema>;
export type StudentVerificationListDto = z.infer<typeof studentVerificationListSchema>;
export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type ExtendDeadlineInput = z.infer<typeof extendDeadlineSchema>;
export type InvoiceDto = z.infer<typeof invoiceSchema>;
export type RegistrationDetailDto = z.infer<typeof registrationDetailSchema>;
export type BillingFeeSchedule = z.infer<typeof billingFeeScheduleSchema>;
export type InvoiceGenerateJobPayload = z.infer<typeof invoiceGenerateJobPayloadSchema>;
export type DiscardSweepJobPayload = z.infer<typeof discardSweepJobPayloadSchema>;
export type PaymentReconcileJobPayload = z.infer<typeof paymentReconcileJobPayloadSchema>;
export type InitiateStudentDocUploadInput = z.infer<typeof initiateStudentDocUploadSchema>;
export type CompleteStudentDocUploadInput = z.infer<typeof completeStudentDocUploadSchema>;
