import { describe, expect, it } from 'vitest';
import {
  drawRegistrationInvoice,
  registrationInvoiceDetails,
  type InvoiceCanvas,
} from './invoice-layout.js';

const payment = {
  id: 'internal-payment',
  providerPaymentId: 'pay_123',
  providerOrderId: 'order_123',
  amountMinor: 425000,
  currency: 'INR',
  kind: 'INITIAL',
  registration: {
    userId: 'payer',
    billingAffiliation: 'Saved Invoice University',
    billingCountry: 'IN',
    audience: 'REGULAR',
    isAdditionalPaper: true,
    payer: { name: 'Registered Author', email: 'payer@example.test' },
    conference: { name: 'Conference 2026' },
    paper: {
      id: 'internal-paper',
      title: 'An Accepted Paper',
      submissionNumber: 'CONF-1234',
      authorships: [
        {
          userId: 'coauthor',
          fullName: 'Other Author',
          email: 'other@example.test',
          affiliation: 'Wrong Institute',
        },
        {
          userId: 'payer',
          fullName: 'Registered Author',
          email: 'payer@example.test',
          affiliation: 'Current Paper University',
        },
      ],
    },
  },
};

describe('registration invoice', () => {
  it('uses the registered account, public paper ID, and saved affiliation instead of the first coauthor', () => {
    const details = registrationInvoiceDetails(payment, 'INV-2026-000001', new Date('2026-11-02'));
    expect(details).toMatchObject({
      authorName: 'Registered Author',
      affiliation: 'Saved Invoice University',
      paperId: 'CONF-1234',
      transactionId: 'pay_123',
      orderId: 'order_123',
      description: 'Additional paper registration',
    });
    expect(details).not.toHaveProperty('email');
  });
  it('falls back to the matching paper author affiliation for legacy registrations', () => {
    const legacy = structuredClone(payment);
    legacy.registration.billingAffiliation = '';
    expect(registrationInvoiceDetails(legacy, 'INV', new Date()).affiliation).toBe(
      'Current Paper University',
    );
  });
  it('renders the required identifiers, affiliation and signature disclaimer without email', () => {
    const strings: string[] = [];
    const canvas: Record<string, unknown> = { page: { width: 595.28, height: 841.89 } };
    for (const method of [
      'font',
      'fontSize',
      'fillColor',
      'roundedRect',
      'moveTo',
      'lineTo',
      'lineWidth',
      'strokeColor',
      'stroke',
    ]) {
      canvas[method] = () => canvas;
    }
    canvas.heightOfString = () => 15;
    canvas.text = (text: string, _x: number, y: number) => {
      expect(y).toBeLessThan(815);
      strings.push(text);
      return canvas;
    };
    drawRegistrationInvoice(
      canvas as unknown as InvoiceCanvas,
      registrationInvoiceDetails(payment, 'INV-2026-000001', new Date('2026-11-02')),
    );
    const text = strings.join('\n');
    for (const value of [
      'Conference 2026',
      'Registered Author',
      'Saved Invoice University',
      'CONF-1234',
      'An Accepted Paper',
      'INR 4,250.00',
      'pay_123',
      'order_123',
      'This is a computer-generated invoice and does not require a signature.',
    ])
      expect(text).toContain(value);
    expect(text).not.toContain('@');
    expect(text).not.toContain('Wrong Institute');
  });
});
