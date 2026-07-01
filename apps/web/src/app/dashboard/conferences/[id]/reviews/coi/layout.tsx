'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionSubnav } from '@/components/dashboard/section-subnav';
import { CoiWorkspaceProvider } from '@/components/dashboard/reviews/coi/coi-workspace';
import { CoiAlerts } from '@/components/dashboard/reviews/coi/coi-panels';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { isOrganizerSurface } from '@/lib/roles';
import { subTabHref } from '@/lib/conference-nav';

export default function CoiLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const { conference } = useConferenceWorkspace();
  const roles = conference?.myRoles ?? [];
  const isOrganizer = isOrganizerSurface(roles);
  const base = `/dashboard/conferences/${params.id}/reviews/coi`;

  const tabs = isOrganizer
    ? [
        { label: 'All conflicts', href: subTabHref(base, 'all') },
        { label: 'Declare conflict', href: subTabHref(base, 'declare') },
      ]
    : [
        { label: 'Declare conflict', href: subTabHref(base, 'declare') },
        { label: 'My declarations', href: subTabHref(base, 'declarations') },
      ];

  return (
    <CoiWorkspaceProvider conferenceId={params.id}>
      <PageHeader
        title={isOrganizer ? 'COI oversight' : 'Conflict of interest'}
        description={
          isOrganizer
            ? 'Review and manage declared conflicts across the conference.'
            : 'Declare and review your conflicts for this conference.'
        }
      />
      <SectionSubnav tabs={tabs} ariaLabel="COI sections" />
      <CoiAlerts />
      {children}
    </CoiWorkspaceProvider>
  );
}
