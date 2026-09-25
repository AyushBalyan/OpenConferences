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
