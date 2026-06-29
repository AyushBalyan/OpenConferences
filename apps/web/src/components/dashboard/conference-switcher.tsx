'use client';

import { useRouter } from 'next/navigation';
import type { Conference } from '@/lib/conference-types';

export function ConferenceSwitcher({
  conferences,
  currentId,
}: {
  conferences: Conference[];
  currentId?: string;
}) {
  const router = useRouter();

  return (
    <select
      className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
      value={currentId ?? ''}
      onChange={(event) => {
        const id = event.target.value;
        if (id) router.push(`/dashboard/conferences/${id}`);
      }}
    >
      <option value="" disabled>
        Select conference
      </option>
      {conferences.map((conference) => (
        <option key={conference.id} value={conference.id}>
          {conference.name}
        </option>
      ))}
    </select>
  );
}
