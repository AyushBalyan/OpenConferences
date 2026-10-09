export type ActivityPoint = {
  date: string;
  label: string;
  shortLabel: string;
  count: number;
  cumulative: number;
};
export function activitySeries(rows: { date: string; count: number }[]): {
  points: ActivityPoint[];
  interval: string;
} {
  const data = rows
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(Date.parse(r.date)))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!data.length) return { points: [], interval: 'Daily' };
  const start = new Date(`${data[0]!.date}T00:00:00Z`),
    end = new Date(`${data.at(-1)!.date}T00:00:00Z`);
  const days = (end.getTime() - start.getTime()) / 86400000;
  const kind = days <= 60 ? 'day' : days <= 365 ? 'week' : 'month';
  const bucket = (date: Date) => {
    const d = new Date(date);
    if (kind === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    if (kind === 'month') d.setUTCDate(1);
    return d.toISOString().slice(0, 10);
  };
  const counts = new Map<string, number>();
  for (const r of data) {
    const key = bucket(new Date(`${r.date}T00:00:00Z`));
    counts.set(key, (counts.get(key) ?? 0) + r.count);
  }
  const cursor = new Date(`${bucket(start)}T00:00:00Z`),
    last = bucket(end),
    points: ActivityPoint[] = [];
  let cumulative = 0;
  while (cursor.toISOString().slice(0, 10) <= last) {
    const date = cursor.toISOString().slice(0, 10),
      count = counts.get(date) ?? 0;
    cumulative += count;
    const long = new Intl.DateTimeFormat('en', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(cursor);
    points.push({
      date,
      label:
        kind === 'month'
          ? new Intl.DateTimeFormat('en', {
              timeZone: 'UTC',
              month: 'long',
              year: 'numeric',
            }).format(cursor)
          : kind === 'week'
            ? `Week of ${long}`
            : long,
      shortLabel: new Intl.DateTimeFormat('en', {
        timeZone: 'UTC',
        ...(kind === 'month'
          ? { month: 'short', year: '2-digit' }
          : { day: 'numeric', month: 'short' }),
      }).format(cursor),
      count,
      cumulative,
    });
    if (kind === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + (kind === 'week' ? 7 : 1));
  }
  return { points, interval: kind === 'day' ? 'Daily' : kind === 'week' ? 'Weekly' : 'Monthly' };
}
export function formatAnalyticsMoney(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toLocaleString()} ${currency}`;
  }
}
