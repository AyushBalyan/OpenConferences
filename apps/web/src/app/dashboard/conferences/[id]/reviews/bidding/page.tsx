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
import { BidPaperModal } from '@/components/dashboard/reviews/bid-paper-modal';
import { BiddingOversightTable } from '@/components/dashboard/reviews/bidding-oversight-table';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { fetchPaperPool, upsertBid } from '@/lib/api-client';
import { bidValueLabel, type BidValue, type BlindedPaperPoolItemDto } from '@/lib/review-types';
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
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

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

  const selectedPaper = useMemo(
    () => papers.find((paper) => paper.id === selectedPaperId) ?? null,
    [papers, selectedPaperId],
  );

  function authorsLabelFor(paper: BlindedPaperPoolItemDto) {
    if (paper.authorships?.length) {
      return paper.authorships.map((a) => a.fullName).join(', ');
    }
    return blindingMode === 'DOUBLE' ? '(blinded)' : '—';
  }

  async function handleBid(paperId: string, value: BidValue) {
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
        <BiddingOversightTable papers={papers} />
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
                  {authorsLabelFor(paper)}
                </DataTableCell>
                <DataTableCell>
                  {paper.myBid ? (
                    <WorkflowBadge label={bidValueLabel(paper.myBid)} tone="info" />
                  ) : (
                    <span className="text-sm text-slate-400">Not bid</span>
                  )}
                </DataTableCell>
                <DataTableCell className="whitespace-nowrap text-right">
                  {canBid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedPaperId(paper.id)}
                    >
                      {paper.myBid ? 'Update bid' : 'Place bid'}
                    </Button>
                  ) : null}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {selectedPaper && canBid ? (
        <BidPaperModal
          paper={selectedPaper}
          authorsLabel={authorsLabelFor(selectedPaper)}
          busy={busyPaperId === selectedPaper.id}
          onClose={() => setSelectedPaperId(null)}
          onSelect={(value) => handleBid(selectedPaper.id, value)}
        />
      ) : null}
    </div>
  );
}
