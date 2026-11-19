import { nameWithoutTitle, type Prisma } from '@openconferences/db';
import { Injectable, Logger } from '@nestjs/common';
import { getConfig } from '@openconferences/config/env';
import {
  type AuthEmailVerifyPayload,
  type AuthMfaOtpPayload,
  type AuthPasswordResetPayload,
  type DecisionNotifiedPayload,
  type PaperSubmittedPayload,
  type PaperWithdrawnPayload,
  type PaymentCapturedPayload,
  type RegistrationAdditionalPaymentPayload,
  type RegistrationClarificationPayload,
  type RegistrationDiscardedPayload,
  type RegistrationVerificationApprovedPayload,
  type RegistrationStudentRateRejectedPayload,
  type ReviewReleasedPayload,
  type ReviewThankYouPayload,
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

  /** Link to a paper's page, optionally opened on one of its sections. */
  private paperUrl(conferenceId: string, paperId: string, section?: 'registration'): string {
    const base = `${getConfig().webUrl.replace(/\/$/, '')}/dashboard/conferences/${conferenceId}/submissions/${paperId}`;
    return section ? `${base}?section=${section}` : base;
  }

  async publishAuthEmailVerify(payload: AuthEmailVerifyPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'auth.email_verify',
      to: payload.to,
      context: {
        otp: payload.otp,
        expiresMinutes: String(payload.expiresMinutes),
      },
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
      context: {
        paperTitle: payload.paperTitle,
        conferenceName: payload.conferenceName,
        authorName: payload.authorName ?? '',
        authorEmail: payload.authorEmail ?? payload.to,
        authorAffiliation: payload.authorAffiliation || '—',
        authorList: payload.authorList ?? payload.authorName ?? '',
        paperUrl: this.paperUrl(payload.conferenceId, payload.paperId),
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['submission.confirmed'],
      relatedEntity: 'Paper',
      relatedEntityId: payload.paperId,
    });

    const config = getConfig();
    const alertEmail = config.mail.submissionAlertEmail?.trim().toLowerCase();
    const authorEmail = (payload.authorEmail ?? payload.to).trim().toLowerCase();
    if (!alertEmail || alertEmail === authorEmail) {
      return;
    }

    const paperUrl = this.paperUrl(payload.conferenceId, payload.paperId);

    await this.notifications.enqueue({
      templateKey: 'submission.ops_alert',
      to: alertEmail,
      context: {
        paperTitle: payload.paperTitle,
        conferenceName: payload.conferenceName,
        authorEmail,
        paperUrl,
        submissionNumber: payload.submissionNumber || 'Not assigned',
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: `submission-ops-alert-${payload.paperId}`,
      tags: ['submission.ops_alert'],
      relatedEntity: 'Paper',
      relatedEntityId: payload.paperId,
    });
  }

  async publishPaperWithdrawn(payload: PaperWithdrawnPayload): Promise<void> {
    const templateKey =
      payload.audience === 'organizer' ? 'paper.withdrawn.organizer' : 'paper.withdrawn';
    await this.notifications.enqueue({
      templateKey,
      to: payload.to,
      context: {
        paperTitle: payload.paperTitle,
        conferenceName: payload.conferenceName,
        submissionNumber: payload.submissionNumber || 'Not assigned',
        reason: payload.reason,
        actorName: payload.actorName || 'An author',
        refundNeeded: payload.refundNeeded ? 'Yes' : 'No',
        paperUrl: this.paperUrl(payload.conferenceId, payload.paperId),
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: [templateKey],
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
        declineUrl: payload.declineUrl ?? '',
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

  async publishReviewerAssigned(payload: ReviewerAssignedPayload): Promise<boolean> {
    const queued = await this.notifications.enqueue({
      templateKey: 'assignment.notified',
      to: payload.to,
      context: {
        reviewerName: nameWithoutTitle(payload.reviewerName) || 'Reviewer',
        conferenceName: payload.conferenceName,
        paperTitle: payload.paperTitle,
        roundNumber: payload.roundNumber,
        dueAt: payload.dueAt,
        reviewUrl: `${getConfig().webUrl.replace(/\/$/, '')}/dashboard/conferences/${payload.conferenceId}/reviews/my-assignments`,
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['assignment.notified'],
      relatedEntity: 'ReviewerAssignment',
      relatedEntityId: payload.assignmentId,
    });
    return queued !== null;
  }

  async publishReviewReminder(payload: {
    to: string;
    conferenceId: string;
    organizationId: string;
    conferenceName: string;
    reviewerName?: string | null;
    paperTitle: string;
    dueAt: string;
    assignmentId: string;
    idempotencyKey: string;
  }): Promise<boolean> {
    const queued = await this.notifications.enqueue({
      templateKey: 'review.reminder',
      to: payload.to,
      context: {
        conferenceName: payload.conferenceName,
        reviewerName: nameWithoutTitle(payload.reviewerName) || 'Reviewer',
        paperTitle: payload.paperTitle,
        dueAt: payload.dueAt,
        reviewUrl: `${getConfig().webUrl.replace(/\/$/, '')}/dashboard/conferences/${payload.conferenceId}/reviews/my-assignments`,
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['review.reminder'],
      relatedEntity: 'ReviewerAssignment',
      relatedEntityId: payload.assignmentId,
    });
    return queued !== null;
  }

  async publishReviewThankYou(payload: ReviewThankYouPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'review.thank_you',
      to: payload.to,
      context: {
        reviewerName: nameWithoutTitle(payload.reviewerName) || 'Reviewer',
        conferenceName: payload.conferenceName,
        paperTitle: payload.paperTitle,
        submissionNumber: payload.submissionNumber,
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['review.thank_you'],
      relatedEntity: 'Review',
      relatedEntityId: payload.reviewId,
    });
  }

  async publishReviewReleased(payload: ReviewReleasedPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'review.released',
      to: payload.to,
      context: {
        paperTitle: payload.paperTitle,
        paperUrl: this.paperUrl(payload.conferenceId, payload.paperId),
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['review.released'],
      relatedEntity: 'Paper',
      relatedEntityId: payload.paperId,
    });
  }

  async publishDecisionNotified(
    payload: DecisionNotifiedPayload,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const accepted = payload.outcomeLabel === 'Accept';
    const templateKey = accepted ? 'decision.accepted' : 'decision.notified';
    if (accepted && !payload.registrationUrl) {
      throw new Error('Acceptance email requires the paper registration link');
    }
    const input = {
      templateKey,
      to: payload.to,
      context: {
        paperTitle: payload.paperTitle,
        conferenceName: payload.conferenceName,
        authorName: payload.authorName?.trim() || 'Author',
        submissionNumber: payload.submissionNumber || '',
        registrationUrl: payload.registrationUrl,
        paperUrl: payload.paperUrl ?? '',
        outcomeLabel: payload.outcomeLabel,
        rationaleBlock: payload.rationaleBlock,
        acceptBlock: payload.acceptBlock,
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      replyTo: accepted ? getConfig().mail.contactEmail : undefined,
      tags: [templateKey],
      relatedEntity: 'Decision',
      relatedEntityId: payload.decisionId,
    };
    if (transaction) await this.notifications.enqueue(input, transaction);
    else await this.notifications.enqueue(input);
  }

  async publishPaymentCaptured(payload: PaymentCapturedPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'registration.confirmed',
      to: payload.to,
      context: {
        paperTitle: payload.paperTitle,
        amountFormatted: payload.amountFormatted,
        transactionId: payload.transactionId,
        registrationUrl: payload.registrationUrl,
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
      context: {
        paperTitle: payload.paperTitle,
        registrationUrl: this.paperUrl(payload.conferenceId, payload.paperId, 'registration'),
      },
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
      context: {
        paperTitle: payload.paperTitle,
        note: payload.note,
        registrationUrl: this.paperUrl(payload.conferenceId, payload.paperId, 'registration'),
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['registration.clarification_requested'],
      relatedEntity: 'StudentVerification',
      relatedEntityId: payload.verificationId,
    });
  }

  async publishStudentRateRejected(payload: RegistrationStudentRateRejectedPayload): Promise<void> {
    await this.notifications.enqueue({
      templateKey: 'registration.student_rate_rejected',
      to: payload.to,
      context: {
        paperTitle: payload.paperTitle,
        reason: payload.reason,
        nextStep: payload.paidInFull
          ? 'Your payment already covers the regular fee, so no further payment is needed.'
          : 'Your registration is now at the regular rate. Please review the updated fee before you pay.',
        registrationUrl: this.paperUrl(payload.conferenceId, payload.paperId, 'registration'),
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['registration.student_rate_rejected'],
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
        reason: payload.reason,
        amountFormatted: payload.amountFormatted,
        deadlineAt: payload.deadlineAt,
        registrationUrl: this.paperUrl(payload.conferenceId, payload.paperId, 'registration'),
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
      context: {
        paperTitle: payload.paperTitle,
        paperUrl: this.paperUrl(payload.conferenceId, payload.paperId),
      },
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      idempotencyKey: payload.idempotencyKey,
      tags: ['registration.discarded'],
      relatedEntity: 'Registration',
      relatedEntityId: payload.registrationId,
    });
  }
}
