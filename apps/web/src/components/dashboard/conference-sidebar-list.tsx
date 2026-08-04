'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import type { Conference } from '@/lib/conference-types';
import { conferenceWorkspaceHref, roleLabels } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';

export function ConferenceSidebarList({
  conferences,
  currentId,
  className,
}: {
  conferences: Conference[];
  currentId?: string;
  className?: string;
}) {
  if (conferences.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
        Your conferences
      </p>
      <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
        {conferences.map((conference) => {
          const active = currentId === conference.id;
          const labels = roleLabels(conference.myRoles ?? []);

          return (
            <li key={conference.id}>
              <Link
                href={conferenceWorkspaceHref(conference.id, conference.myRoles ?? [])}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-md border-l-2 px-3 py-2 transition-colors',
                  active
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                    : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <p className="truncate text-sm font-medium leading-snug">{conference.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={conference.status} />
                  {labels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
