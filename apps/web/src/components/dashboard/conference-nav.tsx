'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { href: (id: string) => `/dashboard/conferences/${id}`, label: 'Overview' },
  { href: (id: string) => `/dashboard/conferences/${id}/settings`, label: 'Settings' },
  { href: (id: string) => `/dashboard/conferences/${id}/tracks`, label: 'Tracks' },
  { href: (id: string) => `/dashboard/conferences/${id}/members`, label: 'Members' },
  { href: (id: string) => `/dashboard/conferences/${id}/audit`, label: 'Audit log' },
];

export function ConferenceNav({ conferenceId }: { conferenceId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3">
      {NAV.map((item) => {
        const href = item.href(conferenceId);
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
