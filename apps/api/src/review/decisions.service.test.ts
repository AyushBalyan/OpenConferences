import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  update: vi.fn(),
  notify: vi.fn(),
  openRegistration: vi.fn(),
  decision: null as Record<string, unknown> | null,
}));

vi.mock('@openconferences/db', () => ({
  generateId: () => 'decision',
  withTenantContext: async (ctx: { userId?: string }, callback: (tx: unknown) => unknown) => {
    mocks.context(ctx);
    return callback({
      decision: {
        findMany: async () => [{ ...mocks.decision, paper }],
        findFirst: async () => mocks.decision,
        updateMany: async (args: {
          where: { version?: number };
          data: { notifiedAt?: Date; rationale?: string | null };
        }) => {
          // Model the production policy: no session user means no visible rows.
          const versionMatches =
            args.where.version === undefined || args.where.version === mocks.decision?.version;
          const count = ctx.userId === 'chair' && versionMatches ? 1 : 0;
          mocks.update(args);
          if (count && mocks.decision) {
            if (args.data.notifiedAt) mocks.decision.notifiedAt = args.data.notifiedAt;
            if ('rationale' in args.data) {
              mocks.decision.rationale = args.data.rationale;
              mocks.decision.version = Number(mocks.decision.version) + 1;
            }
          }
          return { count };
        },
      },
      paper: { findFirst: async () => paper },
      reviewRound: {
        findMany: async () => [{ id: 'round', revisionDueAt: null }],
        findFirst: async () => ({ id: 'round' }),
      },
    });
  },
}));

import { DecisionsService } from './decisions.service';

const paper = {
  id: 'paper',
  organizationId: 'org',
  conferenceId: 'conf',
  title: 'Accepted paper',
  status: 'UNDER_REVIEW',
  version: 1,
  submissionNumber: 'TEST-A1',
  submittedById: 'author',
  authorships: [
    {
      userId: 'author',
      email: 'author@example.test',
      fullName: 'Mira Sharma',
      isCorresponding: true,
    },
  ],
};
const service = () =>
  new DecisionsService(
    { loadConference: async () => ({ organizationId: 'org', name: 'Test Conference' }) } as never,
    { loadRound: async () => ({ id: 'round' }) } as never,
    { log: vi.fn() } as never,
    { publishDecisionNotified: mocks.notify } as never,
    { openRegistration: mocks.openRegistration } as never,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.decision = {
    id: 'decision',
    organizationId: 'org',
    conferenceId: 'conf',
    paperId: 'paper',
    roundId: 'round',
    outcome: 'ACCEPT',
    rationale: 'Paper accepted',
    notifiedAt: null,
    version: 1,
    decidedById: 'chair',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});

describe('author decision release', () => {
  it('persists release under the chair context before emailing and unlocks the author acceptance', async () => {
    const decisions = service();
    mocks.notify.mockImplementation(async () => {
      expect(mocks.decision?.notifiedAt).toBeInstanceOf(Date);
    });
    await decisions.notifyDecisions('chair', 'conf', 'round', {}, ['CHAIR']);
    expect(mocks.context.mock.calls.every(([ctx]) => ctx.userId === 'chair')).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: { in: ['decision'] }, conferenceId: 'conf' },
      data: { notifiedAt: expect.any(Date) },
    });
    expect(mocks.openRegistration).toHaveBeenCalledWith('org', 'conf', 'paper', 'chair');
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        conferenceName: 'Test Conference',
        outcomeLabel: 'Accept',
        authorName: 'Mira Sharma',
        submissionNumber: 'TEST-A1',
        registrationUrl: expect.stringContaining(
          '/dashboard/conferences/conf/submissions/paper?section=registration',
        ),
        to: 'author@example.test',
      }),
      expect.anything(),
    );
    const visible = await decisions.getPaperDecision('author', 'conf', 'paper', ['AUTHOR']);
    expect(visible.outcome).toBe('ACCEPT');
    expect(visible.notifiedAt).not.toBeNull();
  });

  it('does not email a release that updated no visible decisions', async () => {
    await expect(
      service().notifyDecisions('unscoped-user', 'conf', 'round', {}, ['CHAIR']),
    ).rejects.toThrow('Could not release all decisions to authors');
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('keeps an unnotified acceptance hidden from authors', async () => {
    await expect(service().getPaperDecision('author', 'conf', 'paper', ['AUTHOR'])).rejects.toThrow(
      'Decision not found',
    );
  });
});

describe('editing the message to authors', () => {
  it('saves a trimmed message on an unsent decision and bumps the version', async () => {
    const updated = await service().updateRationale(
      'chair',
      'conf',
      'decision',
      { rationale: '  Please address reviewer 2.  ', version: 1 },
      ['CHAIR'],
    );
    expect(updated.rationale).toBe('Please address reviewer 2.');
    expect(updated.version).toBe(2);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'decision', conferenceId: 'conf', version: 1, notifiedAt: null },
      data: { rationale: 'Please address reviewer 2.', version: { increment: 1 } },
    });
  });

  it('stores an empty message as null', async () => {
    const updated = await service().updateRationale(
      'chair',
      'conf',
      'decision',
      { rationale: '   ', version: 1 },
      ['CHAIR'],
    );
    expect(updated.rationale).toBeNull();
  });

  it('refuses to edit a decision that was already sent', async () => {
    mocks.decision!.notifiedAt = new Date();
    await expect(
      service().updateRationale('chair', 'conf', 'decision', { rationale: 'Late', version: 1 }, [
        'CHAIR',
      ]),
    ).rejects.toThrow('already been sent');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects a stale version', async () => {
    await expect(
      service().updateRationale('chair', 'conf', 'decision', { rationale: 'Stale', version: 0 }, [
        'CHAIR',
      ]),
    ).rejects.toThrow('modified by another request');
  });

  it('is limited to roles that coordinate review', async () => {
    await expect(
      service().updateRationale('chair', 'conf', 'decision', { rationale: 'No', version: 1 }, [
        'AUTHOR',
      ]),
    ).rejects.toThrow('Insufficient permissions');
  });
});

describe('acceptance email timing', () => {
  for (const bulk of [false, true]) {
    for (const notify of [false, true]) {
      it(`${bulk ? 'bulk' : 'single'} acceptance ${notify ? 'sends one combined email after registration opens' : 'opens registration without emailing before release'}`, async () => {
        const decisions = service();
        vi.spyOn(
          decisions as unknown as { applyDecisionInTransaction: () => Promise<unknown> },
          'applyDecisionInTransaction',
        ).mockResolvedValue({ paper, decision: mocks.decision, warnings: [] });
        mocks.notify.mockImplementation(async () =>
          expect(mocks.openRegistration).toHaveBeenCalledOnce(),
        );
        if (bulk) {
          await decisions.bulkDecide(
            'chair',
            'conf',
            'round',
            { items: [{ paperId: 'paper', outcome: 'ACCEPT' }], notify },
            ['CHAIR'],
          );
        } else {
          await decisions.makeDecision(
            'chair',
            'conf',
            'paper',
            { roundId: 'round', outcome: 'ACCEPT', version: 1, notify },
            ['CHAIR'],
          );
        }
        expect(mocks.openRegistration).toHaveBeenCalledOnce();
        expect(mocks.notify).toHaveBeenCalledTimes(notify ? 1 : 0);
        expect(mocks.update).toHaveBeenCalledTimes(notify ? 1 : 0);
      });
    }
  }
});
