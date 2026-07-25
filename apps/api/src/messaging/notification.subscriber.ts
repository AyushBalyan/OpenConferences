import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvents,
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
import { NotificationPublisher } from './notification.publisher';

/** Secondary path: domain events → publisher. Primary path is direct publisher injection. */
@Injectable()
export class NotificationSubscriber {
  private readonly logger = new Logger(NotificationSubscriber.name);

  constructor(private readonly publisher: NotificationPublisher) {}

  @OnEvent(DomainEvents.AUTH_EMAIL_VERIFY, { async: true })
  async onAuthEmailVerify(payload: AuthEmailVerifyPayload): Promise<void> {
    await this.publisher.publishAuthEmailVerify(payload);
  }

  @OnEvent(DomainEvents.AUTH_PASSWORD_RESET, { async: true })
  async onAuthPasswordReset(payload: AuthPasswordResetPayload): Promise<void> {
    await this.publisher.publishAuthPasswordReset(payload);
  }

  @OnEvent(DomainEvents.AUTH_MFA_OTP, { async: true })
  async onAuthMfaOtp(payload: AuthMfaOtpPayload): Promise<void> {
    await this.publisher.publishAuthMfaOtp(payload);
  }

  @OnEvent(DomainEvents.PAPER_SUBMITTED, { async: true })
  async onPaperSubmitted(payload: PaperSubmittedPayload): Promise<void> {
    await this.publisher.publishPaperSubmitted(payload);
  }

  @OnEvent(DomainEvents.REVIEWER_INVITATION, { async: true })
  async onReviewerInvitation(payload: ReviewerInvitationPayload): Promise<void> {
    await this.publisher.publishReviewerInvitation(payload);
  }

  @OnEvent(DomainEvents.REVIEWER_ASSIGNED, { async: true })
  async onReviewerAssigned(payload: ReviewerAssignedPayload): Promise<void> {
    await this.publisher.publishReviewerAssigned(payload);
  }

  @OnEvent(DomainEvents.REVIEW_RELEASED, { async: true })
  async onReviewReleased(payload: ReviewReleasedPayload): Promise<void> {
    await this.publisher.publishReviewReleased(payload);
  }

  @OnEvent(DomainEvents.DECISION_NOTIFIED, { async: true })
  async onDecisionNotified(payload: DecisionNotifiedPayload): Promise<void> {
    await this.publisher.publishDecisionNotified(payload);
  }

  @OnEvent(DomainEvents.REGISTRATION_WINDOW_OPEN, { async: true })
  async onRegistrationWindowOpen(payload: RegistrationWindowOpenPayload): Promise<void> {
    await this.publisher.publishRegistrationWindowOpen(payload);
  }

  @OnEvent(DomainEvents.PAYMENT_CAPTURED, { async: true })
  async onPaymentCaptured(payload: PaymentCapturedPayload): Promise<void> {
    await this.publisher.publishPaymentCaptured(payload);
  }

  @OnEvent(DomainEvents.REGISTRATION_VERIFICATION_APPROVED, { async: true })
  async onVerificationApproved(payload: RegistrationVerificationApprovedPayload): Promise<void> {
    await this.publisher.publishVerificationApproved(payload);
  }

  @OnEvent(DomainEvents.REGISTRATION_CLARIFICATION_REQUESTED, { async: true })
  async onClarificationRequested(payload: RegistrationClarificationPayload): Promise<void> {
    await this.publisher.publishClarificationRequested(payload);
  }

  @OnEvent(DomainEvents.REGISTRATION_ADDITIONAL_PAYMENT, { async: true })
  async onAdditionalPayment(payload: RegistrationAdditionalPaymentPayload): Promise<void> {
    await this.publisher.publishAdditionalPaymentRequired(payload);
  }

  @OnEvent(DomainEvents.REGISTRATION_DISCARDED, { async: true })
  async onRegistrationDiscarded(payload: RegistrationDiscardedPayload): Promise<void> {
    await this.publisher.publishRegistrationDiscarded(payload);
  }
}
