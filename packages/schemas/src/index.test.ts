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
