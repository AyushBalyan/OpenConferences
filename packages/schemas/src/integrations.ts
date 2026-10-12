import { z } from 'zod';
export const INTEGRATION_SCOPES = [
  'papers:read',
  'authors:read',
  'authors:contacts:read',
  'reviewers:read',
  'reviewers:identity:read',
  'reviewers:contacts:read',
  'assignments:read',
  'analytics:read',
] as const;
export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];
export const SCOPE_DEPENDENCIES: Partial<Record<IntegrationScope, IntegrationScope[]>> = {
  'authors:read': ['papers:read'],
  'authors:contacts:read': ['authors:read'],
  'reviewers:identity:read': ['reviewers:read'],
  'reviewers:contacts:read': ['reviewers:identity:read'],
  'assignments:read': ['papers:read', 'reviewers:read'],
};
export const integrationScopesSchema = z
  .array(z.enum(INTEGRATION_SCOPES))
  .min(1)
  .max(8)
  .refine((s) => new Set(s).size === s.length, 'Duplicate scopes')
  .refine(
    (s) => s.every((v) => (SCOPE_DEPENDENCIES[v] ?? []).every((d) => s.includes(d))),
    'Missing scope dependency',
  );
const uuid = z.string().uuid();
const date = z.string().datetime();
export const integrationCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    purpose: z.string().trim().max(500).optional(),
    scopes: integrationScopesSchema.default(['papers:read']),
  })
  .strict();
export const integrationUpdateSchema = z
  .object({
    version: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(100).optional(),
    purpose: z.string().trim().max(500).nullable().optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    scopes: integrationScopesSchema.optional(),
  })
  .strict();
export const integrationVersionSchema = z
  .object({ version: z.number().int().nonnegative() })
  .strict();
export const integrationIssueSchema = z
  .object({
    label: z.string().trim().min(1).max(100),
    scopes: integrationScopesSchema,
    expiresInDays: z.number().int().min(1).max(90).default(30),
    requestId: uuid,
  })
  .strict();
export const integrationKeySchema = z.object({
  id: uuid,
  label: z.string(),
  scopes: z.array(z.enum(INTEGRATION_SCOPES)),
  createdAt: date,
  expiresAt: date,
  revokedAt: date.nullable(),
  lastUsedAt: date.nullable(),
});
export const integrationSchema = z.object({
  id: uuid,
  conferenceId: uuid,
  name: z.string(),
  purpose: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']),
  scopes: z.array(z.enum(INTEGRATION_SCOPES)),
  authorizedByUserId: uuid,
  authorizerName: z.string().nullable(),
  version: z.number().int(),
  createdAt: date,
  updatedAt: date,
  keys: z.array(integrationKeySchema),
});
const bool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());
export const botQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(4096).optional(),
    trackId: uuid.optional(),
    paperId: uuid.optional(),
    reviewerId: uuid.optional(),
    cycleId: uuid.optional(),
    cycleNumber: z.coerce.number().int().min(1).optional(),
    history: z.enum(['CURRENT', 'ALL', 'HISTORICAL']).default('CURRENT'),
    includeWithdrawn: bool.default(false),
    status: z
      .enum([
        'SUBMITTED',
        'UNDER_REVIEW',
        'DECISION_MADE',
        'CAMERA_READY',
        'WITHDRAWN',
        'WITHDRAWN_NONPAYMENT',
      ])
      .optional(),
    q: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().min(1).max(100).optional(),
    attention: z.enum(['OVERDUE', 'REMAINING', 'UNASSIGNED', 'COMPLETE']).optional(),
    progress: z
      .enum(['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'CLOSED', 'RETIRED', 'INCONSISTENT'])
      .optional(),
    overdue: bool.optional(),
  })
  .strict();
export type BotQuery = z.infer<typeof botQuerySchema>;
export const botMetaSchema = z.object({
  observedAt: date,
  history: z.enum(['CURRENT', 'ALL', 'HISTORICAL']),
  filters: z.record(z.unknown()),
  returnedCount: z.number().int(),
});
export const botPaperSchema = z.object({
  id: uuid,
  submissionNumber: z.string().nullable(),
  title: z.string(),
  abstract: z.string(),
  keywords: z.array(z.string()),
  track: z.object({ id: uuid, name: z.string() }),
  status: z.string(),
  submittedAt: date.nullable(),
  createdAt: date,
  updatedAt: date,
  currentCycle: z.object({ id: uuid, number: z.number() }).nullable(),
});
export const botAuthorSchema = z.object({
  id: uuid,
  paperId: uuid,
  submissionNumber: z.string().nullable(),
  name: z.string(),
  affiliation: z.string().nullable(),
  order: z.number(),
  isCorresponding: z.boolean(),
  email: z.string().optional(),
});
export const botWorkloadSchema = z.object({
  assigned: z.number().int(),
  submitted: z.number().int(),
  remaining: z.number().int(),
  notStarted: z.number().int(),
  drafts: z.number().int(),
  closedIncomplete: z.number().int(),
  inconsistent: z.number().int(),
  overdue: z.number().int(),
  dueSoon: z.number().int(),
  earliestDeadline: date.nullable(),
});
export const botReviewerSchema = z.object({
  id: uuid,
  label: z.string(),
  hasReviewerRole: z.boolean(),
  name: z.string().optional(),
  email: z.string().optional(),
  workload: botWorkloadSchema,
});
export const botAssignmentSchema = z.object({
  id: uuid,
  paperId: uuid,
  submissionNumber: z.string().nullable(),
  reviewerId: uuid,
  cycleId: uuid,
  cycleNumber: z.number(),
  isCurrentCycle: z.boolean(),
  status: z.string(),
  progress: z.enum(['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'CLOSED', 'RETIRED', 'INCONSISTENT']),
  submittedAt: date.nullable(),
  dueAt: date,
  deadlineSource: z.enum(['INDIVIDUAL', 'CYCLE', 'CONFERENCE', 'LEGACY']),
  overdue: z.boolean(),
  retired: z.boolean(),
});
export const botCapabilitiesSchema = z.object({
  apiVersion: z.literal('1'),
  conference: z.object({ id: uuid, name: z.string(), timezone: z.literal('UTC') }),
  scopes: z.array(z.enum(INTEGRATION_SCOPES)),
  expiresAt: date,
  limits: z.object({
    defaultPageSize: z.number(),
    maxPageSize: z.number(),
    requestsPerKeyPerMinute: z.number(),
    requestsPerConferencePerMinute: z.number(),
  }),
  observedAt: date,
});
export const botSummarySchema = z.object({
  submissions: z.object({
    active: z.number().int(),
    byStatus: z.record(z.number().int()),
    withdrawn: z.number().int(),
  }),
  reviews: botWorkloadSchema,
  reviewersWithActiveWork: z.number().int(),
  underCoveredPapers: z.number().int(),
});
export function botListSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ data: z.array(item), nextCursor: z.string().nullable(), meta: botMetaSchema });
}
export function botDetailSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ data: item, meta: botMetaSchema });
}
export type ApiIntegrationDto = z.infer<typeof integrationSchema>;

export type BotPaperDto = z.infer<typeof botPaperSchema>;
