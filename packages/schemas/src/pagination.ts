import { z } from 'zod';

/** Parses boolean query params where "false" must not become true (z.coerce.boolean bug). */
export const queryBooleanSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return Boolean(value);
  });

export const cursorPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

export function paginatedListSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().uuid().nullable(),
  });
}
