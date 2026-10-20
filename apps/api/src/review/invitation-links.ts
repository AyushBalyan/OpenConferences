import { getConfig } from '@openconferences/config/env';
import type { Prisma } from '@openconferences/db';

export const REVIEWER_INVITATION_TTL_DAYS = 7;
export function reviewerInvitationUrl(token: string): string {
  // Email-bound invitation only; acceptance still requires signing in as the invited address.
  const url = new URL('/sign-in', getConfig().webUrl);
  url.searchParams.set('reviewerInvite', token);
  return url.toString();
}
export async function lockInvitationEmails(
  tx: Prisma.TransactionClient,
  conferenceId: string,
  emails: string[],
) {
  // A deterministic order also makes overlapping batches safe across different integrations.
  for (const email of [...new Set(emails)].sort())
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`reviewer-invite:${conferenceId}:${email}`},0))::text`;
}
