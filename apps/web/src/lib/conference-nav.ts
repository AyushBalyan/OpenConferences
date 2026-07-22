import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  Layers,
  Mail,
  ScrollText,
  Settings,
  ShieldAlert,
  UserCheck,
  Users,
  Vote,
} from 'lucide-react';
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
  href: (conferenceId: string) => string;
  children?: readonly NavSubItem[];
};

export type NavGroupConfig = {
  label: string;
  items: NavItemConfig[];
};

export type CommandNavItem = {
  id: string;
  label: string;
  href: string;
  group: string;
  keywords?: string[];
};

/** Shared section configs — single source for sidebar, breadcrumbs, and command menu. */
export const NAV_SECTIONS = {
  overview: {
    label: 'Overview',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}`,
  },
  mySubmissions: {
    label: 'My submissions',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/submissions`,
  },
  allSubmissions: {
    label: 'All submissions',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/submissions`,
  },
  analytics: {
    label: 'Analytics',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/analytics`,
  },
  bidding: {
    label: 'Bidding',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/bidding`,
  },
  biddingOversight: {
    label: 'Bidding oversight',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/bidding`,
  },
  coiReviewer: {
    label: 'COI',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/coi`,
    children: [
      { label: 'Declare conflict', segment: 'declare' },
      { label: 'My declarations', segment: 'declarations' },
    ],
  },
  coiOrganizer: {
    label: 'COI oversight',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/coi`,
    children: [
      { label: 'All conflicts', segment: 'all' },
      { label: 'Declare conflict', segment: 'declare' },
    ],
  },
  myReviews: {
    label: 'My reviews',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/my-assignments`,
  },
  reviewRounds: {
    label: 'Review rounds',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/rounds`,
  },
  assignments: {
    label: 'Assignments',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/assignments`,
    children: [
      { label: 'Current assignments', segment: 'current' },
      { label: 'Reviewer bids', segment: 'bids' },
      { label: 'Invitations', segment: 'invites' },
      { label: 'Manual assignment', segment: 'manual' },
    ],
  },
  decisions: {
    label: 'Decisions',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/decisions`,
    children: [
      { label: 'Pending decisions', segment: 'pending' },
      { label: 'Recorded decisions', segment: 'recorded' },
    ],
  },
  registrations: {
    label: 'Registrations',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/registrations`,
    children: [
      { label: 'All registrations', segment: 'all' },
      { label: 'Student verifications', segment: 'verifications' },
    ],
  },
  settings: {
    label: 'Settings',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/settings`,
    children: [
      { label: 'Phases & blinding', segment: 'phases' },
      { label: 'Fee schedule', segment: 'fees' },
    ],
  },
  tracks: {
    label: 'Tracks',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/tracks`,
  },
  members: {
    label: 'Members',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/members`,
    children: [
      { label: 'Organisers', segment: 'organisers' },
      { label: 'Reviewers', segment: 'reviewers' },
      { label: 'Authors', segment: 'authors' },
      { label: 'Grant role', segment: 'grant' },
    ],
  },
  emailLog: {
    label: 'Email log',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/notifications`,
  },
  emailTemplates: {
    label: 'Email templates',
    href: (conferenceId: string) =>
      `/dashboard/conferences/${conferenceId}/notifications/templates`,
  },
  auditLog: {
    label: 'Audit log',
    href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/audit`,
  },
} as const satisfies Record<string, NavItemConfig>;

export const NAV_ITEM_ICONS: Record<string, LucideIcon> = {
  Overview: LayoutDashboard,
  'My submissions': FileText,
  'All submissions': FileText,
  Analytics: BarChart3,
  Bidding: Vote,
  'Bidding oversight': Vote,
  COI: ShieldAlert,
  'COI oversight': ShieldAlert,
  'My reviews': ClipboardCheck,
  'Review rounds': ClipboardCheck,
  Assignments: UserCheck,
  Decisions: ClipboardCheck,
  Registrations: CreditCard,
  Settings: Settings,
  Tracks: Layers,
  Members: Users,
  'Email log': Mail,
  'Email templates': Mail,
  'Audit log': ScrollText,
};

/** Breadcrumb segment → label (includes child tab segments). */
export const BREADCRUMB_SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Conferences',
  conferences: 'Conferences',
  me: 'Home',
  new: 'Create',
  submissions: 'Submissions',
  reviews: 'Reviews',
  bidding: 'Bidding',
  coi: 'COI',
  'my-assignments': 'My reviews',
  assignments: 'Assignments',
  current: 'Current assignments',
  bids: 'Reviewer bids',
  invites: 'Invitations',
  manual: 'Manual assignment',
  pending: 'Pending decisions',
  recorded: 'Recorded decisions',
  phases: 'Phases & blinding',
  fees: 'Fee schedule',
  organisers: 'Organisers',
  reviewers: 'Reviewers',
  authors: 'Authors',
  grant: 'Grant role',
  all: 'All registrations',
  verifications: 'Student verifications',
  declare: 'Declare conflict',
  declarations: 'My declarations',
  rounds: 'Review rounds',
  decisions: 'Decisions',
  registrations: 'Registrations',
  'student-verifications': 'Student verifications',
  settings: 'Settings',
  tracks: 'Tracks',
  members: 'Members',
  notifications: 'Email log',
  templates: 'Email templates',
  audit: 'Audit log',
  analytics: 'Analytics',
};

export function navItemIcon(label: string): LucideIcon {
  return NAV_ITEM_ICONS[label] ?? FileText;
}

export function subTabHref(baseHref: string, segment: string): string {
  return `${baseHref.replace(/\/$/, '')}/${segment}`;
}

export function navGroupsForRoles(roles: string[]): NavGroupConfig[] {
  const groups: NavGroupConfig[] = [];

  if (isAuthor(roles)) {
    groups.push({
      label: 'Author',
      items: [NAV_SECTIONS.mySubmissions],
    });
  }

  if (isReviewer(roles)) {
    groups.push({
      label: 'Reviewer',
      items: [NAV_SECTIONS.bidding, NAV_SECTIONS.coiReviewer, NAV_SECTIONS.myReviews],
    });
  }

  if (isOrganizerSurface(roles)) {
    const organizeItems: NavItemConfig[] = [NAV_SECTIONS.overview];

    if (canCoordinateReview(roles) || canManageConference(roles)) {
      organizeItems.push(NAV_SECTIONS.allSubmissions);
    }

    if (canCoordinateReview(roles)) {
      organizeItems.push(
        NAV_SECTIONS.analytics,
        NAV_SECTIONS.biddingOversight,
        NAV_SECTIONS.coiOrganizer,
        NAV_SECTIONS.reviewRounds,
        NAV_SECTIONS.assignments,
        NAV_SECTIONS.decisions,
        NAV_SECTIONS.registrations,
      );
    }

    if (canManageConference(roles)) {
      organizeItems.push(
        NAV_SECTIONS.settings,
        NAV_SECTIONS.tracks,
        NAV_SECTIONS.members,
        NAV_SECTIONS.emailLog,
        NAV_SECTIONS.emailTemplates,
        NAV_SECTIONS.auditLog,
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

export function findNavSubItemLabel(
  item: NavItemConfig,
  conferenceId: string,
  pathname: string,
): string | null {
  if (!item.children?.length) return null;
  const base = item.href(conferenceId);
  for (const child of item.children) {
    const href = subTabHref(base, child.segment);
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return child.label;
    }
  }
  return null;
}

export function breadcrumbLabelForSegment(segment: string): string {
  return BREADCRUMB_SEGMENT_LABELS[segment] ?? segment.replace(/-/g, ' ');
}

export function buildDashboardBreadcrumbs(
  pathname: string,
  options: { conferenceId?: string; conferenceName?: string; roles?: string[] },
): Array<{ label: string; href?: string }> {
  const items: Array<{ label: string; href?: string }> = [
    { label: 'Conferences', href: '/me/dashboard' },
  ];

  if (pathname.startsWith('/me/dashboard')) {
    return [{ label: 'Home' }];
  }

  const conferenceIndex = pathname.split('/').indexOf('conferences');
  const segments = pathname.split('/').filter(Boolean);
  if (conferenceIndex < 0 || !segments[conferenceIndex + 1]) {
    return items;
  }

  const id = segments[conferenceIndex + 1]!;
  if (id === 'new') {
    items.push({ label: 'Create conference' });
    return items;
  }

  items.push({
    label: options.conferenceName ?? 'Conference',
    href: `/dashboard/conferences/${id}`,
  });

  const tail = segments.slice(conferenceIndex + 2);
  if (tail.length === 0) {
    items.push({ label: 'Overview' });
    return items;
  }

  const roles = options.roles ?? [];
  const groups = navGroupsForRoles(roles);
  const activeItem = findNavItemByPath(groups, id, pathname);

  if (activeItem) {
    let path = `/dashboard/conferences/${id}`;
    const firstSegment = tail[0]!;
    path += `/${firstSegment}`;
    items.push({
      label: breadcrumbLabelForSegment(firstSegment),
      href: tail.length > 1 ? path : undefined,
    });

    const subLabel = findNavSubItemLabel(activeItem, id, pathname);
    if (subLabel && tail.length > 1) {
      items.push({ label: subLabel });
    } else if (tail.length > 1) {
      let subPath = path;
      tail.slice(1).forEach((segment, index) => {
        subPath += `/${segment}`;
        const isLast = index === tail.length - 2;
        items.push({
          label: breadcrumbLabelForSegment(segment),
          href: isLast ? undefined : subPath,
        });
      });
    }
    return items;
  }

  let path = `/dashboard/conferences/${id}`;
  tail.forEach((segment, index) => {
    path += `/${segment}`;
    const isLast = index === tail.length - 1;
    items.push({
      label: breadcrumbLabelForSegment(segment),
      href: isLast ? undefined : path,
    });
  });

  return items;
}

export function buildCommandItemsFromNav(options: {
  conferenceId?: string;
  conferenceName?: string;
  roles?: string[];
}): CommandNavItem[] {
  const items: CommandNavItem[] = [
    {
      id: 'home',
      label: 'All conferences',
      href: '/me/dashboard',
      group: 'Workspace',
    },
    {
      id: 'create',
      label: 'Create conference',
      href: '/dashboard/conferences/new',
      group: 'Workspace',
    },
  ];

  if (!options.conferenceId) {
    return items;
  }

  const conferenceId = options.conferenceId;
  const groups = navGroupsForRoles(options.roles ?? []);

  for (const group of groups) {
    for (const item of group.items) {
      items.push({
        id: `${group.label}-${item.label}`,
        label: item.label,
        href: defaultSubTabHref(item, conferenceId),
        group: group.label,
        keywords: [options.conferenceName ?? '', group.label],
      });

      if (item.children) {
        const base = item.href(conferenceId);
        for (const child of item.children) {
          items.push({
            id: `${group.label}-${item.label}-${child.segment}`,
            label: child.label,
            href: subTabHref(base, child.segment),
            group: group.label,
            keywords: [item.label, options.conferenceName ?? ''],
          });
        }
      }
    }
  }

  if (isAuthor(options.roles ?? [])) {
    items.push({
      id: 'new-submission',
      label: 'New submission',
      href: `/dashboard/conferences/${conferenceId}/submissions/new`,
      group: 'Author',
    });
  }

  return items;
}

/** Section page metadata for layouts (replaces local *_NAV + SectionSubnav). */
export const SECTION_PAGE_META = {
  members: {
    item: NAV_SECTIONS.members,
    title: 'Members & roles',
    description: 'View conference members and grant or revoke roles.',
  },
  assignments: {
    item: NAV_SECTIONS.assignments,
    title: 'Reviewer assignments',
    description: 'Manage reviewer assignments, bids, and invitations.',
  },
  decisions: {
    item: NAV_SECTIONS.decisions,
    title: 'Editorial decisions',
    description: 'Record accept/reject/revision outcomes and notify authors.',
  },
  settings: {
    item: NAV_SECTIONS.settings,
    title: 'Conference settings',
    description: 'Configure phases, blinding, and registration fees.',
  },
  registrations: {
    item: NAV_SECTIONS.registrations,
    title: 'Registrations',
    description: 'Manage author registrations and student verification.',
  },
  coiReviewer: {
    item: NAV_SECTIONS.coiReviewer,
    title: 'Conflicts of interest',
    description: 'Declare and manage your conflict declarations.',
  },
  coiOrganizer: {
    item: NAV_SECTIONS.coiOrganizer,
    title: 'Conflicts of interest',
    description: 'Review declared conflicts across the program committee.',
  },
} as const;

export function coiSectionMeta(roles: string[]) {
  return canCoordinateReview(roles)
    ? SECTION_PAGE_META.coiOrganizer
    : SECTION_PAGE_META.coiReviewer;
}
