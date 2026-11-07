import { it, expect, vi, beforeEach } from 'vitest';
const fixture = vi.hoisted(() => ({ send: vi.fn(), update: vi.fn().mockResolvedValue({}) }));
vi.mock('./mailer.js', () => ({ createMailerAdapter: () => ({ send: fixture.send }) }));
vi.mock('@openconferences/config/env', () => ({
  getConfig: () => ({ auth: { secret: 'synthetic-worker-mail-secret-1234567890123456' } }),
}));
vi.mock('@openconferences/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openconferences/db')>()),
  withTenantContext: (_context: unknown, callback: (tx: unknown) => unknown) =>
    callback({ notificationLog: { update: fixture.update } }),
}));
import { sealInvitationMail } from '@openconferences/db';
import { processNotificationJob } from './notification.js';
const secret = 'synthetic-worker-mail-secret-1234567890123456';
const html = '<a href="https://example.test/accept?token=synthetic-secret">Accept</a>';
const payload = {
  logId: '10000000-0000-4000-8000-000000000001',
  to: 'researcher@example.test',
  subject: 'Invitation',
  html: sealInvitationMail(html, secret),
  text: sealInvitationMail('synthetic-secret', secret),
};
beforeEach(() => {
  fixture.send.mockReset();
  fixture.update.mockClear();
});
it('decrypts protected invitation bodies only for mail delivery and records successful delivery', async () => {
  fixture.send.mockResolvedValue({ providerMessageId: 'synthetic' });
  await processNotificationJob(payload);
  expect(fixture.send.mock.calls[0]![0].html).toContain(html);
  expect(fixture.send.mock.calls[0]![0].text).toContain('synthetic-secret');
  expect(fixture.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
  );
});
it('keeps invitation credentials out of persisted and thrown provider errors', async () => {
  fixture.send.mockRejectedValue(new Error('Provider echoed synthetic-secret'));
  await expect(processNotificationJob(payload)).rejects.toThrow(
    /^Invitation email delivery failed$/,
  );
  expect(fixture.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { status: 'FAILED', error: 'Invitation email delivery failed' },
    }),
  );
});
it('continues delivering legacy plaintext queued messages', async () => {
  fixture.send.mockResolvedValue({});
  await processNotificationJob({ ...payload, html, text: undefined });
  expect(fixture.send.mock.calls[0]![0].html).toContain(html);
});
