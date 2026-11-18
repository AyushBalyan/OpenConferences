'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  FileWarning,
  Hourglass,
} from 'lucide-react';
import { SubmissionDate } from '@/components/dashboard/submission-date';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSkeleton,
} from '@/components/dashboard/data-table';
import { Segmented } from '@/components/dashboard/analytics/analytics-card';
import {
  useRegistrationsWorkspace,
  type VerificationRow,
} from '@/components/dashboard/registrations/registrations-workspace';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useIsDesktop } from '@/hooks/dashboard/use-is-desktop';
import {
  currentPaperPdfUrl,
  downloadStudentVerification,
  reviewStudentVerification,
} from '@/lib/api-client';
import { openInNewTab } from '@/lib/open-in-tab';
import { isReviewableVerification, verificationStatusView } from '@/lib/registrations';
import { cn } from '@/lib/utils';

type Action = 'APPROVE' | 'CLARIFY' | 'REJECT';
const DONE: Record<Action, string> = {
  APPROVE: 'Student rate approved.',
  CLARIFY: 'Clarification requested from the author.',
  REJECT: 'Student rate rejected.',
};

export default function RegistrationsVerificationsPage() {
  const {
    conferenceId,
    verifications,
    verificationsLoading,
    verificationsError,
    pendingVerifications,
    reloadVerifications,
  } = useRegistrationsWorkspace();
  const toast = useToast();
  const confirm = useConfirm();
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const rows =
    view === 'pending'
      ? verifications.filter((row) => isReviewableVerification(row.status))
      : verifications;
  const title = (row: VerificationRow) => row.paperTitle ?? row.id;

  async function act(row: VerificationRow, action: Action) {
    const note = notes[row.id]?.trim() ?? '';
    if (
      action === 'REJECT' &&
      !(await confirm({
        title: 'Reject the student rate?',
        description: (
          <>
            <span className="block font-medium text-slate-900">{title(row)}</span>
            <span className="mt-2 block">
              The author will be charged the regular rate and is sent this reason:
            </span>
            <span className="mt-2 block whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-800">
              {note}
            </span>
          </>
        ),
        confirmLabel: 'Reject student rate',
        tone: 'danger',
      }))
    )
      return;
    setBusyId(row.id);
    try {
      await reviewStudentVerification(conferenceId, row.id, {
        action,
        ...(note ? { note } : {}),
      });
      toast.success(DONE[action]);
      setNotes((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      await reloadVerifications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function download(row: VerificationRow) {
    setBusyId(row.id);
    try {
      // The file is served as an attachment, so this starts a download and the page stays put.
      window.location.assign(await downloadStudentVerification(conferenceId, row.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusyId(null);
    }
  }

  /** Show a file in a new tab, so the queue stays open beside it. */
  async function open(row: VerificationRow, resolveUrl: () => Promise<string>) {
    setBusyId(row.id);
    try {
      await openInNewTab(resolveUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open the file.');
    } finally {
      setBusyId(null);
    }
  }

  function paper(row: VerificationRow) {
    return (
      <>
        {row.paperId ? (
          <Link
            href={`/dashboard/conferences/${conferenceId}/submissions/${row.paperId}?section=registration`}
            className="break-words font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500"
          >
            {title(row)}
          </Link>
        ) : (
          <p className="break-words font-medium text-slate-900">{title(row)}</p>
        )}
        {row.submissionNumber ? (
          <p className="mt-1 font-mono text-xs text-slate-500">{row.submissionNumber}</p>
        ) : null}
      </>
    );
  }
  function statusBadge(row: VerificationRow) {
    const state = verificationStatusView(row.status);
    return <WorkflowBadge label={state.label} tone={state.tone} />;
  }
  function documentLine(row: VerificationRow) {
    const [Icon, text, tone] =
      row.scanStatus === 'CLEAN'
        ? ([FileCheck2, row.originalFilename ?? 'Document', 'text-slate-700'] as const)
        : row.scanStatus === 'INFECTED'
          ? ([FileWarning, 'Unsafe document. Request a replacement.', 'text-rose-700'] as const)
          : ([Hourglass, 'File check in progress', 'text-slate-500'] as const);
    return (
      <p className={`flex min-w-0 items-center gap-1.5 text-xs ${tone}`}>
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 break-all">{text}</span>
      </p>
    );
  }
  function fileButtons(row: VerificationRow) {
    const busy = busyId === row.id;
    const clean = row.scanStatus === 'CLEAN';
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="bg-white"
          disabled={busy || !row.paperId}
          onClick={() => void open(row, () => currentPaperPdfUrl(conferenceId, row.paperId!))}
        >
          <FileText className="mr-1.5 size-4" aria-hidden />
          Open paper PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-white"
          disabled={busy || !clean}
          onClick={() =>
            void open(row, () => downloadStudentVerification(conferenceId, row.id, 'inline'))
          }
        >
          <ExternalLink className="mr-1.5 size-4" aria-hidden />
          Open student document
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-white"
          disabled={busy || !clean}
          onClick={() => void download(row)}
        >
          <Download className="mr-1.5 size-4" aria-hidden />
          Download document
        </Button>
      </div>
    );
  }
  function detailsToggle(row: VerificationRow) {
    const open = expanded.has(row.id);
    return (
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`verification-details-${row.id}`}
        aria-label={`${isReviewableVerification(row.status) ? 'Review' : 'Details for'} ${title(row)}`}
        onClick={() => toggleExpanded(row.id)}
        className="inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-md px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isReviewableVerification(row.status) ? 'Review' : 'Details'}
        <ChevronDown
          className={cn('size-4 transition-transform', open ? 'rotate-180' : '')}
          aria-hidden
        />
      </button>
    );
  }
  /** Everything behind a row: the files, then the decision or its outcome. */
  function details(row: VerificationRow) {
    return (
      <div className="space-y-4">
        {fileButtons(row)}
        {isReviewableVerification(row.status)
          ? review(row)
          : (outcomeNote(row) ?? (
              <p className="text-xs text-slate-500">No note was sent to the author.</p>
            ))}
      </div>
    );
  }
  /** The note and decision buttons for a row that still needs a decision. */
  function review(row: VerificationRow) {
    const note = notes[row.id] ?? '';
    const hasNote = note.trim().length > 0;
    const busy = busyId === row.id;
    const fieldId = `verification-note-${row.id}`;
    return (
      <div className="space-y-3">
        {row.note ? (
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">Previous note to the author:</span>{' '}
            <span className="whitespace-pre-wrap">{row.note}</span>
          </p>
        ) : null}
        <div>
          <label htmlFor={fieldId} className="text-xs font-medium text-slate-700">
            Note to the author for {title(row)}
          </label>
          <Textarea
            id={fieldId}
            className="mt-1.5 min-h-[4.5rem] max-w-2xl bg-white text-sm"
            placeholder="Optional when approving. Required to request clarification or reject."
            value={note}
            disabled={busy}
            maxLength={2000}
            onChange={(event) =>
              setNotes((current) => ({ ...current, [row.id]: event.target.value }))
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-slate-900 shadow-none hover:bg-slate-800"
            disabled={busy || row.scanStatus !== 'CLEAN'}
            onClick={() => void act(row, 'APPROVE')}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !hasNote}
            onClick={() => void act(row, 'CLARIFY')}
          >
            Request clarification
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-rose-700 hover:text-rose-800"
            disabled={busy || !hasNote}
            onClick={() => void act(row, 'REJECT')}
          >
            Reject
          </Button>
          {!hasNote ? (
            <span className="text-xs text-slate-500">
              Write a note to request clarification or reject.
            </span>
          ) : null}
          {row.scanStatus !== 'CLEAN' ? (
            <span className="text-xs text-slate-500">
              Approval unlocks once the document passes its file check.
            </span>
          ) : null}
        </div>
      </div>
    );
  }
  function outcomeNote(row: VerificationRow) {
    return row.note ? (
      <p className="text-xs text-slate-600">
        <span className="font-medium text-slate-700">Note to the author:</span>{' '}
        <span className="whitespace-pre-wrap">{row.note}</span>
      </p>
    ) : null;
  }

  const countLine = `${rows.length} of ${verifications.length} verification${verifications.length === 1 ? '' : 's'}`;

  return (
    <div className="space-y-4">
      {verificationsError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          <p>{verificationsError}</p>
          <Button size="sm" variant="outline" onClick={() => void reloadVerifications()}>
            Retry
          </Button>
        </div>
      ) : null}
      {verificationsLoading ? (
        <div role="status" aria-label="Loading student verifications">
          <DataTableSkeleton rows={4} />
        </div>
      ) : (
        <>
          <Segmented
            label="Verification view"
            value={view}
            onChange={setView}
            options={[
              ['pending', `Needs review (${pendingVerifications})`],
              ['all', `All (${verifications.length})`],
            ]}
          />
          {rows.length === 0 ? (
            <div
              role="status"
              className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
            >
              <p className="font-medium text-slate-900">
                {verifications.length === 0
                  ? 'No student verifications yet'
                  : 'Nothing needs review'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {verifications.length === 0
                  ? 'Documents appear here when an author registers at the student rate.'
                  : 'Every student document has been decided. Switch to All to see them.'}
              </p>
            </div>
          ) : isDesktop ? (
            <DataTable footer={<DataTableFooter>{countLine}</DataTableFooter>}>
              <DataTableHeader>
                <tr>
                  <DataTableHead>Paper</DataTableHead>
                  <DataTableHead>Submission date</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Document</DataTableHead>
                  <DataTableHead>
                    <span className="sr-only">Details</span>
                  </DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {rows.flatMap((row) => [
                  <DataTableRow key={row.id} className="align-top">
                    <DataTableCell>{paper(row)}</DataTableCell>
                    <DataTableCell>
                      <SubmissionDate value={row.paperSubmittedAt} />
                    </DataTableCell>
                    <DataTableCell>{statusBadge(row)}</DataTableCell>
                    <DataTableCell>{documentLine(row)}</DataTableCell>
                    <DataTableCell className="text-right">{detailsToggle(row)}</DataTableCell>
                  </DataTableRow>,
                  expanded.has(row.id) ? (
                    <tr
                      key={`${row.id}:detail`}
                      id={`verification-details-${row.id}`}
                      data-verification={row.id}
                    >
                      <td colSpan={5} className="border-t border-slate-100 bg-slate-50 px-6 py-5">
                        {details(row)}
                      </td>
                    </tr>
                  ) : null,
                ])}
              </DataTableBody>
            </DataTable>
          ) : (
            <div className="space-y-3">
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">{paper(row)}</div>
                      <div className="shrink-0">{statusBadge(row)}</div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Submitted <SubmissionDate value={row.paperSubmittedAt} />
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="min-w-0">{documentLine(row)}</div>
                      {detailsToggle(row)}
                    </div>
                    {expanded.has(row.id) ? (
                      <div
                        id={`verification-details-${row.id}`}
                        data-verification={row.id}
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
        </>
      )}
    </div>
  );
}
