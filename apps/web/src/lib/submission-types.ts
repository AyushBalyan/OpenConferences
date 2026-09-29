import type { PaperDto } from '@openconferences/schemas';

export type { PaperDto };

export function paperStatusLabel(status: PaperDto['status']): string {
  const labels: Record<PaperDto['status'], string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under review',
    DECISION_MADE: 'Decision made',
    CAMERA_READY: 'Camera-ready',
    WITHDRAWN: 'Withdrawn',
    WITHDRAWN_NONPAYMENT: 'Withdrawn (non-payment)',
  };
  return labels[status];
}

export function scanStatusLabel(status: 'PENDING_SCAN' | 'CLEAN' | 'INFECTED'): string {
  const labels = {
    PENDING_SCAN: 'Scan pending',
    CLEAN: 'Clean',
    INFECTED: 'Infected',
  };
  return labels[status];
}

export function latestScanStatus(
  paper: PaperDto,
): 'PENDING_SCAN' | 'CLEAN' | 'INFECTED' | undefined {
  return (paper.latestVersion ?? paper.currentVersion)?.fileAsset?.scanStatus;
}

export function canSubmitDraft(paper: PaperDto): boolean {
  return (
    paper.status === 'DRAFT' &&
    Boolean(paper.currentVersionId) &&
    (!paper.latestVersion || paper.latestVersion.id === paper.currentVersionId) &&
    paper.currentVersion?.fileAsset?.scanStatus === 'CLEAN'
  );
}

export function paperHasCleanDownload(paper: PaperDto): boolean {
  return Boolean(paper.currentVersionId) && paper.currentVersion?.fileAsset?.scanStatus === 'CLEAN';
}

const COORDINATOR_WITHDRAW_STATUSES = new Set<PaperDto['status']>([
  'SUBMITTED',
  'UNDER_REVIEW',
  'DECISION_MADE',
  'CAMERA_READY',
]);

export function canWithdrawPaper(
  status: PaperDto['status'],
  access: { isAuthor: boolean; isCoordinator: boolean },
): boolean {
  if (access.isAuthor) return status === 'SUBMITTED';
  if (access.isCoordinator) return COORDINATOR_WITHDRAW_STATUSES.has(status);
  return false;
}

export function canDeleteDraft(status: PaperDto['status'], access: { isAuthor: boolean }): boolean {
  return access.isAuthor && status === 'DRAFT';
}

export function withdrawConfirmationReady(reason: string, confirmText: string): boolean {
  return reason.trim().length > 0 && confirmText === 'WITHDRAW';
}

export function authorMustAskOrganizersToWithdraw(
  status: PaperDto['status'],
  access: { isAuthor: boolean; isCoordinator: boolean },
): boolean {
  return (
    access.isAuthor &&
    !access.isCoordinator &&
    (status === 'UNDER_REVIEW' || status === 'DECISION_MADE' || status === 'CAMERA_READY')
  );
}

export function countActiveSubmissions(
  submissions: {
    total: number;
    byStatus: { status: PaperDto['status']; count: number }[];
  } | null,
  papers: Pick<PaperDto, 'status'>[],
): number {
  if (submissions) {
    const drafts = submissions.byStatus.find((item) => item.status === 'DRAFT')?.count ?? 0;
    return Math.max(submissions.total - drafts, 0);
  }
  return papers.filter((paper) => paper.status !== 'DRAFT').length;
}
