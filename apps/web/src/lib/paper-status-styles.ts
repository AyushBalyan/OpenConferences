import type { PaperDto } from '@/lib/submission-types';
import { paperStatusLabel } from '@/lib/submission-types';

export type WorkflowTone = 'success' | 'pending' | 'danger' | 'info' | 'neutral';

const PAPER_STATUS_TONE: Record<PaperDto['status'], WorkflowTone> = {
  DRAFT: 'info',
  SUBMITTED: 'pending',
  UNDER_REVIEW: 'pending',
  DECISION_MADE: 'success',
  CAMERA_READY: 'success',
  WITHDRAWN: 'neutral',
  WITHDRAWN_NONPAYMENT: 'danger',
};

export function paperStatusTone(status: PaperDto['status']): WorkflowTone {
  return PAPER_STATUS_TONE[status] ?? 'neutral';
}

export { paperStatusLabel };
