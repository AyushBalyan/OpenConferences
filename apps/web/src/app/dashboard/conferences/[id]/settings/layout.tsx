'use client';

import { useParams } from 'next/navigation';
import { SettingsWorkspaceProvider } from '@/components/dashboard/settings/settings-workspace';
import { SectionLayoutFrame } from '@/components/dashboard/section-layout-frame';
import { SECTION_PAGE_META } from '@/lib/conference-nav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const meta = SECTION_PAGE_META.settings;

  return (
    <SettingsWorkspaceProvider conferenceId={params.id}>
      <SectionLayoutFrame title={meta.title} description={meta.description}>
        {children}
      </SectionLayoutFrame>
    </SettingsWorkspaceProvider>
  );
}
