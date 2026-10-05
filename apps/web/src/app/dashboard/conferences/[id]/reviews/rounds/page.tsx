'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { ReviewLedger } from '@/components/dashboard/reviews/review-ledger';

export default function ReviewProgressPage() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={<p role="status">Loading paper review ledger…</p>}>
      <ReviewLedger conferenceId={params.id} />
    </Suspense>
  );
}
