'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fetchAssignmentReview, fetchRebuttal, saveReview, submitReview } from '@/lib/api-client';
import {
  RECOMMENDATION_OPTIONS,
  recommendationLabel,
  type Recommendation,
  type ReviewDto,
} from '@/lib/review-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const SCORE_KEYS = ['originality', 'clarity', 'significance'] as const;

export default function ReviewEditorPage() {
  return <ReviewEditor />;
}

function ReviewEditor() {
  const params = useParams<{ id: string; assignmentId: string }>();
  const conferenceId = params.id;
  const assignmentId = params.assignmentId;

  const [review, setReview] = useState<ReviewDto | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | ''>('');
  const [confidence, setConfidence] = useState<number | ''>('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [commentsToAuthors, setCommentsToAuthors] = useState('');
  const [commentsToChairs, setCommentsToChairs] = useState('');
  const [rebuttalBody, setRebuttalBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'conflict'>('idle');
  const [busy, setBusy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(0);

  const applyReview = useCallback((data: ReviewDto) => {
    setReview(data);
    versionRef.current = data.version;
    setRecommendation(data.recommendation ?? '');
    setConfidence(data.confidence ?? '');
    setScores(data.scores ?? {});
    setCommentsToAuthors(data.commentsToAuthors ?? '');
    setCommentsToChairs(data.commentsToChairs ?? '');
    setIsDirty(false);
  }, []);

  const load = useCallback(async () => {
    const data = await fetchAssignmentReview(conferenceId, assignmentId);
    applyReview(data);

    if (data.submittedAt && data.paperId) {
      try {
        const rebuttal = await fetchRebuttal(conferenceId, data.paperId, data.roundId);
        setRebuttalBody(rebuttal?.body ?? null);
      } catch {
        setRebuttalBody(null);
      }
    }

    setError(null);
  }, [applyReview, assignmentId, conferenceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  const persist = useCallback(async () => {
    setSaveState('saving');
    try {
      const saved = await saveReview(conferenceId, assignmentId, {
        scores,
        recommendation: recommendation || null,
        confidence: confidence === '' ? null : confidence,
        commentsToAuthors: commentsToAuthors || null,
        commentsToChairs: commentsToChairs || null,
        version: versionRef.current,
      });
      applyReview(saved);
      setSaveState('saved');
      setIsDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      if ((err as Error & { status?: number }).status === 409) {
        setSaveState('conflict');
        setError('This review was updated elsewhere. Reload to continue.');
      } else {
        setSaveState('idle');
        setError(message);
      }
    }
  }, [
    applyReview,
    assignmentId,
    commentsToAuthors,
    commentsToChairs,
    conferenceId,
    confidence,
    recommendation,
    scores,
  ]);

  useEffect(() => {
    if (!review || saveState === 'conflict' || !isDirty) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist().catch(() => undefined);
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    commentsToAuthors,
    commentsToChairs,
    confidence,
    persist,
    recommendation,
    review,
    saveState,
    scores,
    isDirty,
  ]);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await persist();
      const result = await submitReview(conferenceId, assignmentId, {
        version: versionRef.current,
      });
      applyReview(result.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleReload() {
    setSaveState('idle');
    setError(null);
    await load();
  }

  function updateScore(key: string, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }));
    setSaveState('idle');
    setIsDirty(true);
  }

  if (error && !review) {
    return (
      <div className="">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!review) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  const submitted = Boolean(review.submittedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review editor"
        description={`${submitted ? 'Submitted' : 'Draft'} · ${
          saveState === 'saving'
            ? 'Saving…'
            : saveState === 'saved'
              ? 'Saved'
              : saveState === 'conflict'
                ? 'Conflict'
                : 'Autosave enabled'
        }`}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {saveState === 'conflict' ? (
        <Button variant="outline" onClick={handleReload}>
          Reload review
        </Button>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Scores</CardTitle>
          <CardDescription>Rate each dimension from 1 (low) to 5 (high).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {SCORE_KEYS.map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key} className="capitalize">
                {key}
              </Label>
              <select
                id={key}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={scores[key] ?? ''}
                disabled={saveState === 'conflict'}
                onChange={(e) => updateScore(key, Number(e.target.value))}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={recommendation}
            disabled={saveState === 'conflict'}
            onChange={(e) => {
              setRecommendation(e.target.value as Recommendation | '');
              setSaveState('idle');
              setIsDirty(true);
            }}
          >
            <option value="">Select recommendation</option>
            {RECOMMENDATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            <Label htmlFor="confidence">Confidence (1–5)</Label>
            <select
              id="confidence"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={confidence}
              disabled={saveState === 'conflict'}
              onChange={(e) => {
                setConfidence(e.target.value === '' ? '' : Number(e.target.value));
                setSaveState('idle');
                setIsDirty(true);
              }}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {recommendation ? (
            <p className="text-sm text-muted-foreground">
              Current: {recommendationLabel(recommendation)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments to authors</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={commentsToAuthors}
            disabled={saveState === 'conflict'}
            onChange={(e) => {
              setCommentsToAuthors(e.target.value);
              setSaveState('idle');
              setIsDirty(true);
            }}
            placeholder="Constructive feedback visible to authors when reviews are released."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confidential comments to chairs</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={commentsToChairs}
            disabled={saveState === 'conflict'}
            onChange={(e) => {
              setCommentsToChairs(e.target.value);
              setSaveState('idle');
              setIsDirty(true);
            }}
            placeholder="Visible only to chairs and organizers."
          />
        </CardContent>
      </Card>

      {rebuttalBody ? (
        <Card>
          <CardHeader>
            <CardTitle>Author rebuttal</CardTitle>
            <CardDescription>Read-only response from the corresponding author.</CardDescription>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
            {rebuttalBody}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={busy || saveState === 'conflict'}>
          {submitted ? 'Update submission' : 'Submit review'}
        </Button>
      </div>
    </div>
  );
}
