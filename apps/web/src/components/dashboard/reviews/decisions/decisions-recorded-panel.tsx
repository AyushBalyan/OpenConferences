'use client';

import { SubmissionDate } from '@/components/dashboard/submission-date';

import { Card, CardContent } from '@/components/ui/card';
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
import { decisionOutcomeLabel } from '@/lib/review-types';
import { useDecisionsWorkspace } from './decisions-workspace';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  fetchMembers,
  fetchNotificationLogs,
  fetchPaper,
  notifyDecisions,
  resendNotification,
} from '@/lib/api-client';
import { DECISION_OPTIONS } from '@/lib/review-types';
import type { NotificationLogDto } from '@openconferences/schemas';
import { DecisionConfirmation } from './decision-confirmation';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';

function displayDate(value: string | null | undefined) {
  return value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString()
    : 'Date unavailable';
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
  const [members, setMembers] = useState<Awaited<ReturnType<typeof fetchMembers>>>([]);
  const [logs, setLogs] = useState<NotificationLogDto[]>([]);
  const [logsReady, setLogsReady] = useState(false);
  const [logsFailed, setLogsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState('all');
  const [delivery, setDelivery] = useState('all');
  const [target, setTarget] = useState<{
    decision: (typeof decisions)[number];
    recipient: string;
    log?: NotificationLogDto;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLogs() {
      const rows: NotificationLogDto[] = [];
      let cursor: string | undefined;
      do {
        const page = await fetchNotificationLogs(conferenceId, {
          templateKey: 'decision.notified',
          limit: 100,
          cursor,
        });
        rows.push(...page.data);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
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

  function latestLog(decisionId: string) {
    return logs
      .filter((log) => log.relatedEntity === 'Decision' && log.relatedEntityId === decisionId)
      .sort((first, second) => Date.parse(second.queuedAt) - Date.parse(first.queuedAt))[0];
  }
  function status(decision: (typeof decisions)[number]) {
    if (!canViewEmailLogs) return decision.notifiedAt ? 'Delivery status unavailable' : 'Not sent';
    if (!logsReady) return logsFailed ? 'Status unavailable' : 'Checking…';
    const log = latestLog(decision.id);
    if (log)
      return { QUEUED: 'Queued', SENT: 'Sent', FAILED: 'Failed', BOUNCED: 'Bounced' }[log.status];
    return decision.notifiedAt ? 'Delivery unconfirmed' : 'Not sent';
  }
  const rows = filteredDecisions.filter(
    (decision) =>
      (outcome === 'all' || decision.outcome === outcome) &&
      (delivery === 'all' || status(decision) === delivery),
  );

  async function prepareSend(decision: (typeof decisions)[number]) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const log = latestLog(decision.id);
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

  return (
    <div className="space-y-4">
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
      <DataTable
        footer={
          <DataTableFooter>
            {rows.length} of {decisions.length} recorded decisions · Includes previous review cycles
          </DataTableFooter>
        }
      >
        <DataTableHeader>
          <tr>
            <DataTableHead className="normal-case tracking-normal">Paper</DataTableHead>
            <DataTableHead>Submission date</DataTableHead>
            <DataTableHead className="normal-case tracking-normal">Outcome</DataTableHead>
            <DataTableHead className="normal-case tracking-normal">Email status</DataTableHead>
            <DataTableHead className="normal-case tracking-normal">Rationale</DataTableHead>
            <DataTableHead className="normal-case tracking-normal">Action</DataTableHead>
          </tr>
        </DataTableHeader>
        <DataTableBody>
          {!rows.length ? (
            <DataTableRow>
              <DataTableCell colSpan={6}>
                <p role="status" className="py-6 text-slate-600">
                  No recorded decisions match this search or filter. Try another title, paper code,
                  or filter.
                </p>
              </DataTableCell>
            </DataTableRow>
          ) : null}
          {rows.map((decision) => (
            <DataTableRow key={decision.id}>
              <DataTableCell>
                <Link
                  href={`/dashboard/conferences/${conferenceId}/submissions/${decision.paperId}?section=reviews`}
                  className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
                >
                  {decision.paperTitle ?? decision.paperId}
                </Link>
                {decision.submissionNumber ? (
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {decision.submissionNumber}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-slate-600">
                  Cycle {decision.roundNumber ?? '—'} · {displayDate(decision.createdAt)}
                </p>
                <p title={decision.decidedById} className="mt-1 text-xs text-slate-600">
                  By{' '}
                  {members.find((member) => member.userId === decision.decidedById)?.name ||
                    'Committee member'}
                </p>
              </DataTableCell>
              <DataTableCell>
                <SubmissionDate value={decision.paperSubmittedAt} />
              </DataTableCell>
              <DataTableCell>
                <WorkflowBadge
                  label={decisionOutcomeLabel(decision.outcome)}
                  tone={
                    decision.outcome === 'ACCEPT'
                      ? 'success'
                      : decision.outcome === 'REJECT'
                        ? 'danger'
                        : 'pending'
                  }
                />
              </DataTableCell>
              <DataTableCell>
                <WorkflowBadge
                  label={status(decision)}
                  tone={
                    status(decision) === 'Sent'
                      ? 'success'
                      : ['Failed', 'Bounced'].includes(status(decision))
                        ? 'danger'
                        : 'neutral'
                  }
                />
                {latestLog(decision.id)?.sentAt ? (
                  <p className="mt-2 text-xs text-slate-600">
                    {displayDate(latestLog(decision.id)?.sentAt)}
                  </p>
                ) : null}
              </DataTableCell>
              <DataTableCell>
                {decision.rationale ? (
                  <details className="min-w-40 text-sm text-slate-600">
                    <summary className="cursor-pointer">View full rationale</summary>
                    <p className="mt-2 max-w-md whitespace-pre-wrap break-words">
                      {decision.rationale}
                    </p>
                  </details>
                ) : (
                  <span className="text-sm text-slate-400">—</span>
                )}
              </DataTableCell>
              <DataTableCell>
                {decisionByPaper.get(decision.paperId)?.id !== decision.id ? (
                  <span className="text-xs text-slate-600">Previous cycle</span>
                ) : ['Not sent', 'Failed', 'Bounced'].includes(status(decision)) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void prepareSend(decision)}
                  >
                    {status(decision) === 'Not sent' ? 'Review and send' : 'Review and retry'}
                  </Button>
                ) : canViewEmailLogs ? (
                  <Link
                    href={`/dashboard/conferences/${conferenceId}/notifications`}
                    className="text-xs underline"
                  >
                    View email log
                  </Link>
                ) : (
                  <span className="text-xs text-slate-600">Ask an organiser to check delivery</span>
                )}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
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
          <p>To: {target.recipient}</p>
          <p>
            The decision email will be queued immediately and the outcome released to the author.
            Committee-only review comments are not included.
          </p>
          {target.decision.rationale ? (
            <p className="whitespace-pre-wrap">Message: {target.decision.rationale}</p>
          ) : null}
        </DecisionConfirmation>
      ) : null}
    </div>
  );
}
