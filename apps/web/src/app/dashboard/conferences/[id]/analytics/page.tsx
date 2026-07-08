'use client';

import { AnalyticsOverview } from '@/components/dashboard/analytics-overview';
import { PageHeader } from '@/components/dashboard/page-header';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';

export default function ConferenceAnalyticsPage() {
  const { conferenceId } = useConferenceWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Conference funnel from submissions through registrations and revenue."
      />
      <AnalyticsOverview conferenceId={conferenceId} />
    </div>
  );
}
