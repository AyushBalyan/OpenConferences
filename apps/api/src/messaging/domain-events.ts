/** Domain event names — maps to notification template keys where applicable */
export const DomainEvents = {
  AUTH_EMAIL_VERIFY: 'notification.auth.email_verify',
  AUTH_PASSWORD_RESET: 'notification.auth.password_reset',
  AUTH_MFA_OTP: 'notification.auth.mfa_otp',
  PAPER_SUBMITTED: 'notification.paper.submitted',
  REVIEWER_INVITATION: 'notification.reviewer.invitation',
  REVIEWER_ASSIGNED: 'notification.reviewer.assigned',
  REVIEW_RELEASED: 'notification.review.released',
  DECISION_NOTIFIED: 'notification.decision.notified',
  REGISTRATION_WINDOW_OPEN: 'notification.registration.window_open',
  PAYMENT_CAPTURED: 'notification.payment.captured',
  REGISTRATION_VERIFICATION_APPROVED: 'notification.registration.verification_approved',
  REGISTRATION_CLARIFICATION_REQUESTED: 'notification.registration.clarification_requested',
  REGISTRATION_ADDITIONAL_PAYMENT: 'notification.registration.additional_payment',
  REGISTRATION_DISCARDED: 'notification.registration.discarded',
} as const;

export type AuthEmailVerifyPayload = {
  to: string;
  otp: string;
  expiresMinutes: number;
  idempotencyKey: string;
};

export type AuthPasswordResetPayload = {
  to: string;
  resetUrl: string;
  idempotencyKey: string;
};

export type AuthMfaOtpPayload = {
  to: string;
  otp: string;
  expiresMinutes: number;
  idempotencyKey: string;
};

export type PaperSubmittedPayload = {
  to: string;
  paperId: string;
  paperTitle: string;
  conferenceId: string;
  organizationId: string;
  idempotencyKey: string;
};

export type ReviewerInvitationPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  conferenceName: string;
  /** Magic link URL (legacy field name retained for template compatibility). */
  signupUrl: string;
  expiresAt: string;
  invitationId: string;
  idempotencyKey: string;
};

export type ReviewerAssignedPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  paperTitle: string;
  roundNumber: number;
  dueAt: string;
  assignmentId: string;
  idempotencyKey: string;
};

export type ReviewReleasedPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  paperTitle: string;
  paperId: string;
  roundId: string;
  idempotencyKey: string;
};

export type DecisionNotifiedPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  paperTitle: string;
  outcomeLabel: string;
  rationaleBlock: string;
  acceptBlock: string;
  decisionId: string;
  idempotencyKey: string;
};

export type RegistrationWindowOpenPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  paperTitle: string;
  deadlineAt: string;
  registrationId: string;
  idempotencyKey: string;
};

export type PaymentCapturedPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  paperTitle: string;
  amountFormatted: string;
  paymentId: string;
  idempotencyKey: string;
};

export type RegistrationVerificationApprovedPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  paperTitle: string;
  verificationId: string;
  idempotencyKey: string;
};

export type RegistrationClarificationPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  paperTitle: string;
  note: string;
  verificationId: string;
  idempotencyKey: string;
};

export type RegistrationAdditionalPaymentPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  paperTitle: string;
  amountFormatted: string;
  registrationId: string;
  idempotencyKey: string;
};

export type RegistrationDiscardedPayload = {
  to: string;
  conferenceId: string;
  organizationId: string;
  paperTitle: string;
  registrationId: string;
  idempotencyKey: string;
};
