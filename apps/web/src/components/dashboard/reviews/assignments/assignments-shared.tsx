'use client';

import { Button } from '@/components/ui/button';
import { copyAssignmentsFromPreviousRound } from '@/lib/api-client';
import { ReviewRoundSelector } from '@/components/dashboard/reviews/review-round-selector';
import { useAssignmentsWorkspace } from './assignments-workspace';

export function AssignmentsRoundBar() {
  const {
    conferenceId,
    rounds,
    roundId,
    selectedRound,
    canCopyFromPrevious,
    busy,
    setBusy,
    setError,
    setMessage,
    refresh,
    onRoundChange,
  } = useAssignmentsWorkspace();

  async function handleCopyFromPreviousRound() {
    if (!roundId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await copyAssignmentsFromPreviousRound(conferenceId, roundId);
      const detail =
        result.failures.length > 0
          ? ` ${result.failures.length} could not be copied (COI or conflicts).`
          : '';
      setMessage(`${result.message}${detail}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy assignments');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ReviewRoundSelector
      id="assignment-round"
      rounds={rounds}
      roundId={roundId}
      onRoundChange={(value) => void onRoundChange(value)}
      actions={
        canCopyFromPrevious && selectedRound ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void handleCopyFromPreviousRound()}
          >
            Copy reviewers from Round {selectedRound.roundNumber - 1}
          </Button>
        ) : undefined
      }
    />
  );
}

export function AssignmentsAlerts() {
  const { error, message } = useAssignmentsWorkspace();

  return (
    <>
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-emerald-700">{message}</p> : null}
    </>
  );
}
