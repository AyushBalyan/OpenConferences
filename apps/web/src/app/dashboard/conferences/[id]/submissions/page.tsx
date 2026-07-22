'use client';

import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DataTableToolbar,
} from '@/components/dashboard/data-table';
import { SectionPageLayout } from '@/components/dashboard/section-page-layout';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { fetchPapers } from '@/lib/api-client';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import { canCoordinateReview } from '@/lib/roles';
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
      <DataTableToolbar className="lg:max-w-2xl">
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
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
      </DataTableToolbar>

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
