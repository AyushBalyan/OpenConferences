import { describe, expect, it } from 'vitest';
import { paperHasCleanDownload, type PaperDto } from './submission-types';

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
});
