import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), upsert: vi.fn(), send: vi.fn() }));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'asset',
  withTenantContext: (_: unknown, cb: (tx: unknown) => unknown) =>
    cb({ fileAsset: { findFirst: mocks.lookup, upsert: mocks.upsert } }),
}));
vi.mock('@openconferences/config/env', () => ({
  getConfig: () => ({ isTest: false }),
  resolveStorageBucket: (b: string) => b,
}));
vi.mock('./s3.client', () => ({
  getS3Bucket: () => 'test',
  getS3Client: () => ({ send: mocks.send }),
}));
import { FilesService } from './files.service';
const key = 'org/org/conf/conf/papers/paper/registration/reg/student-verification/document';
const input = {
  organizationId: 'org',
  conferenceId: 'conf',
  paperId: 'paper',
  registrationId: 'reg',
  userId: 'author',
  objectKey: key,
};
const service = new FilesService({} as never, {} as never);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.lookup.mockResolvedValue({
    id: 'asset',
    objectKey: key,
    createdAt: new Date(),
    mimeType: 'application/pdf',
    originalFilename: 'id.pdf',
    sizeBytes: 30n,
    checksumSha256: '',
  });
  mocks.upsert.mockResolvedValue({ id: 'asset' });
});
it('completes using persisted metadata after the API loses its in-memory session, sealing the validated bytes', async () => {
  mocks.send
    .mockResolvedValueOnce({ ContentLength: 30, ETag: 'version-1' })
    .mockResolvedValueOnce({
      Body: (async function* () {
        yield Buffer.from('%PDF-1.4 student document');
      })(),
    })
    .mockResolvedValueOnce({});
  await service.finalizeStudentVerificationUpload(input);
  expect(mocks.send.mock.calls[1][0].input.IfMatch).toBe('version-1');
  expect(mocks.send.mock.calls[2][0].input.CopySourceIfMatch).toBe('version-1');
  expect(mocks.upsert.mock.calls[0][0].update.objectKey).toContain('.sealed-');
});
it('rejects oversized actual objects before downloading them', async () => {
  mocks.send.mockResolvedValueOnce({ ContentLength: 10485761 });
  await expect(service.finalizeStudentVerificationUpload(input)).rejects.toThrow();
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it('rejects expired upload sessions', async () => {
  mocks.lookup.mockResolvedValueOnce({ createdAt: new Date(0), objectKey: key });
  await expect(service.finalizeStudentVerificationUpload(input)).rejects.toThrow('expired');
  expect(mocks.send).not.toHaveBeenCalled();
});
it('rejects another registration scope', async () => {
  await expect(
    service.finalizeStudentVerificationUpload({ ...input, objectKey: 'other-registration' }),
  ).rejects.toThrow('scope');
  expect(mocks.send).not.toHaveBeenCalled();
});
it('rejects a file disguised with a PDF MIME type', async () => {
  mocks.send.mockResolvedValueOnce({ ContentLength: 10 }).mockResolvedValueOnce({
    Body: (async function* () {
      yield Buffer.from('not a pdf file at all');
    })(),
  });
  await expect(service.finalizeStudentVerificationUpload(input)).rejects.toThrow('content type');
  expect(mocks.upsert).not.toHaveBeenCalled();
});

it('returns the same sealed asset when completion is retried', async () => {
  const sealed = { id: 'asset', checksumSha256: 'hash', objectKey: key + '.sealed-existing' };
  mocks.lookup.mockResolvedValueOnce(sealed);
  expect(await service.finalizeStudentVerificationUpload(input)).toEqual(sealed);
  expect(mocks.send).not.toHaveBeenCalled();
});
