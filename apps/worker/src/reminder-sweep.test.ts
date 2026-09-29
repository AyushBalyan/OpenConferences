import { describe, expect, it } from 'vitest';
import { isAbandonedDraft } from './reminder-sweep.js';

const now = new Date('2026-09-29T00:00:00.000Z');

function paper(overrides: {
  status?: string;
  createdAt?: Date;
  conferenceStatus?: string;
  cfpClosesAt?: Date | null;
}) {
  return {
    status: overrides.status ?? 'DRAFT',
    createdAt: overrides.createdAt ?? new Date('2026-09-25T00:00:00.000Z'),
    conference: {
      status: overrides.conferenceStatus ?? 'CFP_OPEN',
      cfpClosesAt: overrides.cfpClosesAt === undefined ? null : overrides.cfpClosesAt,
    },
  };
}

describe('isAbandonedDraft', () => {
  it('reminds a draft that is at least 3 days old while the call is open', () => {
    expect(isAbandonedDraft(paper({}), now)).toBe(true);
  });

  it('skips a draft that is only 2 days old', () => {
    expect(isAbandonedDraft(paper({ createdAt: new Date('2026-09-27T00:00:00.000Z') }), now)).toBe(
      false,
    );
  });

  it('skips submitted papers and closed calls', () => {
    expect(isAbandonedDraft(paper({ status: 'SUBMITTED' }), now)).toBe(false);
    expect(isAbandonedDraft(paper({ conferenceStatus: 'REVIEWING' }), now)).toBe(false);
    expect(
      isAbandonedDraft(paper({ cfpClosesAt: new Date('2026-09-28T00:00:00.000Z') }), now),
    ).toBe(false);
  });
});
