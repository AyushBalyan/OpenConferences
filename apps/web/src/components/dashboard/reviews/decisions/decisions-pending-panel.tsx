'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { bulkDecide, fetchPaper, makeDecision } from '@/lib/api-client';
import { DECISION_OPTIONS, decisionOutcomeLabel, type DecisionOutcome } from '@/lib/review-types';
import { useDecisionsWorkspace, type PaperRow } from './decisions-workspace';
import { ReviewDossier } from './review-dossier';

const OUTCOME_STYLE: Record<
  DecisionOutcome,
  { key: string; idle: string; active: string; dot: string; chip: string; hint: string }
> = {
  ACCEPT: {
    key: '1',
    idle: 'hover:border-emerald-300 hover:bg-emerald-50/60',
    active: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 text-emerald-900',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-100 text-emerald-800',
    hint: 'Paper proceeds to camera-ready',
  },
  MINOR_REVISION: {
    key: '2',
    idle: 'hover:border-sky-300 hover:bg-sky-50/60',
    active: 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20 text-sky-900',
    dot: 'bg-sky-500',
    chip: 'bg-sky-100 text-sky-800',
    hint: 'Small changes, light re-check',
  },
  MAJOR_REVISION: {
    key: '3',
    idle: 'hover:border-amber-300 hover:bg-amber-50/60',
    active: 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20 text-amber-900',
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-800',
    hint: 'Substantial rework, then a new cycle',
  },
  REJECT: {
    key: '4',
    idle: 'hover:border-rose-300 hover:bg-rose-50/60',
    active: 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20 text-rose-900',
    dot: 'bg-rose-500',
    chip: 'bg-rose-100 text-rose-800',
    hint: 'Paper does not proceed',
  },
};

const ORDERED_OUTCOMES = (Object.keys(OUTCOME_STYLE) as DecisionOutcome[]).filter((value) =>
  DECISION_OPTIONS.some((option) => option.value === value),
);

function isPaperVersionConflict(err: unknown): boolean {
  if (!(err instanceof Error) || (err as Error & { status?: number }).status !== 409) {
    return false;
  }
  return /Paper was modified by another request/i.test(err.message);
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-300 bg-white px-1 font-mono text-[10px] font-medium text-slate-500 shadow-[0_1px_0_rgb(203_213_225)]">
      {children}
    </kbd>
  );
}

export function DecisionsPendingPanel() {
  const searchParams = useSearchParams();
  const {
    conferenceId,
    roundId,
    papers,
    decisions,
    undecidedPapers,
    selected,
    setSelected,
    pending,
    setPending,
    bulkOutcome,
    setBulkOutcome,
    busy,
    setBusy,
    setError,
    setMessage,
    refresh,
    loading,
  } = useDecisionsWorkspace();
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('paper'));
  const [confirming, setConfirming] = useState<'single' | 'bulk' | null>(null);

  const active =
    undecidedPapers.find((paper) => paper.id === activeId) ?? undecidedPapers[0] ?? null;
  const activeIndex = active ? undecidedPapers.indexOf(active) : -1;
  const draft = active ? pending[active.id] : undefined;

  const decidedCount = decisions.length;
  const totalInRound = decidedCount + undecidedPapers.length;
  const drafted = undecidedPapers.filter((paper) => pending[paper.id]?.outcome).length;

  useEffect(() => setConfirming(null), [active?.id, draft?.outcome]);

  function updatePending(
    paperId: string,
    patch: Partial<{ outcome: DecisionOutcome | ''; rationale: string }>,
  ) {
    setPending((prev) => ({
      ...prev,
      [paperId]: {
        outcome: prev[paperId]?.outcome ?? '',
        rationale: prev[paperId]?.rationale ?? '',
        ...patch,
      },
    }));
  }

  function togglePaper(paperId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) next.delete(paperId);
      else next.add(paperId);
      return next;
    });
  }

  function move(delta: number) {
    if (undecidedPapers.length === 0) return;
    const next = Math.min(Math.max(activeIndex + delta, 0), undecidedPapers.length - 1);
    const paper = undecidedPapers[next];
    if (paper) setActiveId(paper.id);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (!active) return;
      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'x') {
        togglePaper(active.id);
      } else {
        const outcome = ORDERED_OUTCOMES.find((value) => OUTCOME_STYLE[value].key === event.key);
        if (outcome) {
          updatePending(active.id, {
            outcome: pending[active.id]?.outcome === outcome ? '' : outcome,
          });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function recordDecisionWithFreshVersion(
    paperId: string,
    body: { roundId: string; outcome: DecisionOutcome; rationale: string | null },
  ) {
    const latest = await fetchPaper(conferenceId, paperId);
    try {
      return await makeDecision(conferenceId, paperId, { ...body, version: latest.version });
    } catch (err) {
      if (!isPaperVersionConflict(err)) throw err;
      const retried = await fetchPaper(conferenceId, paperId);
      return makeDecision(conferenceId, paperId, { ...body, version: retried.version });
    }
  }

  async function handleSingleDecision(paper: PaperRow) {
    const current = pending[paper.id];
    if (!paper.cycleId || !current?.outcome) return;
    if (confirming !== 'single') {
      setConfirming('single');
      return;
    }
    setConfirming(null);
    setBusy(true);
    setError(null);
    setMessage(null);
    const nextPaper = undecidedPapers[activeIndex + 1] ?? undecidedPapers[activeIndex - 1];
    try {
      const result = await recordDecisionWithFreshVersion(paper.id, {
        roundId: paper.cycleId,
        outcome: current.outcome,
        rationale: current.rationale || null,
      });
      setMessage(result.message);
      setActiveId(nextPaper?.id ?? null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const bulkItems = [...selected].map((paperId) => ({
    paperId,
    outcome: pending[paperId]?.outcome || bulkOutcome,
    rationale: pending[paperId]?.rationale || null,
  }));
  const bulkMissing = bulkItems.filter((item) => !item.outcome).length;

  async function handleBulkDecide() {
    const bulkCycleId = undecidedPapers.find((paper) => selected.has(paper.id))?.cycleId;
    if (!bulkCycleId || selected.size === 0) return;
    if (bulkMissing > 0) {
      setError('Choose an outcome for every selected paper or choose a bulk outcome.');
      return;
    }
    if (confirming !== 'bulk') {
      setConfirming('bulk');
      return;
    }
    setConfirming(null);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await bulkDecide(conferenceId, bulkCycleId, {
        items: bulkItems.map((item) => ({ ...item, outcome: item.outcome as DecisionOutcome })),
      });
      setMessage(result.message);
      setSelected(new Set());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk decision failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Skeleton className="h-[28rem] rounded-2xl" />
        <Skeleton className="h-[28rem] rounded-2xl" />
      </div>
    );
  }

  if (undecidedPapers.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white px-8 py-14 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
          <svg
            viewBox="0 0 24 24"
            className="size-7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden
          >
            <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">Queue cleared</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          {decidedCount > 0
            ? `All ${decidedCount} paper${decidedCount === 1 ? '' : 's'} in this round have a decision. Use “Notify authors” when you’re ready to send outcomes.`
            : 'No papers are awaiting a decision in this round.'}
        </p>
      </div>
    );
  }

  const percent = totalInRound ? Math.round((decidedCount / totalInRound) * 100) : 0;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <div className="min-w-[14rem] flex-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-900">Round progress</span>
            <span className="tabular-nums text-slate-500">
              {decidedCount} / {totalInRound} decided
            </span>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-slate-900 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
            <div
              className="h-full bg-slate-900/25 transition-all duration-500"
              style={{ width: `${totalInRound ? (drafted / totalInRound) * 100 : 0}%` }}
            />
          </div>
        </div>
        <dl className="flex gap-6 text-sm">
          {[
            ['Awaiting', undecidedPapers.length],
            ['Drafted', drafted],
            ['Decided', decidedCount],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="hidden items-center gap-1.5 text-xs text-slate-500 xl:flex">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd> navigate · <Kbd>1</Kbd>–<Kbd>4</Kbd> outcome · <Kbd>X</Kbd> select
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
        <nav
          aria-label="Papers awaiting decision"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <input
                type="checkbox"
                className="size-4 accent-slate-900"
                checked={selected.size === undecidedPapers.length}
                onChange={(event) =>
                  setSelected(
                    event.target.checked ? new Set(undecidedPapers.map((p) => p.id)) : new Set(),
                  )
                }
                aria-label="Select all pending papers"
              />
              Queue
            </label>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
              {undecidedPapers.length}
            </span>
          </div>
          <ul className="max-h-[calc(100vh-16rem)] divide-y divide-slate-100 overflow-y-auto">
            {undecidedPapers.map((paper, index) => {
              const outcome = pending[paper.id]?.outcome;
              const isActive = paper.id === active?.id;
              return (
                <li key={paper.id} className="relative">
                  {isActive ? (
                    <span
                      className="absolute inset-y-0 left-0 w-1 rounded-r bg-indigo-600"
                      aria-hidden
                    />
                  ) : null}
                  <div
                    className={`flex items-start gap-3 px-4 py-3 transition-colors ${isActive ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-slate-900"
                      checked={selected.has(paper.id)}
                      onChange={() => togglePaper(paper.id)}
                      aria-label={`Select ${paper.title}`}
                    />
                    <button
                      type="button"
                      onClick={() => setActiveId(paper.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block text-[11px] font-medium tabular-nums text-slate-400">
                        #{String(index + 1).padStart(2, '0')} · v{paper.version}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-sm ${isActive ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}
                      >
                        {paper.title}
                        {paper.warning ? (
                          <span className="mt-1 block text-xs text-amber-700">{paper.warning}</span>
                        ) : null}
                      </span>
                      <span className="mt-1.5 flex items-center gap-1.5 text-xs">
                        {outcome ? (
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${OUTCOME_STYLE[outcome].chip}`}
                          >
                            {decisionOutcomeLabel(outcome)} · draft
                          </span>
                        ) : (
                          <span className="text-slate-400">No outcome yet</span>
                        )}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
            {papers.length} submissions in conference
          </p>
        </nav>

        {active ? (
          <div className="grid items-start gap-6 2xl:grid-cols-[1fr_22rem]">
            <div className="min-w-0 space-y-4">
              <header className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
                    Paper {activeIndex + 1} of {undecidedPapers.length}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 [text-wrap:balance]">
                    {active.title}
                  </h2>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => move(-1)}
                    disabled={activeIndex <= 0}
                    aria-label="Previous paper"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => move(1)}
                    disabled={activeIndex >= undecidedPapers.length - 1}
                    aria-label="Next paper"
                  >
                    ↓
                  </Button>
                </div>
              </header>
              <ReviewDossier
                key={`${roundId}:${active.id}`}
                conferenceId={conferenceId}
                paperId={active.id}
                roundId={roundId}
              />
            </div>

            <aside
              aria-label="Decision"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm 2xl:sticky 2xl:top-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">Your decision</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Recorded privately until authors are notified.
              </p>
              <div role="radiogroup" aria-label="Outcome" className="mt-4 grid grid-cols-2 gap-2">
                {ORDERED_OUTCOMES.map((value) => {
                  const style = OUTCOME_STYLE[value];
                  const checked = draft?.outcome === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => updatePending(active.id, { outcome: checked ? '' : value })}
                      className={`group relative rounded-xl border p-3 text-left transition-all ${checked ? style.active : `border-slate-200 bg-white text-slate-700 ${style.idle}`}`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <span className={`size-2 rounded-full ${style.dot}`} />
                          {decisionOutcomeLabel(value)}
                        </span>
                        <Kbd>{style.key}</Kbd>
                      </span>
                      <span className="mt-1 block text-[11px] leading-snug text-slate-500">
                        {style.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              <label
                htmlFor={`rationale-${active.id}`}
                className="mt-5 block text-xs font-semibold text-slate-700"
              >
                Message to authors <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <Textarea
                id={`rationale-${active.id}`}
                className="mt-1.5 min-h-[7rem] resize-y text-sm"
                value={draft?.rationale ?? ''}
                onChange={(event) => updatePending(active.id, { rationale: event.target.value })}
                placeholder="Summarise the committee’s reasoning. Included in the notification email."
              />
              <Button
                className={`mt-4 w-full ${confirming === 'single' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                onClick={() => void handleSingleDecision(active)}
                disabled={busy || !draft?.outcome}
              >
                {busy
                  ? 'Recording…'
                  : confirming === 'single' && draft?.outcome
                    ? `Confirm ${decisionOutcomeLabel(draft.outcome).toLowerCase()}`
                    : draft?.outcome
                      ? `Record ${decisionOutcomeLabel(draft.outcome).toLowerCase()}`
                      : 'Choose an outcome'}
              </Button>
              {confirming === 'single' ? (
                <button
                  type="button"
                  className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-800"
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </button>
              ) : (
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  Advances to the next paper after recording
                </p>
              )}
            </aside>
          </div>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-900 py-2.5 pl-5 pr-2.5 text-white shadow-2xl shadow-slate-900/30">
            <span className="text-sm font-medium tabular-nums">{selected.size} selected</span>
            <span className="h-5 w-px bg-white/20" />
            <label htmlFor="bulk-outcome" className="text-xs text-slate-300">
              Fill blanks with
            </label>
            <select
              id="bulk-outcome"
              className="h-9 rounded-lg border border-white/15 bg-white/10 px-2 text-sm text-white [&>option]:text-slate-900"
              value={bulkOutcome}
              onChange={(e) => setBulkOutcome(e.target.value as DecisionOutcome)}
            >
              <option value="">—</option>
              {DECISION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {bulkMissing > 0 ? (
              <span className="text-xs text-amber-300">{bulkMissing} without outcome</span>
            ) : null}
            <Button
              size="sm"
              className="bg-white text-slate-900 hover:bg-slate-100"
              onClick={() => void handleBulkDecide()}
              disabled={busy || bulkMissing > 0}
            >
              {confirming === 'bulk'
                ? `Confirm ${selected.size} decisions`
                : `Record ${selected.size}`}
            </Button>
            <button
              type="button"
              className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-white"
              onClick={() => {
                setSelected(new Set());
                setConfirming(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
