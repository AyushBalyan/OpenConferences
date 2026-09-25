import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOutreachMailer, LogOutreachMailer, SesOutreachMailer } from './outreach-mailer.js';
import {
  buildResendSendPayload,
  isTransientResendError,
  outreachIdempotencyKey,
  resendAuthorization,
  ResendOutreachMailer,
  sendResendEmailRequest,
} from './outreach-mailer-resend.js';

function requestHeader(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers;
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key?.toLowerCase() === name.toLowerCase());
    return entry?.[1];
  }
  return (headers as Record<string, string>)[name];
}

describe('createOutreachMailer', () => {
  it('selects the log adapter', () => {
    expect(createOutreachMailer('log')).toBeInstanceOf(LogOutreachMailer);
    expect(createOutreachMailer('log').name).toBe('log');
  });

  it('selects the SES adapter', () => {
    expect(createOutreachMailer('ses')).toBeInstanceOf(SesOutreachMailer);
    expect(createOutreachMailer('ses').name).toBe('ses');
  });
});

describe('Resend adapter payload', () => {
  const input = {
    to: 'reviewer@example.edu',
    toName: 'Dr. Ada',
    subject: 'TPC invitation',
    html: '<p>Hello</p>',
    fromName: 'OpenConferences Outreach',
    fromEmail: 'outreach@example.com',
    replyToEmail: 'chairs@example.com',
    recipientId: '11111111-1111-4111-8111-111111111111',
    campaignId: '22222222-2222-4222-8222-222222222222',
    conferenceId: '33333333-3333-4333-8333-333333333333',
  };

  it('uses the Resend email id, outreach idempotency key, and signed tags', () => {
    const payload = buildResendSendPayload(input);
    expect(payload.to).toEqual(['reviewer@example.edu']);
    expect(payload.from).toBe('OpenConferences Outreach <outreach@example.com>');
    expect(payload.reply_to).toBe('chairs@example.com');
    expect(payload.tags).toEqual([
      { name: 'channel', value: 'outreach' },
      { name: 'campaignId', value: input.campaignId },
      { name: 'recipientId', value: input.recipientId },
      { name: 'conferenceId', value: input.conferenceId },
    ]);
    expect(outreachIdempotencyKey(input.recipientId)).toBe(`outreach/${input.recipientId}`);
    expect(resendAuthorization('re_test_key')).toBe('Bearer re_test_key');
  });

  it('stores data.id as providerMessageId via HTTP', async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 're_123' }, { status: 200 }));
    const mailer = new ResendOutreachMailer(
      're_test_key',
      'https://api.resend.com/emails',
      10,
      async () => undefined,
      fetchMock,
    );
    const result = await mailer.send(input);
    expect(result.providerMessageId).toBe('re_123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
          'Idempotency-Key': `outreach/${input.recipientId}`,
          'User-Agent': 'openconferences-outreach/1.0',
        }),
        body: JSON.stringify(buildResendSendPayload(input)),
      }),
    );
  });

  it('retries transient rate and server errors with the same idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ name: 'rate_limit_exceeded', message: 'slow down' }, { status: 429 }),
      )
      .mockResolvedValueOnce(
        Response.json({ name: 'application_error', message: 'server' }, { status: 500 }),
      )
      .mockResolvedValueOnce(Response.json({ id: 're_ok' }, { status: 200 }));
    const delays: number[] = [];
    const mailer = new ResendOutreachMailer(
      're_test_key',
      'https://api.resend.com/emails',
      10,
      async (ms) => {
        delays.push(ms);
      },
      fetchMock,
    );

    const result = await mailer.send(input);
    expect(result.providerMessageId).toBe('re_ok');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const idempotencyKeys = fetchMock.mock.calls.map((call) =>
      requestHeader(call[1] as RequestInit, 'Idempotency-Key'),
    );
    expect(idempotencyKeys.every((key) => key === `outreach/${input.recipientId}`)).toBe(true);
    expect(delays).toEqual([200, 400]);
  });

  it('does not retry quota exhaustion', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ name: 'daily_quota_exceeded', message: 'quota' }, { status: 429 }),
    );
    const mailer = new ResendOutreachMailer(
      're_test_key',
      'https://api.resend.com/emails',
      10,
      async () => {
        throw new Error('should not sleep');
      },
      fetchMock,
    );
    await expect(mailer.send(input)).rejects.toThrow(/quota/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports unlimited daily quota and the configured send rate', async () => {
    const mailer = new ResendOutreachMailer(
      're_test_key',
      'https://api.resend.com/emails',
      8,
      async () => undefined,
      vi.fn(async () => Response.json({ id: 'x' }, { status: 200 })),
    );
    await expect(mailer.getSendLimits()).resolves.toEqual({
      sendingEnabled: true,
      max24HourSend: -1,
      sentLast24Hours: 0,
      maxSendRate: 8,
    });
  });
});

describe('sendResendEmailRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses provider errors from HTTP responses', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ name: 'validation_error', message: 'Invalid from' }, { status: 422 }),
    );

    await expect(
      sendResendEmailRequest(
        {
          apiKey: 're_test_key',
          apiUrl: 'https://api.resend.com/emails',
          payload: buildResendSendPayload({
            to: 'reviewer@example.edu',
            toName: 'Dr. Ada',
            subject: 'Hello',
            html: '<p>Hello</p>',
            fromName: 'OpenConferences Outreach',
            fromEmail: 'outreach@example.com',
            replyToEmail: 'chairs@example.com',
            recipientId: '11111111-1111-4111-8111-111111111111',
            campaignId: '22222222-2222-4222-8222-222222222222',
            conferenceId: '33333333-3333-4333-8333-333333333333',
          }),
          idempotencyKey: 'outreach/test',
        },
        fetchMock,
      ),
    ).rejects.toThrow(/Invalid from/);
  });
});

describe('Resend retry classification', () => {
  it('retries rate limits and server errors only', () => {
    expect(isTransientResendError({ name: 'rate_limit_exceeded', statusCode: 429 })).toBe(true);
    expect(isTransientResendError({ name: 'api_error', statusCode: 500 })).toBe(true);
    expect(
      isTransientResendError({ name: 'concurrent_idempotent_requests', statusCode: 409 }),
    ).toBe(true);
    expect(isTransientResendError({ name: 'daily_quota_exceeded', statusCode: 429 })).toBe(false);
    expect(isTransientResendError({ name: 'monthly_quota_exceeded', statusCode: 429 })).toBe(false);
    expect(isTransientResendError({ name: 'validation_error', statusCode: 400 })).toBe(false);
    expect(isTransientResendError({ name: 'authentication_error', statusCode: 401 })).toBe(false);
  });
});
