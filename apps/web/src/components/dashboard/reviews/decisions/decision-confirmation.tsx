'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

export function DecisionConfirmation({
  title,
  children,
  action,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  action: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="decision-confirmation-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-900 backdrop:bg-black/40"
    >
      <h2 id="decision-confirmation-title" className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-4 space-y-3 break-words text-sm leading-relaxed text-slate-600">
        {children}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button autoFocus variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="bg-slate-900 shadow-none hover:bg-slate-800"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Working…' : action}
        </Button>
      </div>
    </dialog>
  );
}
