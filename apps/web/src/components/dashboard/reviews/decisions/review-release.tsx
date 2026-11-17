'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAllPaperReviews, releaseReviews } from '@/lib/api-client';
import { recommendationLabel, type ReviewDto } from '@/lib/review-types';
import { DecisionConfirmation } from './decision-confirmation';
import { useDecisionsWorkspace } from './decisions-workspace';

/** Matches the R1, R2… labels used in the review dossier (all reviews, creation order). */
function reviewerLabel(index: number) {
  return `R${index + 1}`;
}

function isReleasable(review: ReviewDto) {
  return Boolean(review.submittedAt) && review.visibility === 'HIDDEN';
}

function ReviewReleasePicker({
  reviews,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  busy,
}: {
  reviews: ReviewDto[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  busy: boolean;
}) {
  const releasable = reviews.filter(isReleasable);
  return (
    <fieldset className="space-y-2" disabled={busy} aria-label="Reviews to release">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">Reviews to release</p>
        {releasable.length > 1 ? (
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              className="text-slate-700 underline disabled:text-slate-400"
              disabled={selected.size === releasable.length}
              onClick={onSelectAll}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-slate-700 underline disabled:text-slate-400"
              disabled={selected.size === 0}
              onClick={onClear}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {reviews.map((review, index) => {
          const label = reviewerLabel(index);
          const name = review.reviewerName?.trim() || review.reviewerEmail?.trim();
          const releasableReview = isReleasable(review);
          const status = !review.submittedAt
            ? 'Not submitted'
            : review.visibility === 'AUTHOR_VISIBLE'
              ? 'Released'
              : null;
          return (
            <li key={review.id}>
              <label
                className={`flex items-center gap-3 px-3 py-2.5 ${releasableReview ? 'cursor-pointer' : 'opacity-70'}`}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-slate-900"
                  checked={releasableReview ? selected.has(review.id) : status === 'Released'}
                  disabled={!releasableReview}
                  onChange={() => onToggle(review.id)}
                  aria-label={`Release ${label}${name ? ` (${name})` : ''}`}
                />
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                  {label}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-900">
                  {name || `Reviewer ${index + 1}`}
                </span>
                {review.recommendation ? (
                  <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 sm:inline">
                    {recommendationLabel(review.recommendation)}
                  </span>
                ) : null}
                {status ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${status === 'Released' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}
                  >
                    {status}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-500">
        {selected.size} of {releasable.length} unreleased submitted review
        {releasable.length === 1 ? '' : 's'} selected. Unselected reviews stay hidden and can be
        released later.
      </p>
    </fieldset>
  );
}

/**
 * Confirmation dialog that lets a chair or organiser pick which hidden submitted
 * reviews (R1, R2, …) to release. The parent performs the release request.
 */
export function ReviewReleaseDialog({
  conferenceId,
  paperId,
  cycleId,
  heading,
  busy,
  onRelease,
  onCancel,
}: {
  conferenceId: string;
  paperId: string;
  cycleId: string;
  heading: string;
  busy: boolean;
  onRelease: (reviewIds: string[]) => void;
  onCancel: () => void;
}) {
  const [reviews, setReviews] = useState<ReviewDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setReviews(null);
    setLoadError(null);
    fetchAllPaperReviews(conferenceId, paperId, cycleId)
      .then((result) => {
        if (cancelled) return;
        setReviews(result.data);
        setSelected(new Set(result.data.filter(isReleasable).map((review) => review.id)));
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load the reviews for this paper.');
      });
    return () => {
      cancelled = true;
    };
  }, [conferenceId, paperId, cycleId, attempt]);

  const releasable = useMemo(() => reviews?.filter(isReleasable) ?? [], [reviews]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const partial = selected.size > 0 && selected.size < releasable.length;
  const action = partial
    ? `Release ${selected.size} review${selected.size === 1 ? '' : 's'}`
    : 'Release reviews';

  return (
    <DecisionConfirmation
      title="Release reviews to authors?"
      action={action}
      busy={busy}
      confirmDisabled={!reviews || selected.size === 0}
      onConfirm={() =>
        onRelease(releasable.filter((review) => selected.has(review.id)).map((r) => r.id))
      }
      onCancel={onCancel}
    >
      <p className="font-semibold text-slate-900">{heading}</p>
      {loadError ? (
        <div role="alert" className="rounded-md bg-rose-50 p-3 text-rose-800">
          <p>{loadError}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      ) : !reviews ? (
        <div role="status" aria-label="Loading reviews" className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : releasable.length === 0 ? (
        <p>No submitted reviews are waiting to be released.</p>
      ) : (
        <ReviewReleasePicker
          reviews={reviews}
          selected={selected}
          onToggle={toggle}
          onSelectAll={() => setSelected(new Set(releasable.map((review) => review.id)))}
          onClear={() => setSelected(new Set())}
          busy={busy}
        />
      )}
      <p>
        Selected reviews will become visible to the authors, and review-availability emails will be
        queued. Committee-only comments remain private.
      </p>
    </DecisionConfirmation>
  );
}

export function ReviewReleaseControl({ cycleId }: { cycleId: string }) {
  const { conferenceId, reviewReleaseByCycle, busy, setBusy, setError, setMessage, refresh } =
    useDecisionsWorkspace();
  const [confirming, setConfirming] = useState(false);
  const row = reviewReleaseByCycle.get(cycleId);

  async function release(reviewIds: string[]) {
    if (!row || row.cycleVersion == null || reviewIds.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await releaseReviews(conferenceId, row.paperId, cycleId, {
        version: row.cycleVersion,
        reviewIds,
      });
      setConfirming(false);
      setMessage(result.message);
      await refresh().catch(() =>
        setError(
          'Reviews released, but the status could not refresh. Refresh the page before making another change.',
        ),
      );
    } catch (error) {
      setConfirming(false);
      setError(
        error instanceof Error
          ? error.message
          : 'Could not release reviews. Refresh and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <p className="text-slate-600">
        {!row
          ? 'Review release status unavailable'
          : row.canReleaseReviews
            ? row.reviewsReleasedAt
              ? 'Some submitted reviews are not released'
              : 'Reviews not released to authors'
            : row.reviewsReleasedAt
              ? 'Reviews released to authors'
              : 'No submitted reviews to release'}
      </p>
      {row?.canReleaseReviews && row.cycleVersion != null ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(true)}>
          Release reviews
        </Button>
      ) : null}
      {confirming && row ? (
        <ReviewReleaseDialog
          conferenceId={conferenceId}
          paperId={row.paperId}
          cycleId={cycleId}
          heading={`${row.submissionNumber ?? ''} · ${row.paperTitle}`}
          busy={busy}
          onRelease={(reviewIds) => void release(reviewIds)}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}

export function ReviewReleaseWarning({ cycleIds }: { cycleIds: (string | null)[] }) {
  const { reviewReleaseByCycle } = useDecisionsWorkspace();
  const rows = [...new Set(cycleIds)].map((id) => (id ? reviewReleaseByCycle.get(id) : undefined));
  const unknown = rows.some((row) => !row);
  const unreleased = rows.filter((row): row is NonNullable<typeof row> =>
    Boolean(row && (row.canReleaseReviews || !row.reviewsReleasedAt)),
  );
  if (!unknown && unreleased.length === 0) return null;
  return (
    <div role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">
        {unreleased.length
          ? 'Reviews have not been fully released to authors.'
          : 'Review release status could not be verified.'}
      </p>
      <p className="mt-1">
        You can continue, but recording or sending a decision does not release reviews. Authors can
        only read feedback that has been released. Use Release reviews to share submitted feedback.
      </p>
      {unreleased.length > 1 ? (
        <ul className="mt-2 list-disc pl-5">
          {unreleased.map((row) => (
            <li key={row.cycleId}>{row.submissionNumber ?? row.paperTitle}</li>
          ))}
        </ul>
      ) : null}
      {unknown && unreleased.length > 0 ? (
        <p className="mt-1">Release status is also unavailable for some selected papers.</p>
      ) : null}
    </div>
  );
}
