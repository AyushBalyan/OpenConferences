import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PapersService } from './papers.service';

const { latest, update, updateMany, findPaper, count, createPaper, queryRaw, findUser, findTrack } =
  vi.hoisted(() => ({
    latest: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findPaper: vi.fn(),
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
      $executeRaw: vi.fn(),
      paperVersion: { findFirst: latest },
      paper: { update, updateMany, findFirst: findPaper, count, create: createPaper },
      user: { findUnique: findUser },
      track: { findFirst: findTrack },
    }),
}));

describe('submission replacement scan gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRaw.mockResolvedValue([
      {
        status: 'CFP_OPEN',
        cfpOpensAt: new Date('2020-01-01'),
        cfpClosesAt: new Date('2099-01-01'),
      },
    ]);
  });
  it('captures the submission date in the same update that submits the paper', async () => {
    const createdAt = new Date('2026-10-01T10:00:00Z');
    const draft = {
      id: 'paper',
      organizationId: 'org',
      conferenceId: 'conf',
      submittedById: 'author',
      status: 'DRAFT',
      title: 'Title',
      abstract: 'Abstract',
      createdAt,
      updatedAt: createdAt,
      authorships: [
        {
          userId: 'author',
          isCorresponding: true,
          email: 'author@example.test',
          fullName: 'Author',
        },
      ],
      currentVersionId: 'current',
      currentVersion: { id: 'current', fileAsset: { scanStatus: 'CLEAN' } },
    };
    const service = new PapersService(
      {
        loadConference: vi.fn().mockResolvedValue({
          status: 'CFP_OPEN',
          cfpOpensAt: new Date('2020-01-01'),
          cfpClosesAt: new Date('2099-01-01'),
          slug: 'test',
        }),
      } as never,
      { log: vi.fn() } as never,
      { publishPaperSubmitted: vi.fn() } as never,
    );
    vi.spyOn(service, 'loadPaper').mockResolvedValue(draft as never);
    latest.mockResolvedValue({ id: 'current', fileAsset: { scanStatus: 'CLEAN' } });
    count.mockResolvedValue(0);
    updateMany.mockResolvedValue({ count: 1 });
    findPaper.mockImplementation(() => ({
      ...draft,
      status: 'SUBMITTED',
      currentVersion: null,
      authorships: [],
      submittedAt: updateMany.mock.calls[0]?.[0].data.submittedAt,
    }));
    const result = await service.submit('author', 'conf', 'paper', ['AUTHOR']);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUBMITTED',
          submittedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.submittedAt).toBe(updateMany.mock.calls[0]?.[0].data.submittedAt.toISOString());
    expect(result.submittedAt).not.toBe(createdAt.toISOString());
  });
  it.each(['PENDING_SCAN', 'INFECTED', 'CLEAN'])(
    'does not submit the older clean version when a replacement is %s',
    async (scanStatus) => {
      const service = new PapersService(
        {
          loadConference: vi.fn().mockResolvedValue({
            status: 'CFP_OPEN',
            cfpOpensAt: new Date('2020-01-01'),
            cfpClosesAt: new Date('2099-01-01'),
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
          cfpOpensAt: new Date('2020-01-01'),
          cfpClosesAt: new Date('2099-01-01'),
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
          cfpOpensAt: new Date('2020-01-01'),
          cfpClosesAt: new Date('2099-01-01'),
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
  it('rechecks the deadline after waiting for the corresponding-author lock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T00:00:00Z'));
    findUser.mockResolvedValue({ id: 'author', name: 'Author', email: 'author@example.test' });
    findTrack.mockResolvedValue({ id: 'track' });
    count.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date('2099-01-02'));
      return 0;
    });
    const conference = {
      status: 'CFP_OPEN',
      organizationId: 'org',
      cfpOpensAt: new Date('2020-01-01'),
      cfpClosesAt: new Date('2099-01-01'),
    };
    const service = new PapersService(
      { loadConference: vi.fn().mockResolvedValue(conference) } as never,
      {} as never,
      {} as never,
    );
    try {
      await expect(
        service.create('author', 'conf', { title: 'Late', abstract: 'Abstract', keywords: [] }, [
          'AUTHOR',
        ]),
      ).rejects.toMatchObject({ status: 409 });
      expect(createPaper).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('rechecks manual closure inside the write transaction even after a stale open precheck', async () => {
    findUser.mockResolvedValue({ id: 'author', name: 'Author', email: 'author@example.test' });
    findTrack.mockResolvedValue({ id: 'track' });
    const conference = {
      status: 'CFP_OPEN',
      organizationId: 'org',
      cfpOpensAt: new Date('2020-01-01'),
      cfpClosesAt: new Date('2099-01-01'),
    };
    queryRaw.mockResolvedValueOnce([{ ...conference, status: 'CFP_CLOSED' }]);
    const service = new PapersService(
      { loadConference: vi.fn().mockResolvedValue(conference) } as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.create('author', 'conf', { title: 'Closed', abstract: 'Abstract', keywords: [] }, [
        'AUTHOR',
      ]),
    ).rejects.toMatchObject({ status: 409 });
    expect(createPaper).not.toHaveBeenCalled();
  });
});
