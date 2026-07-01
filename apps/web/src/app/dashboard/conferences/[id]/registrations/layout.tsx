'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionSubnav } from '@/components/dashboard/section-subnav';
import { sectionSubnavTabs } from '@/lib/conference-nav';

const REGISTRATIONS_NAV = {
  label: 'Registrations',
  href: (conferenceId: string) => `/dashboard/conferences/${conferenceId}/registrations`,
  children: [
    { label: 'All registrations', segment: 'all' },
    { label: 'Student verifications', segment: 'verifications' },
  ],
} as const;

export default function RegistrationsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const tabs = sectionSubnavTabs(REGISTRATIONS_NAV, params.id);

  return (
    <>
      <PageHeader
        title="Registrations"
        description="Payment status and student verification queue."
      />
      <SectionSubnav tabs={tabs} ariaLabel="Registration sections" />
      {children}
    </>
  );
}
