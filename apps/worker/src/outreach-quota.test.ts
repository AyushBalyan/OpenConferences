import { describe, expect, it } from 'vitest';
import { deriveOutreachCampaignStatus, remainingQuotaForTest } from './outreach-quota.js';

describe('provider quota remaining', () => {
  it('treats -1 as unlimited', () => {
    expect(remainingQuotaForTest(-1, 10)).toBe(Number.POSITIVE_INFINITY);
  });

  it('never goes negative', () => {
    expect(remainingQuotaForTest(50, 80)).toBe(0);
  });

  it('subtracts sent from max', () => {
    expect(remainingQuotaForTest(200, 50)).toBe(150);
  });
});

describe('deriveOutreachCampaignStatus', () => {
  it('marks complete sends as SENT', () => {
    expect(deriveOutreachCampaignStatus({ sentCount: 3, failedCount: 0, skippedCount: 1 })).toBe(
      'SENT',
    );
  });

  it('marks mixed outcomes as PARTIAL', () => {
    expect(deriveOutreachCampaignStatus({ sentCount: 2, failedCount: 1, skippedCount: 0 })).toBe(
      'PARTIAL',
    );
  });

  it('marks all-failed as FAILED and all-skipped as SENT', () => {
    expect(deriveOutreachCampaignStatus({ sentCount: 0, failedCount: 4, skippedCount: 0 })).toBe(
      'FAILED',
    );
    expect(deriveOutreachCampaignStatus({ sentCount: 0, failedCount: 0, skippedCount: 3 })).toBe(
      'SENT',
    );
  });
});
