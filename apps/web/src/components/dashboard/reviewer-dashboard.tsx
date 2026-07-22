'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { EmptyState } from '@/components/dashboard/empty-state';
import { KpiCard, KpiGrid } from '@/components/dashboard/kpi-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { fetchMyAssignments } from '@/lib/api-client';
import type { MyAssignmentItemDto } from '@/lib/review-types';
import { roundStatusLabel } from '@/lib/review-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ReviewerDashboardProps = {
  conferenceId: string;
  conferenceName: string;
};

export function ReviewerDashboard({ conferenceId, conferenceName }: ReviewerDashboardProps) {
  const [assignments, setAssignments] = useState<MyAssignmentItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await fetchMyAssignments(conferenceId);
    setAssignments(result.data);
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, [load]);

  const completed = useMemo(
    () => assignments.filter((item) => Boolean(item.review?.submittedAt)).length,
    [assignments],
  );

  const nearestDue = useMemo(() => {
    const dates = assignments
      .map((item) => (item.dueAt ? new Date(item.dueAt).getTime() : null))
      .filter((value): value is number => value !== null);
    if (dates.length === 0) return null;
    return Math.min(...dates);
  }, [assignments]);

  const daysUntilDeadline = nearestDue
    ? Math.max(0, Math.ceil((nearestDue - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const pending = assignments.filter((item) => !item.review?.submittedAt);

  return (
    <>
      <PageHeader
        title="Reviewer workspace"
        description={`Distraction-free review queue for ${conferenceName}.`}
      />

      <KpiGrid className="mb-8">
        <KpiCard
          label="Assigned papers"
          value={loading ? '—' : assignments.length}
          loading={loading}
        />
        <KpiCard
          label="Completed reviews"
          value={loading ? '—' : `${completed}/${assignments.length || 0}`}
          loading={loading}
          footer={
            assignments.length > 0 ? (
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{
                    width: `${assignments.length ? (completed / assignments.length) * 100 : 0}%`,
                  }}
                />
              </div>
            ) : null
          }
        />
        <KpiCard
          label="Days until deadline"
          value={daysUntilDeadline ?? '—'}
          tone={daysUntilDeadline !== null && daysUntilDeadline <= 3 ? 'warning' : 'default'}
          hint={nearestDue ? new Date(nearestDue).toLocaleDateString() : 'No due date set'}
          loading={loading}
        />
      </KpiGrid>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900">Next up</h2>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/conferences/${conferenceId}/reviews/my-assignments`}>
                View all
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/conferences/${conferenceId}/reviews/bidding`}>Bidding</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[1, 2, 3].map((key) => (
                  <div key={key} className="h-12 animate-pulse rounded-md bg-slate-100" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : pending.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={assignments.length === 0 ? 'No assignments yet' : 'All reviews submitted'}
            description={
              assignments.length === 0
                ? 'Check back after the chair assigns papers to you.'
                : 'Great work — you have completed all assigned reviews.'
            }
            action={
              assignments.length === 0 ? (
                <Button asChild variant="outline">
                  <Link href={`/dashboard/conferences/${conferenceId}/reviews/bidding`}>
                    Go to bidding
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable>
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
              {pending.slice(0, 3).map((assignment) => {
                const submitted = Boolean(assignment.review?.submittedAt);
                const hasDraft = Boolean(assignment.review && !submitted);
                const statusLabel = submitted ? 'Submitted' : hasDraft ? 'Draft' : 'Not started';
                const statusTone = submitted ? 'success' : hasDraft ? 'pending' : 'info';

                return (
                  <DataTableRow key={assignment.id}>
                    <DataTableCell>
                      <p className="font-medium text-slate-900">{assignment.paperTitle}</p>
                    </DataTableCell>
                    <DataTableCell>
                      Round {assignment.roundNumber} · {roundStatusLabel(assignment.roundStatus)}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs">
                      {assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : 'TBD'}
                    </DataTableCell>
                    <DataTableCell>
                      <WorkflowBadge label={statusLabel} tone={statusTone} />
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <Button asChild size="sm">
                        <Link
                          href={`/dashboard/conferences/${conferenceId}/reviews/assignments/${assignment.id}`}
                        >
                          {hasDraft ? 'Continue review' : 'Start review'}
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
    </>
  );
}
