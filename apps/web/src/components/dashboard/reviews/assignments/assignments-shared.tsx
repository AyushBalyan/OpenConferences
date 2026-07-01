'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { copyAssignmentsFromPreviousRound } from '@/lib/api-client';
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

  if (rounds.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="max-w-xs flex-1">
        <Label htmlFor="assignment-round">Review round</Label>
        <select
          id="assignment-round"
          className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          value={roundId}
          onChange={(e) => void onRoundChange(e.target.value)}
        >
          {rounds.map((round) => (
            <option key={round.id} value={round.id}>
              Round {round.roundNumber} ({round.status})
            </option>
          ))}
        </select>
      </div>
      {canCopyFromPrevious && selectedRound ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void handleCopyFromPreviousRound()}
        >
          Copy reviewers from Round {selectedRound.roundNumber - 1}
        </Button>
      ) : null}
    </div>
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
