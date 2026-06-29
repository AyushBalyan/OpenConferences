import { describe, expect, it } from 'vitest';
import type { Conference } from '@openconferences/db';
import { deriveStatusFromWindows } from './tenancy.mapper.ts';

function conference(overrides: Partial<Conference> = {}): Conference {
  return {
    id: 'conf-1',
    organizationId: 'org-1',
    slug: 'test',
    name: 'Test',
    status: 'DRAFT',
    blindingMode: 'DOUBLE',
    cfpOpensAt: null,
    cfpClosesAt: null,
    biddingOpensAt: null,
    biddingClosesAt: null,
    reviewDueAt: null,
    rebuttalDueAt: null,
    decisionDueAt: null,
    cameraReadyDueAt: null,
    registrationDueAt: null,
    reviewConfig: {},
    feeSchedule: {},
    version: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('deriveStatusFromWindows', () => {
  it('returns DRAFT when CFP opens in the future even if status is CFP_OPEN', () => {
    const futureOpen = new Date(Date.now() + 86400000 * 15);
    const futureClose = new Date(Date.now() + 86400000 * 45);

    expect(
      deriveStatusFromWindows(
        conference({
          status: 'CFP_OPEN',
          cfpOpensAt: futureOpen,
          cfpClosesAt: futureClose,
        }),
      ),
    ).toBe('DRAFT');
  });

  it('returns CFP_OPEN when now is within the CFP window', () => {
    const pastOpen = new Date(Date.now() - 86400000);
    const futureClose = new Date(Date.now() + 86400000 * 30);

    expect(
      deriveStatusFromWindows(
        conference({
          status: 'DRAFT',
          cfpOpensAt: pastOpen,
          cfpClosesAt: futureClose,
        }),
      ),
    ).toBe('CFP_OPEN');
  });

  it('returns DRAFT when CFP opens is not configured', () => {
    expect(
      deriveStatusFromWindows(
        conference({
          status: 'CFP_OPEN',
          cfpOpensAt: null,
          cfpClosesAt: new Date(Date.now() + 86400000),
        }),
      ),
    ).toBe('DRAFT');
  });

  it('returns REVIEWING after CFP closes when review due is in the future', () => {
    const pastOpen = new Date(Date.now() - 86400000 * 30);
    const pastClose = new Date(Date.now() - 86400000);
    const futureReviewDue = new Date(Date.now() + 86400000 * 14);

    expect(
      deriveStatusFromWindows(
        conference({
          status: 'CFP_OPEN',
          cfpOpensAt: pastOpen,
          cfpClosesAt: pastClose,
          reviewDueAt: futureReviewDue,
        }),
      ),
    ).toBe('REVIEWING');
  });

  it('keeps ARCHIVED and COMPLETED terminal statuses', () => {
    expect(deriveStatusFromWindows(conference({ status: 'ARCHIVED' }))).toBe('ARCHIVED');
    expect(deriveStatusFromWindows(conference({ status: 'COMPLETED' }))).toBe('COMPLETED');
  });
});
