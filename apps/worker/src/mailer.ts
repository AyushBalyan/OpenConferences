import { getConfig } from '@openconferences/config/env';
import type { MailSendInput, MailSendResult, Mailer } from './mailer.types.js';

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
    return new ZeptoMailAdapter(config.mail.zeptoApiKey, config.mail.zeptoApiUrl, config.mail.from);
  }
  return new LogMailerAdapter();
}

export class ZeptoMailAdapter implements Mailer {
  readonly name = 'zeptomail';

  constructor(
    private readonly apiKey: string,
    private readonly apiUrl: string,
    private readonly fromAddress: string,
  ) {}

  async send(input: MailSendInput): Promise<MailSendResult> {
    const { SendMailClient } = await import('zeptomail');

    const client = new SendMailClient({
      url: this.apiUrl,
      token: this.apiKey,
    });

    const fromAddress = this.fromAddress;
    const atIndex = fromAddress.indexOf('@');
    const fromName = atIndex > 0 ? fromAddress.slice(0, atIndex) : 'noreply';

    const response = await client.sendMail({
      from: {
        address: fromAddress,
        name: fromName,
      },
      to: [
        {
          email_address: {
            address: input.to,
          },
        },
      ],
      subject: input.subject,
      htmlbody: input.html,
      ...(input.replyTo ? { reply_to: [{ address: input.replyTo }] } : {}),
      ...(input.tags?.length ? { client_reference: input.tags.join(',') } : {}),
    });

    const messageId =
      (response as { data?: { message_id?: string }; message_id?: string })?.data?.message_id ??
      (response as { message_id?: string })?.message_id;

    return { providerMessageId: messageId };
  }
}
