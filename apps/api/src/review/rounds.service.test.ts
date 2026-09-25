import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoundsService, lockReviewRound } from './rounds.service';

const mocks = vi.hoisted(() => ({ update: vi.fn(), read: vi.fn(), audit: vi.fn() }));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'id',
  withTenantContext: (_: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      reviewRound: {
        findFirst: async () => ({
          id: 'round',
          conferenceId: 'conf',
          paperId: 'paper',
          reviewsReleasedAt: null,
          version: 1,
        }),
        updateMany: mocks.update,
        findUniqueOrThrow: mocks.read,
      },
    }),
}));
describe('round transition concurrency', () => {
  beforeEach(() => vi.clearAllMocks());
  it('does not overwrite a phase changed by another request', async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    const service = new RoundsService(
      { loadConference: async () => ({ organizationId: 'org' }) } as never,
      { log: mocks.audit } as never,
    );
    await expect(
      service.update('chair', 'conf', 'round', { version: 1, rebuttalDueAt: null }, ['CHAIR']),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'round', conferenceId: 'conf', version: 1 },
      }),
    );
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('uses a scoped shared row lock', async () => {
    const query = vi
      .fn()
      .mockResolvedValue([
        { id: 'round', paperId: 'paper', version: 2, reviewsReleasedAt: null, rebuttalDueAt: null },
      ]);
    expect(await lockReviewRound({ $queryRaw: query } as never, 'conf', 'round')).toMatchObject({
      version: 2,
    });
    const [parts, round, conference] = query.mock.calls[0]!;
    expect(parts.join('?')).toContain('FOR UPDATE');
    expect(parts.join('?')).toContain('"conferenceId"');
    expect([round, conference]).toEqual(['round', 'conf']);
  });
  it('rejects inaccessible rounds without proceeding', async () => {
    await expect(
      lockReviewRound({ $queryRaw: vi.fn().mockResolvedValue([]) } as never, 'conf', 'round'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
