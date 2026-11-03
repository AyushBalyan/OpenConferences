import type { ConferenceStatus } from './tenancy.js';

export type CfpWindow = {
  status: string;
  cfpOpensAt?: Date | string | null;
  cfpClosesAt?: Date | string | null;
};

function timestamp(value: Date | string | null | undefined): number {
  return value == null ? NaN : new Date(value).getTime();
}

/** The closing instant is exclusive. Explicit later phases, including manual closure, win. */
export function effectiveConferenceStatus(
  conference: CfpWindow,
  now = new Date(),
): ConferenceStatus {
  if (conference.status !== 'CFP_OPEN') return conference.status as ConferenceStatus;
  const opens = timestamp(conference.cfpOpensAt);
  const closes = timestamp(conference.cfpClosesAt);
  if (Number.isFinite(closes) && now.getTime() >= closes) return 'CFP_CLOSED';
  if (
    !Number.isFinite(opens) ||
    !Number.isFinite(closes) ||
    opens >= closes ||
    now.getTime() < opens
  )
    return 'DRAFT';
  return 'CFP_OPEN';
}

export function isCfpOpen(conference: CfpWindow, now = new Date()): boolean {
  return effectiveConferenceStatus(conference, now) === 'CFP_OPEN';
}
