import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import { withTenantContext } from '@openconferences/db';
import type { ConferenceAnalyticsOverview } from '@openconferences/schemas';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';

const PAID_REGISTRATION_STATUSES = new Set([
  'PAID',
  'AWAITING_VERIFICATION',
  'ADDITIONAL_PAYMENT_REQUIRED',
]);

@Injectable()
export class AnalyticsService {
  constructor(private readonly conferences: ConferenceService) {}

  async getOverview(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
  ): Promise<ConferenceAnalyticsOverview> {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to view analytics');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const feeSchedule = conference.feeSchedule as { currency?: string };
    const currency = feeSchedule?.currency ?? 'INR';
    const now = new Date();
    const atRiskThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      submissionGroups,
      assignmentTotal,
      completedAssignments,
      decisionGroups,
      registrationGroups,
      payments,
    ] = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        Promise.all([
          tx.paper.groupBy({
            by: ['status'],
            where: { conferenceId },
            _count: { _all: true },
          }),
          tx.reviewerAssignment.count({ where: { conferenceId } }),
          tx.reviewerAssignment.count({ where: { conferenceId, status: 'COMPLETED' } }),
          tx.decision.groupBy({
            by: ['outcome'],
            where: { conferenceId },
            _count: { _all: true },
          }),
          tx.registration.groupBy({
            by: ['status'],
            where: { conferenceId },
            _count: { _all: true },
          }),
          tx.payment.findMany({
            where: {
              organizationId: conference.organizationId,
              registration: { conferenceId },
              status: { in: ['CAPTURED', 'REFUNDED', 'PARTIALLY_REFUNDED'] },
            },
            select: { status: true, amountMinor: true },
          }),
        ]),
    );

    const byStatus = submissionGroups.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
    const submissionsTotal = byStatus.reduce((sum, row) => sum + row.count, 0);

    const byOutcome = decisionGroups.map((row) => ({
      outcome: row.outcome,
      count: row._count._all,
    }));

    const byRegistrationStatus = registrationGroups.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
    const registrationsTotal = byRegistrationStatus.reduce((sum, row) => sum + row.count, 0);

    const paid = byRegistrationStatus
      .filter((row) => row.status === 'PAID')
      .reduce((sum, row) => sum + row.count, 0);

    const unpaid = byRegistrationStatus
      .filter((row) => !PAID_REGISTRATION_STATUSES.has(row.status))
      .reduce((sum, row) => sum + row.count, 0);

    const atRiskRows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.registration.count({
          where: {
            conferenceId,
            status: {
              notIn: ['PAID', 'CANCELLED', 'REFUNDED', 'DISCARDED_NONPAYMENT'],
            },
            deadlineAt: { lte: atRiskThreshold },
          },
        }),
    );

    let revenueMinor = 0;
    for (const payment of payments) {
      if (payment.status === 'CAPTURED') {
        revenueMinor += payment.amountMinor;
      } else if (payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED') {
        revenueMinor -= payment.amountMinor;
      }
    }

    return {
      conferenceId,
      submissions: { total: submissionsTotal, byStatus },
      reviews: { assigned: assignmentTotal, completed: completedAssignments },
      decisions: {
        total: byOutcome.reduce((sum, row) => sum + row.count, 0),
        byOutcome,
      },
      registrations: {
        total: registrationsTotal,
        paid,
        unpaid,
        atRisk: atRiskRows,
        byStatus: byRegistrationStatus,
      },
      revenueMinor,
      currency,
      computedAt: new Date().toISOString(),
    };
  }
}
