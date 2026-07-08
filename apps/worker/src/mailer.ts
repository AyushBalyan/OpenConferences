import { getConfig } from '@openconferences/config/env';
import { formatMailError } from './mail-error.js';
import type { MailSendInput, MailSendResult, Mailer } from './mailer.types.js';

export type ZeptoMailPayload = {
  from: { address: string; name: string };
  to: Array<{ email_address: { address: string; name: string } }>;
  subject: string;
  htmlbody: string;
  textbody?: string;
  track_clicks: boolean;
  track_opens: boolean;
  reply_to?: Array<{ address: string; name: string }>;
};

export function zeptoMailAuthorization(apiKey: string): string {
  const raw = apiKey.trim();
  if (/^zoho-enczapikey\s+/i.test(raw)) {
    return raw;
  }
  return `Zoho-enczapikey ${raw}`;
}

export function parseMailFrom(
  from: string,
  fromNameOverride?: string,
): { address: string; name: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  const address = (match?.[2] ?? from).trim();
  const parsedName = match?.[1]?.trim();
  const name = fromNameOverride?.trim() || parsedName || 'OpenConferences';
  return { address, name };
}

export function recipientDisplayName(email: string, toName?: string): string {
  if (toName?.trim()) {
    return toName.trim().slice(0, 250);
  }
  const local = email.split('@')[0]?.trim();
  return local || email;
}

export function buildZeptoMailPayload(
  input: MailSendInput,
  fromAddress: string,
  fromName?: string,
): ZeptoMailPayload {
  const from = parseMailFrom(fromAddress, fromName);
  const toAddress = input.to.trim().toLowerCase();

  return {
    from,
    to: [
      {
        email_address: {
          address: toAddress,
          name: recipientDisplayName(toAddress, input.toName),
        },
      },
    ],
    subject: input.subject,
    htmlbody: input.html,
    ...(input.text ? { textbody: input.text } : {}),
    track_clicks: false,
    track_opens: false,
    ...(input.replyTo?.trim()
      ? {
          reply_to: [
            {
              address: input.replyTo.trim(),
              name: input.replyTo.trim().slice(0, 250),
            },
          ],
        }
      : {}),
  };
}

export class LogMailerAdapter implements Mailer {
  readonly name = 'log';

  async send(input: MailSendInput): Promise<MailSendResult> {
    console.info(
      JSON.stringify({
        level: 'info',
        msg: 'Email sent (dev log adapter)',
        to: input.to,
        subject: input.subject,
        tags: input.tags,
      }),
    );
    return { providerMessageId: `log-${Date.now()}` };
  }
}

export function createMailerAdapter(): Mailer {
  const config = getConfig();
  if (config.mail.zeptoApiKey) {
    return new ZeptoMailAdapter(
      config.mail.zeptoApiKey,
      config.mail.zeptoApiUrl,
      config.mail.from,
      config.mail.fromName,
    );
  }
  return new LogMailerAdapter();
}

export class ZeptoMailAdapter implements Mailer {
  readonly name = 'zeptomail';

  constructor(
    private readonly apiKey: string,
    private readonly apiUrl: string,
    private readonly fromAddress: string,
    private readonly fromName?: string,
  ) {}

  async send(input: MailSendInput): Promise<MailSendResult> {
    const payload = buildZeptoMailPayload(input, this.fromAddress, this.fromName);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: zeptoMailAuthorization(this.apiKey),
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const bodyText = await response.text();
      let body: unknown = bodyText;

      try {
        body = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        body = { message: bodyText };
      }

      if (!response.ok) {
        throw new Error(formatMailError(body));
      }

      const record = body as {
        data?: { message_id?: string; request_id?: string };
        message_id?: string;
        request_id?: string;
      };

      return {
        providerMessageId:
          record.data?.message_id ??
          record.message_id ??
          record.data?.request_id ??
          record.request_id,
      };
    } catch (err) {
      throw new Error(formatMailError(err));
    }
  }
}
