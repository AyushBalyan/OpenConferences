import { describe, expect, it } from 'vitest';
import { submissionsByDay, topAuthorCounts, topPaperCounts } from './analytics.service';

describe('analytics aggregates', () => {
  it('counts each paper once per author and institution, ignoring case', () => {
    const rows = [
      { key: 'Ada Lovelace', paperId: 'p1' },
      { key: 'ada lovelace', paperId: 'p1' },
      { key: 'Ada Lovelace', paperId: 'p2' },
      { key: '  ', paperId: 'p3' },
    ];

    expect(topPaperCounts(rows)).toEqual([{ name: 'Ada Lovelace', count: 2 }]);
  });

  it('counts one paper per author title and skips withdrawn papers', () => {
    expect(
      topAuthorCounts([
        { name: 'Ada Lovelace', title: 'Analytical Engine', status: 'SUBMITTED' },
        { name: 'Ada Lovelace', title: ' analytical   engine ', status: 'UNDER_REVIEW' },
        { name: 'Ada Lovelace', title: 'Notes', status: 'WITHDRAWN' },
        { name: 'Ada Lovelace', title: 'Notes', status: 'WITHDRAWN_NONPAYMENT' },
        { name: 'Charles Babbage', title: 'Difference Engine', status: 'SUBMITTED' },
      ]),
    ).toEqual([
      { name: 'Ada Lovelace', count: 1 },
      { name: 'Charles Babbage', count: 1 },
    ]);
  });

  it('returns every author, not a short ranking', () => {
    const rows = Array.from({ length: 13 }, (_, index) => ({
      name: `Author ${String(index + 1).padStart(2, '0')}`,
      title: `Paper ${index + 1}`,
      status: 'SUBMITTED',
    }));

    expect(topAuthorCounts(rows)).toHaveLength(13);
  });

  it('groups submitted papers by UTC day', () => {
    expect(
      submissionsByDay([
        new Date('2026-09-02T18:00:00.000Z'),
        new Date('2026-09-01T01:00:00.000Z'),
        new Date('2026-09-01T23:00:00.000Z'),
      ]),
    ).toEqual([
      { date: '2026-09-01', count: 2 },
      { date: '2026-09-02', count: 1 },
    ]);
  });
});
