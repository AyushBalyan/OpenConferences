'use client';

import { CalendarDays, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { uploadRevisionPdf } from '@/lib/api-client';
import type { DecisionDto } from '@/lib/review-types';
import type { PaperDto } from '@/lib/submission-types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PdfUploadField } from './pdf-upload-field';

export function RevisionSubmission({
  conferenceId,
  paper,
  decision,
  submitted,
  canUpload,
  onRefresh,
  onReadReviews,
}: {
  conferenceId: string;
  paper: PaperDto;
  decision: DecisionDto;
  submitted: boolean;
  canUpload: boolean;
  onRefresh: () => Promise<void>;
  onReadReviews: () => void;
}) {
  const currentRevision =
    paper.revisionVersion &&
    (submitted || new Date(paper.revisionVersion.createdAt) >= new Date(decision.createdAt))
      ? paper.revisionVersion
      : null;
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState(currentRevision?.note ?? '');
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'scanning'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const scanStatus = currentRevision?.fileAsset?.scanStatus;
  const scanning = phase === 'scanning' || (!submitted && scanStatus === 'PENDING_SCAN');
  const busy = phase !== 'idle';
  const deadlinePassed = Boolean(paper.revisionDueAt && new Date(paper.revisionDueAt) < new Date());

  async function onUpload() {
    if (!file || !response.trim() || busy) return;
    setPhase('uploading');
    setError(null);
    setUploadedFilename(null);
    try {
      await uploadRevisionPdf(conferenceId, paper.id, file, response, () => {
        setUploadedFilename(file.name);
        setFile(null);
        setPhase('scanning');
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Revision upload failed. Please try again.',
      );
    } finally {
      try {
        await onRefresh();
      } catch {
        setError(
          'Could not refresh the submission. Refresh this page to check your upload before trying again.',
        );
      }
      setPhase('idle');
    }
  }

  return (
    <section
      id="revision"
      aria-labelledby="revision-title"
      className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="space-y-2 border-b border-slate-200 p-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="revision-title" className="text-xl font-semibold tracking-tight text-slate-900">
            {submitted
              ? 'Revision submitted'
              : scanning
                ? 'Checking your revised manuscript'
                : 'Submit your revised manuscript'}
          </h2>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${submitted ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
          >
            {submitted
              ? 'In review'
              : decision.outcome === 'MAJOR_REVISION'
                ? 'Major revision requested'
                : 'Minor revision requested'}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          {submitted
            ? 'Your revised PDF and response have been submitted for review.'
            : 'Address the reviewer feedback, then upload your revised PDF and response together.'}
        </p>
        {!submitted && paper.revisionDueAt ? (
          <p
            className={`flex items-center gap-2 text-sm font-medium tabular-nums ${deadlinePassed ? 'text-rose-800' : 'text-slate-700'}`}
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            Due{' '}
            {new Date(paper.revisionDueAt).toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
            })}
            {deadlinePassed ? ' · passed' : ''}
          </p>
        ) : null}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5 p-5 sm:p-6">
          {submitted || scanning || currentRevision || uploadedFilename ? (
            <div role="status" className="flex items-start gap-3 border-b border-slate-200 pb-5">
              {submitted ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
              ) : scanning ? (
                <Loader2
                  className="mt-0.5 h-5 w-5 shrink-0 text-slate-600 motion-safe:animate-spin"
                  aria-hidden
                />
              ) : (
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              )}
              <div className="min-w-0 space-y-1">
                <p className="break-words text-base font-medium text-slate-900">
                  {uploadedFilename ??
                    currentRevision?.fileAsset?.originalFilename ??
                    'Revised manuscript'}
                </p>
                <p className="text-sm leading-relaxed text-slate-600">
                  {submitted
                    ? 'Your revision has been submitted for review.'
                    : scanning
                      ? 'Your PDF was uploaded. We’re checking the file; this updates automatically.'
                      : scanStatus === 'INFECTED'
                        ? 'This PDF could not be processed. Choose a different PDF and try again.'
                        : 'Revised PDF uploaded.'}
                </p>
              </div>
            </div>
          ) : null}
          {error && !submitted ? (
            <p
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {error}
            </p>
          ) : null}
          {canUpload && !scanning ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void onUpload();
              }}
              aria-busy={busy}
            >
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  {currentRevision ? 'Replace revised PDF' : 'Revised manuscript PDF'}
                </p>
                <PdfUploadField
                  compact
                  file={file}
                  onFileChange={(next) => {
                    setFile(next);
                    setError(null);
                  }}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revision-response">
                  Response to reviewers{' '}
                  <span className="font-normal text-slate-500">(required)</span>
                </Label>
                <Textarea
                  id="revision-response"
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  disabled={busy}
                  required
                  maxLength={10000}
                  placeholder="Describe the changes you made and how they address the reviewer comments."
                  className="min-h-24 text-base sm:text-sm"
                  aria-describedby="revision-response-hint"
                />
                <p id="revision-response-hint" className="text-xs leading-relaxed text-slate-600">
                  Your response is sent with the PDF. Both are required to submit this revision.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
                <Button
                  type="submit"
                  disabled={busy || !file || !response.trim()}
                  className="bg-slate-900 shadow-none hover:translate-y-0 hover:bg-slate-800"
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden />
                  ) : null}
                  {phase === 'uploading'
                    ? 'Uploading revision…'
                    : currentRevision
                      ? 'Replace revised PDF and response'
                      : 'Submit revised PDF and response'}
                </Button>
              </div>
            </form>
          ) : submitted && currentRevision?.note ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-900">Your response to reviewers</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {currentRevision.note}
              </p>
            </div>
          ) : null}
          {scanning ? (
            <p role="status" className="text-sm leading-relaxed text-slate-600">
              No further action is needed right now. You can return to this page to check progress.
            </p>
          ) : null}
          {deadlinePassed && !submitted && !scanning ? (
            <p className="text-sm leading-relaxed text-rose-800">
              The revision deadline has passed. Contact the organizers to request an extension.
            </p>
          ) : null}
        </div>
        <aside className="space-y-5 border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div>
            <h3 className="text-sm font-medium text-slate-900">Editorial request</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {decision.rationale ||
                'Revise the manuscript to address the released reviewer feedback.'}
            </p>
            <button
              type="button"
              onClick={onReadReviews}
              className="mt-3 text-sm font-medium text-slate-900 underline underline-offset-4 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              Read reviewer feedback
            </button>
          </div>
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-medium text-slate-900">
              {submitted ? 'What happens next' : 'Before you submit'}
            </h3>
            {submitted ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                The committee will review your updated manuscript. Follow the Reviews tab for
                released feedback.
              </p>
            ) : (
              <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600">
                <li>Update your manuscript using the reviewer feedback.</li>
                <li>Choose the revised PDF, up to 50 MB.</li>
                <li>Explain your changes in the response field.</li>
              </ul>
            )}
          </div>
          {!paper.revisionDueAt && !submitted ? (
            <p className="border-t border-slate-200 pt-5 text-sm leading-relaxed text-slate-600">
              No revision deadline is set. You can submit your revision now.
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
