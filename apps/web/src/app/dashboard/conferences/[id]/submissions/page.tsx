'use client';

import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import type { PaperDto } from '@/lib/submission-types';
import { useCallback, useEffect, useState } from 'react';

export default function SubmissionsListPage() {
  const { conferenceId } = useConferenceWorkspace();
  const [papers, setPapers] = useState<PaperDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const list = await fetchPapers(conferenceId, true);
    setPapers(list.data);
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  return (
    <>
      <PageHeader
        title="My submissions"
        description="Draft, submit, and track your papers for this conference."
        actions={
          <Button asChild>
            <Link href={`/dashboard/conferences/${conferenceId}/submissions/new`}>
              New submission
            </Link>
          </Button>
        }
      />

      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

      {loading ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-12 w-full" />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          description="Start a new submission when the call for papers is open."
          action={
            <Button asChild>
              <Link href={`/dashboard/conferences/${conferenceId}/submissions/new`}>
                Submit your first paper
              </Link>
            </Button>
          }
        />
      ) : (
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
                      <Link href={`/dashboard/conferences/${conferenceId}/submissions/${paper.id}`}>
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
      )}
    </>
  );
}
