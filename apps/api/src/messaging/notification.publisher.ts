import { Injectable, Logger } from '@nestjs/common';
import {
  type AuthEmailVerifyPayload,
  type AuthMfaOtpPayload,
  type AuthPasswordResetPayload,
  type DecisionNotifiedPayload,
  type PaperSubmittedPayload,
  type PaymentCapturedPayload,
  type RegistrationAdditionalPaymentPayload,
  type RegistrationClarificationPayload,
  type RegistrationDiscardedPayload,
  type RegistrationVerificationApprovedPayload,
  type RegistrationWindowOpenPayload,
  type ReviewReleasedPayload,
  type ReviewerAssignedPayload,
  type ReviewerInvitationPayload,
} from './domain-events';
import { NotificationService } from './notification.service';

/**
 * Direct notification dispatch — avoids relying on @OnEvent listener registration,
 * which can be skipped when subscriber providers are not eagerly instantiated.
 */
@Injectable()
export class NotificationPublisher {
  private readonly logger = new Logger(NotificationPublisher.name);

  constructor(private readonly notifications: NotificationService) {}

  async publishAuthEmailVerify(payload: AuthEmailVerifyPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'auth.email_verify',
      to: payload.to,
      context: { verifyUrl: payload.verifyUrl },
      idempotencyKey: payload.idempotencyKey,
      tags: ['auth.email_verify'],
      relatedEntity: 'User',
    });
  }

  async publishAuthPasswordReset(payload: AuthPasswordResetPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'auth.password_reset',
      to: payload.to,
      context: { resetUrl: payload.resetUrl },
      idempotencyKey: payload.idempotencyKey,
      tags: ['auth.password_reset'],
      relatedEntity: 'User',
    });
  }

  async publishAuthMfaOtp(payload: AuthMfaOtpPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'auth.mfa_otp',
      to: payload.to,
      context: {
        otp: payload.otp,
        expiresMinutes: String(payload.expiresMinutes),
      },
      idempotencyKey: payload.idempotencyKey,
      tags: ['auth.mfa_otp'],
      relatedEntity: 'User',
    });
  }

  async publishPaperSubmitted(payload: PaperSubmittedPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'submission.confirmed',
      to: payload.to,
      context: { paperTitle: payload.paperTitle },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['submission.confirmed'],
      relatedEntity: 'Paper',
      relatedEntityId: payload.paperId,
    });
  }

  async publishReviewerInvitation(payload: ReviewerInvitationPayload): Promise<void> {
    this.logger.debug(
      { to: payload.to, invitationId: payload.invitationId },
      'Publishing reviewer invitation',
    );
    await this.notifications.enqueue({
      templateKey: 'reviewer.invitation',
      to: payload.to,
      context: {
        conferenceName: payload.conferenceName,
        signupUrl: payload.signupUrl,
        expiresAt: payload.expiresAt,
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['reviewer.invitation'],
      relatedEntity: 'ReviewerInvitation',
      relatedEntityId: payload.invitationId,
    });
  }

  async publishReviewerAssigned(payload: ReviewerAssignedPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'assignment.notified',
      to: payload.to,
      context: {
        paperTitle: payload.paperTitle,
        roundNumber: payload.roundNumber,
        dueAt: payload.dueAt,
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['assignment.notified'],
      relatedEntity: 'ReviewerAssignment',
      relatedEntityId: payload.assignmentId,
    });
  }

  async publishReviewReleased(payload: ReviewReleasedPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'review.released',
      to: payload.to,
      context: { paperTitle: payload.paperTitle },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['review.released'],
      relatedEntity: 'Paper',
      relatedEntityId: payload.paperId,
    });
  }

  async publishDecisionNotified(payload: DecisionNotifiedPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'decision.notified',
      to: payload.to,
      context: {
        paperTitle: payload.paperTitle,
        outcomeLabel: payload.outcomeLabel,
        rationaleBlock: payload.rationaleBlock,
        acceptBlock: payload.acceptBlock,
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['decision.notified'],
      relatedEntity: 'Decision',
      relatedEntityId: payload.decisionId,
    });
  }

  async publishRegistrationWindowOpen(payload: RegistrationWindowOpenPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'registration.window_open',
      to: payload.to,
      context: { paperTitle: payload.paperTitle, deadlineAt: payload.deadlineAt },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['registration.window_open'],
      relatedEntity: 'Registration',
      relatedEntityId: payload.registrationId,
    });
  }

  async publishPaymentCaptured(payload: PaymentCapturedPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'registration.confirmed',
      to: payload.to,
      context: {
        paperTitle: payload.paperTitle,
        amountFormatted: payload.amountFormatted,
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['registration.confirmed'],
      relatedEntity: 'Payment',
      relatedEntityId: payload.paymentId,
    });
  }

  async publishVerificationApproved(
    payload: RegistrationVerificationApprovedPayload,
  ): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'registration.verification_approved',
      to: payload.to,
      context: { paperTitle: payload.paperTitle },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['registration.verification_approved'],
      relatedEntity: 'StudentVerification',
      relatedEntityId: payload.verificationId,
    });
  }

  async publishClarificationRequested(payload: RegistrationClarificationPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'registration.clarification_requested',
      to: payload.to,
      context: { paperTitle: payload.paperTitle, note: payload.note },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['registration.clarification_requested'],
      relatedEntity: 'StudentVerification',
      relatedEntityId: payload.verificationId,
    });
  }

  async publishAdditionalPaymentRequired(
    payload: RegistrationAdditionalPaymentPayload,
  ): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'registration.additional_payment_required',
      to: payload.to,
      context: {
        paperTitle: payload.paperTitle,
        amountFormatted: payload.amountFormatted,
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['registration.additional_payment_required'],
      relatedEntity: 'Registration',
      relatedEntityId: payload.registrationId,
    });
  }

  async publishRegistrationDiscarded(payload: RegistrationDiscardedPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'registration.discarded',
      to: payload.to,
      context: { paperTitle: payload.paperTitle },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['registration.discarded'],
      relatedEntity: 'Registration',
      relatedEntityId: payload.registrationId,
    });
  }
}
