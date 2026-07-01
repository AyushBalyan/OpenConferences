import type { Invoice, Payment, Registration, StudentVerification } from '@openconferences/db';
import type {
  InvoiceDto,
  PaymentDto,
  RegistrationDto,
  StudentVerificationDto,
} from '@openconferences/schemas';

export function mapRegistration(reg: Registration): RegistrationDto {
  return {
    id: reg.id,
    organizationId: reg.organizationId,
    conferenceId: reg.conferenceId,
    paperId: reg.paperId,
    userId: reg.userId,
    audience: reg.audience,
    lockedTiming: reg.lockedTiming,
    amountDueMinor: reg.amountDueMinor,
    currency: reg.currency,
    status: reg.status,
    version: reg.version,
    windowOpensAt: reg.windowOpensAt.toISOString(),
    deadlineAt: reg.deadlineAt.toISOString(),
    additionalGraceUntil: reg.additionalGraceUntil?.toISOString() ?? null,
    createdAt: reg.createdAt.toISOString(),
    updatedAt: reg.updatedAt.toISOString(),
  };
}

export function mapPayment(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    organizationId: payment.organizationId,
    registrationId: payment.registrationId,
    provider: payment.provider,
    providerOrderId: payment.providerOrderId,
    providerPaymentId: payment.providerPaymentId,
    status: payment.status,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    kind: payment.kind,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

export function mapStudentVerification(sv: StudentVerification): StudentVerificationDto {
  return {
    id: sv.id,
    organizationId: sv.organizationId,
    registrationId: sv.registrationId,
    fileAssetId: sv.fileAssetId,
    reviewedById: sv.reviewedById,
    status: sv.status,
    note: sv.note,
    submittedAt: sv.submittedAt.toISOString(),
    reviewedAt: sv.reviewedAt?.toISOString() ?? null,
    createdAt: sv.createdAt.toISOString(),
    updatedAt: sv.updatedAt.toISOString(),
  };
}

export function mapInvoice(invoice: Invoice): InvoiceDto {
  return {
    id: invoice.id,
    paymentId: invoice.paymentId,
    number: invoice.number,
    issuedAt: invoice.issuedAt.toISOString(),
  };
}
