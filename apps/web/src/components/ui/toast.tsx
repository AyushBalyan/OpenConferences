'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';

type ToastOptions = {
  title?: string;
  /** Milliseconds before the toast closes itself. Errors stay longer by default. */
  duration?: number;
};

type ToastItem = { id: number; tone: ToastTone; message: string; title?: string };

type ToastApi = {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 4;
const DEFAULT_DURATION: Record<ToastTone, number> = { success: 5000, info: 8000, error: 10000 };

const TONE_ICON = { success: CheckCircle2, error: AlertCircle, info: Info } as const;
const TONE_ICON_CLASS: Record<ToastTone, string> = {
  success: 'text-emerald-400',
  error: 'text-rose-400',
  info: 'text-sky-400',
};

/** Show a short message that confirms an action or reports a failure. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used within ToastProvider');
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (tone: ToastTone, message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => {
        const next = [...current, { id, tone, message, title: options?.title }];
        for (const dropped of next.slice(0, -MAX_VISIBLE)) {
          const timer = timers.current.get(dropped.id);
          if (timer !== undefined) window.clearTimeout(timer);
          timers.current.delete(dropped.id);
        }
        return next.slice(-MAX_VISIBLE);
      });
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), options?.duration ?? DEFAULT_DURATION[tone]),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach((timer) => window.clearTimeout(timer));
      active.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => show('success', message, options),
      error: (message, options) => show('error', message, options),
      info: (message, options) => show('info', message, options),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6"
      >
        {toasts.map((toast) => {
          const Icon = TONE_ICON[toast.tone];
          return (
            <div
              key={toast.id}
              // Errors interrupt screen readers; everything else waits its turn.
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-white shadow-xl sm:w-[22rem]"
            >
              <Icon
                className={cn('mt-0.5 h-4 w-4 shrink-0', TONE_ICON_CLASS[toast.tone])}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
                <p
                  className={cn(
                    'break-words text-sm leading-relaxed',
                    toast.title ? 'mt-1 text-slate-200' : 'text-white',
                  )}
                >
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="shrink-0 rounded p-0.5 text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                onClick={() => dismiss(toast.id)}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
