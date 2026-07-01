'use client';

import { useParams } from 'next/navigation';
import { ConferenceWorkspaceProvider } from '@/components/dashboard/conference-workspace';

export default function ConferenceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();

  return (
    <ConferenceWorkspaceProvider conferenceId={params.id}>{children}</ConferenceWorkspaceProvider>
  );
}
