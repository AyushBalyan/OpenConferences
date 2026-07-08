'use client';

import { MembersTablePanel } from '@/components/dashboard/members/members-panels';

export default function MembersOrganisersPage() {
  return (
    <MembersTablePanel
      category="organisers"
      emptyMessage="No organisers, chairs, or org-level admins yet."
    />
  );
}
