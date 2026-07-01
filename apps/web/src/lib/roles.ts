export type RoleKind =
  'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'ORGANIZER' | 'CHAIR' | 'REVIEWER' | 'AUTHOR';

export type { NavGroupConfig as NavGroup, NavItemConfig as NavItem } from '@/lib/conference-nav';
export { navGroupsForRoles } from '@/lib/conference-nav';

const ORGANIZER_SURFACE_ROLES: RoleKind[] = ['CHAIR', 'ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN'];
const REVIEW_COORDINATION_ROLES: RoleKind[] = ['CHAIR', 'ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN'];
const CONFERENCE_ADMIN_ROLES: RoleKind[] = ['ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN'];
const CREATE_CONFERENCE_ROLES: RoleKind[] = ['ORG_ADMIN', 'PLATFORM_ADMIN'];

export function hasRole(roles: string[], role: RoleKind): boolean {
  return roles.includes(role);
}

export function hasAnyRole(roles: string[], candidates: RoleKind[]): boolean {
  return candidates.some((role) => roles.includes(role));
}

export function isAuthor(roles: string[]): boolean {
  return hasRole(roles, 'AUTHOR');
}

export function isReviewer(roles: string[]): boolean {
  return hasRole(roles, 'REVIEWER');
}

export function isOrganizerSurface(roles: string[]): boolean {
  return hasAnyRole(roles, ORGANIZER_SURFACE_ROLES);
}

export function canCoordinateReview(roles: string[]): boolean {
  return hasAnyRole(roles, REVIEW_COORDINATION_ROLES);
}

export function canManageConference(roles: string[]): boolean {
  return hasAnyRole(roles, CONFERENCE_ADMIN_ROLES);
}

export function canCreateConference(roles: string[]): boolean {
  return hasAnyRole(roles, CREATE_CONFERENCE_ROLES);
}

export function roleLabels(roles: string[]): string[] {
  const labels: string[] = [];
  if (isAuthor(roles)) labels.push('Author');
  if (isReviewer(roles)) labels.push('Reviewer');
  if (canManageConference(roles)) labels.push('Organizer');
  else if (canCoordinateReview(roles)) labels.push('Chair');
  return labels;
}
