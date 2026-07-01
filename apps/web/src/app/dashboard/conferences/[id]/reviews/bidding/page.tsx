'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchPaperPool, upsertBid } from '@/lib/api-client';
import { BID_OPTIONS, type BlindedPaperPoolItemDto } from '@/lib/review-types';
import { useCallback, useEffect, useState } from 'react';

export default function ReviewBiddingPage() {
  return <ReviewBidding />;
}

function ReviewBidding() {
  const { conferenceId, conference } = useConferenceWorkspace();
  const [papers, setPapers] = useState<BlindedPaperPoolItemDto[]>([]);
  const [blindingMode, setBlindingMode] = useState<'SINGLE' | 'DOUBLE' | 'OPEN'>('DOUBLE');
  const [error, setError] = useState<string | null>(null);
  const [busyPaperId, setBusyPaperId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const pool = await fetchPaperPool(conferenceId);
    setPapers(pool.data);
    setBlindingMode(pool.blindingMode ?? conference?.blindingMode ?? 'DOUBLE');
    setError(null);
  }, [conference?.blindingMode, conferenceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper pool & bidding"
        description={`Blinding mode: ${blindingMode}${blindingMode === 'DOUBLE' ? ' (author identities hidden)' : ''}`}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {papers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No papers available for bidding.
            </CardContent>
          </Card>
        ) : (
          papers.map((paper) => (
            <Card key={paper.id}>
              <CardHeader>
                <CardTitle className="text-base">{paper.title}</CardTitle>
                <CardDescription className="line-clamp-3">{paper.abstract}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {paper.authorships?.length ? (
                  <p className="text-xs text-muted-foreground">
                    Authors: {paper.authorships.map((a) => a.fullName).join(', ')}
                  </p>
                ) : blindingMode === 'DOUBLE' ? (
                  <p className="text-xs text-muted-foreground">Authors: (blinded)</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
