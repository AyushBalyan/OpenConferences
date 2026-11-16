'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` styles the confirm button for destructive actions. */
  tone?: 'default' | 'danger';
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Ask the user to confirm an action. Resolves `true` only when they confirm. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider');
  return confirm;
}

type Pending = { options: ConfirmOptions; resolve: (confirmed: boolean) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    pendingRef.current?.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // A second request while one is open cancels the first.
        pendingRef.current?.resolve(false);
        const next = { options, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  useEffect(
    () => () => {
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    },
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending ? <ConfirmDialog options={pending.options} onSettle={settle} /> : null}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions;
  onSettle: (confirmed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  // The native modal dialog traps focus, makes the page behind it inert and
  // returns focus to the trigger when it closes.
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirm-dialog-title"
      aria-describedby={options.description ? 'confirm-dialog-description' : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onSettle(false);
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onSettle(false);
      }}
      className="m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/40"
    >
      <div className="p-6">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold">
          {options.title}
        </h2>
        {options.description ? (
          <div
            id="confirm-dialog-description"
            className="mt-2 break-words text-sm leading-relaxed text-slate-600"
          >
            {options.description}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button autoFocus type="button" variant="outline" onClick={() => onSettle(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            type="button"
            className={cn(
              'shadow-none',
              options.tone === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-slate-900 hover:bg-slate-800',
            )}
            onClick={() => onSettle(true)}
          >
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
