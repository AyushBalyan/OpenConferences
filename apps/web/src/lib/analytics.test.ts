import { describe, expect, it } from 'vitest';
import { activitySeries, formatAnalyticsMoney } from './analytics';
describe('analytics activity', () => {
  it('fills missing UTC days with zero and preserves cumulative totals', () => {
    const result = activitySeries([
      { date: '2026-09-01', count: 2 },
      { date: '2026-09-03', count: 3 },
    ]);
    expect(result.interval).toBe('Daily');
    expect(result.points.map((p) => [p.date, p.count, p.cumulative])).toEqual([
      ['2026-09-01', 2, 2],
      ['2026-09-02', 0, 2],
      ['2026-09-03', 3, 5],
    ]);
  });
  it('buckets long ranges without discarding papers or hiding the year', () => {
    const r = activitySeries([
      { date: '2025-12-31', count: 2 },
      { date: '2026-04-01', count: 4 },
    ]);
    expect(r.interval).toBe('Weekly');
    expect(r.points.reduce((n, p) => n + p.count, 0)).toBe(6);
    expect(r.points[0]!.label).toContain('2025');
    expect(r.points.at(-1)!.cumulative).toBe(6);
    const monthly = activitySeries([
      { date: '2020-01-01', count: 2 },
      { date: '2026-01-01', count: 3 },
    ]);
    expect(monthly.interval).toBe('Monthly');
    expect(monthly.points.at(-1)!.cumulative).toBe(5);
  });
  it('handles empty dates and negative financial balances', () => {
    expect(activitySeries([]).points).toEqual([]);
    expect(formatAnalyticsMoney(-12345, 'USD')).toContain('123.45');
  });
});
