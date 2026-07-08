'use client';

import { MembersTablePanel } from '@/components/dashboard/members/members-panels';

export default function MembersReviewersPage() {
  return <MembersTablePanel category="reviewers" emptyMessage="No reviewers yet." />;
}
