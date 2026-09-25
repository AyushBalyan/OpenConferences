'use client';

import { Button } from '@/components/ui/button';

import { Textarea } from '@/components/ui/textarea';
import {
  downloadPaperVersion,
  fetchAssignmentReview,
  fetchRebuttal,
  saveReview,
  submitReview,
} from '@/lib/api-client';
import { RECOMMENDATION_OPTIONS, type Recommendation, type ReviewDto } from '@/lib/review-types';
import { Download } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const SCORE_KEYS = ['originality', 'clarity', 'significance'] as const;
const AUTOSAVE_MS = 800;

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'failed';

type DraftSnapshot = {
  scores: Record<string, number>;
  recommendation: Recommendation | '';
  confidence: number | '';
  commentsToAuthors: string;
  commentsToChairs: string;
};

type ReviewEditorPanelProps = {
  conferenceId: string;
  assignmentId: string;
};

function isVersionConflict(err: unknown): boolean {
  if (!(err instanceof Error) || (err as Error & { status?: number }).status !== 409) {
    return false;
  }
  return (err as Error & { code?: string }).code === 'REVIEW_VERSION_CONFLICT';
}

export function ReviewEditorPanel({ conferenceId, assignmentId }: ReviewEditorPanelProps) {
  const searchParams = useSearchParams();
  const [review, setReview] = useState<ReviewDto | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | ''>('');
  const [confidence, setConfidence] = useState<number | ''>('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [commentsToAuthors, setCommentsToAuthors] = useState('');
  const [commentsToChairs, setCommentsToChairs] = useState('');
  const [rebuttalBody, setRebuttalBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [section, setSection] = useState<'review' | 'response'>(
    searchParams.get('section') === 'response' ? 'response' : 'review',
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rebuttalError, setRebuttalError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(0);
  const dirtyEpochRef = useRef(0);
  const saveQueuedRef = useRef(false);
  const flushPromiseRef = useRef<Promise<boolean> | null>(null);
  const saveStateRef = useRef<SaveState>('idle');
  const formRef = useRef<DraftSnapshot>({
    scores: {},
    recommendation: '',
    confidence: '',
    commentsToAuthors: '',
    commentsToChairs: '',
  });

  formRef.current = {
    scores,
    recommendation,
    confidence,
    commentsToAuthors,
    commentsToChairs,
  };

  const setSaveStateSafe = useCallback((next: SaveState) => {
    saveStateRef.current = next;
    setSaveState(next);
  }, []);

  const applyReview = useCallback((data: ReviewDto) => {
    setReview(data);
    versionRef.current = data.version;
    setRecommendation(data.recommendation ?? '');
    setConfidence(data.confidence ?? '');
    setScores(data.scores ?? {});
    setCommentsToAuthors(data.commentsToAuthors ?? '');
    setCommentsToChairs(data.commentsToChairs ?? '');
    dirtyEpochRef.current = 0;
    setIsDirty(false);
  }, []);

  const applyServerMetadata = useCallback((saved: ReviewDto) => {
    versionRef.current = saved.version;
    setReview((prev) => ({
      ...(prev ?? saved),
      id: saved.id,
      version: saved.version,
      updatedAt: saved.updatedAt,
      submittedAt: saved.submittedAt,
      visibility: saved.visibility,
      paperTitle: saved.paperTitle ?? prev?.paperTitle,
      currentVersionId: saved.currentVersionId ?? prev?.currentVersionId,
    }));
  }, []);

  const load = useCallback(async () => {
    const data = await fetchAssignmentReview(conferenceId, assignmentId);
    applyReview(data);

    if (data.submittedAt && data.paperId) {
      try {
        const rebuttal = await fetchRebuttal(conferenceId, data.paperId, data.roundId);
        setRebuttalBody(rebuttal?.body ?? null);
      } catch {
        setRebuttalError(
          'The author response could not be loaded. Refresh the response to try again.',
        );
      }
    }

    setError(null);
  }, [applyReview, assignmentId, conferenceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  const markDirty = useCallback(() => {
    dirtyEpochRef.current += 1;
    setIsDirty(true);
    if (saveStateRef.current !== 'conflict' && saveStateRef.current !== 'failed') {
      setSaveStateSafe('idle');
    }
  }, [setSaveStateSafe]);

  const persistOnce = useCallback(
    async (epochAtStart: number, draft: DraftSnapshot) => {
      const body = {
        scores: draft.scores,
        recommendation: draft.recommendation || null,
        confidence: draft.confidence === '' ? null : draft.confidence,
        commentsToAuthors: draft.commentsToAuthors || null,
        commentsToChairs: draft.commentsToChairs || null,
        version: versionRef.current,
      };

      try {
        const saved = await saveReview(conferenceId, assignmentId, body);
        applyServerMetadata(saved);

        if (dirtyEpochRef.current === epochAtStart) {
          setIsDirty(false);
          setSaveStateSafe('saved');
        }
        return true;
      } catch (err) {
        if (
          err instanceof Error &&
          (err as Error & { code?: string }).code === 'REVIEW_PHASE_LOCKED'
        ) {
          setReview((previous) =>
            previous ? { ...previous, canEdit: false, editLockReason: err.message } : previous,
          );
          setSaveStateSafe('failed');
          setError(err.message);
          return false;
        }
        if (isVersionConflict(err)) {
          setSaveStateSafe('conflict');
          setError('This review was updated elsewhere. Reload to continue.');
          return false;
        }

        setSaveStateSafe('failed');
        setError(err instanceof Error ? err.message : 'Save failed');
        return false;
      }
    },
    [applyServerMetadata, assignmentId, conferenceId, setSaveStateSafe],
  );

  const flushSaves = useCallback(async (): Promise<boolean> => {
    if (saveStateRef.current === 'conflict') return false;

    saveQueuedRef.current = true;
    if (flushPromiseRef.current) {
      return flushPromiseRef.current;
    }

    flushPromiseRef.current = (async () => {
      let ok = true;
      while (saveQueuedRef.current && saveStateRef.current !== 'conflict') {
        saveQueuedRef.current = false;
        setSaveStateSafe('saving');
        setError(null);

        const epochAtStart = dirtyEpochRef.current;
        const draft = { ...formRef.current, scores: { ...formRef.current.scores } };
        ok = await persistOnce(epochAtStart, draft);

        if (!ok) break;

        if (dirtyEpochRef.current !== epochAtStart) {
          saveQueuedRef.current = true;
        }
      }
      return ok && saveStateRef.current !== 'conflict';
    })().finally(() => {
      flushPromiseRef.current = null;
    });

    return flushPromiseRef.current;
  }, [persistOnce, setSaveStateSafe]);

  useEffect(() => {
    if (!review || review.canEdit === false || saveState !== 'idle' || !isDirty) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void flushSaves();
    }, AUTOSAVE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    flushSaves,
    isDirty,
    review,
    saveState,
    scores,
    recommendation,
    confidence,
    commentsToAuthors,
    commentsToChairs,
  ]);

  async function handleSubmit() {
    if (review?.canEdit === false || saveState === 'failed' || saveState === 'conflict') return;
    setBusy(true);
    setError(null);
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }

      const saved = await flushSaves();
      if (!saved || saveStateRef.current === 'conflict') {
        return;
      }

      const result = await submitReview(conferenceId, assignmentId, {
        version: versionRef.current,
      });
      applyReview({
        ...result.review,
        canEdit: false,
        editLockReason: 'Review submitted. Refresh to check whether further edits are allowed.',
      });
      setSaveStateSafe('saved');
      try {
        const latest = await fetchAssignmentReview(conferenceId, assignmentId);
        applyReview(latest);
      } catch {
        setError(
          'Your review was submitted, but its latest permissions could not be loaded. Refresh before editing again.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const guardLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (link && !window.confirm('Your review has unsaved changes. Leave this page?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardLink, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', guardLink, true);
    };
  }, [isDirty]);

  async function handleReload() {
    if (
      isDirty &&
      !window.confirm(
        'Discard your unsaved changes and load the saved review? Copy your text first if you need to keep it.',
      )
    )
      return;
    setSaveStateSafe('idle');
    setError(null);
    try {
      await load();
    } catch (err) {
      setSaveStateSafe('failed');
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reload the review. Your draft is still here.',
      );
    }
  }

  async function handleDownloadPaper() {
    if (!review?.paperId || !review.currentVersionId) {
      setError('No clean paper PDF is available for download yet.');
      return;
    }

    setDownloadBusy(true);
    setError(null);
    try {
      const { downloadUrl } = await downloadPaperVersion(
        conferenceId,
        review.paperId,
        review.currentVersionId,
      );
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadBusy(false);
    }
  }

  async function previewPaper() {
    if (!review?.paperId || !review.currentVersionId) return;
    setDownloadBusy(true);
    try {
      const result = await downloadPaperVersion(
        conferenceId,
        review.paperId,
        review.currentVersionId,
        'inline',
      );
      setPdfUrl(result.downloadUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not open the PDF preview. Try downloading the paper.',
      );
    } finally {
      setDownloadBusy(false);
    }
  }

  async function refreshResponse() {
    if (!review) return;
    try {
      const response = await fetchRebuttal(conferenceId, review.paperId, review.roundId);
      setRebuttalBody(response?.body ?? null);
      setRebuttalError(null);
    } catch {
      setRebuttalError('Could not load the author response. Please try again.');
    }
  }

  function updateScore(key: string, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }

  const autoPreviewRef = useRef(false);
  useEffect(() => {
    if (!review?.currentVersionId || autoPreviewRef.current) return;
    autoPreviewRef.current = true;
    void previewPaper();
  }, [review?.currentVersionId]);

  if (error && !review) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"
      >
        {error}
      </div>
    );
  }

  if (!review) {
    return (
      <div
        role="status"
        aria-label="Loading review"
        className="grid gap-6 xl:grid-cols-[1.1fr_1fr]"
      >
        <div className="h-[75vh] animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-56 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      </div>
    );
  }

  const submitted = Boolean(review.submittedAt);
  const canDownload = Boolean(review.currentVersionId);
  const readOnly = review.canEdit === false || busy || saveState === 'conflict';

  const checklist = [
    {
      label: 'Scores',
      done: SCORE_KEYS.every((key) => typeof scores[key] === 'number' && scores[key]! > 0),
    },
    { label: 'Recommendation', done: Boolean(recommendation) },
    { label: 'Confidence', done: confidence !== '' },
    { label: 'Comments', done: commentsToAuthors.trim().length > 0 },
  ];
  const saveIndicator =
    saveState === 'saving'
      ? { text: 'Saving…', dot: 'bg-amber-400 animate-pulse' }
      : saveState === 'saved'
        ? { text: 'All changes saved', dot: 'bg-emerald-500' }
        : saveState === 'conflict'
          ? { text: 'Edit conflict', dot: 'bg-rose-500' }
          : saveState === 'failed'
            ? { text: 'Not saved', dot: 'bg-rose-500' }
            : isDirty
              ? { text: 'Unsaved changes', dot: 'bg-slate-400' }
              : { text: 'Autosave on', dot: 'bg-slate-300' };

  return (
    <div className="space-y-6 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
            <span className="text-indigo-600">Your review</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] tracking-wider ${submitted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
            >
              {submitted ? 'Submitted' : 'Draft'}
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 [text-wrap:balance]">
            {review.paperTitle ?? 'Assigned manuscript'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
            <span className={`size-2 rounded-full ${saveIndicator.dot}`} />
            {saveIndicator.text}
          </span>
          <div
            role="tablist"
            aria-label="Review workspace"
            className="flex rounded-xl bg-slate-100 p-1"
          >
            {(
              [
                ['review', 'Paper & review'],
                ['response', 'Author response'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={section === value}
                onClick={() => {
                  setSection(value);
                  if (value === 'response') void refreshResponse();
                }}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${section === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {review.canEdit === false ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-4 shrink-0 text-slate-500"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm-1.5 5V4a1.5 1.5 0 0 1 3 0v2h-3Z" />
          </svg>
          {review.editLockReason ?? 'This review is currently read-only.'}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="flex-1">{error} Your unsaved text remains on this page.</span>
          {saveState === 'failed' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSaveStateSafe('idle');
                void flushSaves();
              }}
              disabled={review.canEdit === false || busy}
            >
              Retry saving
            </Button>
          ) : null}
          {saveState === 'conflict' ? (
            <Button size="sm" variant="outline" onClick={() => void handleReload()}>
              Reload review
            </Button>
          ) : null}
        </div>
      ) : null}

      {section === 'review' ? (
        <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
          <section
            aria-label="Manuscript preview"
            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white xl:sticky xl:top-4"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Manuscript
              </p>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canDownload || downloadBusy}
                  onClick={() => void previewPaper()}
                >
                  {pdfUrl ? 'Reload' : 'Open preview'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canDownload || downloadBusy}
                  onClick={() => void handleDownloadPaper()}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {downloadBusy ? 'Preparing…' : 'Download'}
                </Button>
              </div>
            </div>
            {pdfUrl ? (
              <iframe
                title="Assigned paper PDF"
                src={pdfUrl}
                className="h-[calc(100vh-12rem)] min-h-[32rem] w-full bg-slate-800"
              />
            ) : (
              <div className="flex h-[28rem] flex-col items-center justify-center gap-2 bg-slate-50 px-8 text-center text-sm text-slate-500">
                {canDownload
                  ? downloadBusy
                    ? 'Loading manuscript…'
                    : 'Open the preview to read alongside your review, or download the paper.'
                  : 'The paper PDF is not ready yet (missing or still being scanned).'}
              </div>
            )}
          </section>

          <div className="min-w-0 space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Scores</h2>
                <span className="text-xs text-slate-400">1 low · 5 high</span>
              </div>
              <div className="mt-4 space-y-3">
                {SCORE_KEYS.map((key) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span
                      id={`score-${key}`}
                      className="text-sm font-medium capitalize text-slate-700"
                    >
                      {key}
                    </span>
                    <div role="radiogroup" aria-labelledby={`score-${key}`} className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const active = scores[key] === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={readOnly}
                            onClick={() => updateScore(key, n)}
                            className={`size-9 rounded-lg border text-sm font-semibold tabular-nums transition-all disabled:cursor-not-allowed ${active ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' : 'border-slate-200 bg-white text-slate-600 enabled:hover:border-indigo-300 enabled:hover:text-indigo-700'} ${readOnly && !active ? 'opacity-50' : ''}`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 id="rec-label" className="text-sm font-semibold text-slate-900">
                Recommendation
              </h2>
              <div
                role="radiogroup"
                aria-labelledby="rec-label"
                className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
              >
                {RECOMMENDATION_OPTIONS.map((opt) => {
                  const active = recommendation === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={readOnly}
                      onClick={() => {
                        setRecommendation(opt.value);
                        markDirty();
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-sm transition-colors disabled:cursor-not-allowed ${active ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-900' : 'border-slate-200 bg-white text-slate-600 enabled:hover:border-slate-300 enabled:hover:text-slate-900'} ${readOnly && !active ? 'opacity-50' : ''}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                <span id="confidence-label" className="text-sm font-medium text-slate-700">
                  Confidence
                </span>
                <div role="radiogroup" aria-labelledby="confidence-label" className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = confidence === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`Confidence ${n} of 5`}
                        disabled={readOnly}
                        onClick={() => {
                          setConfidence(n);
                          markDirty();
                        }}
                        className={`size-9 rounded-lg border text-sm font-semibold tabular-nums transition-colors disabled:cursor-not-allowed ${active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 enabled:hover:border-indigo-300 enabled:hover:text-indigo-700'} ${readOnly && !active ? 'opacity-50' : ''}`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="comments-authors" className="text-sm font-semibold text-slate-900">
                  Comments to authors
                </label>
                <span className="text-xs tabular-nums text-slate-400">
                  {commentsToAuthors.length.toLocaleString()} chars
                </span>
              </div>
              <Textarea
                id="comments-authors"
                className="mt-3 min-h-[10rem] resize-y text-[15px] leading-relaxed"
                value={commentsToAuthors}
                disabled={readOnly}
                onChange={(e) => {
                  setCommentsToAuthors(e.target.value);
                  markDirty();
                }}
                placeholder="Strengths, weaknesses, and concrete suggestions. Visible to authors when reviews are released."
              />
            </section>

            <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
              <label
                htmlFor="comments-chairs"
                className="flex items-center gap-1.5 text-sm font-semibold text-violet-900"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
                  <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm-1.5 5V4a1.5 1.5 0 0 1 3 0v2h-3Z" />
                </svg>
                Confidential to chairs
              </label>
              <p className="mt-0.5 text-xs text-violet-700/80">Never shown to authors.</p>
              <Textarea
                id="comments-chairs"
                className="mt-3 min-h-[6rem] resize-y border-violet-200 bg-white text-sm"
                value={commentsToChairs}
                disabled={readOnly}
                onChange={(e) => {
                  setCommentsToChairs(e.target.value);
                  markDirty();
                }}
                placeholder="Concerns about ethics, originality, or anything the committee should weigh."
              />
            </section>
          </div>
        </div>
      ) : (
        <section aria-label="Author response" className="mx-auto max-w-3xl">
          {rebuttalError ? (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {rebuttalError}
            </p>
          ) : null}
          {rebuttalBody ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Author rebuttal
              </p>
              <div className="mt-4 whitespace-pre-wrap break-words font-serif text-[17px] leading-8 text-slate-800">
                {rebuttalBody}
              </div>
            </article>
          ) : !rebuttalError ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
              <p className="font-medium text-slate-900">No author response yet</p>
              <p className="mt-1 text-sm text-slate-500">
                {submitted
                  ? 'Authors haven’t submitted a rebuttal for this round.'
                  : 'The author response becomes available after you submit your review.'}
              </p>
            </div>
          ) : null}
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={() => void refreshResponse()}>
              Check for updates
            </Button>
          </div>
        </section>
      )}

      {section === 'review' ? (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white/95 py-2.5 pl-5 pr-2.5 shadow-xl shadow-slate-900/10 backdrop-blur">
            <ul className="flex items-center gap-3 text-xs">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center gap-1.5 ${item.done ? 'text-slate-700' : 'text-slate-400'}`}
                >
                  <span
                    className={`flex size-4 items-center justify-center rounded-full text-[10px] ${item.done ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}
                    aria-hidden
                  >
                    {item.done ? '✓' : ''}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
            <span className="h-5 w-px bg-slate-200" />
            <Button
              onClick={() => void handleSubmit()}
              disabled={readOnly || saveState === 'failed'}
            >
              {busy ? 'Submitting…' : submitted ? 'Update submission' : 'Submit review'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
