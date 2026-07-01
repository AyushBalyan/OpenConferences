'use client';

import Link from 'next/link';
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
import { KpiCard, KpiGrid } from '@/components/dashboard/kpi-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMyAssignments } from '@/lib/api-client';
import { roundStatusLabel, type MyAssignmentItemDto } from '@/lib/review-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
    const data = await fetchMyAssignments(conferenceId);
    setAssignments(data);
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  const completed = useMemo(
    () => assignments.filter((item) => Boolean(item.review?.submittedAt)).length,
    [assignments],
  );

  return (
    <div className="space-y-8">
      <PageHeader title="My review assignments" description="Papers assigned to you for review." />

      <KpiGrid>
        <KpiCard label="Assigned" value={loading ? '—' : assignments.length} loading={loading} />
        <KpiCard
          label="Completed"
          value={loading ? '—' : `${completed}/${assignments.length || 0}`}
          loading={loading}
        />
        <KpiCard
          label="In progress"
          value={loading ? '—' : assignments.length - completed}
          tone={assignments.length - completed > 0 ? 'warning' : 'default'}
          loading={loading}
        />
      </KpiGrid>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loading ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-12 w-full" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No assignments yet"
          description="Check back after the chair assigns papers to you."
        />
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {completed} of {assignments.length} reviews submitted
            </DataTableFooter>
          }
        >
          <DataTableHeader>
            <tr>
              <DataTableHead>Paper</DataTableHead>
              <DataTableHead>Round</DataTableHead>
              <DataTableHead>Due date</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead className="text-right">Action</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {assignments.map((assignment) => {
              const submitted = Boolean(assignment.review?.submittedAt);
              const hasDraft = Boolean(assignment.review && !submitted);
              const statusLabel = submitted ? 'Submitted' : hasDraft ? 'Draft' : 'Not started';
              const statusTone = submitted ? 'success' : hasDraft ? 'pending' : 'info';
              const due = assignment.dueAt
                ? new Date(assignment.dueAt).toLocaleDateString()
                : 'TBD';

              return (
                <DataTableRow key={assignment.id}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{assignment.paperTitle}</p>
                  </DataTableCell>
                  <DataTableCell>
                    Round {assignment.roundNumber} · {roundStatusLabel(assignment.roundStatus)}
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs">{due}</DataTableCell>
                  <DataTableCell>
                    <WorkflowBadge label={statusLabel} tone={statusTone} />
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <Button asChild size="sm" variant={submitted ? 'ghost' : 'default'}>
                      <Link
                        href={`/dashboard/conferences/${conferenceId}/reviews/assignments/${assignment.id}`}
                      >
                        {submitted ? 'View' : hasDraft ? 'Continue' : 'Start review'}
                      </Link>
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
