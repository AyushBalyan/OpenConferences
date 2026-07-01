import PDFDocument from 'pdfkit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { generateId, withTenantContext } from '@openconferences/db';
import type { InvoiceGenerateJobPayload } from '@openconferences/schemas';
import { getS3Client, getS3Bucket } from './s3.client.js';

async function nextInvoiceNumber(organizationId: string): Promise<string> {
  const fiscalYear = new Date().getFullYear();

  const counter = await withTenantContext({ bypass: true }, async (tx) => {
    const existing = await tx.invoiceCounter.findUnique({
      where: { organizationId_fiscalYear: { organizationId, fiscalYear } },
    });

    if (existing) {
      return tx.invoiceCounter.update({
        where: { organizationId_fiscalYear: { organizationId, fiscalYear } },
        data: { lastNumber: { increment: 1 } },
      });
    }

    return tx.invoiceCounter.create({
      data: { organizationId, fiscalYear, lastNumber: 1 },
    });
  });

  return `INV-${fiscalYear}-${String(counter.lastNumber).padStart(6, '0')}`;
}

async function renderInvoicePdf(input: {
  number: string;
  conferenceName: string;
  paperTitle: string;
  amountMinor: number;
  currency: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(20).text('Registration Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice Number: ${input.number}`);
    doc.text(`Conference: ${input.conferenceName}`);
    doc.text(`Paper: ${input.paperTitle}`);
    doc.text(`Amount: ${(input.amountMinor / 100).toFixed(2)} ${input.currency}`, {
      align: 'right',
    });
    doc.end();
  });
}

export async function processInvoiceJob(payload: InvoiceGenerateJobPayload): Promise<void> {
  const existing = await withTenantContext({ bypass: true }, async (tx) =>
    tx.invoice.findUnique({ where: { paymentId: payload.paymentId } }),
  );

  if (existing) {
    return;
  }

  const payment = await withTenantContext({ bypass: true }, async (tx) =>
    tx.payment.findFirst({
      where: { id: payload.paymentId, status: 'CAPTURED' },
      include: {
        registration: {
          include: {
            paper: { select: { title: true, submittedById: true } },
            conference: { select: { name: true } },
          },
        },
      },
    }),
  );

  if (!payment) {
    throw new Error(`Captured payment not found: ${payload.paymentId}`);
  }

  const invoiceNumber = await nextInvoiceNumber(payload.organizationId);
  const pdfBuffer = await renderInvoicePdf({
    number: invoiceNumber,
    conferenceName: payment.registration.conference.name,
    paperTitle: payment.registration.paper.title,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
  });

  const objectKey = `org/${payload.organizationId}/invoices/${payment.id}/${invoiceNumber}.pdf`;
  const bucket = getS3Bucket();
  const checksumSha256 = createHash('sha256').update(pdfBuffer).digest('hex');

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }),
  );

  await withTenantContext({ bypass: true }, async (tx) => {
    const fileAsset = await tx.fileAsset.create({
      data: {
        id: generateId(),
        organizationId: payload.organizationId,
        uploadedById: payment.registration.userId ?? payment.registration.paper.submittedById,
        bucket,
        objectKey,
        sizeBytes: BigInt(pdfBuffer.length),
        checksumSha256,
        mimeType: 'application/pdf',
        originalFilename: `${invoiceNumber}.pdf`,
        scanStatus: 'CLEAN',
      },
    });

    await tx.invoice.create({
      data: {
        id: generateId(),
        organizationId: payload.organizationId,
        paymentId: payment.id,
        fileAssetId: fileAsset.id,
        number: invoiceNumber,
      },
    });
  });
}
