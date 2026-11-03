'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { releaseReviews } from '@/lib/api-client';
import { DecisionConfirmation } from './decision-confirmation';
import { useDecisionsWorkspace } from './decisions-workspace';

export function ReviewReleaseControl({ cycleId }: { cycleId: string }) {
  const { conferenceId, reviewReleaseByCycle, busy, setBusy, setError, setMessage, refresh } =
    useDecisionsWorkspace();
  const [confirming, setConfirming] = useState(false);
  const row = reviewReleaseByCycle.get(cycleId);

  async function release() {
    if (!row || row.cycleVersion == null) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await releaseReviews(conferenceId, row.paperId, cycleId, {
        version: row.cycleVersion,
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
        <DecisionConfirmation
          title="Release reviews to authors?"
          action="Release reviews"
          busy={busy}
          onConfirm={() => void release()}
          onCancel={() => setConfirming(false)}
        >
          <p className="font-semibold text-slate-900">
            {row.submissionNumber} · {row.paperTitle}
          </p>
          <p>
            Submitted reviews that are still hidden will become visible to the authors, and
            review-availability emails will be queued. Committee-only comments remain private.
          </p>
        </DecisionConfirmation>
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
