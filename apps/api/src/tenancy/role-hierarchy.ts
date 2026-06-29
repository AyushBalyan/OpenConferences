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

export function maxRoleRank(roles: RoleKind[]): number {
  if (roles.length === 0) return 0;
  return Math.max(...roles.map((role) => ROLE_RANK[role]));
}

export function canGrantRole(grantorRoles: RoleKind[], targetRole: RoleKind): boolean {
  if (SEED_ONLY_ROLES.includes(targetRole)) {
    return false;
  }

  const grantorMax = maxRoleRank(grantorRoles);
  return ROLE_RANK[targetRole] < grantorMax;
}
