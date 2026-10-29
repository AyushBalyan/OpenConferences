'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPaper, fetchPaperReviews, fetchRebuttal } from '@/lib/api-client';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { RECOMMENDATION_OPTIONS, recommendationLabel, type ReviewDto } from '@/lib/review-types';

function reviewerLabel(index: number) {
  return `R${index + 1}`;
}

function ConsensusSpectrum({ reviews }: { reviews: ReviewDto[] }) {
  const submitted = reviews.filter((review) => review.submittedAt);
  const recommendations = RECOMMENDATION_OPTIONS.map((option) => ({
    ...option,
    count: submitted.filter((review) => review.recommendation === option.value).length,
  })).filter((option) => option.count > 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Reviewer recommendations</h3>
      <p className="mt-2 text-sm text-slate-900">
        {recommendations.length
          ? recommendations.map((option) => `${option.count} ${option.label}`).join(' · ')
          : 'No submitted recommendations yet'}
      </p>
      <p className="mt-2 text-xs text-slate-600">
        Submitted reviews only. The committee makes the final decision.
      </p>
    </div>
  );
}

function ScoreMatrix({ reviews }: { reviews: ReviewDto[] }) {
  const criteria = [...new Set(reviews.flatMap((review) => Object.keys(review.scores)))];
  if (criteria.length === 0) return null;
  const max = Math.max(5, ...reviews.flatMap((review) => Object.values(review.scores)));

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-600">
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
                          className="h-full rounded-full bg-slate-700"
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

function ReviewCard({
  review,
  index,
  showIdentity,
}: {
  review: ReviewDto;
  index: number;
  showIdentity: boolean;
}) {
  const identity = showIdentity
    ? review.reviewerName?.trim() || review.reviewerEmail?.trim()
    : null;
  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {reviewerLabel(index)}
        </span>
        <p className="min-w-0 break-words font-semibold text-slate-900">
          {identity || `Reviewer ${index + 1}`}
        </p>
        {review.recommendation ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
            {recommendationLabel(review.recommendation)}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          {review.confidence ? (
            <span className="flex items-center gap-1" title={`Confidence ${review.confidence}/5`}>
              Confidence {review.confidence}/5
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
        <span className="text-xs text-slate-600 underline">Review details</span>
      </summary>
      <div className="space-y-4 px-5 py-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-600">
            Visible to authors when reviews are released
          </h4>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
            {review.commentsToAuthors || (
              <span className="italic text-slate-400">No comments recorded.</span>
            )}
          </p>
        </div>
        {review.commentsToChairs ? (
          <div className="rounded-lg border-l-4 border-slate-400 bg-slate-100 px-4 py-3">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
                <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm-1.5 5V4a1.5 1.5 0 0 1 3 0v2h-3Z" />
              </svg>
              Committee only
            </h4>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-900">
              {review.commentsToChairs}
            </p>
          </div>
        ) : null}
      </div>
    </details>
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
  const { conference } = useConferenceWorkspace();
  const showIdentity =
    conference?.myRoles.some((role) => ['CHAIR', 'ORGANIZER', 'PLATFORM_ADMIN'].includes(role)) ??
    false;
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
          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium">Criterion scores</summary>
            <div className="mt-3">
              <ScoreMatrix reviews={reviews.filter((review) => review.submittedAt)} />
            </div>
          </details>
          {reviews.map((review, index) => (
            <ReviewCard key={review.id} review={review} index={index} showIdentity={showIdentity} />
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
