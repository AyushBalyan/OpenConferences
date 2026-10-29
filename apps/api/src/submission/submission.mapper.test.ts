import { describe, expect, it } from 'vitest';
import { mapPaper } from './submission.mapper';

describe('paper submission date', () => {
  const paper = {
    id: 'paper',
    status: 'SUBMITTED',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-28T10:00:00Z'),
  };

  it('uses the actual submission timestamp, independently of creation and later edits', () => {
    const submittedAt = new Date('2026-10-20T10:00:00Z');
    expect(mapPaper({ ...paper, submittedAt } as never).submittedAt).toBe(
      submittedAt.toISOString(),
    );
  });

  it('does not invent a date for drafts or historical records without a timestamp', () => {
    expect(
      mapPaper({ ...paper, status: 'DRAFT', submittedAt: null } as never).submittedAt,
    ).toBeNull();
    expect(mapPaper(paper as never).submittedAt).toBeNull();
  });
});
