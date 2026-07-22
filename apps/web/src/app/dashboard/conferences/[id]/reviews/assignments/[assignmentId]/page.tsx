'use client';

import { ReviewEditorPanel } from '@/components/dashboard/reviews/review-editor';
import { useParams } from 'next/navigation';

export default function ReviewEditorPage() {
  const params = useParams<{ id: string; assignmentId: string }>();
  return <ReviewEditorPanel conferenceId={params.id} assignmentId={params.assignmentId} />;
}
