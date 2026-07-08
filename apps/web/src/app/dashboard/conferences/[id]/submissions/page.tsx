'use client';

import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CursorLoadMore } from '@/components/dashboard/cursor-load-more';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { fetchPapers } from '@/lib/api-client';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import { canCoordinateReview } from '@/lib/roles';
import type { PaperDto } from '@/lib/submission-types';
import { useSavedFilter } from '@/lib/use-saved-filter';
import { useCallback, useEffect, useState } from 'react';

type SubmissionsFilter = {
  status: PaperDto['status'] | '';
  q: string;
};

const DEFAULT_FILTER: SubmissionsFilter = { status: '', q: '' };

const STATUS_OPTIONS: Array<{ value: PaperDto['status'] | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'DECISION_MADE', label: 'Decision made' },
  { value: 'CAMERA_READY', label: 'Camera-ready' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'WITHDRAWN_NONPAYMENT', label: 'Withdrawn (non-payment)' },
];

export default function SubmissionsListPage() {
  const { conferenceId, conference } = useConferenceWorkspace();
  const roles = conference?.myRoles ?? [];
  const showAllPapers = canCoordinateReview(roles);
  const [filter, setFilter] = useSavedFilter(conferenceId, 'submissions', DEFAULT_FILTER);
  const [debouncedQ, setDebouncedQ] = useState(filter.q);
  const [papers, setPapers] = useState<PaperDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(filter.q), 300);
    return () => window.clearTimeout(timer);
  }, [filter.q]);

  const load = useCallback(
    async (cursor?: string, append = false) => {
      const result = await fetchPapers(conferenceId, {
        ...(showAllPapers ? {} : { mine: true }),
        ...(filter.status ? { status: filter.status } : {}),
        ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}),
        ...(cursor ? { cursor } : {}),
        limit: 20,
      });
      setPapers((prev) => (append ? [...prev, ...result.data] : result.data));
      setNextCursor(result.nextCursor);
      setError(null);
    },
    [conferenceId, debouncedQ, filter.status, showAllPapers],
  );

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      await load(nextCursor, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <PageHeader
        title={showAllPapers ? 'All submissions' : 'My submissions'}
        description={
          showAllPapers
            ? 'Browse and search all conference submissions.'
            : 'Draft, submit, and track your papers for this conference.'
        }
        actions={
          !showAllPapers ? (
            <Button asChild>
              <Link href={`/dashboard/conferences/${conferenceId}/submissions/new`}>
                New submission
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <div>
          <Label htmlFor="submissions-status">Status</Label>
          <select
            id="submissions-status"
            className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={filter.status}
            onChange={(event) =>
              setFilter({ status: event.target.value as SubmissionsFilter['status'] })
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="submissions-search">Search</Label>
          <Input
            id="submissions-search"
            className="mt-1"
            placeholder="Title or abstract"
            value={filter.q}
            onChange={(event) => setFilter({ q: event.target.value })}
          />
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

      {loading ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-12 w-full" />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <EmptyState
          title={showAllPapers ? 'No matching submissions' : 'No submissions yet'}
          description={
            showAllPapers
              ? 'Try adjusting your filters or check back after the call for papers opens.'
              : 'Start a new submission when the call for papers is open.'
          }
          action={
            !showAllPapers ? (
              <Button asChild>
                <Link href={`/dashboard/conferences/${conferenceId}/submissions/new`}>
                  Submit your first paper
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            footer={
              <DataTableFooter>
                Showing {papers.length} submission{papers.length === 1 ? '' : 's'}
              </DataTableFooter>
            }
          >
            <DataTableHeader>
              <tr>
                <DataTableHead>Title</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead>Updated</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {papers.map((paper) => (
                <DataTableRow key={paper.id}>
                  <DataTableCell>
                    <div>
                      <Link
                        href={`/dashboard/conferences/${conferenceId}/submissions/${paper.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                      >
                        {paper.title}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{paper.abstract}</p>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <WorkflowBadge
                      label={paperStatusLabel(paper.status)}
                      tone={paperStatusTone(paper.status)}
                    />
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-slate-500">
                    {new Date(paper.updatedAt).toLocaleDateString()}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={`/dashboard/conferences/${conferenceId}/submissions/${paper.id}`}
                        >
                          View
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          <CursorLoadMore
            nextCursor={nextCursor}
            onLoadMore={handleLoadMore}
            loading={loadingMore}
          />
        </>
      )}
    </>
  );
}
