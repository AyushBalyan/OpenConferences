/** Shared, platform-independent invoice layout for API, worker and local previews. */
type TextOptions = {
  width?: number;
  align?: 'left' | 'right' | 'center';
  lineGap?: number;
  characterSpacing?: number;
};
export interface InvoiceCanvas {
  page: { width: number; height: number };
  font(name: string): InvoiceCanvas;
  fontSize(size: number): InvoiceCanvas;
  fillColor(color: string): InvoiceCanvas;
  text(value: string, x: number, y: number, options?: TextOptions): InvoiceCanvas;
  heightOfString(value: string, options: TextOptions): number;
  roundedRect(x: number, y: number, width: number, height: number, radius: number): InvoiceCanvas;
  moveTo(x: number, y: number): InvoiceCanvas;
  lineTo(x: number, y: number): InvoiceCanvas;
  lineWidth(width: number): InvoiceCanvas;
  strokeColor(color: string): InvoiceCanvas;
  stroke(): InvoiceCanvas;
}

export type RegistrationInvoiceDetails = {
  number: string;
  issuedAt: Date;
  conferenceName: string;
  authorName: string;
  affiliation: string;
  billingCountry: string;
  audience: string;
  paperId: string;
  paperTitle: string;
  description: string;
  transactionId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  demonstration?: boolean;
};

type InvoicePayment = {
  id: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  amountMinor: number;
  currency: string;
  kind: string;
  registration: {
    userId: string | null;
    billingAffiliation?: string | null;
    billingCountry?: string | null;
    audience: string;
    isAdditionalPaper: boolean;
    payer: { name: string; email: string } | null;
    conference: { name: string };
    paper: {
      id: string;
      title: string;
      submissionNumber: string | null;
      authorships: Array<{
        userId: string | null;
        fullName: string;
        email: string;
        affiliation: string | null;
      }>;
    };
  };
};

export function registrationInvoiceDetails(
  payment: InvoicePayment,
  number: string,
  issuedAt: Date,
): RegistrationInvoiceDetails {
  const registration = payment.registration;
  const author =
    registration.paper.authorships.find(
      (a) => registration.userId && a.userId === registration.userId,
    ) ??
    registration.paper.authorships.find(
      (a) =>
        !a.userId &&
        registration.payer &&
        a.email.toLowerCase() === registration.payer.email.toLowerCase(),
    );
  const country = registration.billingCountry;
  return {
    number,
    issuedAt,
    conferenceName: registration.conference.name,
    authorName: registration.payer?.name || author?.fullName || 'Registered author',
    affiliation:
      registration.billingAffiliation?.trim() || author?.affiliation?.trim() || 'Not provided',
    billingCountry: country
      ? (new Intl.DisplayNames(['en'], { type: 'region' }).of(country) ?? country)
      : 'Not provided',
    audience: registration.audience === 'STUDENT' ? 'Student author' : 'Regular author',
    paperId: registration.paper.submissionNumber ?? registration.paper.id,
    paperTitle: registration.paper.title,
    description:
      payment.kind === 'ADDITIONAL'
        ? 'Additional registration payment'
        : registration.isAdditionalPaper
          ? 'Additional paper registration'
          : 'Conference paper registration',
    transactionId: payment.providerPaymentId ?? payment.id,
    orderId: payment.providerOrderId ?? 'Not available',
    amountMinor: payment.amountMinor,
    currency: payment.currency,
  };
}

export function drawRegistrationInvoice(
  doc: InvoiceCanvas,
  input: RegistrationInvoiceDetails,
): void {
  const W = doc.page.width,
    H = doc.page.height,
    L = 60,
    R = W - 60;
  const text = (
    value: string,
    x: number,
    y: number,
    size = 11,
    opts: TextOptions & { bold?: boolean; gray?: boolean } = {},
  ) => {
    const { bold, gray, ...options } = opts;
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(size)
      .fillColor(gray ? '#616161' : '#111111');
    doc.text(value, x, y, { width: R - x, lineGap: 3, ...options });
  };
  const fitted = (
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    bold = false,
    align: 'left' | 'right' = 'left',
  ) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    doc.fontSize(size);
    let measured = doc.heightOfString(value, { width, lineGap: 2 });
    while (measured > height && size > 6) {
      size -= 0.5;
      doc.fontSize(size);
      measured = doc.heightOfString(value, { width, lineGap: 2 });
    }
    text(value, x, y, size, { width, lineGap: 2, bold, align });
    return measured;
  };
  const line = (y: number, x = L, end = R, weight = 0.7, color = '#222222') =>
    doc.moveTo(x, y).lineTo(end, y).lineWidth(weight).strokeColor(color).stroke();
  const label = (value: string, x: number, y: number, opts: TextOptions = {}) =>
    text(value, x, y, 9, { bold: true, ...opts });
  const amount = `${input.currency} ${(input.amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  doc
    .roundedRect(28, 26, W - 56, H - 52, 20)
    .lineWidth(1.1)
    .strokeColor('#e2e4e8')
    .stroke();
  text('INVOICE', L, 67, 61, { bold: true, width: 280, characterSpacing: -1.3 });
  fitted(input.conferenceName, 342, 72, R - 342, 39, 13, true, 'right');
  text(
    input.issuedAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    330,
    115,
    10.5,
    { width: R - 330, align: 'right' },
  );
  fitted(`INVOICE NO. ${input.number}`, 330, 132, R - 330, 14, 9.5, true, 'right');
  if (input.demonstration)
    text('DEMONSTRATION ONLY / TEST PAYMENT', L, 141, 7, { gray: true, width: 265 });
  line(155);
  label('BILLED TO / REGISTERED AUTHOR', L, 177);
  fitted(input.authorName, L, 197, 300, 22, 16, true);
  const affiliationHeight = fitted(`Affiliation: ${input.affiliation}`, L, 224, 300, 35, 11);
  const countryY = Math.max(245, 224 + affiliationHeight + 7);
  text(`Billing country: ${input.billingCountry}`, L, countryY, 10.5, { gray: true, width: 300 });
  label('PAYMENT STATUS', 413, 177, { width: R - 413, align: 'right' });
  text('PAID', 413, 195, 17, { bold: true, width: R - 413, align: 'right' });
  label('AUTHOR CATEGORY', 390, 225, { width: R - 390, align: 'right' });
  text(input.audience, 390, 245, 10.5, { width: R - 390, align: 'right' });
  const divider = Math.max(273, countryY + 28);
  line(divider);
  label('PAPER ID', L, divider + 21);
  fitted(input.paperId, L, divider + 38, R - L, 20, 13.5, true);
  label('PAPER TITLE', L, divider + 71);
  const titleHeight = fitted(input.paperTitle, L, divider + 88, R - L, 45, 16, true);
  const top = Math.max(421, divider + 88 + titleHeight + 24);
  line(top, L, R, 1.2);
  text('DESCRIPTION', L + 5, top + 13, 10, { bold: true, width: 230 });
  text('PRICE', 305, top + 13, 10, { bold: true, width: 100, align: 'right' });
  text('QTY', 415, top + 13, 10, { bold: true, width: 38, align: 'center' });
  text('TOTAL', 453, top + 13, 10, { bold: true, width: R - 458, align: 'right' });
  line(top + 34, L, R, 1.2);
  fitted(input.description, L + 5, top + 51, 225, 26, 11.5);
  text('One accepted paper', L + 5, top + 81, 9.5, { gray: true, width: 230 });
  fitted(amount, 305, top + 54, 100, 18, 10.5, false, 'right');
  text('1', 415, top + 54, 10.5, { width: 38, align: 'center' });
  fitted(amount, 453, top + 54, R - 458, 18, 10.5, false, 'right');
  line(top + 109);
  text('Subtotal', 314, top + 124, 10.5, { width: 90, align: 'right' });
  fitted(amount, 418, top + 124, R - 423, 18, 10.5, false, 'right');
  line(top + 148, 312, R);
  text('TOTAL PAID', 312, top + 162, 12, { bold: true, width: 95, align: 'right' });
  fitted(amount, 414, top + 159, R - 419, 22, 15, true, 'right');
  text('Balance due', 312, top + 190, 10, { gray: true, width: 95, align: 'right' });
  text(`${input.currency} 0.00`, 418, top + 190, 10, {
    gray: true,
    width: R - 423,
    align: 'right',
  });
  const footer = Math.max(638, top + 209);
  line(footer);
  text('PAYMENT INFORMATION', L, footer + 16, 12, { bold: true, width: 285 });
  label('TRANSACTION ID', L, footer + 45);
  fitted(input.transactionId, L, footer + 61, 280, 18, 10.5);
  label('ORDER ID', L, footer + 84);
  fitted(input.orderId, L, footer + 100, 280, 18, 10.5);
  label('PAYMENT GATEWAY', 384, footer + 45, { width: R - 384 });
  text('Razorpay', 384, footer + 61, 11, { width: R - 384 });
  label('CURRENCY', 384, footer + 84, { width: R - 384 });
  text(input.currency, 384, footer + 100, 10.5, { width: R - 384 });
  line(footer + 126, L, R, 0.5, '#bdbdbd');
  text(
    'This is a computer-generated invoice and does not require a signature.',
    L,
    footer + 139,
    9,
    { gray: true, width: R - L, align: 'center' },
  );
}
