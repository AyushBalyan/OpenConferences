'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRegistrationsWorkspace } from './registrations-workspace';

export function RegistrationsTabs() {
  const { conferenceId, pendingVerifications } = useRegistrationsWorkspace();
  const pathname = usePathname();
  const tabs = [
    { segment: 'all', label: 'All registrations', count: null },
    { segment: 'verifications', label: 'Student verifications', count: pendingVerifications },
  ] as const;
  return (
    <nav
      aria-label="Registration views"
      className="mb-5 flex gap-5 border-b border-slate-200 text-sm"
    >
      {tabs.map(({ segment, label, count }) => {
        const current = pathname.endsWith(`/registrations/${segment}`);
        return (
          <Link
            key={segment}
            href={`/dashboard/conferences/${conferenceId}/registrations/${segment}`}
            aria-current={current ? 'page' : undefined}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${current ? 'border-slate-900 font-semibold text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            {label}
            {count ? (
              <span
                className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-amber-900"
                aria-label={`${count} awaiting review`}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
