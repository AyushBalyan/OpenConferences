'use client';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { ReviewerOverviewTab } from '@/components/dashboard/reviews/reviewer-overview';
export default function ReviewerOverviewPage() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={<p role="status">Loading reviewer overview…</p>}>
      <ReviewerOverviewTab conferenceId={params.id} />
    </Suspense>
  );
}
