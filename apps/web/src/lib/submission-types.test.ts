import { describe, expect, it } from 'vitest';
import {
  authorMustAskOrganizersToWithdraw,
  canDeleteDraft,
  canSubmitDraft,
  canWithdrawPaper,
  countActiveSubmissions,
  latestScanStatus,
  paperHasCleanDownload,
  paperDownloadFilename,
  withdrawConfirmationReady,
  type PaperDto,
} from './submission-types';

function paper(overrides: Partial<PaperDto>): PaperDto {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    organizationId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    conferenceId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    trackId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    submittedById: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    currentVersionId: null,
    title: 'Example',
    abstract: 'Abstract',
    keywords: [],
    status: 'SUBMITTED',
    version: 1,
    authorships: [],
    currentVersion: null,
    latestVersion: null,
    cameraReadyVersion: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const cleanVersion = {
  id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  paperId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  fileAssetId: '11111111-1111-1111-1111-111111111111',
  uploadedById: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  kind: 'SUBMISSION' as const,
  versionNumber: 1,
  note: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  fileAsset: {
    id: '11111111-1111-1111-1111-111111111111',
    bucket: 'papers',
    objectKey: 'org/paper.pdf',
    sizeBytes: '1024',
    checksumSha256: 'a'.repeat(64),
    mimeType: 'application/pdf',
    originalFilename: 'paper.pdf',
    scanStatus: 'CLEAN' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('paperHasCleanDownload', () => {
  it('blocks submission of an older clean file while its replacement is scanning', () => {
    const draft = paper({
      status: 'DRAFT',
      currentVersionId: cleanVersion.id,
      currentVersion: cleanVersion,
      latestVersion: {
        ...cleanVersion,
        id: '22222222-2222-2222-2222-222222222222',
        fileAsset: { ...cleanVersion.fileAsset, scanStatus: 'PENDING_SCAN' },
      },
    });
    expect(canSubmitDraft(draft)).toBe(false);
    expect(latestScanStatus(draft)).toBe('PENDING_SCAN');
    expect(paperHasCleanDownload(draft)).toBe(true);
    expect(canSubmitDraft({ ...draft, latestVersion: cleanVersion })).toBe(true);
  });
  it('requires a current version whose scan is CLEAN', () => {
    expect(paperHasCleanDownload(paper({ currentVersionId: null }))).toBe(false);
    expect(
      paperHasCleanDownload(
        paper({
          currentVersionId: cleanVersion.id,
          currentVersion: {
            ...cleanVersion,
            fileAsset: { ...cleanVersion.fileAsset, scanStatus: 'PENDING_SCAN' },
          },
        }),
      ),
    ).toBe(false);
    expect(
      paperHasCleanDownload(
        paper({
          currentVersionId: cleanVersion.id,
          currentVersion: cleanVersion,
        }),
      ),
    ).toBe(true);
  });

  it('counts active submissions without drafts', () => {
    expect(
      countActiveSubmissions(
        {
          total: 5,
          byStatus: [
            { status: 'DRAFT', count: 2 },
            { status: 'SUBMITTED', count: 3 },
          ],
        },
        [],
      ),
    ).toBe(3);
    expect(
      countActiveSubmissions(null, [
        { status: 'DRAFT' },
        { status: 'UNDER_REVIEW' },
        { status: 'CAMERA_READY' },
      ]),
    ).toBe(2);
  });

  it('excludes both withdrawal statuses from the conference overview count', () => {
    expect(
      countActiveSubmissions(
        {
          total: 34,
          byStatus: [
            { status: 'SUBMITTED', count: 32 },
            { status: 'WITHDRAWN', count: 1 },
            { status: 'WITHDRAWN_NONPAYMENT', count: 1 },
          ],
        },
        [{ status: 'SUBMITTED' }],
      ),
    ).toBe(32);
    expect(
      countActiveSubmissions(null, [
        { status: 'DRAFT' },
        { status: 'WITHDRAWN' },
        { status: 'WITHDRAWN_NONPAYMENT' },
        { status: 'SUBMITTED' },
        { status: 'UNDER_REVIEW' },
        { status: 'DECISION_MADE' },
        { status: 'CAMERA_READY' },
      ]),
    ).toBe(4);
  });

  it('allows authors to withdraw only submitted papers and delete only drafts', () => {
    expect(canWithdrawPaper('SUBMITTED', { isAuthor: true, isCoordinator: false })).toBe(true);
    expect(canWithdrawPaper('UNDER_REVIEW', { isAuthor: true, isCoordinator: true })).toBe(false);
    expect(canWithdrawPaper('UNDER_REVIEW', { isAuthor: false, isCoordinator: true })).toBe(true);
    expect(canWithdrawPaper('CAMERA_READY', { isAuthor: false, isCoordinator: true })).toBe(true);
    expect(canWithdrawPaper('DRAFT', { isAuthor: true, isCoordinator: false })).toBe(false);
    expect(canDeleteDraft('DRAFT', { isAuthor: true })).toBe(true);
    expect(canDeleteDraft('SUBMITTED', { isAuthor: true })).toBe(false);
    expect(canDeleteDraft('DRAFT', { isAuthor: false })).toBe(false);
    expect(
      authorMustAskOrganizersToWithdraw('DECISION_MADE', { isAuthor: true, isCoordinator: false }),
    ).toBe(true);
    expect(withdrawConfirmationReady('Changed plans', 'WITHDRAW')).toBe(true);
    expect(withdrawConfirmationReady('Changed plans', 'withdraw')).toBe(false);
    expect(withdrawConfirmationReady('   ', 'WITHDRAW')).toBe(false);
  });

  it('names a submitted download with the public code', () => {
    expect(paperDownloadFilename('icamcds2026-k7q4', 'My Paper.pdf')).toBe('ICAMCDS2026-K7Q4.pdf');
    expect(paperDownloadFilename(null, 'My Paper.pdf')).toBe('My Paper.pdf');
  });
});
