'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchReviewRounds, releaseReviews, updateReviewRound } from '@/lib/api-client';
import { roundStatusLabel, type ReviewRoundDto } from '@/lib/review-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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

  return (
    <div className="space-y-6">
      <PageHeader title="Review rounds" description="Open, close, and manage review rounds." />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {rounds.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No review rounds yet. Open Round 1 to begin assignments.
            </CardContent>
          </Card>
        ) : (
          rounds.map((round) => (
            <Card key={round.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Round {round.roundNumber}</CardTitle>
                  <CardDescription>
                    Status: {roundStatusLabel(round.status)}
                    {round.reviewDueAt
                      ? ` · Review due ${new Date(round.reviewDueAt).toLocaleDateString()}`
                      : ''}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
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
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
