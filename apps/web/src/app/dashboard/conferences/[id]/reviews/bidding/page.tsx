'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { fetchPaperPool, upsertBid } from '@/lib/api-client';
import { BID_OPTIONS, bidValueLabel, type BlindedPaperPoolItemDto } from '@/lib/review-types';
import { canCoordinateReview, isReviewer } from '@/lib/roles';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function ReviewBiddingPage() {
  return <ReviewBidding />;
}

function ReviewBidding() {
  const { conferenceId, conference } = useConferenceWorkspace();
  const roles = conference?.myRoles ?? [];
  const oversight = canCoordinateReview(roles);
  const canBid = isReviewer(roles);

  const [papers, setPapers] = useState<BlindedPaperPoolItemDto[]>([]);
  const [poolMode, setPoolMode] = useState<'reviewer' | 'oversight'>(
    oversight ? 'oversight' : 'reviewer',
  );
  const [blindingMode, setBlindingMode] = useState<'SINGLE' | 'DOUBLE' | 'OPEN'>('DOUBLE');
  const [error, setError] = useState<string | null>(null);
  const [busyPaperId, setBusyPaperId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const pool = await fetchPaperPool(conferenceId);
    setPapers(pool.data);
    setPoolMode(pool.mode ?? (oversight ? 'oversight' : 'reviewer'));
    setBlindingMode(pool.blindingMode ?? conference?.blindingMode ?? 'DOUBLE');
    setError(null);
  }, [conference?.blindingMode, conferenceId, oversight]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  const oversightBidRows = useMemo(
    () =>
      papers.flatMap((paper) =>
        (paper.bids ?? []).map((bid) => ({
          ...bid,
          paperId: paper.id,
          paperTitle: paper.title,
          authors: paper.authorships?.map((a) => a.fullName).join(', ') ?? '—',
        })),
      ),
    [papers],
  );

  async function handleBid(paperId: string, value: (typeof BID_OPTIONS)[number]['value']) {
    setBusyPaperId(paperId);
    setError(null);
    try {
      await upsertBid(conferenceId, paperId, value);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bid');
    } finally {
      setBusyPaperId(null);
    }
  }

  const assignmentsHref = `/dashboard/conferences/${conferenceId}/reviews/assignments/bids`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={poolMode === 'oversight' ? 'Bidding oversight' : 'Paper pool & bidding'}
        description={
          poolMode === 'oversight'
            ? 'Review submitted papers and reviewer bids before making assignments.'
            : `Blinding mode: ${blindingMode}${blindingMode === 'DOUBLE' ? ' (author identities hidden)' : ''}`
        }
        actions={
          poolMode === 'oversight' ? (
            <Button asChild variant="outline" size="sm">
              <Link href={assignmentsHref}>Reviewer bids</Link>
            </Button>
          ) : undefined
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {papers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {poolMode === 'oversight'
              ? 'No submitted papers are available for bidding yet.'
              : 'No papers available for bidding.'}
          </CardContent>
        </Card>
      ) : poolMode === 'oversight' ? (
        oversightBidRows.length === 0 ? (
          <DataTable
            footer={
              <DataTableFooter>
                {papers.length} paper{papers.length === 1 ? '' : 's'} · no bids yet
              </DataTableFooter>
            }
          >
            <DataTableHeader>
              <tr>
                <DataTableHead>Title</DataTableHead>
                <DataTableHead>Authors</DataTableHead>
                <DataTableHead>Bids</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {papers.map((paper) => (
                <DataTableRow key={paper.id}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{paper.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{paper.abstract}</p>
                  </DataTableCell>
                  <DataTableCell className="text-sm text-slate-600">
                    {paper.authorships?.map((a) => a.fullName).join(', ') ?? '—'}
                  </DataTableCell>
                  <DataTableCell className="text-sm text-slate-400">No bids yet</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        ) : (
          <DataTable
            footer={
              <DataTableFooter>
                {oversightBidRows.length} bid{oversightBidRows.length === 1 ? '' : 's'} across{' '}
                {papers.length} paper{papers.length === 1 ? '' : 's'}
              </DataTableFooter>
            }
          >
            <DataTableHeader>
              <tr>
                <DataTableHead>Paper</DataTableHead>
                <DataTableHead>Authors</DataTableHead>
                <DataTableHead>Reviewer</DataTableHead>
                <DataTableHead>Email</DataTableHead>
                <DataTableHead>Bid</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {oversightBidRows.map((bid) => (
                <DataTableRow key={`${bid.paperId}:${bid.reviewerUserId}`}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{bid.paperTitle}</p>
                  </DataTableCell>
                  <DataTableCell className="text-sm text-slate-600">{bid.authors}</DataTableCell>
                  <DataTableCell>{bid.reviewerName}</DataTableCell>
                  <DataTableCell className="text-slate-500">{bid.reviewerEmail}</DataTableCell>
                  <DataTableCell>
                    <WorkflowBadge label={bidValueLabel(bid.value)} tone="neutral" />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {papers.length} paper{papers.length === 1 ? '' : 's'} in pool
            </DataTableFooter>
          }
        >
          <DataTableHeader>
            <tr>
              <DataTableHead>Title</DataTableHead>
              <DataTableHead>Authors</DataTableHead>
              <DataTableHead>Your bid</DataTableHead>
              <DataTableHead className="text-right">Place bid</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {papers.map((paper) => (
              <DataTableRow key={paper.id}>
                <DataTableCell>
                  <p className="font-medium text-slate-900">{paper.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{paper.abstract}</p>
                </DataTableCell>
                <DataTableCell className="text-sm text-slate-600">
                  {paper.authorships?.length
                    ? paper.authorships.map((a) => a.fullName).join(', ')
                    : blindingMode === 'DOUBLE'
                      ? '(blinded)'
                      : '—'}
                </DataTableCell>
                <DataTableCell>
                  {paper.myBid ? (
                    <WorkflowBadge label={bidValueLabel(paper.myBid)} tone="info" />
                  ) : (
                    <span className="text-sm text-slate-400">Not bid</span>
                  )}
                </DataTableCell>
                <DataTableCell className="text-right">
                  {canBid ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      {BID_OPTIONS.map((opt) => (
                        <Button
                          key={opt.value}
                          size="sm"
                          variant={paper.myBid === opt.value ? 'default' : 'outline'}
                          disabled={busyPaperId === paper.id}
                          onClick={() => handleBid(paper.id, opt.value)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
