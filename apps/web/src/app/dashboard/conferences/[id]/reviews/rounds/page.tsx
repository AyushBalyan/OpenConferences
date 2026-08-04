'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  createReviewRound,
  fetchReviewRounds,
  releaseReviews,
  updateReviewRound,
} from '@/lib/api-client';
import { roundStatusLabel, type ReviewRoundDto } from '@/lib/review-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

function roundTone(status: ReviewRoundDto['status']) {
  if (status === 'CLOSED') return 'neutral' as const;
  if (status === 'REVIEWING' || status === 'REBUTTAL') return 'pending' as const;
  if (status === 'DECIDING') return 'info' as const;
  return 'success' as const;
}

function nextRoundNumber(rounds: ReviewRoundDto[]) {
  if (rounds.length === 0) return 1;
  return Math.max(...rounds.map((round) => round.roundNumber)) + 1;
}

export default function ReviewRoundsPage() {
  return <ReviewRounds />;
}

function ReviewRounds() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [rounds, setRounds] = useState<ReviewRoundDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchReviewRounds(conferenceId);
    setRounds(data);
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  const upcomingRoundNumber = nextRoundNumber(rounds);
  const hasActiveRound = rounds.some((round) => round.status !== 'CLOSED');
  const canOpenRound = !hasActiveRound;

  async function handleOpenRound() {
    if (!canOpenRound) return;

    setBusy(true);
    setError(null);
    try {
      await createReviewRound(conferenceId, { roundNumber: upcomingRoundNumber });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open review round');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvance(round: ReviewRoundDto) {
    const next =
      round.status === 'OPEN'
        ? 'REVIEWING'
        : round.status === 'REBUTTAL'
          ? 'DECIDING'
          : round.status === 'DECIDING'
            ? 'CLOSED'
            : null;
    if (!next) return;

    setBusy(true);
    setError(null);
    try {
      await updateReviewRound(conferenceId, round.id, { status: next, version: round.version });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update round');
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease(round: ReviewRoundDto) {
    setBusy(true);
    setError(null);
    try {
      await releaseReviews(conferenceId, round.id, { version: round.version });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release reviews');
    } finally {
      setBusy(false);
    }
  }

  const openRoundLabel = `Open Round ${upcomingRoundNumber}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review rounds"
        description="Open, close, and manage review rounds."
        actions={
          canOpenRound && rounds.length > 0 ? (
            <Button disabled={busy} onClick={() => void handleOpenRound()}>
              {openRoundLabel}
            </Button>
          ) : undefined
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {rounds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-muted-foreground">
              No review rounds yet. Open Round 1 to begin assignments.
            </p>
            <Button disabled={busy} onClick={() => void handleOpenRound()}>
              {openRoundLabel}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {rounds.length} round{rounds.length === 1 ? '' : 's'}
            </DataTableFooter>
          }
        >
          <DataTableHeader>
            <tr>
              <DataTableHead>Round</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>Review due</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {rounds.map((round) => (
              <DataTableRow key={round.id}>
                <DataTableCell>
                  <p className="font-medium text-slate-900">Round {round.roundNumber}</p>
                </DataTableCell>
                <DataTableCell>
                  <WorkflowBadge
                    label={roundStatusLabel(round.status)}
                    tone={roundTone(round.status)}
                  />
                </DataTableCell>
                <DataTableCell className="font-mono text-xs text-slate-500">
                  {round.reviewDueAt ? new Date(round.reviewDueAt).toLocaleDateString() : '—'}
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {round.status === 'REVIEWING' ? (
                      <Button
                        variant="default"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleRelease(round)}
                      >
                        Release reviews
                      </Button>
                    ) : null}
                    {round.status !== 'CLOSED' && round.status !== 'REVIEWING' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleAdvance(round)}
                      >
                        Advance status
                      </Button>
                    ) : null}
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
