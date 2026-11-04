import type { Prisma } from '@prisma/client';

export function invoiceIssueDate(issuedAt: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(issuedAt);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('');
}

export function invoiceConferencePrefix(name: string): string {
  // The date already contains the year: ICAMCDS-2026 becomes ICAMCDS.
  return (
    name
      .normalize('NFKC')
      .trim()
      .replace(/[\s_\-–—]*(?:19|20)\d{2}$/u, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/, '') || 'Conference'
  );
}

/** One atomic reservation shared by API and worker, scoped to conference + India date. */
export async function reserveRegistrationInvoiceNumber(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  input: { organizationId: string; conferenceId: string; conferenceName: string; issuedAt: Date },
): Promise<string> {
  const issueDate = invoiceIssueDate(input.issuedAt);
  const rows = await tx.$queryRaw<Array<{ lastNumber: bigint }>>`
    INSERT INTO invoice_daily_counters ("organizationId", "conferenceId", "issueDate", "lastNumber")
    VALUES (${input.organizationId}::uuid, ${input.conferenceId}::uuid, ${issueDate}, 1)
    ON CONFLICT ("conferenceId", "issueDate") DO UPDATE
      SET "lastNumber" = invoice_daily_counters."lastNumber" + 1
      WHERE invoice_daily_counters."lastNumber" < 9999
    RETURNING "lastNumber"
  `;
  if (!rows[0]) throw new Error('Daily invoice sequence exhausted for this conference');
  return `${invoiceConferencePrefix(input.conferenceName)}-${issueDate}${String(rows[0].lastNumber).padStart(4, '0')}`;
}
