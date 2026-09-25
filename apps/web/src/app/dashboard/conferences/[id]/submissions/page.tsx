'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DownloadPaperButton } from '@/components/dashboard/download-paper-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTablePagination,
  DataTableRow,
  DataTableSkeleton,
} from '@/components/dashboard/data-table';
import { SectionPageLayout } from '@/components/dashboard/section-page-layout';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { fetchPapers } from '@/lib/api-client';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import { canCoordinateReview, canDownloadConferencePapers } from '@/lib/roles';
import type { PaperDto } from '@/lib/submission-types';
import { useSavedFilter } from '@/lib/use-saved-filter';
import { useCursorList } from '@/hooks/dashboard/use-cursor-list';
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
  const canDownloadPapers = canDownloadConferencePapers(roles);
  const [filter, setFilter] = useSavedFilter(conferenceId, 'submissions', DEFAULT_FILTER);
  const [debouncedQ, setDebouncedQ] = useState(filter.q);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(filter.q), 300);
    return () => window.clearTimeout(timer);
  }, [filter.q]);

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const result = await fetchPapers(conferenceId, {
        ...(showAllPapers ? {} : { mine: true }),
        ...(filter.status ? { status: filter.status } : {}),
        ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}),
        ...(cursor ? { cursor } : {}),
        limit: 20,
      });
      return { data: result.data, nextCursor: result.nextCursor };
    },
    [conferenceId, debouncedQ, filter.status, showAllPapers],
  );

  const { items, nextCursor, loading, loadingMore, error, loadMore, refresh } =
    useCursorList<PaperDto>({ fetchPage });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SectionPageLayout
      title={showAllPapers ? 'All submissions' : 'My submissions'}
      description={
        showAllPapers
          ? 'Browse and search all conference submissions.'
          : 'Draft, submit, and track your papers for this conference.'
      }
      error={error}
      actions={
        !showAllPapers ? (
          <Button asChild>
            <Link href={`/dashboard/conferences/${conferenceId}/submissions/new`}>
              New submission
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Label htmlFor="submissions-search" className="sr-only">
            Search
          </Label>
          <Input
            id="submissions-search"
            className="h-9 border-0 pl-9 shadow-none focus-visible:ring-0"
            placeholder="Search by title or abstract"
            value={filter.q}
            onChange={(event) => setFilter({ q: event.target.value })}
          />
        </div>
        <div className="flex items-center gap-2 sm:border-l sm:border-slate-100 sm:pl-3">
          <Label htmlFor="submissions-status" className="text-xs font-medium text-slate-500">
            Status
          </Label>
          <select
            id="submissions-status"
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700"
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
      </div>

      {loading ? (
        <DataTableSkeleton rows={5} />
      ) : items.length === 0 ? (
        <div className="space-y-4">
          <DataTableEmpty
            title={showAllPapers ? 'No matching submissions' : 'No submissions yet'}
            description={
              showAllPapers
                ? 'Try adjusting your filters or check back after the call for papers opens.'
                : 'Start a new submission when the call for papers is open.'
            }
          />
          {!showAllPapers ? (
            <Button asChild>
              <Link href={`/dashboard/conferences/${conferenceId}/submissions/new`}>
                Submit your first paper
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <DataTable
            footer={
              <DataTableFooter>
                Showing {items.length} submission{items.length === 1 ? '' : 's'}
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
              {items.map((paper) => (
                <DataTableRow key={paper.id}>
                  <DataTableCell>
                    <div>
                      <Link
                        href={`/dashboard/conferences/${conferenceId}/submissions/${paper.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-700"
                      >
                        {paper.title}
                      </Link>
                      <p className="mt-1 line-clamp-1 max-w-xl text-xs text-slate-500">
                        {paper.abstract}
                      </p>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <WorkflowBadge
                      label={paperStatusLabel(paper.status)}
                      tone={paperStatusTone(paper.status)}
                    />
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-sm tabular-nums text-slate-500">
                    {new Date(paper.updatedAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      {canDownloadPapers ? (
                        <DownloadPaperButton
                          conferenceId={conferenceId}
                          paper={paper}
                          size="sm"
                          variant="ghost"
                          label="Download"
                          hideWhenUnavailable
                        />
                      ) : null}
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={`/dashboard/conferences/${conferenceId}/submissions/${paper.id}`}
                        >
                          View
                        </Link>
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          <DataTablePagination
            nextCursor={nextCursor}
            onLoadMore={loadMore}
            loading={loadingMore}
          />
        </>
      )}
    </SectionPageLayout>
  );
}
