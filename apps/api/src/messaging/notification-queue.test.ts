import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  emailSuppression: { findUnique: vi.fn().mockResolvedValue(null) },
  notificationLog: { findUnique: vi.fn(), create: vi.fn() },
}));
vi.mock('@openconferences/config/env', () => ({
  getConfig: () => ({
    isTest: true,
    auth: { secret: 'synthetic-mail-test-secret-1234567890123456' },
  }),
}));
vi.mock('@openconferences/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openconferences/db')>()),
  withTenantContext: (_context: unknown, callback: (tx: typeof db) => unknown) => callback(db),
  generateId: () => 'log-1',
}));
import { openInvitationMail } from '@openconferences/db';
import { NotificationService } from './notification.service';

describe('retrying notification scheduling', () => {
  const input = {
    templateKey: 'registration.confirmed',
    to: 'author@example.test',
    context: {},
    idempotencyKey: 'payment-captured-123',
  };
  it('does not schedule another delivery for an already queued payment receipt', async () => {
    db.notificationLog.findUnique.mockResolvedValue({
      id: 'log-1',
      status: 'QUEUED',
      toEmail: input.to,
      subject: 'Payment received',
      renderedHtml: '<p>pay_123: 50.00 USD</p>',
    });
    const sendNotification = vi.fn().mockResolvedValue('job-1');
    const service = new NotificationService({} as never, { sendNotification } as never);
    await service.enqueue(input);
    expect(sendNotification).not.toHaveBeenCalled();
  });
  it('does not send a receipt that is already delivered', async () => {
    db.notificationLog.findUnique.mockResolvedValue({ id: 'log-1', status: 'SENT' });
    const sendNotification = vi.fn();
    const service = new NotificationService({} as never, { sendNotification } as never);
    expect(await service.enqueue(input)).toBe('log-1');
    expect(sendNotification).not.toHaveBeenCalled();
  });
  it('uses the same transaction for the receipt log and delivery job', async () => {
    db.notificationLog.findUnique.mockResolvedValue(null);
    db.notificationLog.create.mockResolvedValue({ id: 'log-1' });
    const sendNotification = vi.fn().mockRejectedValue(new Error('Queue unavailable'));
    const resolveActiveTemplate = vi.fn().mockResolvedValue({
      subject: 'Receipt',
      bodyHtml: '<p>Receipt</p>',
      version: 2,
    });
    const service = new NotificationService(
      { resolveActiveTemplate } as never,
      { sendNotification } as never,
    );
    await expect(service.enqueue(input)).rejects.toThrow('Queue unavailable');
    expect(db.notificationLog.create).toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({ logId: 'log-1' }), db);
  });
  it('keeps invitation credentials encrypted in both notification history and queued delivery bodies', async () => {
    db.notificationLog.findUnique.mockResolvedValue(null);
    const sendNotification = vi.fn().mockResolvedValue('job-1');
    const html = '<a href="https://example.test/decline#token=synthetic-secret">Decline</a>';
    const service = new NotificationService(
      {
        resolveActiveTemplate: vi.fn().mockResolvedValue({
          subject: 'Invitation',
          bodyHtml: html,
          bodyText: 'synthetic-secret',
          version: 1,
        }),
      } as never,
      { sendNotification } as never,
    );
    await service.enqueue({ ...input, templateKey: 'reviewer.invitation' });
    const log = db.notificationLog.create.mock.calls.at(-1)![0].data;
    const queued = sendNotification.mock.calls[0][0];
    expect(log.renderedHtml).not.toContain('synthetic-secret');
    expect(queued.html).not.toContain('synthetic-secret');
    expect(queued.text).not.toContain('synthetic-secret');
    expect(openInvitationMail(queued.html, 'synthetic-mail-test-secret-1234567890123456')).toBe(
      html,
    );
  });
  it('adds the separate decline action to an existing organization invitation template', async () => {
    db.notificationLog.findUnique.mockResolvedValue(null);
    const sendNotification = vi.fn().mockResolvedValue('job-1');
    const service = new NotificationService(
      {
        resolveActiveTemplate: vi.fn().mockResolvedValue({
          subject: 'Custom invitation',
          bodyHtml: '<p>Original organization branding</p>',
          bodyText: 'Original plain text',
          version: 1,
        }),
      } as never,
      { sendNotification } as never,
    );
    await service.enqueue({
      ...input,
      templateKey: 'reviewer.invitation',
      context: { declineUrl: 'https://example.test/reviewer-invite/decline#token=synthetic' },
    });
    const html = openInvitationMail(
      sendNotification.mock.calls[0][0].html,
      'synthetic-mail-test-secret-1234567890123456',
    );
    expect(html).toContain('Original organization branding');
    expect(html).toContain('https://example.test/reviewer-invite/decline#token=synthetic');
  });
});
