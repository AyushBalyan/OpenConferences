'use client';

import { useEffect } from 'react';

export function AppToast({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">{message}</p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-slate-300 hover:text-white"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
