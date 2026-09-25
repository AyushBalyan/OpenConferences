import type { OutreachMailProvider } from '@openconferences/schemas';

export function outreachProviderLabel(provider: OutreachMailProvider): string {
  switch (provider) {
    case 'ses':
      return 'Amazon SES';
    case 'resend':
      return 'Resend';
    default:
      return 'the development mailer';
  }
}

export function outreachSenderCopy(provider: OutreachMailProvider): string {
  return `Outreach is sent through ${outreachProviderLabel(provider)} using the backend-configured sender.`;
}
