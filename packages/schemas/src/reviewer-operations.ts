import { z } from 'zod';
export const invitationLifecycleSchema = z.enum([
  'PENDING',
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'REVOKED',
]);
export const invitationLifetimeSchema = z.number().int().min(1).max(30);
// PostgreSQL text/JSONB rejects NUL and malformed Unicode. Validate before a
// chunk transaction so one malformed import row cannot repeatedly abort peers.
function validDatabaseText(value: string) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code === 0) return false;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
const databaseText = (schema: z.ZodString) =>
  schema.refine(validDatabaseText, 'Contains unsupported database text characters');
export const invitationRowIdSchema = databaseText(z.string().max(200)).optional();
export const invitationMetadataSchema = z.object({
  rowId: invitationRowIdSchema,
  name: databaseText(z.string().trim().min(1).max(200)),
  email: databaseText(z.string().trim().email().max(254)),
  affiliation: databaseText(z.string().trim().max(300)),
  researchFields: z.array(databaseText(z.string().trim().min(1).max(100))).max(30),
  externalReference: databaseText(z.string().trim().max(200)).optional(),
});
// Each row is validated by the processor, so an invalid row cannot reject valid peers.
export const bulkInvitationInputSchema = z
  .object({
    requestId: z.string().uuid(),
    rows: z.array(z.unknown()).min(1).max(1000),
    lifetimeDays: invitationLifetimeSchema.optional(),
  })
  .strict();
export const invitationOperationSchema = z
  .object({
    requestId: z.string().uuid(),
    version: z.number().int().nonnegative(),
    action: z.enum(['EXTEND', 'REISSUE', 'REVOKE', 'REINVITE']),
    lifetimeDays: invitationLifetimeSchema.optional(),
  })
  .strict();
export const invitationOperationsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(100).optional(),
    lifecycle: invitationLifecycleSchema.optional(),
    email: z.string().trim().max(254).optional(),
    field: z.string().trim().max(100).optional(),
    updatedSince: z.string().datetime().optional(),
  })
  .strict();
export const publicInvitationSchema = z.object({ token: z.string().min(32).max(150) }).strict();
export const publicDeclineSchema = publicInvitationSchema
  .extend({ reason: z.string().trim().max(1000).optional() })
  .strict();
export const botAssignmentInterventionSchema = z
  .object({
    requestId: z.string().uuid(),
    version: z.number().int().nonnegative(),
    action: z.enum(['RELEASE', 'REPLACE', 'EXTEND']),
    reason: z.string().trim().min(1).max(1000),
    reviewerId: z.string().uuid().optional(),
    dueAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.action === 'REPLACE' && !input.reviewerId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewerId'],
        message: 'Choose a replacement reviewer',
      });
    if (input.action === 'EXTEND' && !input.dueAt)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueAt'],
        message: 'Choose a future deadline',
      });
  });
export type InvitationOperation = z.infer<typeof invitationOperationSchema>;
export type BulkInvitationInput = z.infer<typeof bulkInvitationInputSchema>;
