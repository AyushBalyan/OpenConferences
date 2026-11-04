import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRegistrationSchema } from '@openconferences/schemas';

const mocks = vi.hoisted(() => ({ row: {} as Record<string, unknown>, update: vi.fn() }));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'new-id',
  withTenantContext: async (_ctx: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      registration: {
        findFirst: async () => mocks.row,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          mocks.update(data);
          Object.assign(mocks.row, data, { version: 2 });
          return mocks.row;
        },
      },
      $queryRaw: async () => [mocks.row],
      decision: { findFirst: async () => ({ outcome: 'ACCEPT', notifiedAt: new Date() }) },
      paper: { findFirst: async () => ({ status: 'DECISION_MADE' }) },
      payment: { findMany: async () => [] },
      studentVerification: { findMany: async () => [] },
    }),
}));
import { RegistrationsService } from './registrations.service';
const service = () =>
  new RegistrationsService(
    {
      loadConference: async () => ({
        organizationId: 'org',
        feeSchedule: {
          currency: 'USD',
          matrix: { REGULAR: { EARLY: 100, REGULAR: 200 }, STUDENT: { EARLY: 50, REGULAR: 100 } },
        },
        registrationDueAt: new Date('2099-01-01'),
      }),
    } as never,
    { loadPaper: async () => ({ id: 'paper' }) } as never,
    { log: vi.fn() } as never,
  );
const input = {
  audience: 'REGULAR' as const,
  billingCountry: 'IN',
  billingAffiliation: 'Research University',
  billingName: 'University Finance Office',
  billingEmail: 'finance@example.test',
  billingAddress: '12 Research Road\nNew Delhi 110001',
  billingTaxId: 'TEST-TAX-123',
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.row = {
    id: 'registration',
    paperId: 'paper',
    conferenceId: 'conf',
    organizationId: 'org',
    userId: 'author',
    audience: 'REGULAR',
    billingCountry: 'IN',
    billingAffiliation: 'Research University',
    billingName: null,
    billingEmail: null,
    billingAddress: null,
    billingTaxId: null,
    status: 'PENDING',
    lockedTiming: null,
    amountDueMinor: 10000,
    currency: 'INR',
    version: 1,
    windowOpensAt: new Date(),
    deadlineAt: new Date('2099-01-01'),
    additionalGraceUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
const save = (user = 'author', fields = input) =>
  service().createRegistration(user, 'conf', 'paper', fields, ['AUTHOR']);

describe('saved invoice billing details', () => {
  it('returns saved billing and author details after checkout starts and the page reloads', async () => {
    const saved = await save();
    expect(saved).toMatchObject(input);
    mocks.row.lockedTiming = 'EARLY';
    const reloaded = await service().getRegistration('author', 'conf', 'paper', ['AUTHOR']);
    expect(reloaded).toMatchObject({ ...input, status: 'PENDING', lockedTiming: 'EARLY' });
    expect(mocks.update).toHaveBeenCalledOnce();
  });
  it('allows missing billing details to be completed on a legacy unpaid checkout', async () => {
    mocks.row.lockedTiming = 'EARLY';
    expect(await save()).toMatchObject(input);
  });
  it.each(['billingName', 'billingAddress', 'billingTaxId', 'audience', 'billingCountry'] as const)(
    'preserves the saved %s once checkout starts',
    async (field) => {
      Object.assign(mocks.row, input, { lockedTiming: 'EARLY' });
      const changed = { ...input, [field]: field === 'audience' ? 'STUDENT' : 'changed' };
      await expect(save('author', changed as typeof input)).rejects.toThrow('cannot be changed');
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it('does not change invoice details after payment', async () => {
    mocks.row.status = 'PAID';
    await expect(save()).rejects.toThrow('cannot be changed');
  });
  it('does not let another coauthor fill details on the registering author checkout', async () => {
    mocks.row.lockedTiming = 'EARLY';
    await expect(save('coauthor')).rejects.toThrow('cannot be changed');
  });
  it('validates and trims billing data before storage', () => {
    expect(
      createRegistrationSchema.parse({ ...input, billingName: '  Finance Office  ' }).billingName,
    ).toBe('Finance Office');
    expect(
      createRegistrationSchema.safeParse({ ...input, billingEmail: 'bad-email' }).success,
    ).toBe(false);
    expect(
      createRegistrationSchema.safeParse({ ...input, billingAddress: 'x'.repeat(401) }).success,
    ).toBe(false);
  });
});
