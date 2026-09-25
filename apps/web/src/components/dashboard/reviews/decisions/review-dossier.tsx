'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPaper, fetchPaperReviews, fetchRebuttal } from '@/lib/api-client';
import {
  RECOMMENDATION_OPTIONS,
  recommendationLabel,
  type Recommendation,
  type ReviewDto,
} from '@/lib/review-types';

const SPECTRUM: Recommendation[] = [...RECOMMENDATION_OPTIONS].reverse().map((o) => o.value);

const RECOMMENDATION_TONE: Record<Recommendation, string> = {
  STRONG_REJECT: 'bg-rose-600 text-white',
  REJECT: 'bg-rose-500 text-white',
  WEAK_REJECT: 'bg-rose-100 text-rose-800',
  BORDERLINE: 'bg-amber-100 text-amber-800',
  WEAK_ACCEPT: 'bg-emerald-100 text-emerald-800',
  ACCEPT: 'bg-emerald-500 text-white',
  STRONG_ACCEPT: 'bg-emerald-600 text-white',
};

function reviewerLabel(index: number) {
  return `R${index + 1}`;
}

function ConsensusSpectrum({ reviews }: { reviews: ReviewDto[] }) {
  const placed = reviews
    .map((review, index) => ({
      index,
      position: review.recommendation ? SPECTRUM.indexOf(review.recommendation) : -1,
    }))
    .filter((item) => item.position >= 0);
  const mean =
    placed.length > 0 ? placed.reduce((sum, item) => sum + item.position, 0) / placed.length : null;
  const spread =
    placed.length > 1
      ? Math.max(...placed.map((p) => p.position)) - Math.min(...placed.map((p) => p.position))
      : 0;
  const leaning =
    mean === null
      ? null
      : mean > 3.4
        ? 'Leans accept'
        : mean < 2.6
          ? 'Leans reject'
          : 'Split / borderline';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Reviewer consensus
        </p>
        {leaning ? (
          <p className="text-sm font-medium text-slate-900">
            {leaning}
            {spread >= 3 ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                High disagreement
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-slate-500">No recommendations yet</p>
        )}
      </div>
      <div className="relative mt-6 pb-6">
        <div className="h-2 rounded-full bg-gradient-to-r from-rose-500 via-amber-300 to-emerald-500" />
        {placed.map((item, i) => {
          const stack = placed.slice(0, i).filter((p) => p.position === item.position).length;
          return (
            <span
              key={item.index}
              className="absolute top-1 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-semibold text-white shadow-md transition-all"
              style={{
                left: `${(item.position / (SPECTRUM.length - 1)) * 100}%`,
                marginTop: `${-stack * 22}px`,
              }}
              title={`${reviewerLabel(item.index)}: ${recommendationLabel(SPECTRUM[item.position])}`}
            >
              {reviewerLabel(item.index)}
            </span>
          );
        })}
        <div className="absolute inset-x-0 top-5 flex justify-between text-[11px] text-slate-500">
          <span>Strong reject</span>
          <span>Borderline</span>
          <span>Strong accept</span>
        </div>
      </div>
    </div>
  );
}

function ScoreMatrix({ reviews }: { reviews: ReviewDto[] }) {
  const criteria = [...new Set(reviews.flatMap((review) => Object.keys(review.scores)))];
  if (criteria.length === 0) return null;
  const max = Math.max(5, ...reviews.flatMap((review) => Object.values(review.scores)));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold">Criterion</th>
            {reviews.map((review, index) => (
              <th key={review.id} className="px-3 py-2.5 text-center font-semibold">
                {reviewerLabel(index)}
              </th>
            ))}
            <th className="w-40 px-4 py-2.5 text-left font-semibold">Mean</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {criteria.map((criterion) => {
            const values = reviews
              .map((review) => review.scores[criterion])
              .filter((value): value is number => typeof value === 'number');
            const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
            return (
              <tr key={criterion}>
                <td className="px-4 py-3 font-medium capitalize text-slate-800">{criterion}</td>
                {reviews.map((review) => (
                  <td key={review.id} className="px-3 py-3 text-center tabular-nums text-slate-700">
                    {review.scores[criterion] ?? '—'}
                  </td>
                ))}
                <td className="px-4 py-3">
                  {mean === null ? (
                    '—'
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${(mean / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-semibold tabular-nums text-slate-900">
                        {mean.toFixed(1)}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReviewCard({ review, index }: { review: ReviewDto; index: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {reviewerLabel(index)}
        </span>
        <p className="font-semibold text-slate-900">Reviewer {index + 1}</p>
        {review.recommendation ? (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RECOMMENDATION_TONE[review.recommendation]}`}
          >
            {recommendationLabel(review.recommendation)}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          {review.confidence ? (
            <span className="flex items-center gap-1" title={`Confidence ${review.confidence}/5`}>
              Confidence
              <span className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-1.5 rounded-sm ${i < review.confidence! ? 'bg-slate-700' : 'bg-slate-200'}`}
                  />
                ))}
              </span>
            </span>
          ) : null}
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${review.submittedAt ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'}`}
          >
            {review.submittedAt ? 'Submitted' : 'Draft'}
          </span>
        </div>
      </header>
      <div className="space-y-4 px-5 py-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            To authors
          </h4>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
            {review.commentsToAuthors || (
              <span className="italic text-slate-400">No comments recorded.</span>
            )}
          </p>
        </div>
        {review.commentsToChairs ? (
          <div className="rounded-lg border-l-4 border-violet-400 bg-violet-50 px-4 py-3">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
                <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm-1.5 5V4a1.5 1.5 0 0 1 3 0v2h-3Z" />
              </svg>
              Committee only
            </h4>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-violet-950">
              {review.commentsToChairs}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ReviewDossier({
  conferenceId,
  paperId,
  roundId,
}: {
  conferenceId: string;
  paperId: string;
  roundId: string;
}) {
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [response, setResponse] = useState<string | null>(null);
  const [revisionResponse, setRevisionResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReviews([]);
    setResponse(null);
    setRevisionResponse(null);
    async function load() {
      const rows: ReviewDto[] = [];
      let cursor: string | undefined;
      do {
        const page = await fetchPaperReviews(conferenceId, paperId, roundId, cursor);
        if (cancelled) return;
        rows.push(...page.data);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      const rebuttal = await fetchRebuttal(conferenceId, paperId, roundId);
      const paper = await fetchPaper(conferenceId, paperId).catch(() => null);
      if (!cancelled) {
        setReviews(rows);
        setResponse(rebuttal?.body ?? null);
        const note = paper?.revisionVersion?.note?.trim();
        setRevisionResponse(note ? note : null);
      }
    }
    void load()
      .catch(() => {
        if (!cancelled)
          setError('Could not load the review dossier. Retry before making a decision.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conferenceId, paperId, roundId, attempt]);

  if (loading) {
    return (
      <div role="status" aria-label="Loading reviews and author response" className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
      >
        <p>{error}</p>
        <Button className="mt-3" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  const submitted = reviews.filter((review) => review.submittedAt).length;

  return (
    <section aria-label="Review dossier" className="space-y-4">
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{submitted}</span> of {reviews.length} review
        {reviews.length === 1 ? '' : 's'} submitted
        {submitted < reviews.length ? (
          <span className="ml-2 text-amber-700">· drafts may still change</span>
        ) : null}
      </p>
      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No reviews are available for this paper and round.
        </div>
      ) : (
        <>
          <ConsensusSpectrum reviews={reviews} />
          <ScoreMatrix reviews={reviews} />
          {reviews.map((review, index) => (
            <ReviewCard key={review.id} review={review} index={index} />
          ))}
        </>
      )}
      {revisionResponse ? (
        <article className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Revision response
          </h3>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
            {revisionResponse}
          </p>
        </article>
      ) : null}
      <article className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Author rebuttal
        </h3>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
          {response ?? (
            <span className="italic text-slate-400">
              No response has been submitted for this round.
            </span>
          )}
        </p>
      </article>
    </section>
  );
}
