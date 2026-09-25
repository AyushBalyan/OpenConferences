import { getConfig } from '@openconferences/config/env';
import { LogOutreachMailer } from './outreach-mailer-log.js';
import { ResendOutreachMailer } from './outreach-mailer-resend.js';
import { SesOutreachMailer } from './outreach-mailer-ses.js';

export type OutreachMailProviderName = 'log' | 'ses' | 'resend';

export type OutreachSendInput = {
  to: string;
  toName: string;
  subject: string;
  html: string;
  text?: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  recipientId: string;
  campaignId: string;
  conferenceId: string;
};

export type OutreachSendResult = {
  providerMessageId?: string;
};

export type OutreachSendLimits = {
  sendingEnabled: boolean;
  max24HourSend: number;
  sentLast24Hours: number;
  maxSendRate: number;
};

export interface OutreachMailer {
  readonly name: OutreachMailProviderName;
  getSendLimits(): Promise<OutreachSendLimits>;
  send(input: OutreachSendInput): Promise<OutreachSendResult>;
}

export function createOutreachMailer(
  provider: OutreachMailProviderName = getConfig().outreach.provider,
): OutreachMailer {
  switch (provider) {
    case 'ses':
      return new SesOutreachMailer();
    case 'resend':
      return new ResendOutreachMailer();
    default:
      return new LogOutreachMailer();
  }
}

export { LogOutreachMailer } from './outreach-mailer-log.js';
export { SesOutreachMailer } from './outreach-mailer-ses.js';
export { ResendOutreachMailer } from './outreach-mailer-resend.js';
