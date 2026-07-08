import { initContract } from '@ts-rest/core';
import { conferenceAnalyticsOverviewSchema, problemEnvelopeSchema } from '@openconferences/schemas';
import { z } from 'zod';

const c = initContract();

const conferenceParams = z.object({
  conferenceId: z.string().uuid(),
});

export const analyticsContract = c.router({
  getOverview: {
    method: 'GET',
    path: '/conferences/:conferenceId/analytics/overview',
    pathParams: conferenceParams,
    responses: {
      200: conferenceAnalyticsOverviewSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Organizer analytics funnel and revenue overview',
  },
});

export type AnalyticsContract = typeof analyticsContract;
