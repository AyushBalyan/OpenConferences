'use client';

import { MembersTablePanel } from '@/components/dashboard/members/members-panels';

export default function MembersAuthorsPage() {
  return <MembersTablePanel category="authors" emptyMessage="No authors yet." />;
}
