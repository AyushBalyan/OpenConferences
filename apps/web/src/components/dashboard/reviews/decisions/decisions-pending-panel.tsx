'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { bulkDecide, makeDecision } from '@/lib/api-client';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import { DECISION_OPTIONS, type DecisionOutcome } from '@/lib/review-types';
import { useDecisionsWorkspace, type PaperRow } from './decisions-workspace';

const selectClassName =
  'flex h-9 w-full min-w-[8.5rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm';

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

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(undecidedPapers.map((paper) => paper.id)) : new Set());
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
          <DataTable
            footer={
              <DataTableFooter>
                {undecidedPapers.length} paper{undecidedPapers.length === 1 ? '' : 's'} awaiting
                decision
                {selected.size > 0 ? ` · ${selected.size} selected` : ''}
              </DataTableFooter>
            }
          >
            <DataTableHeader>
              <tr>
                <DataTableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={undecidedPapers.length > 0 && selected.size === undecidedPapers.length}
                    onChange={(event) => toggleAll(event.target.checked)}
                    aria-label="Select all pending papers"
                  />
                </DataTableHead>
                <DataTableHead>Title</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead>Outcome</DataTableHead>
                <DataTableHead>Rationale</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {undecidedPapers.map((paper) => {
                const draft = pending[paper.id] ?? {
                  outcome: 'ACCEPT' as DecisionOutcome,
                  rationale: '',
                };

                return (
                  <DataTableRow key={paper.id}>
                    <DataTableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(paper.id)}
                        onChange={() => togglePaper(paper.id)}
                        aria-label={`Select ${paper.title}`}
                      />
                    </DataTableCell>
                    <DataTableCell>
                      <p className="font-medium text-slate-900">{paper.title}</p>
                    </DataTableCell>
                    <DataTableCell>
                      <WorkflowBadge
                        label={paperStatusLabel(paper.status)}
                        tone={paperStatusTone(paper.status)}
                      />
                    </DataTableCell>
                    <DataTableCell>
                      <select
                        id={`outcome-${paper.id}`}
                        className={selectClassName}
                        value={draft.outcome}
                        onChange={(event) =>
                          updatePending(paper.id, {
                            outcome: event.target.value as DecisionOutcome,
                          })
                        }
                      >
                        {DECISION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </DataTableCell>
                    <DataTableCell className="min-w-[14rem]">
                      <Textarea
                        id={`rationale-${paper.id}`}
                        className="min-h-[2.25rem] resize-y text-sm"
                        rows={2}
                        value={draft.rationale}
                        onChange={(event) =>
                          updatePending(paper.id, { rationale: event.target.value })
                        }
                        placeholder="Optional message to authors…"
                      />
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => void handleSingleDecision(paper)}
                        disabled={busy}
                      >
                        Record
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </div>
    </div>
  );
}
