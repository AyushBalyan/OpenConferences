import { describe, expect, it } from 'vitest';
import {
  buildZeptoMailPayload,
  parseMailFrom,
  recipientDisplayName,
  zeptoMailAuthorization,
} from './mailer.js';

describe('zeptoMailAuthorization', () => {
  it('prefixes raw tokens', () => {
    expect(zeptoMailAuthorization('abc123')).toBe('Zoho-enczapikey abc123');
  });

  it('passes through full authorization headers', () => {
    expect(zeptoMailAuthorization('Zoho-enczapikey abc123')).toBe('Zoho-enczapikey abc123');
  });
});

describe('parseMailFrom', () => {
  it('parses display name and address from MAIL_FROM', () => {
    expect(parseMailFrom('Fresi <notifications@mail.fresi.org>')).toEqual({
      address: 'notifications@mail.fresi.org',
      name: 'Fresi',
    });
  });

  it('uses MAIL_FROM_NAME override for bare addresses', () => {
    expect(parseMailFrom('notifications@mail.fresi.org', 'Fresi')).toEqual({
      address: 'notifications@mail.fresi.org',
      name: 'Fresi',
    });
  });
});

describe('buildZeptoMailPayload', () => {
  it('matches CopCultural transactional defaults', () => {
    const payload = buildZeptoMailPayload(
      {
        to: 'user@example.com',
        toName: 'Ayush',
        subject: 'Verify your email',
        html: '<p>Hello</p>',
        text: 'Hello',
        tags: ['auth.email_verify'],
      },
      'Fresi <notifications@mail.fresi.org>',
    );

    expect(payload.from).toEqual({
      address: 'notifications@mail.fresi.org',
      name: 'Fresi',
    });
    expect(payload.to).toEqual([{ email_address: { address: 'user@example.com', name: 'Ayush' } }]);
    expect(payload.track_clicks).toBe(false);
    expect(payload.track_opens).toBe(false);
    expect(payload.textbody).toBe('Hello');
    expect(payload).not.toHaveProperty('client_reference');
  });

  it('derives recipient name from email when omitted', () => {
    expect(recipientDisplayName('ayush.balyan@gmail.com')).toBe('ayush.balyan');
  });
});
