'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionSubnav } from '@/components/dashboard/section-subnav';
import { MembersWorkspaceProvider } from '@/components/dashboard/members/members-workspace';
import { sectionSubnavTabs } from '@/lib/conference-nav';

const MEMBERS_NAV = {
  label: 'Members',
  href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/members`,
  children: [
    { label: 'Organisers', segment: 'organisers' },
    { label: 'Reviewers', segment: 'reviewers' },
    { label: 'Authors', segment: 'authors' },
    { label: 'Grant role', segment: 'grant' },
  ],
} as const;

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const tabs = sectionSubnavTabs(MEMBERS_NAV, params.id);

  return (
    <MembersWorkspaceProvider conferenceId={params.id}>
      <PageHeader
        title="Members & roles"
        description="Browse organisers, reviewers, and authors. Grant or revoke conference roles."
      />
      <SectionSubnav tabs={tabs} ariaLabel="Members sections" />
      {children}
    </MembersWorkspaceProvider>
  );
}
