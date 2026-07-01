import { describe, expect, it } from 'vitest';
import { MessagingWebhookService } from './messaging-webhook.service';

describe('MessagingWebhookService', () => {
  const service = new MessagingWebhookService();

  it('verifySignature allows unsigned webhooks in test when secret is unset', () => {
    expect(service.verifySignature(Buffer.from('{}'), '')).toBe(true);
    expect(service.verifySignature(Buffer.from('{}'), 'invalid')).toBe(true);
  });
});
