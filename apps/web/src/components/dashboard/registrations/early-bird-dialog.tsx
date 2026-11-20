'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const DAY_MS = 86_400_000;

/** A date as `<input type="datetime-local">` expects it, in the viewer's own time zone. */
function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** End of the day one week from now: a sensible default the organiser can change. */
function defaultCutoff() {
  const date = new Date(Date.now() + 7 * DAY_MS);
  date.setHours(23, 59, 0, 0);
  return toLocalInputValue(date);
}

function timeZoneName() {
  return (
    new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? 'your local time'
  );
}

/**
 * Asks until when the selected papers may still pay the early-bird rate.
 * `onSubmit(null)` removes an extension given earlier.
 */
export function EarlyBirdDialog({
  count,
  canRemove,
  busy,
  onSubmit,
  onCancel,
}: {
  count: number;
  /** At least one selected paper already has its own early-bird date. */
  canRemove: boolean;
  busy: boolean;
  onSubmit: (earlyBirdEndsAt: string | null) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(defaultCutoff);
  const [error, setError] = useState<string | null>(null);

  // The native modal dialog traps focus and returns it to the trigger on close.
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const papers = `${count} paper${count === 1 ? '' : 's'}`;

  function submit() {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
      setError('Enter a date and time.');
      return;
    }
    if (date.getTime() <= Date.now()) {
      setError('Choose a date and time in the future.');
      return;
    }
    setError(null);
    onSubmit(date.toISOString());
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="early-bird-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialog.current && !busy) onCancel();
      }}
      className="m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/40"
    >
      <form
        className="p-6"
        // Our own message is shown instead of the browser tooltip.
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h2 id="early-bird-dialog-title" className="text-lg font-semibold">
          Extend early-bird rate for {papers}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {count === 1 ? 'This paper' : 'These papers'} can pay the early-bird fee until the date
          you choose, even though the conference early-bird period is over. The payment deadline
          does not change.
        </p>
        <label htmlFor="early-bird-until" className="mt-5 block text-sm font-medium text-slate-900">
          Early-bird rate available until
        </label>
        <input
          id="early-bird-until"
          type="datetime-local"
          required
          autoFocus
          value={value}
          min={toLocalInputValue(new Date())}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          aria-describedby="early-bird-until-hint"
          aria-invalid={error ? true : undefined}
          className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p id="early-bird-until-hint" className="mt-1.5 text-xs text-slate-500">
          In your local time ({timeZoneName()}).
        </p>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {canRemove ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSubmit(null)}
              className="mr-auto rounded-lg px-1 py-2 text-sm font-medium text-rose-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Remove extension
            </button>
          ) : null}
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className="bg-slate-900 shadow-none hover:bg-slate-800"
          >
            {busy ? 'Saving…' : 'Extend early bird'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
