'use client';

import { AuthorSubmitLinkCard } from '@/components/dashboard/author-submit-link-card';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { SettingsPhasesPanel } from '@/components/dashboard/settings/settings-panels';

export default function SettingsPhasesPage() {
  const { conferenceId, conference } = useConferenceWorkspace();

  return (
    <div className="space-y-6">
      <AuthorSubmitLinkCard
        conferenceId={conferenceId}
        cfpOpen={conference?.status === 'CFP_OPEN'}
      />
      <SettingsPhasesPanel />
    </div>
  );
}
