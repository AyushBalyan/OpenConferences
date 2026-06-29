import { describe, expect, it } from 'vitest';
import { canGrantRole, maxRoleRank, ROLE_RANK } from '../../src/tenancy/role-hierarchy.ts';

describe('role hierarchy', () => {
  it('organizer cannot grant organizer or above', () => {
    expect(canGrantRole(['ORGANIZER'], 'ORGANIZER')).toBe(false);
    expect(canGrantRole(['ORGANIZER'], 'ORG_ADMIN')).toBe(false);
    expect(canGrantRole(['ORGANIZER'], 'PLATFORM_ADMIN')).toBe(false);
  });

  it('organizer can grant lower roles', () => {
    expect(canGrantRole(['ORGANIZER'], 'CHAIR')).toBe(true);
    expect(canGrantRole(['ORGANIZER'], 'REVIEWER')).toBe(true);
    expect(canGrantRole(['ORGANIZER'], 'AUTHOR')).toBe(true);
  });

  it('platform admin is seed-only', () => {
    expect(canGrantRole(['PLATFORM_ADMIN'], 'PLATFORM_ADMIN')).toBe(false);
  });

  it('ranks are ordered', () => {
    expect(ROLE_RANK.PLATFORM_ADMIN).toBeGreaterThan(ROLE_RANK.ORG_ADMIN);
    expect(maxRoleRank(['AUTHOR', 'ORGANIZER'])).toBe(ROLE_RANK.ORGANIZER);
  });
});
