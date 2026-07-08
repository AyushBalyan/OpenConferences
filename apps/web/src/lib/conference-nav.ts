import {
  canCoordinateReview,
  canManageConference,
  isAuthor,
  isOrganizerSurface,
  isReviewer,
} from '@/lib/roles';

export type NavSubItem = {
  label: string;
  segment: string;
};

export type NavItemConfig = {
  label: string;
  /** Base path for sections with sub-tabs, or full href for leaf items. */
  href: (conferenceId: string) => string;
  children?: readonly NavSubItem[];
};

export type NavGroupConfig = {
  label: string;
  items: NavItemConfig[];
};

export function subTabHref(baseHref: string, segment: string): string {
  return `${baseHref.replace(/\/$/, '')}/${segment}`;
}

export function navGroupsForRoles(roles: string[]): NavGroupConfig[] {
  const groups: NavGroupConfig[] = [];

  if (isAuthor(roles)) {
    groups.push({
      label: 'Author',
      items: [
        {
          label: 'My submissions',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/submissions`,
        },
      ],
    });
  }

  if (isReviewer(roles)) {
    groups.push({
      label: 'Reviewer',
      items: [
        {
          label: 'Bidding',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/reviews/bidding`,
        },
        {
          label: 'COI',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/reviews/coi`,
          children: [
            { label: 'Declare conflict', segment: 'declare' },
            { label: 'My declarations', segment: 'declarations' },
          ],
        },
        {
          label: 'My reviews',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/reviews/my-assignments`,
        },
      ],
    });
  }

  if (isOrganizerSurface(roles)) {
    const organizeItems: NavItemConfig[] = [
      {
        label: 'Overview',
        href: (conferenceId) => `/dashboard/conferences/${conferenceId}`,
      },
    ];

    if (canCoordinateReview(roles) || canManageConference(roles)) {
      organizeItems.push({
        label: 'All submissions',
        href: (conferenceId) => `/dashboard/conferences/${conferenceId}/submissions`,
      });
    }

    if (canCoordinateReview(roles)) {
      organizeItems.push(
        {
          label: 'Analytics',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/analytics`,
        },
        {
          label: 'Bidding oversight',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/reviews/bidding`,
        },
        {
          label: 'COI oversight',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/reviews/coi`,
          children: [
            { label: 'All conflicts', segment: 'all' },
            { label: 'Declare conflict', segment: 'declare' },
          ],
        },
        {
          label: 'Review rounds',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/reviews/rounds`,
        },
        {
          label: 'Assignments/Reviewers',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/reviews/assignments`,
          children: [
            { label: 'Current assignments', segment: 'current' },
            { label: 'Reviewer bids', segment: 'bids' },
            { label: 'Invitations', segment: 'invites' },
            { label: 'Manual assignment', segment: 'manual' },
          ],
        },
        {
          label: 'Decisions',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/reviews/decisions`,
          children: [
            { label: 'Pending decisions', segment: 'pending' },
            { label: 'Recorded decisions', segment: 'recorded' },
          ],
        },
        {
          label: 'Registrations',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/registrations`,
          children: [
            { label: 'All registrations', segment: 'all' },
            { label: 'Student verifications', segment: 'verifications' },
          ],
        },
      );
    }

    if (canManageConference(roles)) {
      organizeItems.push(
        {
          label: 'Settings',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/settings`,
          children: [
            { label: 'Phases & blinding', segment: 'phases' },
            { label: 'Fee schedule', segment: 'fees' },
          ],
        },
        {
          label: 'Tracks',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/tracks`,
        },
        {
          label: 'Members',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/members`,
          children: [
            { label: 'Organisers', segment: 'organisers' },
            { label: 'Reviewers', segment: 'reviewers' },
            { label: 'Authors', segment: 'authors' },
            { label: 'Grant role', segment: 'grant' },
          ],
        },
        {
          label: 'Email log',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/notifications`,
        },
        {
          label: 'Email templates',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/notifications/templates`,
        },
        {
          label: 'Audit log',
          href: (conferenceId) => `/dashboard/conferences/${conferenceId}/audit`,
        },
      );
    }

    groups.push({ label: 'Organize', items: organizeItems });
  }

  return groups;
}

export function defaultSubTabHref(item: NavItemConfig, conferenceId: string): string {
  const base = item.href(conferenceId);
  if (item.children?.length) {
    return subTabHref(base, item.children[0]!.segment);
  }
  return base;
}

export function isNavItemActive(
  item: NavItemConfig,
  conferenceId: string,
  pathname: string,
): boolean {
  const base = item.href(conferenceId);
  if (item.children?.length) {
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function sectionSubnavTabs(
  item: NavItemConfig,
  conferenceId: string,
): { label: string; href: string }[] {
  const base = item.href(conferenceId);
  return (item.children ?? []).map((child) => ({
    label: child.label,
    href: subTabHref(base, child.segment),
  }));
}

export function findNavItemByPath(
  groups: NavGroupConfig[],
  conferenceId: string,
  pathname: string,
): NavItemConfig | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (isNavItemActive(item, conferenceId, pathname)) {
        return item;
      }
    }
  }
  return null;
}
