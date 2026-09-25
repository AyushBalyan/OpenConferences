import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxService } from './inbox.service';

const mocks = vi.hoisted(() => ({
  review: vi.fn(),
  assignments: vi.fn(),
  rebuttal: vi.fn(),
  receipts: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'receipt',
  withTenantContext: (_: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      review: { findMany: mocks.review },
      reviewerAssignment: { findMany: mocks.assignments },
      rebuttal: { findMany: mocks.rebuttal },
      inboxReadState: {
        findMany: mocks.receipts,
        createMany: mocks.create,
        updateMany: mocks.update,
      },
    }),
}));
const scope = { userId: 'user', conferenceId: 'conference', organizationId: 'org' };
const source = {
  id: 'source',
  paperId: 'paper',
  roundId: 'round',
  version: 3,
  updatedAt: new Date(),
  paper: { title: 'Paper' },
};
describe('participant inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.review.mockResolvedValue([source]);
    mocks.receipts.mockResolvedValue([]);
    mocks.assignments.mockResolvedValue([]);
  });
  it('requires published submitted reviews belonging to the author', async () => {
    const result = await new InboxService().list(scope, 'REVIEW');
    expect(mocks.review).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conferenceId: 'conference',
          visibility: 'AUTHOR_VISIBLE',
          submittedAt: { not: null },
          paper: { OR: [{ submittedById: 'user' }, { authorships: { some: { userId: 'user' } } }] },
        }),
      }),
    );
    expect(result.data[0]?.unread).toBe(true);
    expect(result.data[0]).not.toHaveProperty('commentsToChairs');
  });
  it('makes a newer source version unread again', async () => {
    mocks.receipts.mockResolvedValue([{ sourceId: 'source', readVersion: 2 }]);
    expect((await new InboxService().list(scope, 'REVIEW')).data[0]?.unread).toBe(true);
    mocks.receipts.mockResolvedValue([{ sourceId: 'source', readVersion: 3 }]);
    expect((await new InboxService().list(scope, 'REVIEW')).data[0]?.unread).toBe(false);
  });
  it('returns a bounded page and loads receipts only for its displayed sources', async () => {
    mocks.review.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) => ({ ...source, id: `source-${index}` })),
    );
    const result = await new InboxService().list(scope, 'REVIEW', 'previous-source');
    expect(result.data).toHaveLength(50);
    expect(result.nextCursor).toBe('source-49');
    expect(mocks.review).toHaveBeenCalledWith(
      expect.objectContaining({ take: 51, cursor: { id: 'previous-source' }, skip: 1 }),
    );
    const queriedIds = mocks.receipts.mock.calls[0]?.[0].where.sourceId.in;
    expect(queriedIds).toHaveLength(50);
    expect(queriedIds).not.toContain('source-50');
  });
  it('rejects acknowledgement of inaccessible or future versions', async () => {
    await expect(
      new InboxService().acknowledge(scope, { kind: 'REVIEW', sourceId: 'source', version: 4 }),
    ).rejects.toMatchObject({ status: 409 });
    mocks.review.mockResolvedValue([]);
    await expect(
      new InboxService().acknowledge(scope, { kind: 'REVIEW', sourceId: 'source', version: 3 }),
    ).rejects.toMatchObject({ status: 404 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('never downgrades an already acknowledged version', async () => {
    await new InboxService().acknowledge(scope, { kind: 'REVIEW', sourceId: 'source', version: 2 });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        userId: 'user',
        conferenceId: 'conference',
        kind: 'REVIEW',
        sourceId: 'source',
        readVersion: { lt: 2 },
      },
      data: { readVersion: 2 },
    });
  });
  it('does not query responses after assignment access is removed', async () => {
    expect((await new InboxService().list(scope, 'REBUTTAL')).data).toEqual([]);
    expect(mocks.rebuttal).not.toHaveBeenCalled();
  });
  it('scopes response access to both the assigned paper and round', async () => {
    mocks.assignments.mockResolvedValue([{ id: 'assignment', paperId: 'paper', roundId: 'round' }]);
    mocks.rebuttal.mockResolvedValue([source]);
    const result = await new InboxService().list(scope, 'REBUTTAL');
    expect(mocks.rebuttal).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: [{ paperId: 'paper', roundId: 'round' }] }),
      }),
    );
    expect(result.data[0]?.href).toContain('/assignments/assignment?section=response');
  });
});
