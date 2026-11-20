import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processReminderSweepJob } from './reminder-sweep.js';

const mocks = vi.hoisted(() => ({
  conferences: vi.fn(),
  registrations: vi.fn(),
  create: vi.fn(),
  send: vi.fn(),
}));
vi.mock('@openconferences/config/env', () => ({
  getConfig: () => ({
    webUrl: 'http://localhost:3000',
    mail: { contactEmail: 'help@example.test' },
  }),
}));
vi.mock('@openconferences/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openconferences/db')>();
  return {
    renderEmailTemplate: actual.renderEmailTemplate,
    nameWithoutTitle: actual.nameWithoutTitle,
    generateId: () => 'log-id',
    withTenantContext: (_: unknown, callback: (tx: unknown) => unknown) =>
      callback({
        conference: { findMany: mocks.conferences },
        registration: { findMany: mocks.registrations },
        emailSuppression: { findUnique: async () => null },
        notificationLog: { findUnique: async () => null, create: mocks.create },
        notificationTemplate: {
          findFirst: async () => ({
            subject: 'Early bird ending',
            bodyHtml: '{{paperTitle}} until {{earlyBirdEndsAt}}',
            version: 2,
          }),
        },
      }),
  };
});

const now = new Date('2026-11-25T10:00:00Z');
const DAY = 86_400_000;
const inDays = (days: number) => new Date(now.getTime() + days * DAY);

function registration(id: string, earlyBirdExtendedUntil: Date | null) {
  return {
    id,
    conferenceId: 'conference',
    organizationId: 'organization',
    paperId: `paper-${id}`,
    earlyBirdExtendedUntil,
    paper: { title: id, authorships: [{ email: `${id}@example.test`, isCorresponding: true }] },
    conference: { name: 'Conference' },
  };
}
const sweep = () =>
  processReminderSweepJob({ send: mocks.send } as never, {
    kind: 'registration.early_bird_ending',
    conferenceId: 'conference',
  });
const sent = () =>
  mocks.create.mock.calls.map(([call]) => ({
    to: call.data.toEmail,
    key: call.data.idempotencyKey,
    html: call.data.renderedHtml,
  }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe('early-bird reminders', () => {
  it('reminds a paper about its own extended cut-off after the conference one has passed', async () => {
    mocks.conferences.mockResolvedValue([
      { id: 'conference', feeSchedule: { earlyBirdEndsAt: inDays(-6).toISOString() } },
    ]);
    mocks.registrations.mockResolvedValue([registration('extended', inDays(2))]);

    expect((await sweep()).enqueued).toBe(1);
    // Outside the conference's window only papers with their own date are looked up.
    expect(mocks.registrations.mock.calls[0]![0].where).toMatchObject({
      status: 'PENDING',
      lockedTiming: null,
      earlyBirdExtendedUntil: { gte: now, lte: inDays(3) },
    });
    expect(sent()).toEqual([
      {
        to: 'extended@example.test',
        // Keyed by the new date, so an earlier conference-wide reminder does not block it.
        key: `early-bird-extended-${inDays(2).toISOString()}`,
        html: expect.stringContaining('extended until November 27, 2026'),
      },
    ]);
  });

  it('uses each paper’s later date while the conference cut-off is close', async () => {
    mocks.conferences.mockResolvedValue([
      { id: 'conference', feeSchedule: { earlyBirdEndsAt: inDays(1).toISOString() } },
    ]);
    mocks.registrations.mockResolvedValue([
      registration('plain', null),
      registration('soon', inDays(2)),
      // Extended well beyond the window: its reminder waits for its own date.
      registration('later', inDays(20)),
    ]);

    expect((await sweep()).enqueued).toBe(2);
    expect(mocks.registrations.mock.calls[0]![0].where).not.toHaveProperty(
      'earlyBirdExtendedUntil',
    );
    expect(sent().map((mail) => [mail.to, mail.key])).toEqual([
      ['plain@example.test', 'early-bird-plain'],
      ['soon@example.test', `early-bird-soon-${inDays(2).toISOString()}`],
    ]);
  });
});
