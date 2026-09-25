import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesService } from './files.service';

const { lookup, sign } = vi.hoisted(() => ({ lookup: vi.fn(), sign: vi.fn() }));
vi.mock('@openconferences/db', () => ({
  withTenantContext: (_: unknown, callback: (tx: unknown) => unknown) =>
    callback({ fileAsset: { findFirst: lookup } }),
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: sign }));
vi.mock('./s3.client', () => ({ getS3Client: () => ({}) }));
vi.mock('@openconferences/config/env', () => ({
  resolveStorageBucket: (bucket: string) => bucket,
}));

describe('PDF preview response headers', () => {
  const service = new FilesService({} as never, {} as never);
  beforeEach(() => {
    vi.clearAllMocks();
    lookup.mockResolvedValue({
      bucket: 'papers',
      objectKey: 'paper.pdf',
      originalFilename: 'original.pdf',
      scanStatus: 'CLEAN',
    });
    sign.mockResolvedValue('https://storage.example/signed');
  });
  it('signs an inline PDF response for previews', async () => {
    await service.presignDownload('asset', 'user', 'org', 'inline');
    expect(sign.mock.calls[0]?.[1].input).toMatchObject({
      ResponseContentDisposition: 'inline; filename="manuscript.pdf"',
      ResponseContentType: 'application/pdf',
    });
  });
  it('keeps downloads as attachments by default', async () => {
    await service.presignDownload('asset', 'user', 'org');
    expect(sign.mock.calls[0]?.[1].input.ResponseContentDisposition).toBe(
      'attachment; filename="original.pdf"',
    );
  });
  it('does not sign a preview for an unscanned asset', async () => {
    lookup.mockResolvedValue({ scanStatus: 'PENDING_SCAN' });
    await expect(service.presignDownload('asset', 'user', 'org', 'inline')).rejects.toMatchObject({
      status: 403,
    });
    expect(sign).not.toHaveBeenCalled();
  });
});
