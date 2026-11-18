import type { WorkflowTone } from '@/components/dashboard/workflow-badge';

export type RegistrationStatus =
  | 'PENDING'
  | 'AWAITING_VERIFICATION'
  | 'ADDITIONAL_PAYMENT_REQUIRED'
  | 'PAID'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISCARDED_NONPAYMENT';

export const REGISTRATION_STATUS: Record<
  RegistrationStatus,
  { label: string; tone: WorkflowTone }
> = {
  PENDING: { label: 'Pending payment', tone: 'pending' },
  AWAITING_VERIFICATION: { label: 'Paid · student approval pending', tone: 'info' },
  ADDITIONAL_PAYMENT_REQUIRED: { label: 'Additional payment required', tone: 'pending' },
  PAID: { label: 'Paid', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  DISCARDED_NONPAYMENT: { label: 'Discarded for non-payment', tone: 'danger' },
};

/** Statuses that still owe money. Matches conference analytics. */
const UNPAID: ReadonlySet<string> = new Set(['PENDING', 'ADDITIONAL_PAYMENT_REQUIRED']);

export function isUnpaidRegistration(status: string) {
  return UNPAID.has(status);
}

/**
 * A student registration only reaches this status once its payment is captured,
 * so the money is in and only the student document is outstanding.
 */
export function isPaidAwaitingStudentApproval(status: string) {
  return status === 'AWAITING_VERIFICATION';
}

export function registrationStatusView(status: string): { label: string; tone: WorkflowTone } {
  return (
    REGISTRATION_STATUS[status as RegistrationStatus] ?? {
      label: status.replace(/_/g, ' ').toLowerCase(),
      tone: 'neutral',
    }
  );
}

export function audienceLabel(audience: string) {
  return audience === 'STUDENT' ? 'Student' : audience === 'REGULAR' ? 'Regular' : audience;
}

const DAY_MS = 86_400_000;

export type DeadlineState = {
  label: string;
  tone: 'overdue' | 'soon' | 'ok';
};

/**
 * How a registration deadline should read. Only registrations that still owe
 * money have a live deadline; for the rest the date gets no urgency label.
 */
export function registrationDeadlineState(
  status: string,
  deadlineAt: string,
  now: Date = new Date(),
): DeadlineState | null {
  const deadline = Date.parse(deadlineAt);
  if (!isUnpaidRegistration(status) || Number.isNaN(deadline)) return null;
  const remaining = deadline - now.getTime();
  if (remaining < 0) {
    const days = Math.floor(-remaining / DAY_MS);
    return {
      label: days === 0 ? 'Overdue since today' : `Overdue by ${days} day${days === 1 ? '' : 's'}`,
      tone: 'overdue',
    };
  }
  const days = Math.floor(remaining / DAY_MS);
  return {
    label: days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} left`,
    tone: days <= 7 ? 'soon' : 'ok',
  };
}

export function formatRegistrationMoney(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED';

export function isReviewableVerification(status: string) {
  return status === 'PENDING' || status === 'CLARIFICATION_REQUESTED';
}

export function verificationStatusView(status: string): { label: string; tone: WorkflowTone } {
  switch (status) {
    case 'PENDING':
      return { label: 'Needs review', tone: 'pending' };
    case 'CLARIFICATION_REQUESTED':
      return { label: 'Clarification requested', tone: 'info' };
    case 'APPROVED':
      return { label: 'Approved', tone: 'success' };
    case 'REJECTED':
      return { label: 'Rejected', tone: 'danger' };
    default:
      return { label: status.replace(/_/g, ' ').toLowerCase(), tone: 'neutral' };
  }
}
