'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionSubnav } from '@/components/dashboard/section-subnav';
import { DecisionsWorkspaceProvider } from '@/components/dashboard/reviews/decisions/decisions-workspace';
import {
  DecisionsAlerts,
  DecisionsRoundBar,
} from '@/components/dashboard/reviews/decisions/decisions-panels';
import { sectionSubnavTabs } from '@/lib/conference-nav';

const DECISIONS_NAV = {
  label: 'Decisions',
  href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/reviews/decisions`,
  children: [
    { label: 'Pending decisions', segment: 'pending' },
    { label: 'Recorded decisions', segment: 'recorded' },
  ],
} as const;

export default function DecisionsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const tabs = sectionSubnavTabs(DECISIONS_NAV, params.id);

  return (
    <DecisionsWorkspaceProvider conferenceId={params.id}>
      <PageHeader
        title="Editorial decisions"
        description="Record accept/reject/revision outcomes and notify authors."
      />
      <SectionSubnav tabs={tabs} ariaLabel="Decision sections" />
      <DecisionsAlerts />
      <DecisionsRoundBar />
      {children}
    </DecisionsWorkspaceProvider>
  );
}
