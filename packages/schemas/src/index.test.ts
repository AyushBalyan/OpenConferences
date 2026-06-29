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
