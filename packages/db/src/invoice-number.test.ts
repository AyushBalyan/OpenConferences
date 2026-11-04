import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import {
  invoiceConferencePrefix,
  invoiceIssueDate,
  reserveRegistrationInvoiceNumber,
} from './invoice-number.js';

describe('conference invoice numbers', () => {
  it('uses the India calendar date across the UTC day boundary', () => {
    expect(invoiceIssueDate(new Date('2026-11-03T18:29:59Z'))).toBe('20261103');
    expect(invoiceIssueDate(new Date('2026-11-03T18:30:00Z'))).toBe('20261104');
  });
  it.each([
    ['ICAMCDS-2026', 'ICAMCDS'],
    ['ICAMCDS', 'ICAMCDS'],
    ['Conference Name 2026', 'Conference-Name'],
    ['  ICAMCDS / Computing  ', 'ICAMCDS-Computing'],
    ['', 'Conference'],
  ])('uses a filename-safe conference prefix for %s', (name, expected) => {
    expect(invoiceConferencePrefix(name)).toBe(expected);
  });
  it('matches the requested format and binds the conference and daily counter', async () => {
    const query = vi.fn().mockResolvedValue([{ lastNumber: 1n }]);
    const tx = { $queryRaw: query } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>;
    expect(
      await reserveRegistrationInvoiceNumber(tx, {
        organizationId: 'organization',
        conferenceId: 'conference',
        conferenceName: 'ICAMCDS-2026',
        issuedAt: new Date('2026-11-04T08:00:00Z'),
      }),
    ).toBe('ICAMCDS-202611040001');
    expect(query.mock.calls[0]!.slice(1)).toEqual(['organization', 'conference', '20261104']);
    expect(query.mock.calls[0]![0].join('')).toContain(
      'ON CONFLICT ("conferenceId", "issueDate") DO UPDATE',
    );
    query.mockResolvedValue([{ lastNumber: 42n }]);
    expect(
      await reserveRegistrationInvoiceNumber(tx, {
        organizationId: 'organization',
        conferenceId: 'conference',
        conferenceName: 'ICAMCDS-2026',
        issuedAt: new Date('2026-11-04T08:00:00Z'),
      }),
    ).toBe('ICAMCDS-202611040042');
  });
  it('fails clearly rather than generating a duplicate or overflowing the four digits', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as Pick<
      Prisma.TransactionClient,
      '$queryRaw'
    >;
    await expect(
      reserveRegistrationInvoiceNumber(tx, {
        organizationId: 'organization',
        conferenceId: 'conference',
        conferenceName: 'ICAMCDS',
        issuedAt: new Date('2026-11-04T08:00:00Z'),
      }),
    ).rejects.toThrow('Daily invoice sequence exhausted');
  });
});
