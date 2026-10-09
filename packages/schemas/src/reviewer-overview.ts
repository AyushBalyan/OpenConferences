import { z } from 'zod';
import { coordinationAssignmentSchema } from './review.js';

export const reviewerOverviewQuerySchema = z.object({
  history: z.enum(['CURRENT', 'ALL', 'HISTORICAL']).default('CURRENT'),
  track: z.string().uuid().optional(),
  cycle: z.coerce.number().int().positive().optional(),
  paperSearch: z.string().trim().max(200).optional(),
});
export type ReviewerOverviewQuery = z.infer<typeof reviewerOverviewQuerySchema>;
export const reviewerWorkAssignmentSchema = coordinationAssignmentSchema.extend({
  paperTitle: z.string(),
  submissionNumber: z.string().nullable(),
  trackId: z.string().uuid(),
  trackName: z.string(),
  roundNumber: z.number().int(),
  isCurrentCycle: z.boolean(),
  paperStatus: z.string(),
  canIntervene: z.boolean(),
  workState: z.enum(['SUBMITTED', 'NOT_STARTED', 'DRAFT', 'CLOSED', 'RETIRED', 'INCONSISTENT']),
  dueSoon: z.boolean(),
});
export type ReviewerWorkAssignment = z.infer<typeof reviewerWorkAssignmentSchema>;
export const reviewerWorkloadSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  hasReviewerRole: z.boolean(),
  assigned: z.number().int(),
  submitted: z.number().int(),
  remaining: z.number().int(),
  notStarted: z.number().int(),
  drafts: z.number().int(),
  closedIncomplete: z.number().int(),
  overdue: z.number().int(),
  dueSoon: z.number().int(),
  earliestDeadline: z.string().datetime().nullable(),
  inconsistent: z.boolean(),
  allSubmitted: z.boolean(),
  assignments: z.array(reviewerWorkAssignmentSchema),
  digestToday: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      createdAt: z.string().datetime(),
      notificationLogId: z.string().uuid().nullable(),
    })
    .nullable(),
});
export type ReviewerWorkload = z.infer<typeof reviewerWorkloadSchema>;
export const reviewerOverviewSchema = z.object({
  observedAt: z.string().datetime(),
  conferenceName: z.string(),
  scope: reviewerOverviewQuerySchema,
  complete: z.literal(true),
  data: z.array(reviewerWorkloadSchema),
  roster: z.array(
    z.object({ userId: z.string().uuid(), name: z.string(), email: z.string().email() }),
  ),
  tracks: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  cycles: z.array(z.number().int()),
  summary: z.object({
    overdue: z.number().int(),
    dueSoon: z.number().int(),
    allSubmitted: z.number().int(),
    unassigned: z.number().int(),
  }),
});
export type ReviewerOverview = z.infer<typeof reviewerOverviewSchema>;
export const DIGEST_MAX_REVIEWERS = 50;
export const DIGEST_MAX_ASSIGNMENTS = 500;
export const DIGEST_MAX_ITEMS = 100;
const digestTargets = z
  .array(z.object({ id: z.string().uuid(), version: z.number().int().nonnegative() }))
  .min(1)
  .max(DIGEST_MAX_ITEMS)
  .refine(
    (items) => new Set(items.map((i) => i.id)).size === items.length,
    'Duplicate assignments',
  );
export const reviewerDigestPreviewInputSchema = z.object({ assignments: digestTargets });
export const reviewerDigestInputSchema = reviewerDigestPreviewInputSchema.extend({
  requestId: z.string().uuid(),
  previewToken: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ReviewerDigestInput = z.infer<typeof reviewerDigestInputSchema>;
export const reviewerDigestItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  paperId: z.string().uuid(),
  roundId: z.string().uuid(),
  paperTitle: z.string(),
  submissionNumber: z.string().nullable(),
  roundNumber: z.number().int(),
  dueAt: z.string().datetime(),
  overdue: z.boolean(),
});
export const reviewerDigestSnapshotSchema = z.object({
  templateId: z.string().uuid(),
  templateVersion: z.number().int().positive(),
  recipient: z.string().email(),
  reviewerName: z.string(),
  conferenceName: z.string(),
  reviewUrl: z.string().url(),
  items: z.array(reviewerDigestItemSchema).min(1).max(DIGEST_MAX_ITEMS),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  preparedAt: z.string().datetime(),
});
export const reviewerDigestPreviewSchema = reviewerDigestSnapshotSchema.extend({
  previewToken: z.string(),
  dailyLimit: z.string(),
});
export type ReviewerDigestPreview = z.infer<typeof reviewerDigestPreviewSchema>;
export type ReviewerDigestSnapshot = z.infer<typeof reviewerDigestSnapshotSchema>;
export const reviewerDigestResultSchema = z.object({
  digestId: z.string().uuid(),
  status: z.enum(['PREPARING', 'QUEUED', 'SUPPRESSED', 'CANCELLED', 'FAILED']),
  alreadyRequested: z.boolean(),
  assignmentCount: z.number().int(),
  notificationLogId: z.string().uuid().nullable(),
  message: z.string(),
});
export const REVIEWER_DIGEST_JOB_NAME = 'reviewer.reminder_digest.prepare' as const;
export const reviewerDigestJobSchema = z.object({
  digestId: z.string().uuid(),
  requestId: z.string().uuid(),
});

/** Counts assignment units (paper + cycle), never reviewer names or distinct papers. */
export function aggregateReviewerWorkload(
  roster: Array<{ userId: string; name: string; email: string }>,
  assignments: ReviewerWorkAssignment[],
): ReviewerWorkload[] {
  const members = new Set(roster.map((r) => r.userId));
  const rows = new Map<string, ReviewerWorkload>();
  const create = (userId: string, name: string, email: string): ReviewerWorkload => ({
    userId,
    name,
    email,
    hasReviewerRole: members.has(userId),
    assigned: 0,
    submitted: 0,
    remaining: 0,
    notStarted: 0,
    drafts: 0,
    closedIncomplete: 0,
    overdue: 0,
    dueSoon: 0,
    earliestDeadline: null,
    inconsistent: false,
    allSubmitted: false,
    assignments: [],
    digestToday: null,
  });
  for (const r of roster) rows.set(r.userId, create(r.userId, r.name, r.email));
  for (const a of assignments) {
    let r = rows.get(a.reviewerUserId);
    if (!r) {
      r = create(a.reviewerUserId, a.reviewerName, a.reviewerEmail);
      rows.set(r.userId, r);
    }
    r.assignments.push(a);
    if (a.workState === 'RETIRED') continue;
    r.assigned++;
    if (a.workState === 'INCONSISTENT') {
      r.inconsistent = true;
      continue;
    }
    if (a.workState === 'SUBMITTED') r.submitted++;
    else if (a.workState === 'CLOSED') r.closedIncomplete++;
    else {
      r.remaining++;
      if (a.workState === 'DRAFT') r.drafts++;
      else r.notStarted++;
      if (a.overdue) r.overdue++;
      if (a.dueSoon) r.dueSoon++;
      if (a.dueAt && (!r.earliestDeadline || a.dueAt < r.earliestDeadline))
        r.earliestDeadline = a.dueAt;
    }
  }
  for (const r of rows.values()) {
    r.allSubmitted = !r.inconsistent && r.assigned > 0 && r.submitted === r.assigned;
    r.assignments.sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        Number(b.canIntervene) - Number(a.canIntervene) ||
        (a.dueAt ?? '').localeCompare(b.dueAt ?? '') ||
        a.id.localeCompare(b.id),
    );
  }
  return [...rows.values()];
}
