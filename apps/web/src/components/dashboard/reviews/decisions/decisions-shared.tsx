'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDecisionsWorkspace } from './decisions-workspace';

export function DecisionsSearch() {
  const { search, setSearch, busy, loading } = useDecisionsWorkspace();
  return (
    <div className="flex min-w-0 items-end gap-2 lg:w-96">
      <label htmlFor="decision-search" className="min-w-0 flex-1 space-y-1 text-sm">
        <span className="font-medium text-slate-700">Find a paper</span>
        <Input
          id="decision-search"
          type="search"
          placeholder="Title or paper code"
          className="text-base placeholder:text-slate-500 sm:text-sm"
          value={search}
          disabled={busy || loading}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {search ? (
        <Button variant="outline" disabled={busy || loading} onClick={() => setSearch('')}>
          Clear search
        </Button>
      ) : null}
    </div>
  );
}

export function DecisionsRoundBar() {
  const { conferenceId, undecidedPapers, decisions } = useDecisionsWorkspace();
  const pathname = usePathname();
  return (
    <nav aria-label="Decision views" className="flex gap-5 border-b border-slate-200 text-sm">
      {(
        [
          ['pending', 'Pending decisions', undecidedPapers.length],
          ['recorded', 'Recorded decisions', decisions.length],
        ] as const
      ).map(([section, label, count]) => (
        <Link
          key={section}
          href={`/dashboard/conferences/${conferenceId}/reviews/decisions/${section}`}
          aria-current={pathname.endsWith(section) ? 'page' : undefined}
          className={`border-b-2 py-3 ${pathname.endsWith(section) ? 'border-slate-900 font-semibold text-slate-900' : 'border-transparent text-slate-600'}`}
        >
          {label} <span className="ml-1 tabular-nums">{count}</span>
        </Link>
      ))}
    </nav>
  );
}

export function DecisionsAlerts() {
  const { error, message } = useDecisionsWorkspace();
  return (
    <>
      {error ? (
        <p role="alert" className="mb-4 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mb-4 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
    </>
  );
}
