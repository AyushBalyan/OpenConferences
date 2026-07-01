'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionSubnav } from '@/components/dashboard/section-subnav';
import { SettingsWorkspaceProvider } from '@/components/dashboard/settings/settings-workspace';
import { sectionSubnavTabs } from '@/lib/conference-nav';

const SETTINGS_NAV = {
  label: 'Settings',
  href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/settings`,
  children: [
    { label: 'Phases & blinding', segment: 'phases' },
    { label: 'Fee schedule', segment: 'fees' },
  ],
} as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const tabs = sectionSubnavTabs(SETTINGS_NAV, params.id);

  return (
    <SettingsWorkspaceProvider conferenceId={params.id}>
      <PageHeader
        title="Conference settings"
        description="Configure phase windows, blinding, and registration fees."
      />
      <SectionSubnav tabs={tabs} ariaLabel="Settings sections" />
      {children}
    </SettingsWorkspaceProvider>
  );
}
