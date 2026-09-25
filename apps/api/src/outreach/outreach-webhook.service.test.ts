import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@openconferences/db';
import { resetConfig } from '@openconferences/config/env';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyVerifiedResendOutreachEvent,
  isOutreachChannel,
  mapResendOutreachEvent,
  OutreachWebhookService,
} from './outreach-webhook.service';

function uniqueConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function bounceEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'email.bounced',
    data: {
      email_id: 're_msg_1',
      tags: { channel: 'outreach', recipientId: 'rec-1' },
      bounce: { message: 'mailbox gone' },
      ...overrides,
    },
  };
}

type Recipient = {
  id: string;
  campaignId: string;
  email: string;
  status: 'SENT' | 'QUEUED' | 'BOUNCED' | 'FAILED';
  providerMessageId: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
};

function createFakeTx(seed: { recipients?: Recipient[]; svixIds?: string[] }) {
  const recipients = [...(seed.recipients ?? [])];
  const suppressions: Array<{ email: string; reason: string }> = [];
  const events: string[] = [...(seed.svixIds ?? [])];
  const recipientUpdates: Array<Record<string, unknown>> = [];
  const rollups: string[] = [];
  let notificationLogTouched = false;

  const tx = {
    notificationLog: {
      updateMany: async () => {
        notificationLogTouched = true;
        return { count: 0 };
      },
    },
    outreachWebhookEvent: {
      create: async ({ data }: { data: { svixId: string } }) => {
        if (events.includes(data.svixId)) {
          throw uniqueConflict();
        }
        events.push(data.svixId);
        return data;
      },
    },
    outreachRecipient: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if ('providerMessageId' in where) {
          return (
            recipients.find((row) => row.providerMessageId === where.providerMessageId) ?? null
          );
        }
        if ('id' in where) {
          return recipients.find((row) => row.id === where.id) ?? null;
        }
        return null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        recipientUpdates.push(data);
        const row = recipients.find((item) => item.id === where.id);
        if (row && typeof data.status === 'string') {
          row.status = data.status as Recipient['status'];
        }
        return row;
      },
    },
    emailSuppression: {
      upsert: async ({ create }: { create: { email: string; reason: string } }) => {
        suppressions.push({ email: create.email, reason: create.reason });
        return create;
      },
    },
  };

  return {
    tx,
    suppressions,
    recipientUpdates,
    rollups,
    notificationLogTouched: () => notificationLogTouched,
    recordRollup: async (_client: unknown, campaignId: string) => {
      rollups.push(campaignId);
    },
  };
}

describe('Resend outreach event mapping', () => {
  it('maps bounce, complaint, suppression, and failure', () => {
    expect(mapResendOutreachEvent('email.bounced', bounceEvent())).toMatchObject({
      type: 'set-status',
      status: 'BOUNCED',
      suppress: true,
    });
    expect(
      mapResendOutreachEvent('email.complained', bounceEvent({ type: 'email.complained' })),
    ).toMatchObject({
      type: 'set-status',
      status: 'COMPLAINED',
      suppress: true,
    });
    expect(mapResendOutreachEvent('email.suppressed', bounceEvent())).toMatchObject({
      status: 'SUPPRESSED',
      suppress: true,
    });
    expect(mapResendOutreachEvent('email.failed', bounceEvent())).toMatchObject({
      status: 'FAILED',
      suppress: false,
    });
    expect(mapResendOutreachEvent('email.delivered', bounceEvent())).toEqual({
      type: 'record-delivered',
    });
    expect(mapResendOutreachEvent('email.opened', bounceEvent())).toEqual({ type: 'ignore' });
  });

  it('filters to signed outreach tags', () => {
    expect(isOutreachChannel({ channel: 'outreach' })).toBe(true);
    expect(isOutreachChannel({ channel: 'transactional' })).toBe(false);
    expect(isOutreachChannel({})).toBe(false);
  });
});

describe('applyVerifiedResendOutreachEvent', () => {
  const recipient: Recipient = {
    id: 'rec-1',
    campaignId: 'camp-1',
    email: 'ada@example.edu',
    status: 'SENT',
    providerMessageId: 're_msg_1',
    sentAt: new Date('2026-01-01T00:00:00.000Z'),
    deliveredAt: null,
  };

  it('ignores valid non-outreach events without updating recipients', async () => {
    const fake = createFakeTx({ recipients: [recipient] });
    const result = await applyVerifiedResendOutreachEvent(
      fake.tx,
      {
        svixId: 'svix-1',
        event: bounceEvent({ tags: { channel: 'broadcasts' } }),
      },
      fake.recordRollup,
    );
    expect(result).toBe('ignored');
    expect(fake.recipientUpdates).toHaveLength(0);
    expect(fake.suppressions).toHaveLength(0);
  });

  it('correlates by provider message id, updates bounce state, and upserts suppressions', async () => {
    const fake = createFakeTx({ recipients: [recipient] });
    const result = await applyVerifiedResendOutreachEvent(
      fake.tx,
      { svixId: 'svix-bounce', event: bounceEvent() },
      fake.recordRollup,
    );
    expect(result).toBe('applied');
    expect(fake.recipientUpdates[0]).toMatchObject({ status: 'BOUNCED', error: 'mailbox gone' });
    expect(fake.suppressions).toEqual([
      { email: 'ada@example.edu', reason: 'outreach:email.bounced' },
    ]);
    expect(fake.rollups).toEqual(['camp-1']);
    expect(fake.notificationLogTouched()).toBe(false);
  });

  it('falls back to the signed recipient tag when the email id is missing', async () => {
    const unlabeled = { ...recipient, providerMessageId: null };
    const fake = createFakeTx({ recipients: [unlabeled] });
    await applyVerifiedResendOutreachEvent(
      fake.tx,
      {
        svixId: 'svix-tag',
        event: bounceEvent({
          email_id: undefined,
          tags: { channel: 'outreach', recipientId: 'rec-1' },
        }),
      },
      fake.recordRollup,
    );
    expect(fake.recipientUpdates).toHaveLength(1);
  });

  it('is replay-safe for duplicate svix ids', async () => {
    const fake = createFakeTx({ recipients: [recipient], svixIds: ['svix-dup'] });
    await expect(
      applyVerifiedResendOutreachEvent(
        fake.tx,
        { svixId: 'svix-dup', event: bounceEvent() },
        fake.recordRollup,
      ),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(fake.recipientUpdates).toHaveLength(0);
  });

  it('does not write transactional notification logs', async () => {
    const fake = createFakeTx({ recipients: [recipient] });
    await applyVerifiedResendOutreachEvent(
      fake.tx,
      { svixId: 'svix-delivered', event: { type: 'email.delivered', data: bounceEvent().data } },
      fake.recordRollup,
    );
    expect(fake.notificationLogTouched()).toBe(false);
  });
});

describe('OutreachWebhookService signature handling', () => {
  afterEach(() => {
    delete process.env.OUTREACH_RESEND_WEBHOOK_SECRET;
    resetConfig();
  });

  it('rejects invalid signatures', async () => {
    process.env.OUTREACH_RESEND_WEBHOOK_SECRET = 'whsec_test';
    resetConfig();
    const service = new OutreachWebhookService();
    service.verify = () => {
      throw new Error('bad signature');
    };
    await expect(
      service.handleResendWebhook(Buffer.from('{}'), {
        svixId: 'id',
        svixTimestamp: 'ts',
        svixSignature: 'sig',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
