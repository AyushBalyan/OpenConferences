'use client';

import { useParams, usePathname } from 'next/navigation';
import { AssignmentsWorkspaceProvider } from '@/components/dashboard/reviews/assignments/assignments-workspace';
import {
  AssignmentsAlerts,
  AssignmentsRoundBar,
} from '@/components/dashboard/reviews/assignments/assignments-shared';
import { SectionLayoutFrame } from '@/components/dashboard/section-layout-frame';
import { SECTION_PAGE_META } from '@/lib/conference-nav';

const ORGANIZER_ASSIGNMENT_TABS = new Set(['current', 'bids', 'manual', 'invites']);

function isReviewEditorPath(pathname: string): boolean {
  const match = pathname.match(/\/reviews\/assignments\/([^/]+)\/?$/);
  if (!match) return false;
  return !ORGANIZER_ASSIGNMENT_TABS.has(match[1]!);
}

export default function AssignmentsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const meta = SECTION_PAGE_META.assignments;

  // Review editor lives under /assignments/[assignmentId] for both roles.
  // Do not mount the organizer workspace (members/bids fetch) on that route.
  if (isReviewEditorPath(pathname)) {
    return <>{children}</>;
  }

  const showRoundBar = !pathname.endsWith('/invites');

  return (
    <AssignmentsWorkspaceProvider conferenceId={params.id}>
      <SectionLayoutFrame
        title={meta.title}
        description={meta.description}
        alerts={<AssignmentsAlerts />}
        toolbar={showRoundBar ? <AssignmentsRoundBar /> : null}
      >
        {children}
      </SectionLayoutFrame>
    </AssignmentsWorkspaceProvider>
  );
}
