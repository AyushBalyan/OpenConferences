import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PapersService } from './papers.service';

const { latest, update, count, createPaper, queryRaw, findUser, findTrack } = vi.hoisted(() => ({
  latest: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  createPaper: vi.fn(),
  queryRaw: vi.fn(),
  findUser: vi.fn(),
  findTrack: vi.fn(),
}));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'test-id',
  generateSubmissionNumber: () => 'CONF-K7Q4',
  Prisma: { PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} },
  withTenantContext: (_context: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      $queryRaw: queryRaw,
      paperVersion: { findFirst: latest },
      paper: { update, count, create: createPaper },
      user: { findUnique: findUser },
      track: { findFirst: findTrack },
    }),
}));

describe('submission replacement scan gate', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(['PENDING_SCAN', 'INFECTED', 'CLEAN'])(
    'does not submit the older clean version when a replacement is %s',
    async (scanStatus) => {
      const service = new PapersService(
        { loadConference: vi.fn().mockResolvedValue({ status: 'CFP_OPEN' }) } as never,
        {} as never,
        {} as never,
      );
      vi.spyOn(service, 'loadPaper').mockResolvedValue({
        id: 'paper',
        organizationId: 'org',
        conferenceId: 'conf',
        submittedById: 'author',
        status: 'DRAFT',
        title: 'Title',
        abstract: 'Abstract',
        authorships: [{ userId: 'author', isCorresponding: true }],
        currentVersionId: 'old',
        currentVersion: { id: 'old', fileAsset: { scanStatus: 'CLEAN' } },
      } as never);
      latest.mockResolvedValue({ id: 'replacement', fileAsset: { scanStatus } });
      await expect(service.submit('author', 'conf', 'paper', ['AUTHOR'])).rejects.toMatchObject({
        status: 409,
      });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('refuses a new paper when the corresponding author already has two', async () => {
    findUser.mockResolvedValue({ id: 'author', name: 'Ada Lovelace', email: 'ada@example.edu' });
    findTrack.mockResolvedValue({ id: 'track' });
    count.mockResolvedValue(2);
    const service = new PapersService(
      {
        loadConference: vi.fn().mockResolvedValue({
          status: 'CFP_OPEN',
          organizationId: 'org',
          name: 'Test Conference',
        }),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.create(
        'author',
        'conf',
        { title: 'Another paper', abstract: 'Abstract', keywords: [] },
        ['AUTHOR'],
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'CORRESPONDING_PAPER_LIMIT' },
    });

    expect(createPaper).not.toHaveBeenCalled();
  });

  it('refuses submitting a draft when two papers are already submitted', async () => {
    count.mockResolvedValue(2);
    const service = new PapersService(
      {
        loadConference: vi.fn().mockResolvedValue({
          status: 'CFP_OPEN',
          organizationId: 'org',
          name: 'Test Conference',
          slug: 'test-conf',
        }),
      } as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service, 'loadPaper').mockResolvedValue({
      id: 'paper',
      organizationId: 'org',
      conferenceId: 'conf',
      submittedById: 'author',
      status: 'DRAFT',
      title: 'Title',
      abstract: 'Abstract',
      authorships: [
        { userId: 'author', isCorresponding: true, email: 'ada@example.edu', fullName: 'Ada' },
      ],
      currentVersionId: 'current',
      currentVersion: { id: 'current', fileAsset: { scanStatus: 'CLEAN' } },
    } as never);
    latest.mockResolvedValue({ id: 'current', fileAsset: { scanStatus: 'CLEAN' } });

    await expect(service.submit('author', 'conf', 'paper', ['AUTHOR'])).rejects.toMatchObject({
      status: 409,
      response: { code: 'CORRESPONDING_PAPER_LIMIT' },
    });
  });
});
