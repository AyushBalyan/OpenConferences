export type MailSendInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  tags?: string[];
};

export type MailSendResult = {
  providerMessageId?: string;
};

export interface Mailer {
  readonly name: string;
  send(input: MailSendInput): Promise<MailSendResult>;
}
