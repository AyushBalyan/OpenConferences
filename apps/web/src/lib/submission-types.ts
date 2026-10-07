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

const SUBMISSION_CODE = /^[A-Z0-9]+-[2-9A-HJ-NP-Z]{4}$/i;

/** Saved download name. Submitted papers use the public code, including files uploaded earlier. */
export function paperDownloadFilename(
  submissionNumber: string | null | undefined,
  originalFilename?: string | null,
): string {
  const code = submissionNumber?.trim() ?? '';
  if (SUBMISSION_CODE.test(code)) return `${code.toUpperCase()}.pdf`;
  const fallback = originalFilename?.replace(/["\r\n\\/]/g, '').trim();
  return fallback || 'manuscript.pdf';
}

export async function saveUrlAsFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  } catch {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
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
  const inactiveStatuses = new Set<PaperDto['status']>([
    'DRAFT',
    'WITHDRAWN',
    'WITHDRAWN_NONPAYMENT',
  ]);
  if (submissions) {
    const inactiveCount = submissions.byStatus.reduce(
      (total, item) => total + (inactiveStatuses.has(item.status) ? item.count : 0),
      0,
    );
    return Math.max(submissions.total - inactiveCount, 0);
  }
  return papers.filter((paper) => !inactiveStatuses.has(paper.status)).length;
}
