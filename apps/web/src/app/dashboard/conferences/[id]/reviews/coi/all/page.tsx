'use client';

import { CoiListPanel } from '@/components/dashboard/reviews/coi/coi-panels';

export default function CoiAllPage() {
  return (
    <CoiListPanel
      title="All declared conflicts"
      description="Conflicts declared by reviewers and chairs for this conference."
    />
  );
}
