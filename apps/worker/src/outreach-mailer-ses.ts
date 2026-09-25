import { GetAccountCommand, SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { getConfig } from '@openconferences/config/env';
import type {
  OutreachMailer,
  OutreachSendInput,
  OutreachSendLimits,
  OutreachSendResult,
} from './outreach-mailer.js';

export class SesOutreachMailer implements OutreachMailer {
  readonly name = 'ses' as const;
  private readonly client: SESv2Client;
  private readonly configurationSet?: string;

  constructor() {
    const { ses } = getConfig().outreach;
    this.client = new SESv2Client({
      region: ses.region,
      ...(ses.accessKeyId && ses.secretAccessKey
        ? {
            credentials: {
              accessKeyId: ses.accessKeyId,
              secretAccessKey: ses.secretAccessKey,
            },
          }
        : {}),
    });
    this.configurationSet = ses.configurationSet;
  }

  async getSendLimits(): Promise<OutreachSendLimits> {
    const response = await this.client.send(new GetAccountCommand({}));
    const quota = response.SendQuota;
    return {
      sendingEnabled: response.SendingEnabled !== false,
      max24HourSend: quota?.Max24HourSend ?? 0,
      sentLast24Hours: quota?.SentLast24Hours ?? 0,
      maxSendRate: quota?.MaxSendRate && quota.MaxSendRate > 0 ? quota.MaxSendRate : 1,
    };
  }

  async send(input: OutreachSendInput): Promise<OutreachSendResult> {
    const response = await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: `${input.fromName} <${input.fromEmail}>`,
        ReplyToAddresses: [input.replyToEmail],
        Destination: { ToAddresses: [input.to] },
        Content: {
          Simple: {
            Subject: { Data: input.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: input.html, Charset: 'UTF-8' },
              ...(input.text ? { Text: { Data: input.text, Charset: 'UTF-8' } } : {}),
            },
          },
        },
        ...(this.configurationSet ? { ConfigurationSetName: this.configurationSet } : {}),
      }),
    );

    return { providerMessageId: response.MessageId };
  }
}
