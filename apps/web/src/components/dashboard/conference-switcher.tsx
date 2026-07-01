'use client';

import { useRouter } from 'next/navigation';
import { ChevronsUpDown } from 'lucide-react';
import type { Conference } from '@/lib/conference-types';
import { cn } from '@/lib/utils';

export function ConferenceSwitcher({
  conferences,
  currentId,
  className,
}: {
  conferences: Conference[];
  currentId?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={cn('relative', className)}>
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <select
        className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    </div>
  );
}
