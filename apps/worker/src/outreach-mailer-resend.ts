import { getConfig } from '@openconferences/config/env';
import { formatMailError } from './mail-error.js';
import type {
  OutreachMailer,
  OutreachSendInput,
  OutreachSendLimits,
  OutreachSendResult,
} from './outreach-mailer.js';

export const RESEND_EMAILS_API_URL = 'https://api.resend.com/emails';
export const RESEND_MAX_SEND_ATTEMPTS = 4;
export const RESEND_RETRY_BASE_DELAY_MS = 200;
export const RESEND_USER_AGENT = 'openconferences-outreach/1.0';

export type ResendSendPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  reply_to: string;
  tags: Array<{ name: string; value: string }>;
};

export type ResendSendError = {
  name?: string;
  message?: string;
  statusCode?: number | null;
};

export function resendAuthorization(apiKey: string): string {
  const raw = apiKey.trim();
  if (/^bearer\s+/i.test(raw)) {
    return raw;
  }
  return `Bearer ${raw}`;
}

export function outreachIdempotencyKey(recipientId: string): string {
  return `outreach/${recipientId}`;
}

export function buildResendSendPayload(input: OutreachSendInput): ResendSendPayload {
  return {
    from: `${input.fromName} <${input.fromEmail}>`,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    ...(input.text ? { text: input.text } : {}),
    reply_to: input.replyToEmail,
    tags: [
      { name: 'channel', value: 'outreach' },
      { name: 'campaignId', value: input.campaignId },
      { name: 'recipientId', value: input.recipientId },
      { name: 'conferenceId', value: input.conferenceId },
    ],
  };
}

export function parseResendHttpError(body: unknown, status: number): ResendSendError {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const nested =
      record.error && typeof record.error === 'object'
        ? (record.error as Record<string, unknown>)
        : record;
    return {
      name: typeof nested.name === 'string' ? nested.name : undefined,
      message:
        typeof nested.message === 'string'
          ? nested.message
          : typeof record.message === 'string'
            ? record.message
            : formatMailError(body),
      statusCode:
        typeof nested.statusCode === 'number'
          ? nested.statusCode
          : typeof record.statusCode === 'number'
            ? record.statusCode
            : status,
    };
  }

  return {
    message:
      typeof body === 'string' && body.length > 0 ? body : `Resend request failed (${status})`,
    statusCode: status,
  };
}

export function isTransientResendError(error: ResendSendError | null | undefined): boolean {
  if (!error) return false;
  const name = (error.name ?? '').toLowerCase();
  const status = error.statusCode;
  if (name === 'daily_quota_exceeded' || name === 'monthly_quota_exceeded') {
    return false;
  }
  if (
    name === 'rate_limit_exceeded' ||
    name === 'api_error' ||
    name === 'concurrent_idempotent_requests'
  ) {
    return true;
  }
  if (status === 429 && name !== 'daily_quota_exceeded' && name !== 'monthly_quota_exceeded') {
    return name.length === 0 || name === 'rate_limit_exceeded';
  }
  return status === 500 || status === 502 || status === 503;
}

export function isTransientOutreachProviderError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as ResendSendError & { cause?: unknown };
  if (isTransientResendError(record)) return true;
  if (err instanceof TypeError) return true;
  const nested = record.cause;
  if (nested && typeof nested === 'object') {
    return isTransientResendError(nested as ResendSendError);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function sendResendEmailRequest(
  input: {
    apiKey: string;
    apiUrl: string;
    payload: ResendSendPayload;
    idempotencyKey: string;
  },
  httpFetch: typeof fetch = fetch,
): Promise<{ providerMessageId: string }> {
  const response = await httpFetch(input.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: resendAuthorization(input.apiKey),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
      'User-Agent': RESEND_USER_AGENT,
    },
    body: JSON.stringify(input.payload),
  });

  const bodyText = await response.text();
  let body: unknown = bodyText;

  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { message: bodyText };
  }

  if (!response.ok) {
    const error = parseResendHttpError(body, response.status);
    const failure = new Error(
      error.message ?? `Resend request failed (${response.status})`,
    ) as Error & ResendSendError;
    failure.name = error.name ?? failure.name;
    failure.statusCode = error.statusCode ?? response.status;
    throw failure;
  }

  const record = body as { id?: string };
  if (!record.id) {
    throw new Error('Resend send returned no email id');
  }

  return { providerMessageId: record.id };
}

export class ResendOutreachMailer implements OutreachMailer {
  readonly name = 'resend' as const;

  constructor(
    private readonly apiKey: string = getConfig().outreach.resend.apiKey ?? '',
    private readonly apiUrl: string = RESEND_EMAILS_API_URL,
    private readonly ratePerSecond: number = getConfig().outreach.resend.ratePerSecond,
    private readonly sleeper: (ms: number) => Promise<void> = sleep,
    private readonly httpFetch: typeof fetch = fetch,
  ) {
    if (!this.apiKey.trim()) {
      throw new Error('OUTREACH_RESEND_API_KEY is required for the Resend mailer');
    }
  }

  async getSendLimits(): Promise<OutreachSendLimits> {
    return {
      sendingEnabled: true,
      max24HourSend: -1,
      sentLast24Hours: 0,
      maxSendRate: this.ratePerSecond > 0 ? this.ratePerSecond : 10,
    };
  }

  async send(input: OutreachSendInput): Promise<OutreachSendResult> {
    const payload = buildResendSendPayload(input);
    const idempotencyKey = outreachIdempotencyKey(input.recipientId);
    let lastError: (Error & ResendSendError) | null = null;

    for (let attempt = 1; attempt <= RESEND_MAX_SEND_ATTEMPTS; attempt += 1) {
      try {
        return await sendResendEmailRequest(
          {
            apiKey: this.apiKey,
            apiUrl: this.apiUrl,
            payload,
            idempotencyKey,
          },
          this.httpFetch,
        );
      } catch (err) {
        lastError =
          err instanceof Error
            ? (err as Error & ResendSendError)
            : Object.assign(new Error(String(err)), err as ResendSendError);
        if (!isTransientOutreachProviderError(lastError) || attempt === RESEND_MAX_SEND_ATTEMPTS) {
          break;
        }
      }

      const delay = RESEND_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await this.sleeper(delay);
    }

    throw lastError ?? new Error('Resend send failed');
  }
}
