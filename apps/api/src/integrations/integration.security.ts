import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { z } from 'zod';
import type { IntegrationScope, BotQuery } from '@openconferences/schemas';
export type IntegrationPrincipal = {
  integrationId: string;
  keyId: string;
  userId: string;
  conferenceId: string;
  organizationId: string;
  scopes: IntegrationScope[];
  expiresAt: Date;
  conferenceName: string;
  conferenceReviewDueAt: Date | null;
};
export function botConfig() {
  const enabled = process.env.BOT_API_ENABLED === 'true';
  const secret = process.env.BOT_API_CURSOR_SECRET ?? '';
  if (!enabled || !/^[a-f0-9]{64}$/i.test(secret))
    throw new ServiceUnavailableException('Bot API is not enabled');
  return { secret: Buffer.from(secret, 'hex') };
}
export function makeCredential() {
  const id = randomUUID();
  const token = `ocbot_v1.${id}.${randomBytes(32).toString('base64url')}`;
  return { id, token, hash: credentialHash(token) };
}
export function credentialHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function parseCredential(header: string | undefined) {
  if (!header || header.length > 200) return null;
  const m = /^Bearer (ocbot_v1\.([0-9a-f-]{36})\.[A-Za-z0-9_-]{43})$/.exec(header);
  if (!m || !z.string().uuid().safeParse(m[2]).success) return null;
  return { id: m[2]!, hash: credentialHash(m[1]!) };
}
export function hashMatches(a: string, b: string) {
  const x = Buffer.from(a, 'hex'),
    y = Buffer.from(b, 'hex');
  return x.length === 32 && y.length === 32 && timingSafeEqual(x, y);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((v) => JSON.parse(canonical(v))));
  if (value && typeof value === 'object')
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, JSON.parse(canonical(v))]),
      ),
    );
  return JSON.stringify(value);
}
function cursorContext(p: IntegrationPrincipal, resource: string, q: BotQuery) {
  const { cursor: _c, limit: _l, ...filters } = q;
  return canonical({
    integrationId: p.integrationId,
    conferenceId: p.conferenceId,
    scopes: [...p.scopes].sort(),
    resource,
    filters,
  });
}
export function encodeCursor(p: IntegrationPrincipal, resource: string, q: BotQuery, id: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', botConfig().secret, iv);
  cipher.setAAD(Buffer.from(cursorContext(p, resource, q)));
  const data = Buffer.concat([cipher.update(JSON.stringify({ id })), cipher.final()]);
  return '1.' + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function decodeCursor(
  p: IntegrationPrincipal,
  resource: string,
  q: BotQuery,
): string | undefined {
  if (!q.cursor) return undefined;
  try {
    if (!q.cursor.startsWith('1.')) throw new Error();
    const data = Buffer.from(q.cursor.slice(2), 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', botConfig().secret, data.subarray(0, 12));
    cipher.setAAD(Buffer.from(cursorContext(p, resource, q)));
    cipher.setAuthTag(data.subarray(12, 28));
    return z
      .object({ id: z.string().uuid() })
      .parse(
        JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString()),
      ).id;
  } catch {
    throw new BadRequestException('Invalid cursor for these filters');
  }
}
