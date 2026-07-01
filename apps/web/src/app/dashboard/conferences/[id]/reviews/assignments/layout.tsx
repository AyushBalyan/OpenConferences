'use client';

import { useParams, usePathname } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionSubnav } from '@/components/dashboard/section-subnav';
import { AssignmentsWorkspaceProvider } from '@/components/dashboard/reviews/assignments/assignments-workspace';
import {
  AssignmentsAlerts,
  AssignmentsRoundBar,
} from '@/components/dashboard/reviews/assignments/assignments-shared';
import { sectionSubnavTabs } from '@/lib/conference-nav';

const ASSIGNMENTS_NAV = {
  label: 'Assignments',
  href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/assignments`,
  children: [
    { label: 'Current assignments', segment: 'current' },
    { label: 'Reviewer bids', segment: 'bids' },
    { label: 'Invitations', segment: 'invites' },
    { label: 'Manual assignment', segment: 'manual' },
  ],
} as const;

export default function AssignmentsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const tabs = sectionSubnavTabs(ASSIGNMENTS_NAV, params.id);
  const showRoundBar = !pathname.endsWith('/invites');

  return (
    <AssignmentsWorkspaceProvider conferenceId={params.id}>
      <PageHeader
        title="Reviewer assignments"
        description="Manage reviewer assignments, bids, and invitations."
      />
      <SectionSubnav tabs={tabs} ariaLabel="Assignment sections" />
      <AssignmentsAlerts />
      {showRoundBar ? <AssignmentsRoundBar /> : null}
      {children}
    </AssignmentsWorkspaceProvider>
  );
}
