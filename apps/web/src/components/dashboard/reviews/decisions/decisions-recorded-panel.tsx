'use client';

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
import { decisionOutcomeLabel } from '@/lib/review-types';
import { useDecisionsWorkspace } from './decisions-workspace';

export function DecisionsRecordedPanel() {
  const { decisions, loading } = useDecisionsWorkspace();

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (decisions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No decisions recorded yet for this round.
        </CardContent>
      </Card>
    );
  }

  return (
    <DataTable
      footer={
        <DataTableFooter>
          {decisions.length} decision{decisions.length === 1 ? '' : 's'} recorded
        </DataTableFooter>
      }
    >
      <DataTableHeader>
        <tr>
          <DataTableHead>Paper</DataTableHead>
          <DataTableHead>Outcome</DataTableHead>
          <DataTableHead>Notification</DataTableHead>
          <DataTableHead>Rationale</DataTableHead>
        </tr>
      </DataTableHeader>
      <DataTableBody>
        {decisions.map((decision) => (
          <DataTableRow key={decision.id}>
            <DataTableCell>
              <p className="font-medium text-slate-900">
                {decision.paperTitle ?? decision.paperId}
              </p>
            </DataTableCell>
            <DataTableCell>
              <WorkflowBadge
                label={decisionOutcomeLabel(decision.outcome)}
                tone={
                  decision.outcome === 'ACCEPT'
                    ? 'success'
                    : decision.outcome === 'REJECT'
                      ? 'danger'
                      : 'pending'
                }
              />
            </DataTableCell>
            <DataTableCell>
              <WorkflowBadge
                label={decision.notifiedAt ? 'Authors notified' : 'Not notified'}
                tone={decision.notifiedAt ? 'success' : 'neutral'}
              />
            </DataTableCell>
            <DataTableCell>
              {decision.rationale ? (
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-slate-500">
                  {decision.rationale}
                </p>
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  );
}
