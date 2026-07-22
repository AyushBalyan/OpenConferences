'use client';

import { Button } from '@/components/ui/button';
import { notifyDecisions } from '@/lib/api-client';
import { ReviewRoundSelector } from '@/components/dashboard/reviews/review-round-selector';
import { useDecisionsWorkspace } from './decisions-workspace';

export function DecisionsRoundBar() {
  const {
    roundId,
    rounds,
    decisions,
    busy,
    setBusy,
    setError,
    setMessage,
    refresh,
    onRoundChange,
    conferenceId,
  } = useDecisionsWorkspace();

  async function handleNotify() {
    if (!roundId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await notifyDecisions(conferenceId, roundId);
      setMessage(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notification failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ReviewRoundSelector
      id="decision-round"
      rounds={rounds}
      roundId={roundId}
      onRoundChange={(value) => void onRoundChange(value)}
      actions={
        <Button
          variant="outline"
          onClick={() => void handleNotify()}
          disabled={busy || !roundId || decisions.length === 0}
        >
          Notify authors
        </Button>
      }
    />
  );
}

export function DecisionsAlerts() {
  const { error, message } = useDecisionsWorkspace();
  return (
    <>
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-emerald-700">{message}</p> : null}
    </>
  );
}
