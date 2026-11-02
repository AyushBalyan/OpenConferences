import { createRequire } from 'node:module';
import { PLATFORM_NOTIFICATION_TEMPLATES } from '../../../packages/db/dist/notification-templates.js';
import {
  drawRegistrationInvoice,
  registrationInvoiceDetails,
} from '../../../packages/db/dist/invoice-layout.js';

const require = createRequire(new URL('../../../apps/api/package.json', import.meta.url));
const PDFDocument = require('pdfkit');
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export function demoReceipt(state, payment, apiPort, webPort) {
  const registration = state.registrations.find((r) => r.id === payment.registrationId);
  const paper = state.papers.find((p) => p.id === registration?.paperId);
  if (!paper || payment.status !== 'CAPTURED' || payment.kind === 'REFUND') return null;
  const invoice = {
    id: payment.id,
    paymentId: payment.id,
    number: `DEMO-${payment.id.slice(0, 8).toUpperCase()}`,
    issuedAt: payment.updatedAt ?? payment.createdAt,
    downloadUrl: `http://localhost:${apiPort}/__demo/invoices/${payment.id}.pdf`,
    expiresInSeconds: 900,
  };
  const context = {
    conferenceName: state.conference.name,
    paperTitle: paper.title,
    amountFormatted: `${(payment.amountMinor / 100).toFixed(2)} ${payment.currency}`,
    transactionId: payment.providerPaymentId ?? payment.id,
    registrationUrl: `http://localhost:${webPort}/dashboard/conferences/${state.conference.id}/submissions/${paper.id}?section=registration`,
  };
  const template = PLATFORM_NOTIFICATION_TEMPLATES.find((t) => t.key === 'registration.confirmed');
  const render = (value) => value.replace(/\{\{(\w+)\}\}/g, (_, key) => escape(context[key]));
  const to = registration.userId === state.user.id ? state.user.email : paper.authorships[0]?.email;
  const banner = `<div style="padding:16px;background:#fff8dc;font:14px sans-serif">LOCAL EMAIL PREVIEW — no email sent. To: ${escape(to)}<br>Subject: ${render(template.subject)}</div>`;
  const html = render(template.bodyHtml).replace(/(<body[^>]*>)/, `$1${banner}`);
  const payer =
    registration.userId === state.user.id
      ? state.user
      : (state.authors.find((a) => a.userId === registration.userId) ?? null);
  const details = registrationInvoiceDetails(
    {
      ...payment,
      registration: { ...registration, paper, payer, conference: state.conference },
    },
    invoice.number,
    new Date(invoice.issuedAt),
  );
  return { invoice, context, html, details: { ...details, demonstration: true } };
}

export function demoInvoicePdf(receipt) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    drawRegistrationInvoice(doc, receipt.details);
    doc.end();
  });
}
