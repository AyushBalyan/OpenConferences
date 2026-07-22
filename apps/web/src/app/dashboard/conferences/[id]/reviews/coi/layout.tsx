'use client';

import { useParams } from 'next/navigation';
import { CoiWorkspaceProvider } from '@/components/dashboard/reviews/coi/coi-workspace';
import { CoiAlerts } from '@/components/dashboard/reviews/coi/coi-panels';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { SectionLayoutFrame } from '@/components/dashboard/section-layout-frame';
import { coiSectionMeta } from '@/lib/conference-nav';

export default function CoiLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const { conference } = useConferenceWorkspace();
  const roles = conference?.myRoles ?? [];
  const meta = coiSectionMeta(roles);

  return (
    <CoiWorkspaceProvider conferenceId={params.id}>
      <SectionLayoutFrame title={meta.title} description={meta.description} alerts={<CoiAlerts />}>
        {children}
      </SectionLayoutFrame>
    </CoiWorkspaceProvider>
  );
}
