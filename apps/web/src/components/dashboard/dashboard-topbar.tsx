'use client';

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { buildCommandItems, CommandMenu } from '@/components/dashboard/command-menu';
import {
  DashboardBreadcrumbs,
  type BreadcrumbItem,
} from '@/components/dashboard/dashboard-breadcrumbs';
import { UserMenu } from '@/components/dashboard/user-menu';
import {
  canCoordinateReview,
  canManageConference,
  isAuthor,
  isOrganizerSurface,
  isReviewer,
} from '@/lib/roles';
import { cn } from '@/lib/utils';

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Conferences',
  conferences: 'Conferences',
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
};

type DashboardTopbarProps = {
  conferenceId?: string;
  conferenceName?: string;
  roles?: string[];
  actions?: React.ReactNode;
  className?: string;
  mobileMenuButton?: React.ReactNode;
};

export function DashboardTopbar({
  conferenceId,
  conferenceName,
  roles = [],
  actions,
  className,
  mobileMenuButton,
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname, conferenceName);

  const commandItems = buildCommandItems({
    conferenceId,
    conferenceName,
    isAuthor: isAuthor(roles),
    isReviewer: isReviewer(roles),
    isOrganizer:
      isOrganizerSurface(roles) || canCoordinateReview(roles) || canManageConference(roles),
  });

  return (
    <header
      className={cn(
        'flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6',
        className,
      )}
    >
      {mobileMenuButton}
      <div className="min-w-0 flex-1">
        <DashboardBreadcrumbs items={breadcrumbs} />
      </div>

      <div className="hidden flex-1 justify-center lg:flex">
        <CommandMenu items={commandItems} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className="h-5 w-5" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

function buildBreadcrumbs(pathname: string, conferenceName?: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: 'Conferences', href: '/dashboard' }];

  if (segments.length <= 1) {
    return items;
  }

  const conferenceIndex = segments.indexOf('conferences');
  if (conferenceIndex >= 0 && segments[conferenceIndex + 1]) {
    const id = segments[conferenceIndex + 1];
    if (id === 'new') {
      items.push({ label: 'Create conference' });
      return items;
    }

    items.push({
      label: conferenceName ?? 'Conference',
      href: `/dashboard/conferences/${id}`,
    });

    const tail = segments.slice(conferenceIndex + 2);
    if (tail.length === 0) {
      items.push({ label: 'Overview' });
      return items;
    }

    let path = `/dashboard/conferences/${id}`;
    tail.forEach((segment, index) => {
      path += `/${segment}`;
      const isLast = index === tail.length - 1;
      const label = SEGMENT_LABELS[segment] ?? segment.replace(/-/g, ' ');
      items.push(isLast ? { label } : { label, href: path });
    });
  }

  return items;
}
