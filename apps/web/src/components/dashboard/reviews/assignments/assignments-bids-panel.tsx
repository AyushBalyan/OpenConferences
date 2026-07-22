'use client';

import Link from 'next/link';
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
import { bidValueLabel } from '@/lib/review-types';
import { useAssignmentsWorkspace } from './assignments-workspace';

export function AssignmentsBidsPanel() {
  const {
    bidsByPaper,
    papersWithoutBids,
    assignmentKeys,
    roundId,
    busy,
    prefillAssignment,
    loading,
    conferenceId,
  } = useAssignmentsWorkspace();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((key) => (
          <Skeleton key={key} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const bidRows = bidsByPaper.flatMap(({ paperId, title, bids }) =>
    bids.map((bid) => ({ ...bid, paperTitle: title, paperId })),
  );

  if (bidRows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No reviewer bids yet. Reviewers can bid from the Bidding tab once bidding is open.
        </CardContent>
      </Card>
    );
  }

  const manualBase = `/dashboard/conferences/${conferenceId}/reviews/assignments/manual`;

  return (
    <div className="space-y-3">
      <DataTable
        footer={
          <DataTableFooter>
            {bidRows.length} bid{bidRows.length === 1 ? '' : 's'}
            {papersWithoutBids.length > 0
              ? ` · ${papersWithoutBids.length} paper${papersWithoutBids.length === 1 ? '' : 's'} without bids`
              : ''}
          </DataTableFooter>
        }
      >
        <DataTableHeader>
          <tr>
            <DataTableHead>Paper</DataTableHead>
            <DataTableHead>Reviewer</DataTableHead>
            <DataTableHead>Email</DataTableHead>
            <DataTableHead>Bid</DataTableHead>
            <DataTableHead>Status</DataTableHead>
            <DataTableHead className="text-right">Actions</DataTableHead>
          </tr>
        </DataTableHeader>
        <DataTableBody>
          {bidRows.map((bid) => {
            const assigned = assignmentKeys.has(`${bid.paperId}:${bid.reviewerUserId}`);
            return (
              <DataTableRow key={`${bid.paperId}:${bid.reviewerUserId}`}>
                <DataTableCell>
                  <p className="font-medium text-slate-900">{bid.paperTitle}</p>
                </DataTableCell>
                <DataTableCell>{bid.reviewerName}</DataTableCell>
                <DataTableCell className="text-slate-500">{bid.reviewerEmail}</DataTableCell>
                <DataTableCell>
                  <WorkflowBadge label={bidValueLabel(bid.value)} tone="neutral" />
                </DataTableCell>
                <DataTableCell>
                  {assigned ? (
                    <WorkflowBadge label="Assigned" tone="success" />
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </DataTableCell>
                <DataTableCell className="text-right">
                  {assigned ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !roundId || bid.value === 'CONFLICT'}
                      asChild
                    >
                      <Link
                        href={`${manualBase}?paper=${bid.paperId}&reviewer=${bid.reviewerUserId}`}
                        onClick={() => prefillAssignment(bid.paperId, bid.reviewerUserId)}
                      >
                        Assign
                      </Link>
                    </Button>
                  )}
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
    </div>
  );
}
