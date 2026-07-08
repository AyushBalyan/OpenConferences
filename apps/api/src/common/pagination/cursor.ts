export type CursorPaginationOptions = {
  limit?: number;
  cursor?: string;
};

export type PaginatedResult<T> = {
  data: T[];
  nextCursor: string | null;
};

export const DEFAULT_PAGE_LIMIT = 20;

export function resolveLimit(limit?: number, fallback = DEFAULT_PAGE_LIMIT): number {
  return limit ?? fallback;
}

/** Build Prisma cursor args for id-based cursor pagination. */
export function prismaCursorArgs(options: CursorPaginationOptions, limit: number) {
  return {
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  };
}

/** Slice a fetched page and compute nextCursor from item id accessor. */
export function paginateItems<T>(
  items: T[],
  limit: number,
  getId: (item: T) => string,
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const last = data[data.length - 1];
  return {
    data,
    nextCursor: hasMore && last ? getId(last) : null,
  };
}
