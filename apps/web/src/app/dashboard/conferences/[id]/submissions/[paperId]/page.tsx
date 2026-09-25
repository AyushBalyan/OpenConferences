'use client';

import Link from 'next/link';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { DownloadPaperButton } from '@/components/dashboard/download-paper-button';
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
  uploadRevisionPdf,
} from '@/lib/api-client';
import {
  decisionOutcomeLabel,
  reviewStageLabel,
  type DecisionDto,
  type DecisionOutcome,
  type ReviewDto,
} from '@/lib/review-types';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import { canDownloadConferencePapers } from '@/lib/roles';
import { canSubmitDraft, latestScanStatus, scanStatusLabel } from '@/lib/submission-types';
import { RegistrationCard } from '@/components/billing/registration-card';
import type { PaperDto } from '@/lib/submission-types';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type ScanStatus = 'PENDING_SCAN' | 'CLEAN' | 'INFECTED';

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

function groupReviewsByCycle(reviews: ReviewDto[]) {
  const groups: { roundId: string; roundNumber: number; reviews: ReviewDto[] }[] = [];
  for (const review of reviews) {
    const roundNumber = review.roundNumber ?? 1;
    const existing = groups.find((group) => group.roundId === review.roundId);
    if (existing) {
      existing.reviews.push(review);
    } else {
      groups.push({ roundId: review.roundId, roundNumber, reviews: [review] });
    }
  }
  return groups.sort((a, b) => a.roundNumber - b.roundNumber);
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
  isRevisionRequested: boolean;
  canUploadRevision: boolean;
  revisionDeadlinePassed: boolean;
  revisionScanStatus?: ScanStatus;
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
    isRevisionRequested,
    canUploadRevision,
    revisionDeadlinePassed,
    revisionScanStatus,
  } = input;

  if (paper.status === 'DRAFT') {
    if (scanStatus === 'PENDING_SCAN') {
      return {
        title: 'Security scan in progress',
        detail: 'Scan status updates automatically. You can submit once the scan reports clean.',
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
    if (!paper.currentVersionId) {
      return {
        title: 'Upload your manuscript',
        detail: 'Add a PDF, wait for the security scan, then submit while the CFP is open.',
        cta: 'Upload PDF',
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

  if (isRevisionRequested) {
    if (revisionDeadlinePassed) {
      return {
        title: 'Revision deadline passed',
        detail: 'Contact the organizers if you still need to upload a revised PDF.',
      };
    }
    if (revisionScanStatus === 'INFECTED') {
      return {
        title: 'Replace the revised PDF',
        detail: 'The uploaded file failed security scanning. Choose a different PDF.',
        cta: 'Upload revised PDF',
      };
    }
    if (canUploadRevision && revisionScanStatus !== 'CLEAN') {
      return {
        title: 'Upload revised PDF',
        detail:
          'Address the reviewer comments and upload a revised manuscript before the deadline.',
        cta: 'Upload revised PDF',
      };
    }
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
  const searchParams = useSearchParams();
  const selectedRound = searchParams.get('round') ?? undefined;
  const router = useRouter();
  const sections = ['overview', 'submission', 'reviews', 'rebuttal', 'final'] as const;
  const selected = searchParams.get('section') ?? 'overview';
  const section = sections.includes(selected as (typeof sections)[number]) ? selected : 'overview';
  const params = useParams<{ id: string; paperId: string }>();
  const { conference } = useConferenceWorkspace();
  const conferenceId = params.id;
  const paperId = params.paperId;
  const canDownloadPapers = canDownloadConferencePapers(conference?.myRoles ?? []);

  const [paper, setPaper] = useState<PaperDto | null>(null);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [reviewStage, setReviewStage] = useState<string | undefined>();
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
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [revisionResponse, setRevisionResponse] = useState('');
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [rebuttalDirty, setRebuttalDirty] = useState(false);
  const rebuttalDirtyRef = useRef(false);
  rebuttalDirtyRef.current = rebuttalDirty;
  const navigateSection = (next: string) => router.push(`?section=${next}`, { scroll: false });

  useEffect(() => {
    const legacySection = {
      '#manuscript': 'submission',
      '#rebuttal': 'rebuttal',
      '#camera-ready': 'final',
    }[window.location.hash];
    if (legacySection && !searchParams.has('section'))
      router.replace(`?section=${legacySection}`, { scroll: false });
  }, [router, searchParams]);

  const load = useCallback(async () => {
    const warnings: string[] = [];
    const submission = await fetchPaper(conferenceId, paperId);
    setPaper(submission);
    setRevisionResponse(submission.revisionVersion?.note ?? '');

    try {
      const reviewData = await fetchPaperReviews(conferenceId, paperId, selectedRound);
      setReviews(reviewData.data);
      setReviewStage(reviewData.reviewStage);
    } catch {
      warnings.push('Reviews could not be loaded.');
      setReviews([]);
      setReviewStage(undefined);
    }

    try {
      const rebuttal = await fetchRebuttal(conferenceId, paperId, selectedRound);
      if (rebuttal && !rebuttalDirtyRef.current) {
        setRebuttalBody(rebuttal.body);
        setRebuttalVersion(rebuttal.version);
        setHasRebuttal(true);
      } else if (!rebuttalDirtyRef.current) {
        setHasRebuttal(false);
      }
    } catch {
      warnings.push('Your rebuttal could not be loaded. Editing is unavailable until it loads.');
      // Keep the local response intact when a refresh fails.
    }

    try {
      const paperDecision = await fetchPaperDecision(conferenceId, paperId);
      setDecision(paperDecision);
    } catch {
      warnings.push('The decision could not be loaded.');
      setDecision(null);
    }

    try {
      const conference = await fetchConference(conferenceId);
      setCameraReadyDueAt(conference.cameraReadyDueAt ?? null);
    } catch {
      warnings.push('Conference deadlines could not be loaded.');
      setCameraReadyDueAt(null);
    }

    setLoadWarnings(warnings);
    setError(null);
  }, [conferenceId, paperId, selectedRound]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!paper || latestScanStatus(paper) !== 'PENDING_SCAN') return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void fetchPaper(conferenceId, paperId)
        .then((next) => {
          if (!cancelled) setPaper(next);
        })
        .catch(() => {
          if (!cancelled) setActionError('Could not refresh scan status. Try refreshing the page.');
        });
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [paper, conferenceId, paperId]);

  useEffect(() => {
    if (!rebuttalDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    const guardLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (link && !window.confirm('Your response has unsaved changes. Leave this page?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', guardLink, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', guardLink, true);
    };
  }, [rebuttalDirty]);

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

  async function onUploadRevision() {
    if (!revisionFile || !paper) return;
    setBusy(true);
    setActionError(null);
    try {
      await uploadRevisionPdf(conferenceId, paperId, revisionFile, revisionResponse);
      setRevisionFile(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Revision upload failed');
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
      setRebuttalDirty(false);
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
    paper.currentVersion?.kind === 'CAMERA_READY' ? undefined : latestScanStatus(paper);
  const cameraReadyScanStatus = paper.cameraReadyVersion?.fileAsset?.scanStatus;
  const canSubmit = canSubmitDraft(paper);
  const canRebut =
    reviewStage === 'FEEDBACK_RELEASED' && reviews.length > 0 && loadWarnings.length === 0;
  const isAccepted = decision?.outcome === 'ACCEPT';
  const isRevisionRequested =
    decision?.outcome === 'MINOR_REVISION' || decision?.outcome === 'MAJOR_REVISION';
  const revisionScanStatus = paper.revisionVersion?.fileAsset?.scanStatus;
  const revisionDeadlinePassed =
    paper.revisionDueAt != null && new Date(paper.revisionDueAt) < new Date();
  const revisionSubmitted =
    isRevisionRequested && paper.latestCycleId != null && decision?.roundId !== paper.latestCycleId;
  const canUploadRevision =
    isRevisionRequested &&
    !revisionSubmitted &&
    !revisionDeadlinePassed &&
    paper.status === 'UNDER_REVIEW';
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
    isRevisionRequested,
    canUploadRevision,
    revisionDeadlinePassed,
    revisionScanStatus,
  });

  const lifecycle = [
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'UNDER_REVIEW', label: 'Under review' },
    { key: 'DECISION_MADE', label: 'Decision' },
    { key: 'CAMERA_READY', label: 'Camera-ready' },
  ] as const;
  const lifecycleIndex =
    paper.status === 'DRAFT'
      ? -1
      : Math.max(
          lifecycle.findIndex((stage) => stage.key === paper.status),
          paper.status.startsWith('WITHDRAWN') ? -1 : 0,
        );
  const withdrawn = paper.status.startsWith('WITHDRAWN');

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <Link
        href={`/dashboard/conferences/${conferenceId}/submissions`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        ← All submissions
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <WorkflowBadge
                label={paperStatusLabel(paper.status)}
                tone={paperStatusTone(paper.status)}
              />
              {scanStatus ? (
                <WorkflowBadge
                  label={`PDF ${scanStatusLabel(scanStatus).toLowerCase()}`}
                  tone={scanTone(scanStatus)}
                />
              ) : null}
              {reviewStage ? (
                <span className="text-xs text-slate-500">
                  {reviewStageLabel(reviewStage as 'FEEDBACK_RELEASED')}
                </span>
              ) : null}
            </div>
            <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 [text-wrap:balance]">
              {paper.title}
            </h1>
            <p className="text-xs text-slate-400" title={paper.id}>
              Submission ID {paper.id.slice(0, 8)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canDownloadPapers ? (
              <DownloadPaperButton conferenceId={conferenceId} paper={paper} />
            ) : null}
            {canSubmit ? (
              <Button size="sm" disabled={busy} onClick={() => void onSubmit()}>
                Submit paper
              </Button>
            ) : null}
          </div>
        </div>

        {!withdrawn ? (
          <ol
            className="grid grid-cols-4 gap-2 border-t border-slate-100 px-6 py-4"
            aria-label="Paper progress"
          >
            {lifecycle.map((stage, index) => {
              const state =
                index < lifecycleIndex ? 'done' : index === lifecycleIndex ? 'current' : 'todo';
              return (
                <li key={stage.key} aria-current={state === 'current' ? 'step' : undefined}>
                  <div
                    className={`h-1 rounded-full ${state === 'todo' ? 'bg-slate-200' : 'bg-indigo-600'}`}
                  />
                  <p
                    className={`mt-2 text-xs font-medium ${state === 'todo' ? 'text-slate-400' : 'text-slate-800'}`}
                  >
                    {stage.label}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : null}

        <nav
          aria-label="Paper sections"
          className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4"
        >
          {sections.map((item) => (
            <button
              key={item}
              type="button"
              aria-current={section === item ? 'page' : undefined}
              onClick={() => navigateSection(item)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${section === item ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {
                {
                  overview: 'Overview',
                  submission: 'Submission',
                  reviews: 'Reviews',
                  rebuttal: 'Rebuttal',
                  final: 'Final materials',
                }[item]
              }
            </button>
          ))}
        </nav>
      </header>

      {loadWarnings.length > 0 ? (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {loadWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={rebuttalDirty || busy}
              onClick={() =>
                void load().catch(() => setActionError('Refresh failed. Please try again.'))
              }
            >
              Retry loading
            </Button>
            {rebuttalDirty ? <span>Save your response before refreshing.</span> : null}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      {section === 'overview' && nextAction ? (
        <section
          className="flex flex-col gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 sm:flex-row sm:items-center sm:justify-between"
          aria-labelledby="next-action-title"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">
              Next step
            </p>
            <p id="next-action-title" className="text-base font-semibold text-slate-900">
              {nextAction.title}
            </p>
            <p className="max-w-2xl text-sm text-slate-600">{nextAction.detail}</p>
          </div>
          {nextAction.cta === 'Submit paper' ? (
            <Button disabled={busy} onClick={() => void onSubmit()}>
              Submit paper
            </Button>
          ) : nextAction.cta === 'Write rebuttal' ? (
            <Button type="button" onClick={() => navigateSection('rebuttal')}>
              Write rebuttal
            </Button>
          ) : nextAction.cta === 'Upload camera-ready' ? (
            <Button type="button" onClick={() => navigateSection('final')}>
              Upload camera-ready
            </Button>
          ) : nextAction.cta === 'Upload revised PDF' ? (
            <Button type="button" onClick={() => navigateSection('submission')}>
              Upload revised PDF
            </Button>
          ) : nextAction.cta === 'Upload PDF' || nextAction.cta === 'Replace PDF' ? (
            <Button type="button" onClick={() => navigateSection('submission')}>
              {nextAction.cta}
            </Button>
          ) : null}
        </section>
      ) : null}

      {section === 'overview' && !nextAction ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600">
          <p className="font-medium text-slate-900">You’re all set for now</p>
          <p className="mt-1">
            No action is needed. Open Reviews to read released feedback, or Submission to view your
            manuscript.
          </p>
        </div>
      ) : null}
      {section === 'submission' ? (
        <>
          <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <Card className="min-w-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Abstract</CardTitle>
              </CardHeader>
              <CardContent className="max-w-prose text-sm leading-relaxed text-slate-700">
                {paper.abstract}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Keywords</CardTitle>
              </CardHeader>
              <CardContent>
                {paper.keywords.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {paper.keywords.map((keyword) => (
                      <li
                        key={keyword}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
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
                  The manuscript is locked after submission. Contact the organizers if a correction
                  is required.
                </p>
              )}

              {scanStatus === 'PENDING_SCAN' ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Scan in progress — this status updates automatically.
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

          {isRevisionRequested ? (
            <Card id="revision" className="border-slate-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Revised manuscript</CardTitle>
                <CardDescription>
                  {paper.revisionVersion?.fileAsset?.originalFilename
                    ? `${paper.revisionVersion.fileAsset.originalFilename}${
                        revisionScanStatus ? ` · ${scanStatusLabel(revisionScanStatus)}` : ''
                      }`
                    : 'Upload the PDF that addresses the reviewer comments.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paper.revisionDueAt ? (
                  <p className="font-mono text-xs text-slate-500">
                    Deadline {new Date(paper.revisionDueAt).toLocaleString()}
                    {revisionDeadlinePassed ? ' · passed' : ''}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    No revision deadline is set. You can upload the revised PDF now.
                  </p>
                )}
                {revisionSubmitted ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    Your revised PDF and response were submitted. The next review cycle is open.
                  </p>
                ) : null}
                {canUploadRevision ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-900">
                      {paper.revisionVersion ? 'Replace revised PDF' : 'Upload revised PDF'}
                    </p>
                    <PdfUploadField
                      file={revisionFile}
                      onFileChange={setRevisionFile}
                      disabled={busy}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="revision-response">Response to reviewers</Label>
                      <Textarea
                        id="revision-response"
                        value={revisionResponse}
                        maxLength={10000}
                        disabled={busy}
                        onChange={(event) => setRevisionResponse(event.target.value)}
                        placeholder="Explain how the revised manuscript addresses the reviews."
                        className="min-h-32"
                      />
                      <p className="text-xs text-slate-500">
                        This response is sent with the revised PDF and is only collected for a
                        revision.
                      </p>
                    </div>
                    <Button
                      disabled={busy || !revisionFile || revisionResponse.trim().length === 0}
                      onClick={() => void onUploadRevision()}
                    >
                      {busy && revisionFile ? 'Uploading…' : 'Upload revised PDF'}
                    </Button>
                  </div>
                ) : paper.revisionVersion?.note ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">Response to reviewers</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {paper.revisionVersion.note}
                    </p>
                  </div>
                ) : null}
                {revisionScanStatus === 'PENDING_SCAN' ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Scan in progress — refresh shortly.
                  </p>
                ) : null}
                {revisionScanStatus === 'INFECTED' ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    The uploaded file failed security scanning. Please upload a different PDF.
                  </p>
                ) : null}
                {revisionDeadlinePassed && revisionScanStatus !== 'CLEAN' ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    The revision deadline has passed. Contact the organizers if you need assistance.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
      {section === 'reviews' && reviews.length === 0 && loadWarnings.length === 0 ? (
        <p>No reviews have been released yet.</p>
      ) : null}
      {section === 'reviews' && reviews.length > 0 ? (
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Released reviews</CardTitle>
            <CardDescription>
              Reviewer identities are hidden
              {reviewStage ? ` · ${reviewStageLabel(reviewStage as 'FEEDBACK_RELEASED')}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {groupReviewsByCycle(reviews).map((cycle) => (
              <section key={cycle.roundId} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Cycle {cycle.roundNumber}</h3>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {cycle.reviews.map((review, index) => (
                    <article key={review.id} className="px-3 py-4">
                      {cycle.reviews.length > 1 ? (
                        <p className="mb-2 text-sm font-medium text-slate-900">
                          Reviewer {index + 1}
                        </p>
                      ) : null}
                      <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {review.commentsToAuthors || 'No comments to authors were provided.'}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {section === 'rebuttal' ? (
        <>
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
                    onChange={(e) => {
                      setRebuttalBody(e.target.value);
                      setRebuttalDirty(true);
                    }}
                    placeholder="Address reviewer comments and clarify any misunderstandings."
                    className="min-h-36"
                  />
                </div>
                <Button
                  onClick={() => void onSubmitRebuttal()}
                  disabled={busy || !rebuttalBody.trim()}
                >
                  {hasRebuttal ? 'Update rebuttal' : 'Submit rebuttal'}
                </Button>
              </CardContent>
            </Card>
          ) : hasRebuttal && rebuttalBody ? (
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your rebuttal</CardTitle>
                <CardDescription>
                  Submitted response on record for this review cycle.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {rebuttalBody}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {!canRebut && !hasRebuttal && loadWarnings.length === 0 ? (
            <p>Rebuttal is not open for this paper.</p>
          ) : null}
        </>
      ) : null}
      {(section === 'overview' || section === 'final') && decision ? (
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
            {isRevisionRequested ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
                Upload a revised PDF before the deadline. The next review cycle opens after the file
                passes scanning.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {section === 'final' && !isAccepted && loadWarnings.length === 0 ? (
        <p>Final materials become available after acceptance.</p>
      ) : null}
      {section === 'final' && isAccepted ? (
        <RegistrationCard conferenceId={conferenceId} paperId={paperId} />
      ) : null}

      {section === 'final' && isAccepted ? (
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
