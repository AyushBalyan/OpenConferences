'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import { PdfUploadField } from '@/components/dashboard/pdf-upload-field';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchConference,
  fetchPaper,
  fetchPaperDecision,
  fetchPaperReviews,
  fetchRebuttal,
  submitPaper,
  submitRebuttal,
  uploadCameraReadyPdf,
  uploadPaperPdf,
} from '@/lib/api-client';
import {
  decisionOutcomeLabel,
  recommendationLabel,
  roundStatusLabel,
  type DecisionDto,
  type DecisionOutcome,
  type ReviewDto,
} from '@/lib/review-types';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import { scanStatusLabel } from '@/lib/submission-types';
import { RegistrationCard } from '@/components/billing/registration-card';
import type { PaperDto } from '@/lib/submission-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type ScanStatus = 'PENDING_SCAN' | 'CLEAN' | 'INFECTED';

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const scroller = target.closest('main');
  if (!(scroller instanceof HTMLElement)) return;

  // Only adjust the dashboard <main> scroller. scrollIntoView also moves the window
  // and breaks the fixed shell layout.
  const targetTop = target.getBoundingClientRect().top;
  const scrollerTop = scroller.getBoundingClientRect().top;
  scroller.scrollTo({
    top: scroller.scrollTop + (targetTop - scrollerTop) - 16,
    behavior: 'smooth',
  });
}

function scanTone(status: ScanStatus | undefined) {
  if (status === 'CLEAN') return 'success' as const;
  if (status === 'PENDING_SCAN') return 'pending' as const;
  if (status === 'INFECTED') return 'danger' as const;
  return 'neutral' as const;
}

function decisionTone(outcome: DecisionOutcome) {
  if (outcome === 'ACCEPT') return 'success' as const;
  if (outcome === 'REJECT') return 'danger' as const;
  return 'pending' as const;
}

function resolveNextAction(input: {
  paper: PaperDto;
  scanStatus?: ScanStatus;
  canSubmit: boolean;
  canRebut: boolean;
  canUploadCameraReady: boolean;
  cameraReadyComplete: boolean;
  isAccepted: boolean;
  cameraReadyDeadlinePassed: boolean;
}): { title: string; detail: string; cta?: string } | null {
  const {
    paper,
    scanStatus,
    canSubmit,
    canRebut,
    canUploadCameraReady,
    cameraReadyComplete,
    isAccepted,
    cameraReadyDeadlinePassed,
  } = input;

  if (paper.status === 'DRAFT') {
    if (!paper.currentVersionId) {
      return {
        title: 'Upload your manuscript',
        detail: 'Add a PDF, wait for the security scan, then submit while the CFP is open.',
        cta: 'Upload PDF',
      };
    }
    if (scanStatus === 'PENDING_SCAN') {
      return {
        title: 'Security scan in progress',
        detail: 'Refresh shortly. You can submit once the scan reports clean.',
      };
    }
    if (scanStatus === 'INFECTED') {
      return {
        title: 'Replace the manuscript PDF',
        detail: 'The uploaded file failed security scanning. Choose a different PDF.',
        cta: 'Replace PDF',
      };
    }
    if (canSubmit) {
      return {
        title: 'Ready to submit',
        detail: 'Your PDF is clean. Submit to enter the review pipeline.',
        cta: 'Submit paper',
      };
    }
  }

  if (canRebut) {
    return {
      title: 'Rebuttal window is open',
      detail: 'Respond to the released reviews before the chairs move to decisions.',
      cta: 'Write rebuttal',
    };
  }

  if (isAccepted && !cameraReadyComplete) {
    if (cameraReadyDeadlinePassed) {
      return {
        title: 'Camera-ready deadline passed',
        detail: 'Contact the organizers if you still need to upload a final PDF.',
      };
    }
    if (canUploadCameraReady) {
      return {
        title: 'Upload camera-ready PDF',
        detail: 'Your paper was accepted. Complete registration and upload the final manuscript.',
        cta: 'Upload camera-ready',
      };
    }
  }

  return null;
}

export default function SubmissionDetailPage() {
  return <SubmissionDetail />;
}

function SubmissionDetail() {
  const params = useParams<{ id: string; paperId: string }>();
  const conferenceId = params.id;
  const paperId = params.paperId;

  const [paper, setPaper] = useState<PaperDto | null>(null);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [roundStatus, setRoundStatus] = useState<string | undefined>();
  const [rebuttalBody, setRebuttalBody] = useState('');
  const [rebuttalVersion, setRebuttalVersion] = useState(0);
  const [hasRebuttal, setHasRebuttal] = useState(false);
  const [decision, setDecision] = useState<DecisionDto | null>(null);
  const [cameraReadyDueAt, setCameraReadyDueAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [cameraReadyFile, setCameraReadyFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const submission = await fetchPaper(conferenceId, paperId);
    setPaper(submission);

    try {
      const reviewData = await fetchPaperReviews(conferenceId, paperId);
      setReviews(reviewData.data);
      setRoundStatus(reviewData.roundStatus);
    } catch {
      setReviews([]);
      setRoundStatus(undefined);
    }

    try {
      const rebuttal = await fetchRebuttal(conferenceId, paperId);
      if (rebuttal) {
        setRebuttalBody(rebuttal.body);
        setRebuttalVersion(rebuttal.version);
        setHasRebuttal(true);
      } else {
        setHasRebuttal(false);
      }
    } catch {
      setRebuttalBody('');
      setRebuttalVersion(0);
      setHasRebuttal(false);
    }

    try {
      const paperDecision = await fetchPaperDecision(conferenceId, paperId);
      setDecision(paperDecision);
    } catch {
      setDecision(null);
    }

    try {
      const conference = await fetchConference(conferenceId);
      setCameraReadyDueAt(conference.cameraReadyDueAt ?? null);
    } catch {
      setCameraReadyDueAt(null);
    }

    setError(null);
  }, [conferenceId, paperId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  async function onSubmit() {
    if (!paper) return;
    setBusy(true);
    setActionError(null);
    try {
      await submitPaper(conferenceId, paperId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  async function onUploadDraft() {
    if (!draftFile || !paper) return;
    setBusy(true);
    setActionError(null);
    try {
      await uploadPaperPdf(conferenceId, paperId, draftFile);
      setDraftFile(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onUploadCameraReady() {
    if (!cameraReadyFile || !paper) return;
    setBusy(true);
    setActionError(null);
    try {
      await uploadCameraReadyPdf(conferenceId, paperId, cameraReadyFile);
      setCameraReadyFile(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Camera-ready upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitRebuttal() {
    if (!rebuttalBody.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await submitRebuttal(conferenceId, paperId, {
        body: rebuttalBody,
        version: rebuttalVersion,
      });
      setRebuttalBody(result.rebuttal.body);
      setRebuttalVersion(result.rebuttal.version);
      setHasRebuttal(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rebuttal failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-9 w-2/3 max-w-xl" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-20 w-full rounded-md" />
        <Skeleton className="h-40 w-full rounded-md" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  if (error && !paper) {
    return (
      <div className="space-y-4">
        <PageHeader title="Submission" description="Unable to load this paper." />
        <div
          className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          {error}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true);
            load()
              .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
              .finally(() => setLoading(false));
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!paper) {
    return null;
  }

  const scanStatus =
    paper.currentVersion?.kind === 'CAMERA_READY'
      ? undefined
      : paper.currentVersion?.fileAsset?.scanStatus;
  const cameraReadyScanStatus = paper.cameraReadyVersion?.fileAsset?.scanStatus;
  const canSubmit =
    paper.status === 'DRAFT' && Boolean(paper.currentVersionId) && scanStatus === 'CLEAN';
  const canRebut = roundStatus === 'REBUTTAL' && reviews.length > 0;
  const isAccepted = decision?.outcome === 'ACCEPT';
  const cameraReadyDeadlinePassed =
    cameraReadyDueAt !== null && new Date(cameraReadyDueAt) < new Date();
  const canUploadCameraReady =
    isAccepted &&
    !cameraReadyDeadlinePassed &&
    (paper.status === 'DECISION_MADE' || paper.status === 'CAMERA_READY');
  const cameraReadyComplete = paper.status === 'CAMERA_READY' && cameraReadyScanStatus === 'CLEAN';
  const manuscriptFilename = paper.currentVersion?.fileAsset?.originalFilename;
  const cameraReadyFilename = paper.cameraReadyVersion?.fileAsset?.originalFilename;

  const nextAction = resolveNextAction({
    paper,
    scanStatus,
    canSubmit,
    canRebut,
    canUploadCameraReady,
    cameraReadyComplete,
    isAccepted,
    cameraReadyDeadlinePassed,
  });

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <PageHeader
        title={paper.title}
        description="Author submission workspace"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/conferences/${conferenceId}/submissions`}>
                All submissions
              </Link>
            </Button>
            {canSubmit ? (
              <Button size="sm" disabled={busy} onClick={() => void onSubmit()}>
                Submit paper
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 pb-4">
        <WorkflowBadge
          label={paperStatusLabel(paper.status)}
          tone={paperStatusTone(paper.status)}
        />
        {scanStatus ? (
          <span className="inline-flex items-center gap-2 text-sm text-slate-600">
            Manuscript
            <WorkflowBadge label={scanStatusLabel(scanStatus)} tone={scanTone(scanStatus)} />
          </span>
        ) : null}
        {roundStatus ? (
          <span className="font-mono text-xs text-slate-500">
            Round · {roundStatusLabel(roundStatus as 'REBUTTAL')}
          </span>
        ) : null}
        <span className="font-mono text-xs text-slate-400" title={paper.id}>
          ID {paper.id.slice(0, 8)}
        </span>
      </div>

      {actionError ? (
        <div
          className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      {nextAction ? (
        <section
          className="rounded-md border border-slate-200 bg-white px-4 py-4 sm:px-5"
          aria-labelledby="next-action-title"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p id="next-action-title" className="text-sm font-semibold text-slate-900">
                {nextAction.title}
              </p>
              <p className="max-w-2xl text-sm text-slate-600">{nextAction.detail}</p>
            </div>
            {nextAction.cta === 'Submit paper' ? (
              <Button disabled={busy} onClick={() => void onSubmit()}>
                Submit paper
              </Button>
            ) : nextAction.cta === 'Write rebuttal' ? (
              <Button type="button" variant="outline" onClick={() => scrollToSection('rebuttal')}>
                Write rebuttal
              </Button>
            ) : nextAction.cta === 'Upload camera-ready' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => scrollToSection('camera-ready')}
              >
                Upload camera-ready
              </Button>
            ) : nextAction.cta === 'Upload PDF' || nextAction.cta === 'Replace PDF' ? (
              <Button type="button" variant="outline" onClick={() => scrollToSection('manuscript')}>
                {nextAction.cta}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Card className="min-w-0 border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Abstract</CardTitle>
          </CardHeader>
          <CardContent className="max-w-prose text-sm leading-relaxed text-slate-700">
            {paper.abstract}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            {paper.keywords.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {paper.keywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No keywords provided.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-200 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Authors</CardTitle>
          <CardDescription>
            {paper.authorships?.length ?? 0} author
            {(paper.authorships?.length ?? 0) === 1 ? '' : 's'} on this submission
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paper.authorships && paper.authorships.length > 0 ? (
            <ul className="divide-y divide-slate-100 border border-slate-200">
              {paper.authorships.map((author, index) => (
                <li
                  key={author.id}
                  className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <div>
                    <span className="font-mono text-xs text-slate-400">{index + 1}.</span>{' '}
                    <span className="font-medium text-slate-900">{author.fullName}</span>
                    {author.isCorresponding ? (
                      <WorkflowBadge label="Corresponding" tone="info" className="ml-2" />
                    ) : null}
                  </div>
                  <div className="min-w-0 text-slate-600 sm:text-right">
                    <p className="break-all">{author.email}</p>
                    {author.affiliation ? (
                      <p className="break-words text-xs text-slate-500">{author.affiliation}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No authorships recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card id="manuscript" className="border-slate-200 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Manuscript</CardTitle>
          <CardDescription>
            {manuscriptFilename
              ? `${manuscriptFilename}${scanStatus ? ` · ${scanStatusLabel(scanStatus)}` : ''}`
              : 'No version uploaded yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paper.status === 'DRAFT' ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">
                {paper.currentVersionId ? 'Replace PDF' : 'Upload PDF'}
              </p>
              <PdfUploadField file={draftFile} onFileChange={setDraftFile} disabled={busy} />
              <Button disabled={busy || !draftFile} onClick={() => void onUploadDraft()}>
                {busy && draftFile ? 'Uploading…' : 'Upload PDF'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              The manuscript is locked after submission. Contact the organizers if a correction is
              required.
            </p>
          )}

          {scanStatus === 'PENDING_SCAN' ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Scan in progress — refresh shortly before submitting.
            </p>
          ) : null}

          {scanStatus === 'INFECTED' ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              The uploaded file failed security scanning. Please upload a different PDF.
            </p>
          ) : null}

          {canSubmit ? (
            <Button onClick={() => void onSubmit()} disabled={busy}>
              Submit paper
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {reviews.length > 0 ? (
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Released reviews</CardTitle>
            <CardDescription>
              Reviewer identities are hidden
              {roundStatus ? ` · ${roundStatusLabel(roundStatus as 'REBUTTAL')}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-slate-100 border border-slate-200">
            {reviews.map((review, index) => (
              <article key={review.id} className="space-y-2 px-3 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    Reviewer {index + 1}
                    {review.recommendation
                      ? ` · ${recommendationLabel(review.recommendation)}`
                      : ''}
                  </p>
                  {review.confidence ? (
                    <p className="font-mono text-xs text-slate-500">
                      Confidence {review.confidence}/5
                    </p>
                  ) : null}
                </div>
                <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {review.commentsToAuthors || 'No comments to authors were provided.'}
                </p>
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canRebut ? (
        <Card id="rebuttal" className="border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rebuttal</CardTitle>
            <CardDescription>
              Respond to the released reviews before the decision phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rebuttal">Your response</Label>
              <Textarea
                id="rebuttal"
                value={rebuttalBody}
                disabled={busy}
                onChange={(e) => setRebuttalBody(e.target.value)}
                placeholder="Address reviewer comments and clarify any misunderstandings."
                className="min-h-36"
              />
            </div>
            <Button onClick={() => void onSubmitRebuttal()} disabled={busy || !rebuttalBody.trim()}>
              {hasRebuttal ? 'Update rebuttal' : 'Submit rebuttal'}
            </Button>
          </CardContent>
        </Card>
      ) : hasRebuttal && rebuttalBody ? (
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your rebuttal</CardTitle>
            <CardDescription>Submitted response on record for this review cycle.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {rebuttalBody}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {decision ? (
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Editorial decision</CardTitle>
              <WorkflowBadge
                label={decisionOutcomeLabel(decision.outcome)}
                tone={decisionTone(decision.outcome)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {decision.rationale ? (
              <p className="max-w-prose whitespace-pre-wrap leading-relaxed text-slate-700">
                {decision.rationale}
              </p>
            ) : (
              <p className="text-slate-500">No additional rationale was provided.</p>
            )}
            {decision.outcome === 'ACCEPT' ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                Your paper was accepted. Upload your camera-ready PDF and complete registration
                before the deadlines.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isAccepted ? <RegistrationCard conferenceId={conferenceId} paperId={paperId} /> : null}

      {isAccepted ? (
        <Card id="camera-ready" className="border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Camera-ready submission</CardTitle>
            <CardDescription>
              {cameraReadyComplete
                ? 'Your camera-ready PDF has been accepted.'
                : cameraReadyFilename
                  ? `${cameraReadyFilename}${
                      cameraReadyScanStatus ? ` · ${scanStatusLabel(cameraReadyScanStatus)}` : ''
                    }`
                  : 'Upload your final publishable PDF.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cameraReadyDueAt ? (
              <p className="font-mono text-xs text-slate-500">
                Deadline {new Date(cameraReadyDueAt).toLocaleString()}
                {cameraReadyDeadlinePassed ? ' · passed' : ''}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Camera-ready deadline has not been configured yet.
              </p>
            )}

            {canUploadCameraReady ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-900">
                  {paper.cameraReadyVersion
                    ? 'Replace camera-ready PDF'
                    : 'Upload camera-ready PDF'}
                </p>
                <PdfUploadField
                  file={cameraReadyFile}
                  onFileChange={setCameraReadyFile}
                  disabled={busy}
                />
                <Button
                  disabled={busy || !cameraReadyFile}
                  onClick={() => void onUploadCameraReady()}
                >
                  {busy && cameraReadyFile ? 'Uploading…' : 'Upload camera-ready PDF'}
                </Button>
              </div>
            ) : null}

            {cameraReadyScanStatus === 'PENDING_SCAN' ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Scan in progress — refresh shortly.
              </p>
            ) : null}

            {cameraReadyScanStatus === 'INFECTED' ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                The uploaded file failed security scanning. Please upload a different PDF.
              </p>
            ) : null}

            {cameraReadyDeadlinePassed && !cameraReadyComplete ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                The camera-ready deadline has passed. Contact the organizers if you need assistance.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
