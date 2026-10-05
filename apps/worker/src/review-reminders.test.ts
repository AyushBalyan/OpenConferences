import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { processReminderSweepJob } from './reminder-sweep.js';
const mocks = vi.hoisted(() => ({ assignments: vi.fn(), create: vi.fn(), send: vi.fn() }));
vi.mock('@openconferences/config/env', () => ({
  getConfig: () => ({ webUrl: 'http://localhost:3000' }),
}));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'log-id',
  withTenantContext: (_: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      reviewerAssignment: { findMany: mocks.assignments },
      emailSuppression: { findUnique: async () => null },
      notificationLog: { findUnique: async () => null, create: mocks.create },
      notificationTemplate: {
        findFirst: async () => ({
          subject: 'Reminder',
          bodyHtml: '{{dueAt}} {{reviewUrl}}',
          version: 2,
        }),
      },
    }),
}));
const now = new Date('2026-10-06T10:00:00Z');
function assignment(id: string, roundId = 'current', dueAt = new Date('2026-10-08T10:00:00Z')) {
  return {
    id,
    conferenceId: 'conference',
    organizationId: 'organization',
    roundId,
    createdAt: new Date('2026-09-01'),
    dueAt,
    reviewer: { email: `${id}@example.test` },
    paper: { title: 'Paper', reviewRounds: [{ id: 'current' }] },
    round: { reviewDueAt: new Date('2026-10-01') },
    conference: { name: 'Conference', reviewDueAt: new Date('2026-10-01') },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());
describe('scheduled review reminders', () => {
  it('uses explicit extensions despite an earlier conference deadline and skips historical cycles', async () => {
    mocks.assignments.mockResolvedValue([
      assignment('extended'),
      assignment('historical', 'older'),
      assignment('future', 'current', new Date('2026-10-20')),
    ]);
    const result = await processReminderSweepJob({ send: mocks.send } as never, {
      kind: 'review.reminder',
      conferenceId: 'conference',
    });
    expect(result.enqueued).toBe(1);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toEmail: 'extended@example.test',
          renderedHtml: expect.stringContaining('2026-10-08T10:00:00.000Z'),
        }),
      }),
    );
    expect(mocks.send.mock.calls[0]?.[1]?.html).toContain(
      '/dashboard/conferences/conference/reviews/my-assignments',
    );
    expect(mocks.assignments.mock.calls[0]?.[0]?.where).toMatchObject({
      status: { in: ['ASSIGNED', 'ACCEPTED'] },
      round: { reviewsReleasedAt: null, decisions: { none: {} } },
    });
  });
});
