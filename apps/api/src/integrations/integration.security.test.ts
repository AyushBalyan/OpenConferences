import { integrationLogUrl } from './integration.http';
import { describe, it, expect } from 'vitest';
import {
  botQuerySchema,
  integrationScopesSchema,
  INTEGRATION_SCOPES,
  botCreateAssignmentSchema,
} from '@openconferences/schemas';
import {
  makeCredential,
  parseCredential,
  hashMatches,
  encodeCursor,
  decodeCursor,
  type IntegrationPrincipal,
} from './integration.security';
const p: IntegrationPrincipal = {
  integrationId: '019f9957-54d6-722d-a8b9-d653fec9a0a3',
  conferenceId: '019f9957-54d6-722d-a8b9-d653fec9a0a4',
  organizationId: '019f9957-54d6-722d-a8b9-d653fec9a0a5',
  userId: '019f9957-54d6-722d-a8b9-d653fec9a0a6',
  keyId: '019f9957-54d6-722d-a8b9-d653fec9a0a7',
  scopes: ['papers:read'],
  expiresAt: new Date(),
  conferenceName: 'Test',
  conferenceReviewDueAt: null,
};
process.env.BOT_API_ENABLED = 'true';
process.env.BOT_API_CURSOR_SECRET = '12'.repeat(32);
describe('bot credentials and query contracts', () => {
  it('requires explicit write dependencies and accepts the complete nine-scope grant', () => {
    expect(integrationScopesSchema.safeParse(['assignments:write']).success).toBe(false);
    expect(
      integrationScopesSchema.safeParse([
        'assignments:write',
        'assignments:read',
        'papers:read',
        'reviewers:read',
      ]).success,
    ).toBe(true);
    expect(integrationScopesSchema.safeParse([...INTEGRATION_SCOPES]).success).toBe(true);
  });
  it('requires a deadline and request UUID and rejects extra write operations', () => {
    const input = {
      requestId: p.keyId,
      paperId: p.conferenceId,
      reviewerId: p.userId,
      dueAt: '2030-01-02T17:30:00+05:30',
    };
    expect(botCreateAssignmentSchema.safeParse(input).success).toBe(true);
    expect(botCreateAssignmentSchema.safeParse({ ...input, dueAt: undefined }).success).toBe(false);
    expect(
      botCreateAssignmentSchema.safeParse({ ...input, dueAt: '2030-01-02T17:30:00' }).success,
    ).toBe(false);
    expect(botCreateAssignmentSchema.safeParse({ ...input, requestId: 'retry' }).success).toBe(
      false,
    );
    expect(botCreateAssignmentSchema.safeParse({ ...input, notify: false }).success).toBe(false);
  });
  it('strips query values and resource identifiers from integration telemetry', () => {
    expect(
      integrationLogUrl(
        '/api/v1/integrations/v1/conferences/' +
          p.conferenceId +
          '/authors?email=private@example.test',
      ),
    ).toBe('/api/v1/integrations/v1/conferences/:id/authors');
  });
  it('uses high-entropy credentials and stores only a digest', () => {
    const c = makeCredential();
    expect(parseCredential('Bearer ' + c.token)).toEqual({ id: c.id, hash: c.hash });
    expect(c.token).not.toContain(c.hash);
    expect(hashMatches(c.hash, c.hash)).toBe(true);
    expect(parseCredential('Bearer ' + c.token + 'x')).toBeNull();
    expect(hashMatches('bad', c.hash)).toBe(false);
  });
  it('enforces dependencies and rejects unknown scopes', () => {
    expect(integrationScopesSchema.safeParse(['authors:read']).success).toBe(false);
    expect(integrationScopesSchema.safeParse(['papers:read', 'authors:read']).success).toBe(true);
    expect(integrationScopesSchema.safeParse(['write']).success).toBe(false);
  });
  it('accepts uuidv7 and query booleans while rejecting drafts and unbounded pages', () => {
    expect(
      botQuerySchema.parse({ trackId: p.conferenceId, includeWithdrawn: 'false' }).includeWithdrawn,
    ).toBe(false);
    expect(botQuerySchema.safeParse({ status: 'DRAFT' }).success).toBe(false);
    expect(botQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(botQuerySchema.safeParse({ includeWithdrawn: 'yes' }).success).toBe(false);
  });
  it('encrypts cursors and binds them to tenant, resource, filters and scopes', () => {
    const q = botQuerySchema.parse({});
    const token = encodeCursor(p, 'reviewers', q, p.userId);
    expect(token).not.toContain(p.userId);
    expect(Buffer.from(token.slice(2), 'base64url').toString()).not.toContain(p.userId);
    expect(decodeCursor(p, 'reviewers', { ...q, cursor: token })).toBe(p.userId);
    for (const changed of [
      { ...q, history: 'ALL' as const },
      { ...q, trackId: p.conferenceId },
    ])
      expect(() => decodeCursor(p, 'reviewers', { ...changed, cursor: token })).toThrow();
    expect(() =>
      decodeCursor({ ...p, integrationId: p.keyId }, 'reviewers', { ...q, cursor: token }),
    ).toThrow();
    expect(() => decodeCursor(p, 'papers', { ...q, cursor: token })).toThrow();
  });
});
