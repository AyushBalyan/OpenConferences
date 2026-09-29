'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { withdrawConfirmationReady } from '@/lib/submission-types';
import { useState } from 'react';

export function WithdrawPaperDialog({
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const ready = withdrawConfirmationReady(reason, confirmText);

  return (
    <form
      className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || busy) return;
        onConfirm(reason.trim());
      }}
    >
      <div>
        <h2 className="text-sm font-semibold text-rose-950">Withdraw this paper?</h2>
        <p className="mt-1 text-sm text-rose-900">
          Review stops, unfinished assignments are closed, and an unpaid registration is cancelled.
          A payment that was already captured is left for the organizers to refund. This cannot be
          undone.
        </p>
      </div>
      <div>
        <Label htmlFor="withdraw-reason">Reason</Label>
        <textarea
          id="withdraw-reason"
          className="mt-1 flex min-h-20 w-full rounded-md border border-rose-200 bg-white px-3 py-2 text-sm"
          value={reason}
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="withdraw-confirm">Type WITHDRAW to confirm</Label>
        <input
          id="withdraw-confirm"
          className="mt-1 flex h-10 w-full rounded-md border border-rose-200 bg-white px-3 text-sm font-mono"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {error ? <p className="text-sm text-rose-800">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready || busy}>
          {busy ? 'Withdrawing…' : 'Withdraw paper'}
        </Button>
      </div>
    </form>
  );
}
