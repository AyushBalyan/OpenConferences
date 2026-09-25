'use client';

import { PageHeader } from '@/components/dashboard/page-header';
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
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { fetchReviewProgress, releaseReviews } from '@/lib/api-client';
import { reviewStageLabel, type ReviewStage } from '@/lib/review-types';
import type { PaperReviewProgressDto } from '@openconferences/schemas';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

function stageTone(stage: ReviewStage) {
  if (stage === 'DECIDED') return 'success' as const;
  if (stage === 'FEEDBACK_RELEASED' || stage === 'REVISION_REQUESTED') return 'pending' as const;
  if (stage === 'IN_REVIEW') return 'info' as const;
  return 'neutral' as const;
}

export default function ReviewProgressPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [rows, setRows] = useState<PaperReviewProgressDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const progress = await fetchReviewProgress(conferenceId);
    setRows(progress.data);
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  async function handleRelease(row: PaperReviewProgressDto) {
    if (!row.cycleId || row.cycleVersion == null) return;
    setBusyId(row.paperId);
    setError(null);
    setMessage(null);
    try {
      const result = await releaseReviews(conferenceId, row.paperId, row.cycleId, {
        version: row.cycleVersion,
      });
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Release failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Review progress"
        description="Each paper moves on its own. Releasing or deciding one paper leaves the others in review."
      />
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-emerald-700">{message}</p> : null}
      <DataTable
        footer={
          <DataTableFooter>
            {rows.length === 0 ? 'No submitted papers yet.' : `${rows.length} papers`}
          </DataTableFooter>
        }
      >
        <DataTableHeader>
          <DataTableRow>
            <DataTableHead>Paper</DataTableHead>
            <DataTableHead>Stage</DataTableHead>
            <DataTableHead>Reviews</DataTableHead>
            <DataTableHead>Warning</DataTableHead>
            <DataTableHead>Action</DataTableHead>
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody>
          {rows.map((row) => (
            <DataTableRow key={row.paperId}>
              <DataTableCell>
                <div className="font-medium">{row.paperTitle}</div>
                {row.roundNumber ? (
                  <div className="text-xs text-slate-500">Cycle {row.roundNumber}</div>
                ) : null}
              </DataTableCell>
              <DataTableCell>
                <WorkflowBadge
                  label={reviewStageLabel(row.reviewStage)}
                  tone={stageTone(row.reviewStage)}
                />
              </DataTableCell>
              <DataTableCell>
                {row.submittedReviewCount}/{row.assignmentCount || '—'}
              </DataTableCell>
              <DataTableCell className="text-amber-700">{row.warning ?? ''}</DataTableCell>
              <DataTableCell>
                {row.cycleId &&
                (row.reviewStage === 'IN_REVIEW' || row.reviewStage === 'FEEDBACK_RELEASED') ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === row.paperId || row.submittedReviewCount === 0}
                    onClick={() => void handleRelease(row)}
                  >
                    Release
                  </Button>
                ) : null}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </div>
  );
}
