import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { generateId, withTenantContext } from '@openconferences/db';
import type { InvoiceGenerateJobPayload } from '@openconferences/schemas';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { getS3Bucket, getS3Client } from '../files/s3.client';
import { mapInvoice } from './billing.mapper';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  async generateInvoice(payload: InvoiceGenerateJobPayload) {
    const existing = await withTenantContext({}, async (tx) =>
      tx.invoice.findUnique({ where: { paymentId: payload.paymentId } }),
    );

    if (existing) {
      return mapInvoice(existing);
    }

    const payment = await withTenantContext({}, async (tx) =>
      tx.payment.findFirst({
        where: { id: payload.paymentId },
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

    if (!payment || payment.status !== 'CAPTURED') {
      throw new NotFoundException('Captured payment not found for invoice');
    }

    const invoiceNumber = await this.nextInvoiceNumber(payload.organizationId);
    const pdfBuffer = await this.renderInvoicePdf({
      number: invoiceNumber,
      conferenceName: payment.registration.conference.name,
      paperTitle: payment.registration.paper.title,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      issuedAt: new Date(),
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

    const invoice = await withTenantContext({}, async (tx) => {
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

      return tx.invoice.create({
        data: {
          id: generateId(),
          organizationId: payload.organizationId,
          paymentId: payment.id,
          fileAssetId: fileAsset.id,
          number: invoiceNumber,
        },
      });
    });

    await this.audit.log({
      organizationId: payload.organizationId,
      conferenceId: payload.conferenceId,
      action: 'invoice.generated',
      entity: 'Invoice',
      entityId: invoice.id,
      diff: { paymentId: payment.id, number: invoiceNumber },
    });

    return mapInvoice(invoice);
  }

  async getInvoiceDownload(
    userId: string,
    conferenceId: string,
    paperId: string,
    organizationId: string,
  ) {
    const registration = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.registration.findFirst({ where: { paperId, conferenceId } }),
    );

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    const payment = await withTenantContext({ userId, conferenceId, organizationId }, async (tx) =>
      tx.payment.findFirst({
        where: { registrationId: registration.id, status: 'CAPTURED', kind: { not: 'REFUND' } },
        orderBy: { createdAt: 'desc' },
      }),
    );

    if (!payment) {
      throw new NotFoundException('No captured payment found');
    }

    const invoice = await withTenantContext({ userId, organizationId }, async (tx) =>
      tx.invoice.findUnique({ where: { paymentId: payment.id } }),
    );

    if (!invoice) {
      throw new NotFoundException('Invoice not yet generated');
    }

    const download = await this.files.presignDownload(invoice.fileAssetId, userId, organizationId);

    return {
      ...mapInvoice(invoice),
      downloadUrl: download.downloadUrl,
      expiresInSeconds: download.expiresInSeconds,
    };
  }

  private async nextInvoiceNumber(organizationId: string): Promise<string> {
    const fiscalYear = new Date().getFullYear();

    const counter = await withTenantContext({}, async (tx) => {
      const existing = await tx.invoiceCounter.findUnique({
        where: {
          organizationId_fiscalYear: { organizationId, fiscalYear },
        },
      });

      if (existing) {
        return tx.invoiceCounter.update({
          where: {
            organizationId_fiscalYear: { organizationId, fiscalYear },
          },
          data: { lastNumber: { increment: 1 } },
        });
      }

      return tx.invoiceCounter.create({
        data: {
          organizationId,
          fiscalYear,
          lastNumber: 1,
        },
      });
    });

    return `INV-${fiscalYear}-${String(counter.lastNumber).padStart(6, '0')}`;
  }

  private async renderInvoicePdf(input: {
    number: string;
    conferenceName: string;
    paperTitle: string;
    amountMinor: number;
    currency: string;
    issuedAt: Date;
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
      doc.text(`Issued: ${input.issuedAt.toISOString()}`);
      doc.text(`Conference: ${input.conferenceName}`);
      doc.text(`Paper: ${input.paperTitle}`);
      doc.moveDown();
      doc.text(`Amount: ${(input.amountMinor / 100).toFixed(2)} ${input.currency}`, {
        align: 'right',
      });
      doc.end();
    });
  }
}
