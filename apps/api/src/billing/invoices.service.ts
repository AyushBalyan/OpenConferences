import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
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
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { getS3Bucket, getS3Client } from '../files/s3.client';
import type { RoleKind } from '@openconferences/db';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
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
              paper: { include: { authorships: { orderBy: { order: 'asc' } } } },
              payer: { select: { name: true, email: true } },
              conference: { select: { name: true } },
            },
          },
        },
      }),
    );

    if (!payment || payment.status !== 'CAPTURED') {
      throw new NotFoundException('Captured payment not found for invoice');
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
    const pdfBuffer = await this.renderInvoicePdf(
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
          issuedAt,
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
    roles: RoleKind[] = [],
  ) {
    const registration = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.registration.findFirst({ where: { paperId, conferenceId } }),
    );

    if (!registration || registration.organizationId !== organizationId) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.userId !== userId && !canCoordinateReview(roles)) {
      throw new ForbiddenException(
        'Only the registering author or organizers can download this invoice',
      );
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

  private async renderInvoicePdf(input: RegistrationInvoiceDetails): Promise<Buffer> {
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
}
