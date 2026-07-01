import { z } from 'zod';

export const roleKindSchema = z.enum([
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'ORGANIZER',
  'CHAIR',
  'REVIEWER',
  'AUTHOR',
]);

export const membershipScopeSchema = z.enum(['ORGANIZATION', 'CONFERENCE']);

export const conferenceStatusSchema = z.enum([
  'DRAFT',
  'CFP_OPEN',
  'REVIEWING',
  'DECISIONS',
  'FINALIZATION',
  'COMPLETED',
  'ARCHIVED',
]);

export const blindingModeSchema = z.enum(['SINGLE', 'DOUBLE', 'OPEN']);

export const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens');

export const createOrganizationSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(255),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export const organizationSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const feeScheduleSchema = z.object({
  currency: z.string().length(3),
  earlyBirdEndsAt: z.string().datetime().nullable().optional(),
  registrationDeadlineAt: z.string().datetime().nullable().optional(),
  matrix: z.record(
    z.enum(['REGULAR', 'STUDENT']),
    z.record(z.enum(['EARLY', 'REGULAR']), z.number().int().nonnegative()),
  ),
});

export const reviewConfigSchema = z.object({
  scoreDimensions: z.array(z.string().min(1)).default(['originality', 'clarity', 'significance']),
  recommendationRequired: z.boolean().default(true),
  confidenceRequired: z.boolean().optional(),
});

export const phaseWindowsSchema = z.object({
  cfpOpensAt: z.string().datetime().nullable().optional(),
  cfpClosesAt: z.string().datetime().nullable().optional(),
  biddingOpensAt: z.string().datetime().nullable().optional(),
  biddingClosesAt: z.string().datetime().nullable().optional(),
  reviewDueAt: z.string().datetime().nullable().optional(),
  rebuttalDueAt: z.string().datetime().nullable().optional(),
  decisionDueAt: z.string().datetime().nullable().optional(),
  cameraReadyDueAt: z.string().datetime().nullable().optional(),
  registrationDueAt: z.string().datetime().nullable().optional(),
});

export const createConferenceSchema = z.object({
  organizationId: z.string().uuid(),
  slug: slugSchema,
  name: z.string().min(1).max(255),
  blindingMode: blindingModeSchema.optional(),
});

export const updateConferenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: slugSchema.optional(),
});

export const updateConferenceSettingsSchema = z
  .object({
    blindingMode: blindingModeSchema.optional(),
    reviewConfig: reviewConfigSchema.optional(),
    feeSchedule: feeScheduleSchema.optional(),
  })
  .merge(phaseWindowsSchema);

export const conferenceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  status: conferenceStatusSchema,
  blindingMode: blindingModeSchema,
  cfpOpensAt: z.string().datetime().nullable(),
  cfpClosesAt: z.string().datetime().nullable(),
  biddingOpensAt: z.string().datetime().nullable(),
  biddingClosesAt: z.string().datetime().nullable(),
  reviewDueAt: z.string().datetime().nullable(),
  rebuttalDueAt: z.string().datetime().nullable(),
  decisionDueAt: z.string().datetime().nullable(),
  cameraReadyDueAt: z.string().datetime().nullable(),
  registrationDueAt: z.string().datetime().nullable(),
  reviewConfig: reviewConfigSchema,
  feeSchedule: feeScheduleSchema,
  version: z.number().int(),
  myRoles: z.array(roleKindSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const conferenceListSchema = z.object({
  data: z.array(conferenceSchema),
  nextCursor: z.string().uuid().nullable(),
});

export const createTrackSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export const updateTrackSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const trackSchema = z.object({
  id: z.string().uuid(),
  conferenceId: z.string().uuid(),
  organizationId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const trackListSchema = z.object({
  data: z.array(trackSchema),
});

export const grantRoleSchema = z.object({
  userId: z.string().uuid(),
  role: roleKindSchema,
  scope: membershipScopeSchema,
});

export const revokeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: roleKindSchema,
  scope: membershipScopeSchema,
});

export const memberSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  scope: membershipScopeSchema,
  roles: z.array(roleKindSchema),
  membershipId: z.string().uuid(),
});

export const memberListSchema = z.object({
  data: z.array(memberSchema),
});

export const transitionStatusSchema = z.object({
  status: conferenceStatusSchema,
});

export const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  organizationId: z.string().uuid().nullable(),
  conferenceId: z.string().uuid().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  diff: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});

export const auditLogListSchema = z.object({
  data: z.array(auditLogEntrySchema),
});

export type RoleKind = z.infer<typeof roleKindSchema>;
export type MembershipScope = z.infer<typeof membershipScopeSchema>;
export type ConferenceStatus = z.infer<typeof conferenceStatusSchema>;
export type BlindingMode = z.infer<typeof blindingModeSchema>;
export type ConferenceDto = z.infer<typeof conferenceSchema>;
export type ConferenceListDto = z.infer<typeof conferenceListSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateConferenceInput = z.infer<typeof createConferenceSchema>;
export type UpdateConferenceSettingsInput = z.infer<typeof updateConferenceSettingsSchema>;
export type CreateTrackInput = z.infer<typeof createTrackSchema>;
export type GrantRoleInput = z.infer<typeof grantRoleSchema>;
export type RevokeRoleInput = z.infer<typeof revokeRoleSchema>;
