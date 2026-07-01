import type { RoleKind } from '@openconferences/db';
import type { PrismaClient } from '@openconferences/db';

type MembershipClient = Pick<PrismaClient, 'membership'>;

export async function resolveEffectiveRoles(
  tx: MembershipClient,
  userId: string,
  conferenceId: string,
  organizationId: string,
): Promise<RoleKind[]> {
  const memberships = await tx.membership.findMany({
    where: {
      userId,
      OR: [
        { conferenceId, scope: 'CONFERENCE' },
        { organizationId, scope: 'ORGANIZATION' },
      ],
    },
    include: { roles: true },
  });

  return [
    ...new Set(memberships.flatMap((membership) => membership.roles.map((grant) => grant.role))),
  ];
}

export function mergeRolesByConference(
  memberships: Array<{
    conferenceId: string | null;
    organizationId: string | null;
    scope: 'ORGANIZATION' | 'CONFERENCE';
    roles: Array<{ role: RoleKind }>;
  }>,
): {
  rolesByConferenceId: Map<string, RoleKind[]>;
  rolesByOrganizationId: Map<string, RoleKind[]>;
} {
  const rolesByConferenceId = new Map<string, RoleKind[]>();
  const rolesByOrganizationId = new Map<string, RoleKind[]>();

  for (const membership of memberships) {
    const grantRoles = membership.roles.map((grant) => grant.role);

    if (membership.scope === 'CONFERENCE' && membership.conferenceId) {
      const existing = rolesByConferenceId.get(membership.conferenceId) ?? [];
      rolesByConferenceId.set(membership.conferenceId, [...new Set([...existing, ...grantRoles])]);
    }

    if (membership.scope === 'ORGANIZATION' && membership.organizationId) {
      const existing = rolesByOrganizationId.get(membership.organizationId) ?? [];
      rolesByOrganizationId.set(membership.organizationId, [
        ...new Set([...existing, ...grantRoles]),
      ]);
    }
  }

  return { rolesByConferenceId, rolesByOrganizationId };
}

export function effectiveRolesForConference(
  conferenceId: string,
  organizationId: string,
  rolesByConferenceId: Map<string, RoleKind[]>,
  rolesByOrganizationId: Map<string, RoleKind[]>,
  globalRoles: RoleKind[] = [],
): RoleKind[] {
  return [
    ...new Set([
      ...(rolesByConferenceId.get(conferenceId) ?? []),
      ...(rolesByOrganizationId.get(organizationId) ?? []),
      ...globalRoles,
    ]),
  ];
}
