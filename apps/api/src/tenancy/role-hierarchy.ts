import type { RoleKind } from '@openconferences/db';

/** Higher rank = more privileged. Used for privilege ceiling (§18.9). */
export const ROLE_RANK: Record<RoleKind, number> = {
  PLATFORM_ADMIN: 100,
  ORG_ADMIN: 90,
  ORGANIZER: 80,
  CHAIR: 70,
  REVIEWER: 50,
  AUTHOR: 40,
};

export const PRIVILEGED_ROLES: RoleKind[] = ['PLATFORM_ADMIN', 'ORG_ADMIN', 'ORGANIZER', 'CHAIR'];

export const MFA_REQUIRED_ROLES: RoleKind[] = ['PLATFORM_ADMIN', 'ORG_ADMIN', 'ORGANIZER', 'CHAIR'];

export const SEED_ONLY_ROLES: RoleKind[] = ['PLATFORM_ADMIN'];

/** Conference roles that may perform review coordination (rounds, assignments, bid oversight). */
export const REVIEW_COORDINATION_ROLES: RoleKind[] = ['ORG_ADMIN', 'ORGANIZER', 'CHAIR'];

/** Conference/org roles that may manage reviewer invitations and conference review setup. */
export const CONFERENCE_ORGANIZER_ROLES: RoleKind[] = ['ORG_ADMIN', 'ORGANIZER'];

export function maxRoleRank(roles: RoleKind[]): number {
  if (roles.length === 0) return 0;
  return Math.max(...roles.map((role) => ROLE_RANK[role]));
}

export function canCoordinateReview(roles: RoleKind[]): boolean {
  return maxRoleRank(roles) >= maxRoleRank(['CHAIR']);
}

export function canManageConferenceReview(roles: RoleKind[]): boolean {
  return maxRoleRank(roles) >= maxRoleRank(['ORGANIZER']);
}

export function canGrantRole(grantorRoles: RoleKind[], targetRole: RoleKind): boolean {
  if (SEED_ONLY_ROLES.includes(targetRole)) {
    return false;
  }

  const grantorMax = maxRoleRank(grantorRoles);
  return ROLE_RANK[targetRole] < grantorMax;
}
