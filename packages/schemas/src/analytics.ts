import { z } from 'zod';
import { paperStatusSchema } from './submission.js';
import { decisionOutcomeSchema } from './review.js';
import { registrationStatusSchema } from './billing.js';

export const analyticsSubmissionsSchema = z.object({
  total: z.number().int().nonnegative(),
  byStatus: z.array(
    z.object({
      status: paperStatusSchema,
      count: z.number().int().nonnegative(),
    }),
  ),
});

export const analyticsReviewsSchema = z.object({
  assigned: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});

export const analyticsDecisionsSchema = z.object({
  total: z.number().int().nonnegative(),
  byOutcome: z.array(
    z.object({
      outcome: decisionOutcomeSchema,
      count: z.number().int().nonnegative(),
    }),
  ),
});

export const analyticsRegistrationsSchema = z.object({
  total: z.number().int().nonnegative(),
  paid: z.number().int().nonnegative(),
  unpaid: z.number().int().nonnegative(),
  atRisk: z.number().int().nonnegative(),
  byStatus: z.array(
    z.object({
      status: registrationStatusSchema,
      count: z.number().int().nonnegative(),
    }),
  ),
});

export const conferenceAnalyticsOverviewSchema = z.object({
  conferenceId: z.string().uuid(),
  submissions: analyticsSubmissionsSchema,
  reviews: analyticsReviewsSchema,
  decisions: analyticsDecisionsSchema,
  registrations: analyticsRegistrationsSchema,
  revenueMinor: z.number().int(),
  currency: z.string().length(3),
  computedAt: z.string().datetime(),
});

export type ConferenceAnalyticsOverview = z.infer<typeof conferenceAnalyticsOverviewSchema>;
