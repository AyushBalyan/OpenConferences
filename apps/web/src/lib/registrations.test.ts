import { describe, expect, it } from 'vitest';
import {
  audienceLabel,
  formatRegistrationMoney,
  isReviewableVerification,
  registrationDeadlineState,
  registrationStatusView,
  verificationStatusView,
} from './registrations';

const now = new Date('2026-11-18T12:00:00Z');

describe('registration status', () => {
  it('labels and colours every real status', () => {
    expect(registrationStatusView('PAID')).toEqual({ label: 'Paid', tone: 'success' });
    expect(registrationStatusView('PENDING').tone).toBe('pending');
    expect(registrationStatusView('AWAITING_VERIFICATION')).toEqual({
      label: 'Awaiting verification',
      tone: 'info',
    });
    expect(registrationStatusView('ADDITIONAL_PAYMENT_REQUIRED').tone).toBe('pending');
    expect(registrationStatusView('DISCARDED_NONPAYMENT').tone).toBe('danger');
    expect(registrationStatusView('CANCELLED').tone).toBe('neutral');
    expect(registrationStatusView('REFUNDED').tone).toBe('neutral');
  });

  it('falls back to a readable neutral label for an unknown status', () => {
    expect(registrationStatusView('SOMETHING_NEW')).toEqual({
      label: 'something new',
      tone: 'neutral',
    });
  });

  it('labels audiences', () => {
    expect(audienceLabel('STUDENT')).toBe('Student');
    expect(audienceLabel('REGULAR')).toBe('Regular');
  });
});

describe('registration deadline', () => {
  it('counts down for unpaid registrations and flags the last week', () => {
    expect(registrationDeadlineState('PENDING', '2026-11-21T13:00:00Z', now)).toEqual({
      label: '3 days left',
      tone: 'soon',
    });
    expect(registrationDeadlineState('PENDING', '2026-12-18T12:00:00Z', now)).toEqual({
      label: '30 days left',
      tone: 'ok',
    });
    expect(registrationDeadlineState('AWAITING_VERIFICATION', '2026-11-18T20:00:00Z', now)).toEqual(
      { label: 'Due today', tone: 'soon' },
    );
    expect(registrationDeadlineState('PENDING', '2026-11-19T13:00:00Z', now)?.label).toBe(
      '1 day left',
    );
  });

  it('reports how long an unpaid registration has been overdue', () => {
    expect(registrationDeadlineState('PENDING', '2026-11-16T11:00:00Z', now)).toEqual({
      label: 'Overdue by 2 days',
      tone: 'overdue',
    });
    expect(
      registrationDeadlineState('ADDITIONAL_PAYMENT_REQUIRED', '2026-11-18T09:00:00Z', now)?.label,
    ).toBe('Overdue since today');
  });

  it('gives no urgency label once a registration is paid or closed', () => {
    for (const status of ['PAID', 'CANCELLED', 'REFUNDED', 'DISCARDED_NONPAYMENT'])
      expect(registrationDeadlineState(status, '2026-11-01T00:00:00Z', now)).toBeNull();
    expect(registrationDeadlineState('PENDING', 'not a date', now)).toBeNull();
  });
});

describe('registration money', () => {
  it('formats minor units with the currency symbol', () => {
    expect(formatRegistrationMoney(202500, 'USD')).toBe('$2,025.00');
    expect(formatRegistrationMoney(750000, 'INR')).toBe('₹7,500.00');
  });
});

describe('verification status', () => {
  it('only pending and clarification rows can be reviewed', () => {
    expect(isReviewableVerification('PENDING')).toBe(true);
    expect(isReviewableVerification('CLARIFICATION_REQUESTED')).toBe(true);
    expect(isReviewableVerification('APPROVED')).toBe(false);
    expect(isReviewableVerification('REJECTED')).toBe(false);
  });

  it('labels each state', () => {
    expect(verificationStatusView('PENDING').label).toBe('Needs review');
    expect(verificationStatusView('REJECTED').tone).toBe('danger');
  });
});
