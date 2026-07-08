import { z } from 'zod';

export * from './auth.js';
export * from './pagination.js';
export * from './analytics.js';
export * from './tenancy.js';
export * from './submission.js';
export * from './review.js';
export * from './billing.js';
export * from './messaging.js';

export const problemEnvelopeSchema = z.object({
  type: z.string().url().or(z.string().startsWith('https://')),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});

export type ProblemEnvelope = z.infer<typeof problemEnvelopeSchema>;

export const healthStatusSchema = z.enum(['ok', 'degraded', 'error']);

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  timestamp: z.string().datetime(),
  version: z.string().optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readinessCheckSchema = z.object({
  name: z.string(),
  status: healthStatusSchema,
  message: z.string().optional(),
});

export const readinessResponseSchema = z.object({
  status: healthStatusSchema,
  timestamp: z.string().datetime(),
  checks: z.array(readinessCheckSchema),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
