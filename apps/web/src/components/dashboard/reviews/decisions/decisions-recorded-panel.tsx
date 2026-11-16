'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { SubmissionDate } from '@/components/dashboard/submission-date';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { DECISION_OPTIONS, decisionOutcomeLabel } from '@/lib/review-types';
import {
  fetchMembers,
  fetchNotificationLogs,
  fetchPaper,
  notifyDecisions,
  resendNotification,
} from '@/lib/api-client';
import type { NotificationLogDto } from '@openconferences/schemas';
import { cn } from '@/lib/utils';
import { useDecisionsWorkspace } from './decisions-workspace';
import { ReviewReleaseWarning } from './review-release';
import { DecisionConfirmation } from './decision-confirmation';
import { RecordedDecisionDetails } from './recorded-decision-details';

const SENDABLE = ['Not sent', 'Failed', 'Bounced'];
const DESKTOP_QUERY = '(min-width: 768px)';

function displayDate(value: string | null | undefined) {
  return value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString()
    : 'Date unavailable';
}

/** The table needs room for six columns; narrower screens get one card per decision. */
function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

export function DecisionsRecordedPanel() {
  const { conference } = useConferenceWorkspace();
  const canViewEmailLogs = Boolean(
    conference?.myRoles.some((role) => ['ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN'].includes(role)),
  );
  const {
    conferenceId,
    decisions,
    filteredDecisions,
    loading,
    busy,
    setBusy,
    setError,
    setMessage,
    refresh,
    decisionByPaper,
  } = useDecisionsWorkspace();
  type Decision = (typeof decisions)[number];
  const isDesktop = useIsDesktop();
  const [members, setMembers] = useState<Awaited<ReturnType<typeof fetchMembers>>>([]);
  const [logs, setLogs] = useState<NotificationLogDto[]>([]);
  const [logsReady, setLogsReady] = useState(false);
  const [logsFailed, setLogsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState('all');
  const [delivery, setDelivery] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [target, setTarget] = useState<{
    decision: Decision;
    recipient: string;
    log?: NotificationLogDto;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLogs() {
      const batches = await Promise.all(
        ['decision.notified', 'decision.accepted'].map(async (templateKey) => {
          const rows: NotificationLogDto[] = [];
          let cursor: string | undefined;
          do {
            const page = await fetchNotificationLogs(conferenceId, {
              templateKey,
              limit: 100,
              cursor,
            });
            rows.push(...page.data);
            cursor = page.nextCursor ?? undefined;
          } while (cursor);
          return rows;
        }),
      );
      const rows = batches.flat();
      if (!cancelled) {
        setLogs(rows);
        setLogsReady(true);
        setLogsFailed(false);
      }
    }
    if (canViewEmailLogs)
      void loadLogs().catch(() => {
        if (!cancelled) {
          setLogsFailed(true);
          setLogsReady(false);
        }
      });
    void fetchMembers(conferenceId)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [conferenceId, attempt, canViewEmailLogs]);

  useEffect(() => {
    if (!logs.some((log) => log.status === 'QUEUED')) return;
    const timer = window.setInterval(() => setAttempt((value) => value + 1), 15000);
    return () => window.clearInterval(timer);
  }, [logs]);

  const latestLogByDecision = useMemo(() => {
    const latest = new Map<string, NotificationLogDto>();
    for (const log of logs) {
      if (log.relatedEntity !== 'Decision' || !log.relatedEntityId) continue;
      const current = latest.get(log.relatedEntityId);
      if (!current || Date.parse(log.queuedAt) > Date.parse(current.queuedAt)) {
        latest.set(log.relatedEntityId, log);
      }
    }
    return latest;
  }, [logs]);

  function status(decision: Decision) {
    if (!canViewEmailLogs) return decision.notifiedAt ? 'Delivery status unavailable' : 'Not sent';
    if (!logsReady) return logsFailed ? 'Status unavailable' : 'Checking…';
    const log = latestLogByDecision.get(decision.id);
    if (log)
      return { QUEUED: 'Queued', SENT: 'Sent', FAILED: 'Failed', BOUNCED: 'Bounced' }[log.status];
    return decision.notifiedAt ? 'Delivery unconfirmed' : 'Not sent';
  }
  function describe(decision: Decision) {
    const state = status(decision);
    const current = decisionByPaper.get(decision.paperId)?.id === decision.id;
    return {
      decision,
      state,
      current,
      log: latestLogByDecision.get(decision.id),
      sendable: current && SENDABLE.includes(state),
      // Once notified the author can already see the decision, so the text is frozen.
      editable: current && !decision.notifiedAt,
    };
  }

  const rows = filteredDecisions
    .map(describe)
    .filter(
      (row) =>
        (outcome === 'all' || row.decision.outcome === outcome) &&
        (delivery === 'all' || row.state === delivery),
    );
  const unsent = decisions.map(describe).filter((row) => row.sendable);
  const failedCount = unsent.filter((row) => row.state !== 'Not sent').length;
  const sendableRows = rows.filter((row) => row.sendable);
  const chosen = sendableRows.filter((row) => selected.has(row.decision.id));
  const allChosen = sendableRows.length > 0 && chosen.length === sendableRows.length;

  function toggleSelected(decisionId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(decisionId)) next.delete(decisionId);
      else next.add(decisionId);
      return next;
    });
  }
  function toggleExpanded(decisionId: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(decisionId)) next.delete(decisionId);
      else next.add(decisionId);
      return next;
    });
  }

  async function prepareSend(decision: Decision) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const log = latestLogByDecision.get(decision.id);
      if (log && ['FAILED', 'BOUNCED'].includes(log.status)) {
        setTarget({ decision, recipient: log.toEmail, log });
      } else {
        const paper = await fetchPaper(conferenceId, decision.paperId);
        const author =
          paper.authorships?.find((person) => person.isCorresponding) ?? paper.authorships?.[0];
        if (!author?.email)
          throw new Error(
            'No corresponding author email is available. Check the paper’s author details before sending.',
          );
        setTarget({ decision, recipient: author.email });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load the recipient.');
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!target) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (target.log) await resendNotification(conferenceId, target.log.id);
      else
        await notifyDecisions(conferenceId, target.decision.roundId, {
          paperIds: [target.decision.paperId],
        });
      setMessage(
        `Decision email requested for ${target.recipient}. Check the delivery status below.`,
      );
      setTarget(null);
      await refresh().catch(() =>
        setError(
          'Email requested, but decisions could not refresh. Refresh the page for the latest status.',
        ),
      );
      setAttempt((value) => value + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not request the decision email.');
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Each paper has its own review cycle, so emails are requested one decision
   * at a time. A failure on one paper does not stop the rest.
   */
  async function sendChosen() {
    const batch = chosen;
    if (batch.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const failures: Array<{ id: string; label: string; reason: string }> = [];
    let requested = 0;
    for (const [index, row] of batch.entries()) {
      setBulkProgress(`Requesting ${index + 1} of ${batch.length}…`);
      try {
        if (row.log && ['FAILED', 'BOUNCED'].includes(row.log.status))
          await resendNotification(conferenceId, row.log.id);
        else
          await notifyDecisions(conferenceId, row.decision.roundId, {
            paperIds: [row.decision.paperId],
          });
        requested += 1;
      } catch (error) {
        failures.push({
          id: row.decision.id,
          label: row.decision.submissionNumber ?? row.decision.paperTitle ?? row.decision.paperId,
          reason: error instanceof Error ? error.message : 'Request failed',
        });
      }
    }
    setBulkProgress(null);
    setBulkConfirming(false);
    setSelected(new Set(failures.map((failure) => failure.id)));
    if (requested > 0)
      setMessage(
        `${requested} decision email${requested === 1 ? '' : 's'} requested. Check the delivery status below.`,
      );
    await refresh().catch(() => undefined);
    setAttempt((value) => value + 1);
    if (failures.length)
      setError(
        `${failures.length} could not be requested and ${failures.length === 1 ? 'is' : 'are'} still selected: ${failures
          .map((failure) => `${failure.label} (${failure.reason})`)
          .join('; ')}`,
      );
    setBusy(false);
  }

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (decisions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No decisions recorded yet for this conference.
        </CardContent>
      </Card>
    );
  }

  type Row = (typeof rows)[number];

  function title(row: Row) {
    return row.decision.paperTitle ?? row.decision.paperId;
  }
  function paperSummary(row: Row) {
    const { decision } = row;
    return (
      <>
        <Link
          href={`/dashboard/conferences/${conferenceId}/submissions/${decision.paperId}?section=reviews`}
          className="break-words font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
        >
          {title(row)}
        </Link>
        {decision.submissionNumber ? (
          <p className="mt-1 font-mono text-xs text-slate-500">{decision.submissionNumber}</p>
        ) : null}
        <p className="mt-2 text-xs text-slate-600">
          Cycle {decision.roundNumber ?? '—'} · {displayDate(decision.createdAt)}
        </p>
        <p title={decision.decidedById} className="mt-1 text-xs text-slate-600">
          By{' '}
          {members.find((member) => member.userId === decision.decidedById)?.name ||
            'Committee member'}
        </p>
      </>
    );
  }
  function outcomeBadge(row: Row) {
    return (
      <WorkflowBadge
        label={decisionOutcomeLabel(row.decision.outcome)}
        tone={
          row.decision.outcome === 'ACCEPT'
            ? 'success'
            : row.decision.outcome === 'REJECT'
              ? 'danger'
              : 'pending'
        }
      />
    );
  }
  function emailStatus(row: Row) {
    return (
      <>
        <WorkflowBadge
          label={row.state}
          tone={
            row.state === 'Sent'
              ? 'success'
              : ['Failed', 'Bounced'].includes(row.state)
                ? 'danger'
                : 'neutral'
          }
        />
        {row.log?.sentAt ? (
          <p className="mt-2 text-xs text-slate-600">{displayDate(row.log.sentAt)}</p>
        ) : null}
        {row.sendable && !row.decision.rationale ? (
          <p className="mt-2 text-xs text-amber-800">No message to authors</p>
        ) : null}
      </>
    );
  }
  function action(row: Row) {
    if (!row.current) return <span className="text-xs text-slate-600">Previous cycle</span>;
    if (row.sendable)
      return (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void prepareSend(row.decision)}
        >
          {row.state === 'Not sent' ? 'Review and send' : 'Review and retry'}
        </Button>
      );
    if (canViewEmailLogs)
      return (
        <Link
          href={`/dashboard/conferences/${conferenceId}/notifications`}
          className="text-xs underline"
        >
          View email log
        </Link>
      );
    return <span className="text-xs text-slate-600">Ask an organiser to check delivery</span>;
  }
  function selectBox(row: Row) {
    if (!row.sendable) return null;
    return (
      <input
        type="checkbox"
        className="size-4 accent-slate-900"
        checked={selected.has(row.decision.id)}
        disabled={busy}
        onChange={() => toggleSelected(row.decision.id)}
        aria-label={`Select ${title(row)} for sending`}
      />
    );
  }
  function detailsToggle(row: Row) {
    const open = expanded.has(row.decision.id);
    return (
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`decision-details-${row.decision.id}`}
        aria-label={`Details for ${title(row)}`}
        onClick={() => toggleExpanded(row.decision.id)}
        className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Details
        <ChevronDown
          className={cn('size-4 transition-transform', open ? 'rotate-180' : '')}
          aria-hidden
        />
      </button>
    );
  }
  function details(row: Row) {
    return (
      <RecordedDecisionDetails
        key={`${row.decision.id}:${row.decision.version}`}
        decision={row.decision}
        canEditMessage={row.editable}
      />
    );
  }

  const empty = (
    <p role="status" className="py-6 text-slate-600">
      No recorded decisions match this search or filter. Try another title, paper code, or filter.
    </p>
  );
  const countLine = `${rows.length} of ${decisions.length} recorded decisions · Includes previous review cycles`;
  const selectAll = (
    <input
      type="checkbox"
      className="size-4 accent-slate-900"
      checked={allChosen}
      disabled={busy || sendableRows.length === 0}
      onChange={(event) =>
        setSelected(
          event.target.checked ? new Set(sendableRows.map((row) => row.decision.id)) : new Set(),
        )
      }
      aria-label="Select all unsent decisions shown"
    />
  );

  return (
    <div className={cn('space-y-4', chosen.length > 0 ? 'pb-24' : '')}>
      {unsent.length > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p>
            <span className="font-semibold">
              {unsent.length} decision{unsent.length === 1 ? '' : 's'} not yet sent to authors.
            </span>{' '}
            {failedCount > 0
              ? `${failedCount} failed or bounced and can be retried. `
              : 'Authors cannot see an outcome until its email is sent. '}
            {sendableRows.length < unsent.length
              ? `${sendableRows.length} match the current search and filters.`
              : ''}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="bg-white"
            disabled={busy || sendableRows.length === 0 || allChosen}
            onClick={() => setSelected(new Set(sendableRows.map((row) => row.decision.id)))}
          >
            Select all unsent
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block">Outcome</span>
          <select
            aria-label="Filter recorded outcome"
            className="min-h-10 rounded-md border border-slate-300 bg-white px-2"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            <option value="all">All outcomes</option>
            {DECISION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block">Decision email</span>
          <select
            aria-label="Filter decision email"
            className="min-h-10 rounded-md border border-slate-300 bg-white px-2"
            value={delivery}
            onChange={(event) => setDelivery(event.target.value)}
          >
            <option value="all">All email statuses</option>
            {[
              'Not sent',
              'Queued',
              'Sent',
              'Failed',
              'Bounced',
              'Delivery unconfirmed',
              'Status unavailable',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setAttempt((value) => value + 1);
            void refresh().catch(() => setError('Could not refresh decisions. Try again.'));
          }}
        >
          Refresh status
        </Button>
      </div>
      {logsFailed ? (
        <p role="status" className="text-sm text-amber-800">
          Email status could not be loaded. Refresh status to try again. No delivery state has been
          assumed.
        </p>
      ) : null}

      {isDesktop ? (
        <DataTable footer={<DataTableFooter>{countLine}</DataTableFooter>}>
          <DataTableHeader>
            <tr>
              <DataTableHead className="w-10 pr-0">{selectAll}</DataTableHead>
              <DataTableHead className="normal-case tracking-normal">Paper</DataTableHead>
              <DataTableHead>Submission date</DataTableHead>
              <DataTableHead className="normal-case tracking-normal">Outcome</DataTableHead>
              <DataTableHead className="normal-case tracking-normal">Email status</DataTableHead>
              <DataTableHead className="normal-case tracking-normal">Action</DataTableHead>
              <DataTableHead className="normal-case tracking-normal">
                <span className="sr-only">Details</span>
              </DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {!rows.length ? (
              <DataTableRow>
                <DataTableCell colSpan={7}>{empty}</DataTableCell>
              </DataTableRow>
            ) : null}
            {rows.flatMap((row) => [
              <DataTableRow key={row.decision.id} className="align-top">
                <DataTableCell className="w-10 pr-0">{selectBox(row)}</DataTableCell>
                <DataTableCell>{paperSummary(row)}</DataTableCell>
                <DataTableCell>
                  <SubmissionDate value={row.decision.paperSubmittedAt} />
                </DataTableCell>
                <DataTableCell>{outcomeBadge(row)}</DataTableCell>
                <DataTableCell>{emailStatus(row)}</DataTableCell>
                <DataTableCell>{action(row)}</DataTableCell>
                <DataTableCell className="text-right">{detailsToggle(row)}</DataTableCell>
              </DataTableRow>,
              expanded.has(row.decision.id) ? (
                <tr key={`${row.decision.id}:details`} id={`decision-details-${row.decision.id}`}>
                  <td colSpan={7} className="border-t border-slate-100 bg-slate-50 px-6 py-5">
                    {details(row)}
                  </td>
                </tr>
              ) : null,
            ])}
          </DataTableBody>
        </DataTable>
      ) : (
        <div className="space-y-3">
          {sendableRows.length > 0 ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              {selectAll}
              Select all unsent
            </label>
          ) : null}
          {!rows.length ? empty : null}
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.decision.id}
                className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
              >
                <div className="flex items-start gap-3">
                  {row.sendable ? <div className="pt-0.5">{selectBox(row)}</div> : null}
                  <div className="min-w-0 flex-1">{paperSummary(row)}</div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="text-xs text-slate-500">Outcome</dt>
                    <dd className="mt-1">{outcomeBadge(row)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Email status</dt>
                    <dd className="mt-1">{emailStatus(row)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Submission date</dt>
                    <dd className="mt-1">
                      <SubmissionDate value={row.decision.paperSubmittedAt} />
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  {action(row)}
                  {detailsToggle(row)}
                </div>
                {expanded.has(row.decision.id) ? (
                  <div
                    id={`decision-details-${row.decision.id}`}
                    className="mt-3 border-t border-slate-100 pt-4"
                  >
                    {details(row)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">{countLine}</p>
        </div>
      )}

      {chosen.length > 0 ? (
        <div className="sticky bottom-0 z-20">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-900 p-4 text-white">
            <span className="text-sm font-medium tabular-nums">{chosen.length} selected</span>
            <span className="h-5 w-px bg-white/20" />
            <Button
              size="sm"
              className="bg-white text-slate-900 hover:bg-slate-100"
              disabled={busy}
              onClick={() => setBulkConfirming(true)}
            >
              Send {chosen.length} decision email{chosen.length === 1 ? '' : 's'}
            </Button>
            <button
              type="button"
              className="rounded-lg px-2 py-1.5 text-xs text-slate-300 hover:text-white"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {bulkConfirming && chosen.length > 0 ? (
        <DecisionConfirmation
          title={`Send ${chosen.length} decision email${chosen.length === 1 ? '' : 's'}?`}
          action={`Send ${chosen.length} email${chosen.length === 1 ? '' : 's'}`}
          busy={busy}
          onConfirm={() => void sendChosen()}
          onCancel={() => setBulkConfirming(false)}
        >
          <p>
            Each email goes to the paper’s corresponding author and is queued immediately. The
            outcome becomes visible to the authors, and the message can no longer be edited.
            Committee-only review comments are not included.
          </p>
          <ReviewReleaseWarning cycleIds={chosen.map((row) => row.decision.roundId)} />
          <ul className="space-y-3">
            {chosen.map((row) => (
              <li key={row.decision.id}>
                <p className="font-medium text-slate-900">
                  {row.decision.submissionNumber} · {row.decision.paperTitle}
                </p>
                <p>
                  {decisionOutcomeLabel(row.decision.outcome)}
                  {row.log ? ' · retry' : ''}
                </p>
                {row.decision.rationale ? null : (
                  <p className="text-amber-800">No message to authors</p>
                )}
              </li>
            ))}
          </ul>
          {bulkProgress ? <p role="status">{bulkProgress}</p> : null}
        </DecisionConfirmation>
      ) : null}
      {target ? (
        <DecisionConfirmation
          title={target.log ? 'Retry this decision email?' : 'Send this decision to the author?'}
          action={target.log ? 'Retry email' : 'Send decision email'}
          busy={busy}
          onConfirm={() => void send()}
          onCancel={() => setTarget(null)}
        >
          <p className="font-semibold text-slate-900">
            {target.decision.submissionNumber} · {target.decision.paperTitle}
          </p>
          <p>Outcome: {decisionOutcomeLabel(target.decision.outcome)}</p>
          <ReviewReleaseWarning cycleIds={[target.decision.roundId]} />
          <p>To: {target.recipient}</p>
          <p>
            The decision email will be queued immediately and the outcome released to the author.
            Committee-only review comments are not included.
          </p>
          {target.decision.rationale ? (
            <p className="whitespace-pre-wrap">Message: {target.decision.rationale}</p>
          ) : (
            <p className="text-amber-800">
              No message to authors. Cancel and use Details to add one first if needed.
            </p>
          )}
        </DecisionConfirmation>
      ) : null}
    </div>
  );
}
