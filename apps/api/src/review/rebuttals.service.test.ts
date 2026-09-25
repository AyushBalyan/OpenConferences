import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RebuttalsService } from './rebuttals.service';

const mocks = vi.hoisted(() => ({
  existing: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  audit: vi.fn(),
  lockRound: vi.fn(),
}));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'new-id',
  withTenantContext: (_: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      $queryRaw: mocks.lockRound,
      paper: {
        findFirst: async () => ({ conferenceId: 'conf', submittedById: 'author', authorships: [] }),
      },
      reviewRound: {
        findFirst: async () => ({
          id: 'round',
          paperId: 'paper',
          reviewsReleasedAt: new Date(),
          rebuttalDueAt: null,
        }),
      },
      decision: { findFirst: async () => null },
      review: { count: async () => 1 },
      rebuttal: {
        findUnique: mocks.existing,
        updateMany: mocks.update,
        createMany: mocks.create,
        findUniqueOrThrow: mocks.read,
      },
    }),
}));

const row = {
  id: 'response',
  version: 2,
  body: 'Saved response',
  createdAt: new Date(),
  updatedAt: new Date(),
  submittedAt: new Date(),
};
const service = () =>
  new RebuttalsService(
    { loadConference: async () => ({ organizationId: 'org' }) } as never,
    { log: mocks.audit } as never,
  );
const submit = (version?: number) =>
  service().submitRebuttal('author', 'conf', 'paper', { body: 'Response', version }, ['AUTHOR']);

describe('rebuttal optimistic writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lockRound.mockResolvedValue([
      {
        id: 'round',
        paperId: 'paper',
        version: 1,
        reviewsReleasedAt: new Date(),
        rebuttalDueAt: null,
      },
    ]);
    mocks.existing.mockResolvedValue({ ...row, version: 1 });
    mocks.read.mockResolvedValue(row);
    mocks.update.mockResolvedValue({ count: 1 });
    mocks.create.mockResolvedValue({ count: 1 });
  });
  it('rejects a response when the round closes before the write transaction', async () => {
    mocks.lockRound.mockResolvedValue([
      { id: 'round', paperId: 'paper', version: 2, reviewsReleasedAt: null, rebuttalDueAt: null },
    ]);
    await expect(submit(1)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REBUTTAL_PHASE_LOCKED' }),
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each([undefined, 0, 2])(
    'rejects missing or stale version %s on existing responses',
    async (version) => {
      await expect(submit(version)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REBUTTAL_VERSION_CONFLICT' }),
      });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
    },
  );
  it('rejects a write that loses the race after reading the current version', async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    await expect(submit(1)).rejects.toMatchObject({ status: 409 });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'response',
          conferenceId: 'conf',
          paperId: 'paper',
          roundId: 'round',
          version: 1,
        },
      }),
    );
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('returns the persisted version after updating', async () => {
    expect((await submit(1)).rebuttal.version).toBe(2);
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it('maps simultaneous first submissions to a conflict', async () => {
    mocks.existing.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ count: 0 });
    await expect(submit(0)).rejects.toMatchObject({ status: 409 });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each([undefined, 0])('allows first submissions with version %s', async (version) => {
    mocks.existing.mockResolvedValue(null);
    expect((await submit(version)).rebuttal.body).toBe('Saved response');
  });
});
