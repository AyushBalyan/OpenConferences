'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  type ReviewDto,
} from '@/lib/review-types';
import { paperStatusLabel, scanStatusLabel } from '@/lib/submission-types';
import { RegistrationCard } from '@/components/billing/registration-card';
import type { PaperDto } from '@/lib/submission-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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
  const [decision, setDecision] = useState<DecisionDto | null>(null);
  const [cameraReadyDueAt, setCameraReadyDueAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      }
    } catch {
      setRebuttalBody('');
      setRebuttalVersion(0);
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
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
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

  async function onReupload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !paper) return;
    setBusy(true);
    setActionError(null);
    try {
      await uploadPaperPdf(conferenceId, paperId, file);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onCameraReadyUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !paper) return;
    setBusy(true);
    setActionError(null);
    try {
      await uploadCameraReadyPdf(conferenceId, paperId, file);
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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rebuttal failed');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!paper) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  const scanStatus =
    paper.currentVersion?.kind === 'CAMERA_READY'
      ? undefined
      : paper.currentVersion?.fileAsset?.scanStatus;
  const cameraReadyScanStatus = paper.cameraReadyVersion?.fileAsset?.scanStatus;
  const canSubmit = paper.status === 'DRAFT' && paper.currentVersionId && scanStatus === 'CLEAN';
  const canRebut = roundStatus === 'REBUTTAL' && reviews.length > 0;
  const isAccepted = decision?.outcome === 'ACCEPT';
  const cameraReadyDeadlinePassed =
    cameraReadyDueAt !== null && new Date(cameraReadyDueAt) < new Date();
  const canUploadCameraReady =
    isAccepted &&
    !cameraReadyDeadlinePassed &&
    (paper.status === 'DECISION_MADE' || paper.status === 'CAMERA_READY');
  const cameraReadyComplete = paper.status === 'CAMERA_READY' && cameraReadyScanStatus === 'CLEAN';

  return (
    <div className="space-y-6">
      <PageHeader title={paper.title} description={paperStatusLabel(paper.status)} />

      <Card>
        <CardHeader>
          <CardTitle>Abstract</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed">{paper.abstract}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {paper.authorships?.map((author) => (
            <div key={author.id}>
              <span className="font-medium">{author.fullName}</span>
              {author.isCorresponding ? ' (corresponding)' : ''} — {author.email}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manuscript</CardTitle>
          <CardDescription>
            {scanStatus ? scanStatusLabel(scanStatus) : 'No version uploaded yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paper.status === 'DRAFT' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="reupload">
                {paper.currentVersionId ? 'Replace PDF' : 'Upload PDF'}
              </label>
              <input
                id="reupload"
                type="file"
                accept="application/pdf,.pdf"
                onChange={onReupload}
                disabled={busy}
              />
            </div>
          ) : null}

          {scanStatus === 'PENDING_SCAN' ? (
            <p className="text-sm text-amber-700">Scan in progress — refresh shortly.</p>
          ) : null}

          {scanStatus === 'INFECTED' ? (
            <p className="text-sm text-destructive">
              The uploaded file failed security scanning. Please upload a different PDF.
            </p>
          ) : null}

          {canSubmit ? (
            <Button onClick={onSubmit} disabled={busy}>
              Submit paper
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {reviews.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Released reviews</CardTitle>
            <CardDescription>
              Reviewer identities are hidden.{' '}
              {roundStatus ? roundStatusLabel(roundStatus as 'REBUTTAL') : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {reviews.map((review) => (
              <div key={review.id} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-medium">
                  Recommendation: {recommendationLabel(review.recommendation)}
                </p>
                {review.confidence ? (
                  <p className="text-sm text-muted-foreground">Confidence: {review.confidence}/5</p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {review.commentsToAuthors}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canRebut ? (
        <Card>
          <CardHeader>
            <CardTitle>Rebuttal</CardTitle>
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
              />
            </div>
            <Button onClick={onSubmitRebuttal} disabled={busy || !rebuttalBody.trim()}>
              Submit rebuttal
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {decision ? (
        <Card>
          <CardHeader>
            <CardTitle>Editorial decision</CardTitle>
            <CardDescription>{decisionOutcomeLabel(decision.outcome)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {decision.rationale ? (
              <p className="whitespace-pre-wrap leading-relaxed">{decision.rationale}</p>
            ) : (
              <p className="text-muted-foreground">No additional rationale was provided.</p>
            )}
            {decision.outcome === 'ACCEPT' ? (
              <p className="text-muted-foreground">
                Your paper was accepted. Upload your camera-ready PDF and complete registration
                before the deadlines.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isAccepted ? <RegistrationCard conferenceId={conferenceId} paperId={paperId} /> : null}

      {isAccepted ? (
        <Card>
          <CardHeader>
            <CardTitle>Camera-ready submission</CardTitle>
            <CardDescription>
              {cameraReadyComplete
                ? 'Your camera-ready PDF has been accepted.'
                : cameraReadyScanStatus
                  ? scanStatusLabel(cameraReadyScanStatus)
                  : 'Upload your final publishable PDF.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cameraReadyDueAt ? (
              <p className="text-sm text-muted-foreground">
                Deadline: {new Date(cameraReadyDueAt).toLocaleString()}
                {cameraReadyDeadlinePassed ? ' (passed)' : ''}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Camera-ready deadline has not been configured yet.
              </p>
            )}

            {canUploadCameraReady ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="camera-ready-upload">
                  {paper.cameraReadyVersion
                    ? 'Replace camera-ready PDF'
                    : 'Upload camera-ready PDF'}
                </label>
                <input
                  id="camera-ready-upload"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onCameraReadyUpload}
                  disabled={busy}
                />
              </div>
            ) : null}

            {cameraReadyScanStatus === 'PENDING_SCAN' ? (
              <p className="text-sm text-amber-700">Scan in progress — refresh shortly.</p>
            ) : null}

            {cameraReadyScanStatus === 'INFECTED' ? (
              <p className="text-sm text-destructive">
                The uploaded file failed security scanning. Please upload a different PDF.
              </p>
            ) : null}

            {cameraReadyDeadlinePassed && !cameraReadyComplete ? (
              <p className="text-sm text-destructive">
                The camera-ready deadline has passed. Contact the organizers if you need assistance.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
    </div>
  );
}
