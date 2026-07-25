import { Injectable } from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import { withTenantContext } from '@openconferences/db';
import type { MeDashboard } from '@openconferences/schemas';
import { effectiveRolesForConference, mergeRolesByConference } from '../tenancy/membership-roles';
import { maxRoleRank } from '../tenancy/role-hierarchy';

const ORGANIZER_SURFACE_ROLES: RoleKind[] = ['ORGANIZER', 'ORG_ADMIN', 'CHAIR', 'PLATFORM_ADMIN'];
const CREATE_CONFERENCE_ROLES: RoleKind[] = ['ORG_ADMIN', 'PLATFORM_ADMIN'];

@Injectable()
export class MeDashboardService {
  async getDashboard(userId: string): Promise<MeDashboard> {
    const [papers, assignments, memberships] = await withTenantContext({ userId }, async (tx) =>
      Promise.all([
        tx.paper.findMany({
          where: {
            OR: [{ submittedById: userId }, { authorships: { some: { userId } } }],
          },
          include: {
            conference: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        }),
        tx.reviewerAssignment.findMany({
          where: {
            reviewerUserId: userId,
            round: { status: { not: 'CLOSED' } },
          },
          include: {
            paper: { select: { title: true } },
            round: { select: { roundNumber: true } },
            conference: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
          take: 50,
        }),
        tx.membership.findMany({
          where: { userId },
          include: {
            roles: true,
            conference: {
              select: { id: true, name: true, slug: true, status: true, organizationId: true },
            },
          },
        }),
      ]),
    );

    const conferenceMemberships = memberships.filter((m) => m.conferenceId && m.conference);
    const orgIds = [...new Set(conferenceMemberships.map((m) => m.organizationId))];
    const conferenceIds = conferenceMemberships
      .map((m) => m.conferenceId)
      .filter((id): id is string => id !== null);

    const orgMemberships = await withTenantContext({ userId }, async (tx) =>
      tx.membership.findMany({
        where: {
          userId,
          OR: [
            { conferenceId: { in: conferenceIds }, scope: 'CONFERENCE' },
            { organizationId: { in: orgIds }, scope: 'ORGANIZATION' },
          ],
        },
        include: { roles: true },
      }),
    );

    const { rolesByConferenceId, rolesByOrganizationId } = mergeRolesByConference(orgMemberships);

    const organizerConferences = conferenceMemberships
      .filter((membership) => {
        if (!membership.conference) return false;
        const roles = effectiveRolesForConference(
          membership.conference.id,
          membership.conference.organizationId,
          rolesByConferenceId,
          rolesByOrganizationId,
        );
        return maxRoleRank(roles) >= maxRoleRank(ORGANIZER_SURFACE_ROLES);
      })
      .map((membership) => {
        const conference = membership.conference!;
        const myRoles = effectiveRolesForConference(
          conference.id,
          conference.organizationId,
          rolesByConferenceId,
          rolesByOrganizationId,
        );
        return {
          id: conference.id,
          name: conference.name,
          slug: conference.slug,
          status: conference.status,
          myRoles,
        };
      });

    const canCreateConference = memberships.some((membership) =>
      membership.roles.some((grant) => CREATE_CONFERENCE_ROLES.includes(grant.role)),
    );

    return {
      authoredPapers: papers.map((paper) => ({
        id: paper.id,
        conferenceId: paper.conferenceId,
        conferenceName: paper.conference.name,
        conferenceSlug: paper.conference.slug,
        title: paper.title,
        status: paper.status,
        updatedAt: paper.updatedAt.toISOString(),
      })),
      reviewerAssignments: assignments.map((assignment) => ({
        id: assignment.id,
        conferenceId: assignment.conferenceId,
        conferenceName: assignment.conference.name,
        conferenceSlug: assignment.conference.slug,
        paperId: assignment.paperId,
        paperTitle: assignment.paper.title,
        status: assignment.status,
        dueAt: assignment.dueAt?.toISOString() ?? null,
        roundNumber: assignment.round.roundNumber,
      })),
      organizerConferences,
      canCreateConference,
    };
  }
}
