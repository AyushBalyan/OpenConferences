'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { bulkDecide, makeDecision, notifyDecisions } from '@/lib/api-client';
import { DECISION_OPTIONS, decisionOutcomeLabel, type DecisionOutcome } from '@/lib/review-types';
import { useDecisionsWorkspace, type PaperRow } from './decisions-workspace';

export function DecisionsRoundBar() {
  const {
    roundId,
    rounds,
    decisions,
    busy,
    setBusy,
    setError,
    setMessage,
    refresh,
    onRoundChange,
    conferenceId,
  } = useDecisionsWorkspace();

  async function handleNotify() {
    if (!roundId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await notifyDecisions(conferenceId, roundId);
      setMessage(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notification failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Review round</CardTitle>
        <CardDescription>Select the round to decide on</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="round">Round</Label>
          <select
            id="round"
            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={roundId}
            onChange={(e) => void onRoundChange(e.target.value)}
          >
            <option value="">Select round…</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                Round {r.roundNumber} ({r.status})
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          onClick={() => void handleNotify()}
          disabled={busy || !roundId || decisions.length === 0}
        >
          Notify authors
        </Button>
      </CardContent>
    </Card>
  );
}

export function DecisionsAlerts() {
  const { error, message } = useDecisionsWorkspace();
  return (
    <>
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-emerald-700">{message}</p> : null}
    </>
  );
}

export function DecisionsPendingPanel() {
  const {
    conferenceId,
    roundId,
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

  function togglePaper(paperId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) next.delete(paperId);
      else next.add(paperId);
      return next;
    });
  }

  function updatePending(
    paperId: string,
    patch: Partial<{ outcome: DecisionOutcome; rationale: string }>,
  ) {
    setPending((prev) => ({
      ...prev,
      [paperId]: {
        outcome: prev[paperId]?.outcome ?? 'ACCEPT',
        rationale: prev[paperId]?.rationale ?? '',
        ...patch,
      },
    }));
  }

  async function handleSingleDecision(paper: PaperRow) {
    if (!roundId) return;
    const draft = pending[paper.id] ?? { outcome: 'ACCEPT' as DecisionOutcome, rationale: '' };
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await makeDecision(conferenceId, paper.id, {
        roundId,
        outcome: draft.outcome,
        rationale: draft.rationale || null,
        version: paper.version,
      });
      setMessage(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkDecide() {
    if (!roundId || selected.size === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const items = [...selected].map((paperId) => ({
        paperId,
        outcome: pending[paperId]?.outcome ?? bulkOutcome,
        rationale: pending[paperId]?.rationale || null,
      }));
      const result = await bulkDecide(conferenceId, roundId, { items });
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
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!roundId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          Select a review round to record decisions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {undecidedPapers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bulk decision</CardTitle>
            <CardDescription>
              Select papers and apply the same outcome, or set per-paper outcomes below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="bulk-outcome">Default outcome</Label>
              <select
                id="bulk-outcome"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={bulkOutcome}
                onChange={(e) => setBulkOutcome(e.target.value as DecisionOutcome)}
              >
                {DECISION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => void handleBulkDecide()} disabled={busy || selected.size === 0}>
              Decide {selected.size} selected
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {undecidedPapers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-500">
              No papers awaiting decision in this round.
            </CardContent>
          </Card>
        ) : (
          undecidedPapers.map((paper) => {
            const draft = pending[paper.id] ?? {
              outcome: 'ACCEPT' as DecisionOutcome,
              rationale: '',
            };
            return (
              <Card key={paper.id}>
                <CardHeader className="flex flex-row items-start gap-4">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(paper.id)}
                    onChange={() => togglePaper(paper.id)}
                    aria-label={`Select ${paper.title}`}
                  />
                  <div className="flex-1 space-y-1">
                    <CardTitle className="text-base">{paper.title}</CardTitle>
                    <CardDescription>Status: {paper.status}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`outcome-${paper.id}`}>Outcome</Label>
                      <select
                        id={`outcome-${paper.id}`}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={draft.outcome}
                        onChange={(e) =>
                          updatePending(paper.id, { outcome: e.target.value as DecisionOutcome })
                        }
                      >
                        {DECISION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`rationale-${paper.id}`}>Rationale (optional)</Label>
                    <Textarea
                      id={`rationale-${paper.id}`}
                      value={draft.rationale}
                      onChange={(e) => updatePending(paper.id, { rationale: e.target.value })}
                      placeholder="Optional message to authors…"
                    />
                  </div>
                  <Button onClick={() => void handleSingleDecision(paper)} disabled={busy}>
                    Record decision
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DecisionsRecordedPanel() {
  const { decisions, loading } = useDecisionsWorkspace();

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (decisions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No decisions recorded yet for this round.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {decisions.map((d) => (
        <Card key={d.id}>
          <CardHeader>
            <CardTitle className="text-base">{d.paperTitle ?? d.paperId}</CardTitle>
            <CardDescription>
              {decisionOutcomeLabel(d.outcome)}
              {d.notifiedAt ? ' · Authors notified' : ' · Not yet notified'}
            </CardDescription>
          </CardHeader>
          {d.rationale ? (
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-slate-500">{d.rationale}</p>
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
