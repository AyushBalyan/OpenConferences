'use client';

import { useParams } from 'next/navigation';
import { RegistrationsWorkspaceProvider } from '@/components/dashboard/registrations/registrations-workspace';
import { SectionLayoutFrame } from '@/components/dashboard/section-layout-frame';
import { SECTION_PAGE_META } from '@/lib/conference-nav';

export default function RegistrationsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const meta = SECTION_PAGE_META.registrations;

  return (
    <RegistrationsWorkspaceProvider conferenceId={params.id}>
      <SectionLayoutFrame title={meta.title} description={meta.description}>
        {children}
      </SectionLayoutFrame>
    </RegistrationsWorkspaceProvider>
  );
}
