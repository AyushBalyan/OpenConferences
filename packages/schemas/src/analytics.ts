import { z } from 'zod';
import { paperStatusSchema } from './submission.js';
import { decisionOutcomeSchema } from './review.js';
import { registrationStatusSchema } from './billing.js';

export const analyticsNamedCountSchema = z.object({
  name: z.string(),
  count: z.number().int().nonnegative(),
});

export const analyticsAmountSchema = z.object({
  name: z.string(),
  amountMinor: z.number().int(),
});

export const analyticsSubmissionsSchema = z.object({
  total: z.number().int().nonnegative(),
  byStatus: z.array(
    z.object({
      status: paperStatusSchema,
      count: z.number().int().nonnegative(),
    }),
  ),
  byDay: z.array(
    z.object({
      date: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export const analyticsReviewsSchema = z.object({
  assigned: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  notStarted: z.number().int().nonnegative(),
  draft: z.number().int().nonnegative(),
  submitted: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  underCoveredPapers: z.number().int().nonnegative(),
  reviewerLoad: z.array(analyticsNamedCountSchema),
});

export const analyticsDecisionsSchema = z.object({
  total: z.number().int().nonnegative(),
  acceptRate: z.number().min(0).max(1),
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
  revenueByTiming: z.array(analyticsAmountSchema),
  revenueByAudience: z.array(analyticsAmountSchema),
  unpaidAccepted: z.number().int().nonnegative(),
  authors: z.array(analyticsNamedCountSchema),
  institutions: z.array(analyticsNamedCountSchema),
  currency: z.string().length(3),
  computedAt: z.string().datetime(),
});

export type ConferenceAnalyticsOverview = z.infer<typeof conferenceAnalyticsOverviewSchema>;
