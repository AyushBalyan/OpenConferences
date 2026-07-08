export type MailSendInput = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
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
