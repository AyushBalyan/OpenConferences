import type { FeeAudience, FeeTiming, BillingFeeSchedule } from '@openconferences/schemas';

export function parseFeeSchedule(raw: unknown): BillingFeeSchedule {
  const schedule = raw as BillingFeeSchedule;
  if (!schedule?.currency || !schedule?.matrix) {
    throw new Error('Conference fee schedule is not configured');
  }
  return schedule;
}

export function resolveTiming(capturedAt: Date, earlyBirdEndsAt: Date | null): FeeTiming {
  if (!earlyBirdEndsAt) {
    return 'REGULAR';
  }
  return capturedAt <= earlyBirdEndsAt ? 'EARLY' : 'REGULAR';
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
