/** Format a stored ISO instant for `<input type="datetime-local">` in UTC wall time. */
export function toUtcDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
  ].join('T');
}

/** Parse a `datetime-local` value as UTC wall time into an ISO string. */
export function fromUtcDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withSeconds = trimmed.length === 16 ? `${trimmed}:00.000Z` : `${trimmed}Z`;
  const date = new Date(withSeconds);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
