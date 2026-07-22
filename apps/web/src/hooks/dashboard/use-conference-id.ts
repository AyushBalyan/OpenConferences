'use client';

import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';

export function useConferenceId(): string {
  const { conferenceId } = useConferenceWorkspace();
  return conferenceId;
}
