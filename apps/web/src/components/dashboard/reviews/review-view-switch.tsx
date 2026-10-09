import Link from 'next/link';
export function ReviewViewSwitch({
  conferenceId,
  view,
}: {
  conferenceId: string;
  view: 'papers' | 'reviewers';
}) {
  return (
    <nav
      aria-label="Review views"
      className="flex flex-wrap gap-4 border-b border-slate-200 text-sm"
    >
      {(
        [
          ['papers', 'Paper review ledger', 'rounds'],
          ['reviewers', 'Reviewer overview', 'reviewers'],
        ] as const
      ).map(([key, label, path]) => (
        <Link
          key={key}
          aria-current={view === key ? 'page' : undefined}
          className={`min-h-11 border-b-2 px-1 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
          href={`/dashboard/conferences/${conferenceId}/reviews/${path}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
