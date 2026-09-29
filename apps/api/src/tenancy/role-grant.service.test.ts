import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleGrantService } from './role-grant.service';

const findMany = vi.hoisted(() => vi.fn());

vi.mock('@openconferences/db', () => ({
  generateId: () => 'id',
  withTenantContext: (_: unknown, callback: (tx: unknown) => unknown) =>
    callback({ membership: { findMany } }),
}));

describe('listMembers role filter', () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  const service = new RoleGrantService(
    { log: vi.fn() } as never,
    { loadConference: async () => ({ organizationId: 'org' }) } as never,
  );

  it('returns only memberships that hold the requested role', async () => {
    await service.listMembers('chair', 'conf', ['CHAIR'], { role: 'REVIEWER', limit: 100 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roles: { some: { role: 'REVIEWER' } },
          OR: [
            { conferenceId: 'conf', scope: 'CONFERENCE' },
            { organizationId: 'org', scope: 'ORGANIZATION' },
          ],
        }),
      }),
    );
  });

  it('does not filter roles when none is requested', async () => {
    await service.listMembers('chair', 'conf', ['CHAIR']);
    const where = findMany.mock.calls[0]?.[0].where;
    expect(where.roles).toBeUndefined();
    expect(where.OR).toEqual([
      { conferenceId: 'conf', scope: 'CONFERENCE' },
      { organizationId: 'org', scope: 'ORGANIZATION' },
    ]);
  });
});
