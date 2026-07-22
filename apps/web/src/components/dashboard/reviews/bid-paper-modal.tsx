'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { BidSelector } from '@/components/dashboard/reviews/bid-selector';
import { Button } from '@/components/ui/button';
import { bidValueLabel, type BidValue, type BlindedPaperPoolItemDto } from '@/lib/review-types';

type BidPaperModalProps = {
  paper: BlindedPaperPoolItemDto;
  authorsLabel: string;
  busy?: boolean;
  onClose: () => void;
  onSelect: (value: BidValue) => void;
};

export function BidPaperModal({
  paper,
  authorsLabel,
  busy,
  onClose,
  onSelect,
}: BidPaperModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-8">
      <button
        type="button"
        aria-label="Close paper details"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`bid-paper-title-${paper.id}`}
        className="relative flex max-h-[min(90vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Paper details
            </p>
            <h2
              id={`bid-paper-title-${paper.id}`}
              className="mt-1 text-lg font-semibold leading-snug text-slate-900"
            >
              {paper.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{authorsLabel}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 px-2"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Abstract
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {paper.abstract || 'No abstract provided.'}
            </p>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Keywords
            </h3>
            {paper.keywords.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {paper.keywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No keywords listed.</p>
            )}
          </section>
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Your bid
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {paper.myBid ? bidValueLabel(paper.myBid) : 'Not bid yet'}
              </p>
            </div>
            <BidSelector value={paper.myBid} disabled={busy} onSelect={onSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}
