import PDFDocument from 'pdfkit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import {
  generateId,
  withTenantContext,
  drawRegistrationInvoice,
  registrationInvoiceDetails,
  reserveRegistrationInvoiceNumber,
  type RegistrationInvoiceDetails,
} from '@openconferences/db';
import type { InvoiceGenerateJobPayload } from '@openconferences/schemas';
import { getS3Client, getS3Bucket } from './s3.client.js';

async function renderInvoicePdf(input: RegistrationInvoiceDetails): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    drawRegistrationInvoice(doc, input);
    doc.end();
  });
}

export async function processInvoiceJob(payload: InvoiceGenerateJobPayload): Promise<void> {
  const existing = await withTenantContext({}, async (tx) =>
    tx.invoice.findUnique({ where: { paymentId: payload.paymentId } }),
  );

  if (existing) {
    return;
  }

  const payment = await withTenantContext({}, async (tx) =>
    tx.payment.findFirst({
      where: { id: payload.paymentId, status: 'CAPTURED' },
      include: {
        registration: {
          include: {
            paper: { include: { authorships: { orderBy: { order: 'asc' } } } },
            payer: { select: { name: true, email: true } },
            conference: { select: { name: true } },
          },
        },
      },
    }),
  );

  if (!payment) {
    throw new Error(`Captured payment not found: ${payload.paymentId}`);
  }

  const issuedAt = new Date();
  const invoiceNumber = await withTenantContext(
    { organizationId: payload.organizationId, conferenceId: payload.conferenceId },
    (tx) =>
      reserveRegistrationInvoiceNumber(tx, {
        ...payload,
        conferenceName: payment.registration.conference.name,
        issuedAt,
      }),
  );
  const pdfBuffer = await renderInvoicePdf(
    registrationInvoiceDetails(payment, invoiceNumber, issuedAt),
  );

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

  await withTenantContext({}, async (tx) => {
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
        issuedAt,
      },
    });
  });
}
