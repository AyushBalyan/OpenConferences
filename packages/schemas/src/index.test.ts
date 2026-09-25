import { describe, expect, it } from 'vitest';
import { healthResponseSchema, problemEnvelopeSchema } from './index.js';

describe('schemas', () => {
  it('validates a problem envelope', () => {
    const result = problemEnvelopeSchema.safeParse({
      type: 'https://errors.openconf.dev/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Resource not found',
      instance: '/api/v1/healthz',
    });
    expect(result.success).toBe(true);
  });

  it('validates a health response', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.0',
    });
    expect(result.success).toBe(true);
  });
});

describe('outreach template rendering', () => {
  it('personalizes and escapes merge fields including paper title', async () => {
    const { renderOutreachTemplate } = await import('./outreach.js');
    expect(
      renderOutreachTemplate('Dear {{name}} — {{paper title}}', {
        name: 'Dr. <X>',
        paper: 'Q & A',
      }),
    ).toBe('Dear Dr. &lt;X&gt; — Q &amp; A');
  });
});

describe('outreach campaign rollup', () => {
  it('keeps SENDING while the worker is in flight', async () => {
    const { outreachCampaignRollup } = await import('./outreach.js');
    expect(
      outreachCampaignRollup({
        currentStatus: 'SENDING',
        recipientStatuses: ['SENT', 'BOUNCED', 'QUEUED'],
      }),
    ).toEqual({ sentCount: 1, failedCount: 1, skippedCount: 0, status: 'SENDING' });
  });

  it('finalizes from authoritative recipient rows including late webhooks', async () => {
    const { outreachCampaignRollup } = await import('./outreach.js');
    expect(
      outreachCampaignRollup({
        currentStatus: 'SENDING',
        recipientStatuses: ['SENT', 'BOUNCED', 'SKIPPED', 'SUPPRESSED'],
        finalize: true,
      }),
    ).toEqual({ sentCount: 1, failedCount: 1, skippedCount: 2, status: 'PARTIAL' });
  });

  it('recomputes a terminal campaign after a late bounce', async () => {
    const { outreachCampaignRollup } = await import('./outreach.js');
    expect(
      outreachCampaignRollup({
        currentStatus: 'SENT',
        recipientStatuses: ['SENT', 'BOUNCED'],
      }),
    ).toEqual({ sentCount: 1, failedCount: 1, skippedCount: 0, status: 'PARTIAL' });
  });

  it('normalizes array and object Resend tags', async () => {
    const { normalizeOutreachTags } = await import('./outreach.js');
    expect(normalizeOutreachTags([{ name: 'channel', value: 'outreach' }])).toEqual({
      channel: 'outreach',
    });
    expect(normalizeOutreachTags({ channel: 'outreach', recipientId: 'abc' })).toEqual({
      channel: 'outreach',
      recipientId: 'abc',
    });
  });
});

describe('queryBooleanSchema', () => {
  it('parses string false as false', async () => {
    const { queryBooleanSchema } = await import('./pagination.js');
    expect(queryBooleanSchema.parse('false')).toBe(false);
    expect(queryBooleanSchema.parse('true')).toBe(true);
    expect(queryBooleanSchema.parse('0')).toBe(false);
    expect(queryBooleanSchema.parse('1')).toBe(true);
    expect(queryBooleanSchema.parse(false)).toBe(false);
    expect(queryBooleanSchema.parse(undefined)).toBeUndefined();
  });
});
