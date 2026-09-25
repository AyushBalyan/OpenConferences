'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMyAssignments } from '@/lib/api-client';
import { reviewStageLabel, type MyAssignmentItemDto } from '@/lib/review-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

function dueInfo(dueAt: string | null | undefined, submitted: boolean) {
  if (!dueAt) return { label: 'No due date', tone: 'text-slate-400' };
  const due = new Date(dueAt);
  const date = due.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (submitted) return { label: date, tone: 'text-slate-500' };
  const days = Math.ceil((due.getTime() - Date.now()) / DAY_MS);
  if (days < 0)
    return { label: `${date} · ${Math.abs(days)}d overdue`, tone: 'text-rose-700 font-medium' };
  if (days === 0) return { label: `${date} · due today`, tone: 'text-amber-700 font-medium' };
  if (days <= 3) return { label: `${date} · ${days}d left`, tone: 'text-amber-700' };
  return { label: `${date} · ${days}d left`, tone: 'text-slate-600' };
}

export default function MyAssignmentsPage() {
  return <MyAssignments />;
}

function MyAssignments() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [assignments, setAssignments] = useState<MyAssignmentItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await fetchMyAssignments(conferenceId);
    setAssignments(result.data);
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  const sorted = useMemo(
    () =>
      [...assignments].sort((a, b) => {
        const doneA = Boolean(a.review?.submittedAt);
        const doneB = Boolean(b.review?.submittedAt);
        if (doneA !== doneB) return doneA ? 1 : -1;
        const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
        const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
        return dueA - dueB;
      }),
    [assignments],
  );

  const completed = assignments.filter((item) => Boolean(item.review?.submittedAt)).length;
  const drafts = assignments.filter((item) => item.review && !item.review.submittedAt).length;
  const total = assignments.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const next = sorted.find((item) => !item.review?.submittedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My review assignments"
        description="Papers assigned to you, ordered by what needs attention first."
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon="inbox"
          title="No assignments yet"
          description="You’ll see papers here once the program chair assigns them to you."
        />
      ) : (
        <>
          <section className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div className="min-w-[14rem] flex-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-900">Progress</span>
                <span className="tabular-nums text-slate-500">
                  {completed} of {total} submitted
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <dl className="flex gap-8 text-sm">
              {[
                ['Not started', total - completed - drafts],
                ['Drafts', drafts],
                ['Submitted', completed],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
            {next ? (
              <Link
                href={`/dashboard/conferences/${conferenceId}/reviews/assignments/${next.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                {next.review ? 'Continue next review' : 'Start next review'}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span className="text-sm font-medium text-emerald-700">All reviews submitted</span>
            )}
          </section>

          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {sorted.map((assignment) => {
              const submitted = Boolean(assignment.review?.submittedAt);
              const hasDraft = Boolean(assignment.review && !submitted);
              const due = dueInfo(assignment.dueAt, submitted);
              return (
                <li key={assignment.id}>
                  <Link
                    href={`/dashboard/conferences/${conferenceId}/reviews/assignments/${assignment.id}`}
                    className="group flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 group-hover:text-indigo-700">
                        {assignment.paperTitle}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Cycle {assignment.roundNumber} · {reviewStageLabel(assignment.reviewStage)}
                      </p>
                    </div>
                    <span className={`w-48 text-sm tabular-nums ${due.tone}`}>{due.label}</span>
                    <span className="w-28">
                      <WorkflowBadge
                        label={submitted ? 'Submitted' : hasDraft ? 'Draft' : 'Not started'}
                        tone={submitted ? 'success' : hasDraft ? 'pending' : 'neutral'}
                      />
                    </span>
                    <span className="flex w-28 items-center justify-end gap-1 text-sm font-medium text-slate-600 group-hover:text-indigo-700">
                      {submitted ? 'View' : hasDraft ? 'Continue' : 'Start'}
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
