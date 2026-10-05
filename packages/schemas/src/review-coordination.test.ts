import { describe, expect, it } from 'vitest';
import { assignmentInterventionSchema, effectiveReviewDeadline } from './review.js';
const assignment = { createdAt: new Date('2026-10-01T12:00:00Z'), dueAt: null };
describe('effective review deadlines', () => {
  it('uses persisted extensions even when they exceed cycle and conference defaults', () => {
    const extended = new Date('2026-10-15T12:00:00Z');
    expect(
      effectiveReviewDeadline(
        { ...assignment, dueAt: extended },
        new Date('2026-10-05'),
        new Date('2026-10-04'),
      ),
    ).toEqual(extended);
  });
  it('uses a paper cycle deadline ahead of the conference fallback', () => {
    expect(
      effectiveReviewDeadline(
        assignment,
        new Date('2026-10-06T12:00:00Z'),
        new Date('2026-10-04T12:00:00Z'),
      ),
    ).toEqual(new Date('2026-10-06T12:00:00Z'));
  });
  it('keeps the seven-day window when no deadline is configured', () => {
    expect(effectiveReviewDeadline(assignment, null, null)).toEqual(
      new Date('2026-10-08T12:00:00Z'),
    );
  });
});
describe('intervention validation', () => {
  it('requires a reason and date for an extension', () => {
    expect(assignmentInterventionSchema.safeParse({ action: 'EXTEND', version: 0 }).success).toBe(
      false,
    );
    expect(
      assignmentInterventionSchema.safeParse({
        action: 'EXTEND',
        version: 0,
        reason: '   ',
        dueAt: '2026-10-09T12:00:00Z',
      }).success,
    ).toBe(false);
  });
  it('requires a reviewer and reason for replacement, but reminders need neither', () => {
    expect(
      assignmentInterventionSchema.safeParse({
        action: 'REPLACE',
        version: 0,
        reason: 'Unavailable',
      }).success,
    ).toBe(false);
    expect(assignmentInterventionSchema.safeParse({ action: 'REMIND', version: 0 }).success).toBe(
      true,
    );
  });
});
