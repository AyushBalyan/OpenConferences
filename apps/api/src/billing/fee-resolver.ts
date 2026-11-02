import {
  billingFeeScheduleSchema,
  type FeeAudience,
  type FeeTiming,
  type BillingFeeSchedule,
  type PaymentQuote,
} from '@openconferences/schemas';

export function parseFeeSchedule(raw: unknown): BillingFeeSchedule {
  const result = billingFeeScheduleSchema.safeParse(raw);
  if (!result.success) {
    throw new Error('Conference fee schedule is not configured');
  }
  return result.data;
}

export function resolveTiming(capturedAt: Date, earlyBirdEndsAt: Date | null): FeeTiming {
  if (!earlyBirdEndsAt) {
    return 'REGULAR';
  }
  return capturedAt < earlyBirdEndsAt ? 'EARLY' : 'REGULAR';
}

export function resolveMatrixAmount(
  feeSchedule: BillingFeeSchedule,
  audience: FeeAudience,
  timing: FeeTiming,
): number {
  const audienceMatrix = feeSchedule.matrix[audience];
  if (!audienceMatrix) {
    throw new Error(`Fee matrix missing audience: ${audience}`);
  }
  const amount = audienceMatrix[timing];
  if (amount === undefined) {
    throw new Error(`Fee matrix missing timing cell: ${audience}/${timing}`);
  }
  return amount;
}

export function getEarlyBirdEndsAt(
  feeSchedule: BillingFeeSchedule,
  _conferenceRegistrationDueAt: Date | null,
): Date | null {
  if (feeSchedule.earlyBirdEndsAt) {
    return new Date(feeSchedule.earlyBirdEndsAt);
  }
  return null;
}

export function getRegistrationDeadline(
  feeSchedule: BillingFeeSchedule,
  conferenceRegistrationDueAt: Date | null,
): Date {
  if (feeSchedule.registrationDeadlineAt) {
    return new Date(feeSchedule.registrationDeadlineAt);
  }
  if (conferenceRegistrationDueAt) {
    return conferenceRegistrationDueAt;
  }
  throw new Error('Registration deadline is not configured');
}

export function estimateProvisionalAmount(
  feeSchedule: BillingFeeSchedule,
  audience: FeeAudience,
  now: Date = new Date(),
): number {
  const earlyBirdEndsAt = getEarlyBirdEndsAt(feeSchedule, null);
  const timing = resolveTiming(now, earlyBirdEndsAt);
  return resolveMatrixAmount(feeSchedule, audience, timing);
}

export function quoteRegistration(
  schedule: BillingFeeSchedule,
  audience: FeeAudience,
  country: string | null,
  hasPaidBasePaper: boolean,
  now = new Date(),
): PaymentQuote {
  const timing = resolveTiming(now, getEarlyBirdEndsAt(schedule, null));
  const isAdditionalPaper = hasPaidBasePaper && schedule.additionalPaperMinor !== undefined;
  let amountMinor = isAdditionalPaper
    ? schedule.additionalPaperMinor!
    : resolveMatrixAmount(schedule, audience, timing);
  let regularAmountMinor = isAdditionalPaper
    ? schedule.additionalPaperMinor!
    : resolveMatrixAmount(schedule, 'REGULAR', timing);
  let currency = schedule.currency;
  if (currency === 'USD') {
    if (!country) throw new Error('Save your billing country before payment.');
    if (country === 'IN') {
      if (!schedule.domesticInrPerUsd) {
        throw new Error(
          'INR registration pricing is not configured. Please contact the organizers.',
        );
      }
      // USD cents × INR per USD = INR paise; snapshot the rounded amount per order.
      amountMinor = Math.round(amountMinor * schedule.domesticInrPerUsd);
      regularAmountMinor = Math.round(regularAmountMinor * schedule.domesticInrPerUsd);
      currency = 'INR';
    }
  }
  if (
    ![amountMinor, regularAmountMinor].every(
      (amount) => Number.isSafeInteger(amount) && amount >= 100 && amount <= 2_147_483_647,
    )
  ) {
    throw new Error('Registration pricing is invalid. Please contact the organizers.');
  }
  return { amountMinor, regularAmountMinor, currency, timing, isAdditionalPaper };
}
