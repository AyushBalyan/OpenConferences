import type { Member } from '@/lib/conference-types';

export type MemberCategory = 'organisers' | 'reviewers' | 'authors';

export const ORGANIZER_ROLES = [
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'ORGANIZER',
  'CHAIR',
] as const satisfies readonly string[];

export const REVIEWER_ROLES = ['REVIEWER'] as const satisfies readonly string[];
export const AUTHOR_ROLES = ['AUTHOR'] as const satisfies readonly string[];

const CATEGORY_ROLES: Record<MemberCategory, readonly string[]> = {
  organisers: ORGANIZER_ROLES,
  reviewers: REVIEWER_ROLES,
  authors: AUTHOR_ROLES,
};

export function memberHasCategoryRole(member: Member, category: MemberCategory): boolean {
  const roles = CATEGORY_ROLES[category];
  return member.roles.some((role) => roles.includes(role));
}

export function filterMembersByCategory(members: Member[], category: MemberCategory): Member[] {
  return members.filter((member) => memberHasCategoryRole(member, category));
}

export function categoryRolesForMember(member: Member, category: MemberCategory): string[] {
  const roles = CATEGORY_ROLES[category];
  return member.roles.filter((role) => roles.includes(role));
}

export function formatMemberScope(scope: Member['scope']): string {
  return scope === 'ORGANIZATION' ? 'Organization' : 'Conference';
}

export function formatRoleLabel(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
