import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  sealInvitationMail,
  openInvitationMail,
  newInvitationSecret,
  recoverInvitationToken,
  invitationTokenHash,
  invitationTokenMatches,
  declineInvitationToken,
  validDeclineToken,
  sealInvitationData,
  openInvitationData,
  invitationLifecycle,
} from './reviewer-invitations.js';
const secret = 'isolated-unit-test-encryption-secret-12345';
describe('purpose-bound reviewer invitation secrets', () => {
  it('protects recoverable secrets and preserves legacy mailed acceptance tokens', () => {
    const token = newInvitationSecret(secret);
    expect(token.token).toBe(invitationTokenHash(token.raw));
    expect(invitationTokenMatches(token, token.raw)).toBe(true);
    expect(invitationTokenMatches(token, token.token)).toBe(false);
    expect(token.tokenCiphertext).not.toContain(token.raw);
    expect(recoverInvitationToken(token, secret)).toBe(token.raw);
    expect(recoverInvitationToken({ token: 'legacy-mail-token' }, secret)).toBe(
      'legacy-mail-token',
    );
    expect(() => openInvitationData(token.tokenCiphertext, secret + 'wrong')).toThrow();
    expect(() => newInvitationSecret('short')).toThrow();
  });
  it('separates decline purpose, binds invitation identity and invalidates old generations', () => {
    const row = { id: randomUUID(), ...newInvitationSecret(secret) };
    const decline = declineInvitationToken(row, secret);
    expect(validDeclineToken(row, decline, secret)).toBe(true);
    expect(validDeclineToken(row, row.raw, secret)).toBe(false);
    expect(validDeclineToken({ ...row, id: randomUUID() }, decline, secret)).toBe(false);
    expect(validDeclineToken({ ...row, ...newInvitationSecret(secret) }, decline, secret)).toBe(
      false,
    );
    expect(validDeclineToken(row, decline.slice(0, -1), secret)).toBe(false);
    const encrypted = sealInvitationData('Private response', secret);
    expect(openInvitationData(encrypted, secret)).toBe('Private response');
  });
  it('encrypts invitation email bodies and supports legacy queued messages', () => {
    const body = '<a href="https://example.test/accept?token=synthetic">Accept</a>';
    const protectedBody = sealInvitationMail(body, secret);
    expect(protectedBody).not.toContain('synthetic');
    expect(openInvitationMail(protectedBody, secret)).toBe(body);
    expect(openInvitationMail(body, secret)).toBe(body);
    expect(sealInvitationMail(protectedBody, secret)).toBe(protectedBody);
  });
  it('keeps terminal responses after expiry and reports Sent as an additive lifecycle', () => {
    const base = { status: 'PENDING', expiresAt: new Date('2030-01-01'), sentAt: new Date() };
    expect(invitationLifecycle(base, new Date('2026-01-01'))).toBe('SENT');
    expect(invitationLifecycle({ ...base, sentAt: null }, new Date('2026-01-01'))).toBe('PENDING');
    expect(invitationLifecycle({ ...base, status: 'ACCEPTED' }, new Date('2031-01-01'))).toBe(
      'ACCEPTED',
    );
    expect(invitationLifecycle({ ...base, status: 'DECLINED' }, new Date('2031-01-01'))).toBe(
      'DECLINED',
    );
    expect(invitationLifecycle({ ...base, revokedAt: new Date() })).toBe('REVOKED');
    expect(invitationLifecycle(base, new Date('2031-01-01'))).toBe('EXPIRED');
  });
});
