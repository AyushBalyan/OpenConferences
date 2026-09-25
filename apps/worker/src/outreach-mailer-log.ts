import type {
  OutreachMailer,
  OutreachSendInput,
  OutreachSendLimits,
  OutreachSendResult,
} from './outreach-mailer.js';

export class LogOutreachMailer implements OutreachMailer {
  readonly name = 'log' as const;

  async getSendLimits(): Promise<OutreachSendLimits> {
    return {
      sendingEnabled: true,
      max24HourSend: 50_000,
      sentLast24Hours: 0,
      maxSendRate: 14,
    };
  }

  async send(input: OutreachSendInput): Promise<OutreachSendResult> {
    console.info(
      JSON.stringify({
        level: 'info',
        msg: 'Outreach email sent (dev log adapter)',
        to: input.to,
        subject: input.subject,
        from: input.fromEmail,
        replyTo: input.replyToEmail,
        recipientId: input.recipientId,
      }),
    );
    return { providerMessageId: `log-outreach-${input.recipientId}` };
  }
}
