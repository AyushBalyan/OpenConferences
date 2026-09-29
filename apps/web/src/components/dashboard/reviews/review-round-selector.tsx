'use client';

import { Label } from '@/components/ui/label';

export type ReviewRoundOption = {
  id: string;
  roundNumber: number;
  reviewStage: string;
  paperId?: string;
  submissionNumber?: string | null;
};

type ReviewRoundSelectorProps = {
  id: string;
  label?: string;
  rounds: ReviewRoundOption[];
  roundId: string;
  onRoundChange: (roundId: string) => void;
  actions?: React.ReactNode;
  className?: string;
};

export function ReviewRoundSelector({
  id,
  label = 'Review cycle',
  rounds,
  roundId,
  onRoundChange,
  actions,
  className,
}: ReviewRoundSelectorProps) {
  if (rounds.length === 0) return null;

  return (
    <div className={`mb-6 flex flex-col gap-3 sm:flex-row sm:items-end ${className ?? ''}`}>
      <div className="max-w-lg flex-1">
        <Label htmlFor={id}>{label}</Label>
        <select
          id={id}
          className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          value={roundId}
          onChange={(e) => onRoundChange(e.target.value)}
        >
          {rounds.map((round) => {
            const stage = round.reviewStage.replaceAll('_', ' ').toLowerCase();
            const cycle = `Cycle ${round.roundNumber} (${stage})`;
            return (
              <option key={round.id} value={round.id}>
                {round.submissionNumber ? `${round.submissionNumber} · ${cycle}` : cycle}
              </option>
            );
          })}
        </select>
      </div>
      {actions}
    </div>
  );
}
