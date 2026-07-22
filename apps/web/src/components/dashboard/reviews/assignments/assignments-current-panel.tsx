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

export function AssignmentsCurrentPanel() {
  const { assignments, busy, setBusy, setError, refresh, conferenceId, loading } =
    useAssignmentsWorkspace();

  async function handleUnassign(assignmentId: string) {
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
          <DataTableHead className="text-right">Actions</DataTableHead>
        </tr>
      </DataTableHeader>
      <DataTableBody>
        {assignments.map((assignment) => (
          <DataTableRow key={assignment.id}>
            <DataTableCell>
              <p className="font-medium text-slate-900">
                {assignment.paperTitle ?? assignment.paperId}
              </p>
            </DataTableCell>
            <DataTableCell>{assignment.reviewerName ?? assignment.reviewerUserId}</DataTableCell>
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
            <DataTableCell className="text-right">
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
  );
}
