import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { drawRegistrationInvoice, type RegistrationInvoiceDetails } from '@openconferences/db';

describe('invoice PDF output', () => {
  for (const long of [false, true]) {
    it(`keeps ${long ? 'long' : 'ordinary'} author and paper details on one A4 page without clipping`, async () => {
      const details: RegistrationInvoiceDetails = {
        number: 'ICAMCDS-202611040001',
        issuedAt: new Date('2026-11-02'),
        conferenceName: 'Conference on Computing 2026',
        authorName: long ? 'Registered Author '.repeat(10) : 'Registered Author',
        affiliation: long
          ? 'Department of Computing, International Research University '.repeat(6).slice(0, 300)
          : 'Research University',
        billingCountry: 'India',
        billingName: long
          ? 'University Finance Office '.repeat(6).slice(0, 150)
          : 'University Finance Office',
        billingEmail: long ? 'finance'.repeat(30) + '@example.test' : 'finance@example.test',
        billingAddress: long
          ? '12 Research Road, Department of Computing, New Delhi 110001 '.repeat(8).slice(0, 400)
          : '12 Research Road, New Delhi 110001',
        billingTaxId: long ? 'TEST'.repeat(12) : 'TEST-TAX-123',
        audience: 'Regular author',
        paperId: 'CONF-1234',
        paperTitle: long
          ? 'Privacy-Preserving Systems and Trustworthy Scientific Computing '
              .repeat(5)
              .slice(0, 300)
          : 'An Accepted Paper',
        description: 'Additional paper registration',
        transactionId: 'pay_Test123',
        orderId: 'order_Test123',
        amountMinor: 425000,
        currency: 'INR',
      };
      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks: Buffer[] = [];
      const result = new Promise<Buffer>((resolve, reject) => {
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });
      const originalText = doc.text.bind(doc);
      doc.text = ((value: string, x: number, y: number, options: PDFKit.Mixins.TextOptions) => {
        expect(y + doc.heightOfString(value, options)).toBeLessThan(doc.page.height - 26);
        return originalText(value, x, y, options);
      }) as typeof doc.text;
      drawRegistrationInvoice(doc, details);
      expect(doc.bufferedPageRange().count).toBe(1);
      doc.end();
      expect((await result).subarray(0, 5).toString()).toBe('%PDF-');
    });
  }
});
