'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { bidValueLabel, type BidValue } from '@/lib/review-types';
import { deleteAssignment } from '@/lib/api-client';
import { useAssignmentsWorkspace } from './assignments-workspace';
import Link from 'next/link';
import { useState } from 'react';

export function AssignmentsCurrentPanel() {
  const [filter, setFilter] = useState('ALL');
  const { assignments, busy, setBusy, setError, refresh, conferenceId, loading } =
    useAssignmentsWorkspace();

  async function handleUnassign(assignmentId: string) {
    if (!window.confirm('Remove this reviewer assignment?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAssignment(conferenceId, assignmentId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No assignments yet. Use Reviewer bids or Manual assignment to assign reviewers.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 text-sm">
        Review progress
        <select
          className="rounded border bg-background p-2"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="ALL">All loaded assignments</option>
          <option value="NOT_STARTED">Not started</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </label>
      <DataTable
        footer={
          <DataTableFooter>
            {assignments.length} assignment{assignments.length === 1 ? '' : 's'}
          </DataTableFooter>
        }
      >
        <DataTableHeader>
          <tr>
            <DataTableHead>Paper</DataTableHead>
            <DataTableHead>Reviewer</DataTableHead>
            <DataTableHead>Email</DataTableHead>
            <DataTableHead>Bid</DataTableHead>
            <DataTableHead>Progress</DataTableHead>
            <DataTableHead>Deadline</DataTableHead>
            <DataTableHead className="text-right">Actions</DataTableHead>
          </tr>
        </DataTableHeader>
        <DataTableBody>
          {assignments
            .filter(
              (assignment) =>
                filter === 'ALL' ||
                (filter === 'OVERDUE'
                  ? assignment.status !== 'COMPLETED' &&
                    assignment.reviewProgress !== 'SUBMITTED' &&
                    Boolean(assignment.dueAt && new Date(assignment.dueAt).getTime() < Date.now())
                  : assignment.reviewProgress === filter),
            )
            .map((assignment) => (
              <DataTableRow key={assignment.id}>
                <DataTableCell>
                  <p className="font-medium text-slate-900">
                    {assignment.paperTitle ?? assignment.paperId}
                  </p>
                </DataTableCell>
                <DataTableCell>
                  {assignment.reviewerName ?? assignment.reviewerUserId}
                </DataTableCell>
                <DataTableCell className="text-slate-500">
                  {assignment.reviewerEmail ?? '—'}
                </DataTableCell>
                <DataTableCell>
                  {assignment.bidValue ? (
                    <WorkflowBadge
                      label={bidValueLabel(assignment.bidValue as BidValue)}
                      tone="neutral"
                    />
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </DataTableCell>
                <DataTableCell>
                  {assignment.reviewProgress === 'SUBMITTED'
                    ? 'Submitted'
                    : assignment.reviewProgress === 'DRAFT'
                      ? 'Draft'
                      : assignment.reviewProgress === 'NOT_STARTED'
                        ? 'Not started'
                        : 'Unavailable'}
                </DataTableCell>
                <DataTableCell>
                  {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : 'Not set'}
                </DataTableCell>
                <DataTableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/dashboard/conferences/${conferenceId}/reviews/decisions/pending?paper=${assignment.paperId}`}
                    >
                      Read reviews
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleUnassign(assignment.id)}
                  >
                    Remove
                  </Button>
                </DataTableCell>
              </DataTableRow>
            ))}
        </DataTableBody>
      </DataTable>
    </div>
  );
}
