'use client';

import { useParams } from 'next/navigation';
import { MembersWorkspaceProvider } from '@/components/dashboard/members/members-workspace';
import { SectionLayoutFrame } from '@/components/dashboard/section-layout-frame';
import { SECTION_PAGE_META } from '@/lib/conference-nav';

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const meta = SECTION_PAGE_META.members;

  return (
    <MembersWorkspaceProvider conferenceId={params.id}>
      <SectionLayoutFrame title={meta.title} description={meta.description}>
        {children}
      </SectionLayoutFrame>
    </MembersWorkspaceProvider>
  );
}
