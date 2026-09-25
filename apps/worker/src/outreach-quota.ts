import { deriveOutreachCampaignStatus } from '@openconferences/schemas';

export { deriveOutreachCampaignStatus };

export function remainingQuotaForTest(max24HourSend: number, sentLast24Hours: number): number {
  if (max24HourSend < 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor(max24HourSend - sentLast24Hours));
}
