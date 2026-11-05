import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), adapter: {} }));
vi.mock('@openconferences/db', () => ({
  withTenantContext: (_: unknown, cb: (tx: unknown) => unknown) =>
    cb({ studentVerification: { findMany: mocks.findMany } }),
  prismaQueueAdapter: () => mocks.adapter,
}));
import { recoverStudentScans } from './student-scan-recovery.js';
it('recovers stranded proof scans without treating the asset as a manuscript', async () => {
  mocks.findMany.mockResolvedValue([
    {
      fileAssetId: 'proof',
      organizationId: 'org',
      fileAsset: { originalFilename: 'id.pdf' },
      registration: { paperId: 'paper', conferenceId: 'conf' },
    },
  ]);
  const send = vi.fn().mockResolvedValue('job');
  expect(await recoverStudentScans({ send } as never)).toBe(1);
  expect(send).toHaveBeenCalledWith(
    'file.scan',
    expect.objectContaining({ fileAssetId: 'proof', paperVersionId: 'proof' }),
    expect.objectContaining({ db: mocks.adapter, singletonKey: 'proof', retryLimit: 5 }),
  );
  expect(mocks.findMany.mock.calls[0]![0].where.fileAsset.scanStatus).toBe('PENDING_SCAN');
});
it('does not count a duplicate pending scan as another recovery', async () => {
  mocks.findMany.mockResolvedValue([
    {
      fileAssetId: 'proof',
      organizationId: 'org',
      fileAsset: { originalFilename: 'id.pdf' },
      registration: { paperId: 'paper', conferenceId: 'conf' },
    },
  ]);
  expect(await recoverStudentScans({ send: vi.fn().mockResolvedValue(null) } as never)).toBe(0);
});
