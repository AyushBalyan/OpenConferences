import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PapersService } from './papers.service';

const { latest, update } = vi.hoisted(() => ({ latest: vi.fn(), update: vi.fn() }));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'test-id',
  withTenantContext: (_context: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      paperVersion: { findFirst: latest },
      paper: { update },
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
});
