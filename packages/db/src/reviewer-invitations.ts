import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type { Prisma, ReviewerInvitation } from '@prisma/client';

export const INVITATION_BATCH_JOB = 'reviewer.invitation_batch';
export function invitationTokenHash(token: string) {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}
export function invitationTokenMatches(row: { token: string }, raw: string) {
  const expected = row.token.startsWith('sha256:') ? invitationTokenHash(raw) : raw;
  const stored = Buffer.from(row.token),
    supplied = Buffer.from(expected);
  return stored.length === supplied.length && timingSafeEqual(stored, supplied);
}
function key(secret: string) {
  if (secret.length < 32) throw new Error('Invitation protection key is not configured');
  return createHash('sha256').update(`reviewer-invitation:v1:${secret}`).digest();
}
export function sealInvitationData(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from('reviewer-invitation:v1'));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function openInvitationData(value: string, secret: string) {
  const data = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', key(secret), data.subarray(0, 12));
  cipher.setAAD(Buffer.from('reviewer-invitation:v1'));
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8');
}
export function newInvitationSecret(secret: string) {
  const raw = randomBytes(32).toString('hex');
  return { raw, token: invitationTokenHash(raw), tokenCiphertext: sealInvitationData(raw, secret) };
}
export function recoverInvitationToken(
  row: { token: string; tokenCiphertext?: string | null },
  secret: string,
) {
  if (row.tokenCiphertext) return openInvitationData(row.tokenCiphertext, secret);
  if (row.token.startsWith('sha256:')) throw new Error('Invitation link is unavailable');
  return row.token; // Existing mailed links remain valid during the additive migration.
}
export function declineInvitationToken(row: { id: string; token: string }, secret: string) {
  return `${row.id}.${createHmac('sha256', key(secret)).update(`decline:${row.id}:${row.token}`).digest('hex')}`;
}
export function validDeclineToken(
  row: { id: string; token: string },
  token: string,
  secret: string,
) {
  const expected = Buffer.from(declineInvitationToken(row, secret));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function invitationLifecycle(
  row: { status: string; expiresAt: Date; revokedAt?: Date | null; sentAt?: Date | null },
  now = new Date(),
) {
  if (row.revokedAt) return 'REVOKED' as const;
  if (row.status === 'ACCEPTED' || row.status === 'DECLINED') return row.status;
  if (row.status === 'EXPIRED' || row.expiresAt <= now) return 'EXPIRED' as const;
  return row.sentAt ? ('SENT' as const) : ('PENDING' as const);
}
export async function recordInvitationChange(
  tx: Prisma.TransactionClient,
  row: Pick<ReviewerInvitation, 'id' | 'organizationId' | 'conferenceId' | 'version'>,
  action: string,
  actorUserId: string | null = null,
) {
  // Serialize sequence allocation per conference until commit, so polling a
  // committed watermark cannot skip a lower sequence that commits later.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${row.conferenceId}`}, 0))::text`;
  await tx.reviewerInvitationChange.createMany({
    data: {
      organizationId: row.organizationId,
      conferenceId: row.conferenceId,
      invitationId: row.id,
      action,
      version: row.version,
    },
  });
  await tx.auditLog.createMany({
    data: {
      id: randomUUID(),
      organizationId: row.organizationId,
      conferenceId: row.conferenceId,
      actorUserId,
      action: `reviewer_invitation.${action.toLowerCase()}`,
      entity: 'ReviewerInvitation',
      entityId: row.id,
      diff: { version: row.version }, // No tokens, email addresses or personal responses.
    },
  });
}

const INVITATION_MAIL_PREFIX = 'reviewer-mail:v1:';
export function sealInvitationMail(value: string, secret: string) {
  return value.startsWith(INVITATION_MAIL_PREFIX)
    ? value
    : INVITATION_MAIL_PREFIX + sealInvitationData(value, secret);
}
export function openInvitationMail(value: string, secret: string) {
  return value.startsWith(INVITATION_MAIL_PREFIX)
    ? openInvitationData(value.slice(INVITATION_MAIL_PREFIX.length), secret)
    : value;
}
export function isProtectedInvitationMail(value: string) {
  return value.startsWith(INVITATION_MAIL_PREFIX);
}
