import { test, expect, type Page } from '@playwright/test';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const conferenceId = id(1),
  userId = id(2);
const path = `/dashboard/conferences/${conferenceId}/reviews/decisions`;

async function mockApi(
  page: Page,
  options: {
    role?: string;
    many?: boolean;
    failDecision?: boolean;
    failLogs?: boolean;
    partialBulk?: boolean;
  } = {},
) {
  const requests: Array<{ endpoint: string; body: Record<string, unknown> }> = [];
  const logs: Array<Record<string, unknown>> = [];
  const conference = {
    id: conferenceId,
    organizationId: conferenceId,
    name: 'Decision test conference',
    slug: 'decision-test',
    status: 'REVIEWING',
    blindingMode: 'DOUBLE',
    version: 1,
    myRoles: [options.role ?? 'ORGANIZER'],
  };
  const papers = [
    {
      id: id(10),
      title: 'Reliable review systems',
      submissionNumber: 'SYS-A1',
      status: 'UNDER_REVIEW',
    },
    {
      id: id(11),
      title: 'Privacy in conference workflows',
      submissionNumber: 'SYS-B2',
      status: 'UNDER_REVIEW',
    },
    {
      id: id(12),
      title: 'Recorded reliable systems',
      submissionNumber: 'REC-C3',
      status: 'DECISION_MADE',
    },
    {
      id: id(13),
      title: 'Recorded privacy workflows',
      submissionNumber: 'REC-D4',
      status: 'DECISION_MADE',
    },
    ...(options.many
      ? Array.from({ length: 100 }, (_, i) => ({
          id: id(1000 + i),
          title: `Additional paper ${i}`,
          submissionNumber: `EXTRA-${i}`,
          status: 'UNDER_REVIEW',
        }))
      : []),
  ].map((p) => ({
    ...p,
    version: 1,
    conferenceId,
    organizationId: conferenceId,
    currentVersionId: null,
    authorships: [{ fullName: 'Mira Author', email: 'mira@example.test', isCorresponding: true }],
  }));
  const rounds = papers.map((p, i) => ({
    id: id(2000 + i),
    paperId: p.id,
    conferenceId,
    organizationId: conferenceId,
    roundNumber: 1,
    reviewStage: 'IN_REVIEW',
    version: 1,
    submissionNumber: p.submissionNumber,
  }));
  const decisions = papers
    .filter((p) => p.status === 'DECISION_MADE')
    .map((p, i) => ({
      id: id(3000 + i),
      paperId: p.id,
      roundId: rounds.find((r) => r.paperId === p.id)!.id,
      paperTitle: p.title,
      submissionNumber: p.submissionNumber,
      roundNumber: 1,
      outcome: 'ACCEPT',
      rationale: 'Ready for publication',
      notifiedAt: null,
      decidedById: userId,
      createdAt: '2026-10-20T10:00:00Z',
      version: 1,
    }));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/v1', '');
    let body: unknown = { data: [], nextCursor: null };
    let status = 200;
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON() ?? {};
      requests.push({ endpoint, body: input });
      if (endpoint.endsWith('/decision')) {
        if (options.failDecision) {
          await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
          return;
        }
        const paper = papers.find((row) => endpoint.includes(row.id))!;
        const decision = {
          ...decisions[0]!,
          id: id(3500),
          paperId: paper.id,
          paperTitle: paper.title,
          submissionNumber: paper.submissionNumber,
          roundId: input.roundId,
          outcome: input.outcome,
          rationale: input.rationale,
          notifiedAt: null,
        };
        decisions.push(decision);
        paper.status = 'DECISION_MADE';
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ decision, message: 'Recorded', warnings: [] }),
        });
        return;
      }
      if (endpoint.endsWith('/decisions/bulk')) {
        const items = input.items as Array<{ paperId: string; outcome: string; rationale: string }>;
        const successful = items
          .filter((_, index) => !options.partialBulk || index === 0)
          .map((item, index) => {
            const paper = papers.find((row) => row.id === item.paperId)!;
            const decision = {
              ...decisions[0]!,
              ...item,
              id: id(3600 + index),
              paperTitle: paper.title,
              submissionNumber: paper.submissionNumber,
              roundId: rounds.find((round) => round.paperId === paper.id)!.id,
              notifiedAt: null,
            };
            decisions.push(decision);
            paper.status = 'DECISION_MADE';
            return decision;
          });
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: successful,
            failures: options.partialBulk
              ? [{ paperId: items[1]!.paperId, reason: 'Paper changed. Try again.' }]
              : [],
            message: 'Recorded',
          }),
        });
        return;
      }
      if (endpoint.endsWith('/decisions/notify')) {
        const decision = decisions.find((row) =>
          (input.paperIds as string[]).includes(row.paperId),
        )!;
        logs.push({
          id: id(5000),
          relatedEntity: 'Decision',
          relatedEntityId: decision.id,
          templateKey: 'decision.notified',
          toEmail: 'mira@example.test',
          status: 'QUEUED',
          queuedAt: new Date().toISOString(),
          sentAt: null,
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ notifiedCount: 1, message: 'Queued' }),
        });
        return;
      }
      if (endpoint.endsWith('/resend')) {
        const original = logs.find((log) => endpoint.includes(String(log.id)))!;
        logs.push({
          ...original,
          id: id(5999),
          status: 'QUEUED',
          queuedAt: new Date().toISOString(),
          sentAt: null,
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ logId: id(5999), message: 'Queued' }),
        });
        return;
      }
    }
    if (endpoint.endsWith('/get-session'))
      body = {
        session: {
          id: 'session',
          userId,
          token: 'test',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
        user: {
          id: userId,
          name: 'Test Chair',
          email: 'chair@example.test',
          emailVerified: true,
          twoFactorEnabled: true,
        },
      };
    else if (endpoint === '/auth/me')
      body = {
        id: userId,
        name: 'Test Chair',
        email: 'chair@example.test',
        twoFactorEnabled: true,
      };
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint === `/conferences/${conferenceId}`) body = conference;
    else if (endpoint.endsWith('/review-progress'))
      body = {
        data: rounds.map((r, index) => ({
          paperId: r.paperId,
          cycleId: r.id,
          roundNumber: 1,
          submittedReviewCount: index === 1 ? 0 : 2,
          warning: index === 1 ? '0 of 2 required reviews submitted' : null,
        })),
        minimumReviews: 2,
      };
    else if (endpoint.endsWith('/rounds')) body = { data: rounds, nextCursor: null };
    else if (endpoint.endsWith('/decisions')) body = { data: decisions, nextCursor: null };
    else if (endpoint.endsWith('/members'))
      body = {
        data: [{ userId, name: 'Test Chair', email: 'chair@example.test', roles: ['CHAIR'] }],
        nextCursor: null,
      };
    else if (endpoint.endsWith('/notification-logs')) {
      body = { data: logs, nextCursor: null };
      if (options.failLogs) status = 500;
    } else if (endpoint.endsWith('/papers')) {
      const offset = Number(url.searchParams.get('cursor') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 100);
      body = {
        data: papers.slice(offset, offset + limit),
        nextCursor: offset + limit < papers.length ? String(offset + limit) : null,
      };
    } else if (endpoint.endsWith('/reviews')) {
      const paper = papers.find((p) => endpoint.includes(p.id))!;
      const round = rounds.find((r) => r.paperId === paper.id)!;
      body = {
        data: [
          {
            id: id(4000),
            paperId: paper.id,
            roundId: round.id,
            reviewerName: 'Ada Reviewer',
            reviewerEmail: 'ada@example.test',
            scores: { originality: 4 },
            recommendation: 'ACCEPT',
            confidence: 4,
            commentsToAuthors: 'Clear and well supported.',
            commentsToChairs: null,
            submittedAt: new Date().toISOString(),
          },
          {
            id: id(4001),
            paperId: paper.id,
            roundId: round.id,
            reviewerName: '   ',
            reviewerEmail: 'unnamed@example.test',
            scores: { originality: 3 },
            recommendation: 'WEAK_ACCEPT',
            confidence: 3,
            commentsToAuthors: 'Useful contribution.',
            commentsToChairs: null,
            submittedAt: new Date().toISOString(),
          },
        ],
        nextCursor: null,
      };
    } else if (endpoint.endsWith('/rebuttal')) body = { body: 'We clarified the evidence.' };
    else if (/\/papers\/[^/]+$/.test(endpoint)) body = papers.find((p) => endpoint.endsWith(p.id));
    else if (endpoint.includes('inbox')) body = { data: [], nextCursor: null, unreadCount: 0 };
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
      headers: {
        'access-control-allow-origin': 'http://localhost:3000',
        'access-control-allow-credentials': 'true',
      },
    });
  });
  return { requests, logs, rounds };
}

test('queue filters show readiness, draft counts, and paper-specific cycles', async ({ page }) => {
  await mockApi(page);
  await page.goto(`${path}/pending`);
  await expect(page.getByLabel('Review cycle', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Conference progress')).toBeVisible();
  await page.getByLabel('Paper queue', { exact: true }).selectOption('ready');
  await expect(page.getByRole('heading', { name: 'Reliable review systems' })).toBeVisible();
  const queue = page.getByRole('navigation', { name: 'Papers awaiting decision' });
  await expect(queue.getByRole('button')).toHaveCount(1);
  await page.getByRole('radio', { name: /^Accept/ }).click();
  await page.getByLabel('Paper queue', { exact: true }).selectOption('drafted');
  await expect(queue.getByRole('button')).toHaveCount(1);
  await page.getByLabel('Paper queue', { exact: true }).selectOption('waiting');
  await expect(queue.getByRole('button')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'Privacy in conference workflows' }),
  ).toBeVisible();
  await expect(queue.getByText('0 of 2 required reviews submitted')).toBeVisible();
});

test('drafts survive paper switches and reload, and discarding requires confirmation', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto(`${path}/pending`);
  await page.getByRole('radio', { name: /^Accept/ }).click();
  await page.getByLabel('Message to authors').fill('Please retain this committee note.');
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Next paper', exact: true }).click();
  await page.getByRole('button', { name: 'Previous paper', exact: true }).click();
  await expect(page.getByLabel('Message to authors')).toHaveValue(
    'Please retain this committee note.',
  );
  await page.reload();
  await expect(page.getByLabel('Message to authors')).toHaveValue(
    'Please retain this committee note.',
  );
  await expect(page.getByRole('radio', { name: /^Accept/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Message to authors')).toHaveValue(
    'Please retain this committee note.',
  );
  await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  await expect(page.getByLabel('Message to authors')).toHaveValue('');
  await page.reload();
  await expect(page.getByLabel('Message to authors')).toHaveValue('');
});

test('recording confirms scope, sends notify false, and respects next-paper preference', async ({
  page,
}) => {
  const fixture = await mockApi(page);
  await page.goto(`${path}/pending`);
  await page.getByRole('radio', { name: /^Accept/ }).click();
  await page.getByLabel('Next paper after recording').uncheck();
  await page.getByRole('button', { name: 'Record accept', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Reliable review systems');
  await expect(page.getByRole('dialog')).toContainText('No decision email will be sent');
  expect(fixture.requests).toHaveLength(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm and record' }).click();
  await expect(page.getByRole('heading', { name: 'Decision recorded', exact: true })).toBeVisible();
  expect(fixture.requests).toHaveLength(1);
  expect(fixture.requests[0]!.body.notify).toBe(false);
  expect(fixture.requests[0]!.body.roundId).toBe(id(2000));
  await page.getByRole('button', { name: 'Continue reviewing' }).click();
  await expect(
    page.getByRole('heading', { name: 'Privacy in conference workflows' }),
  ).toBeVisible();
});

test('failed recording retains the draft for retry', async ({ page }) => {
  await mockApi(page, { failDecision: true });
  await page.goto(`${path}/pending`);
  await page.getByRole('radio', { name: /^Accept/ }).click();
  await page.getByLabel('Message to authors').fill('Keep this note after failure.');
  await page.getByRole('button', { name: 'Record accept', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm and record' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Failed to record decision' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Message to authors')).toHaveValue('Keep this note after failure.');
});

test('bulk partial success keeps failed papers selected and preserves their drafts', async ({
  page,
}) => {
  const fixture = await mockApi(page, { partialBulk: true });
  await page.goto(`${path}/pending`);
  await page.getByRole('radio', { name: /^Accept/ }).click();
  await page.getByRole('button', { name: 'Next paper', exact: true }).click();
  await page.getByRole('radio', { name: /^Reject/ }).click();
  await page.getByLabel('Message to authors').fill('Retain failed bulk note.');
  await page.getByRole('checkbox', { name: 'Select all visible pending papers' }).check();
  await page.getByRole('button', { name: 'Record 2', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('0 of 2 required reviews submitted');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Record 2 decisions', exact: true })
    .click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Paper changed. Try again.' }),
  ).toBeVisible();
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Message to authors')).toHaveValue('Retain failed bulk note.');
  expect(fixture.requests[0]!.body.notify).toBe(false);
});

test('review summary is factual and detailed reviews are expandable', async ({ page }) => {
  await mockApi(page);
  await page.goto(`${path}/pending`);
  await expect(page.getByText('1 Accept · 1 Weak accept', { exact: true })).toBeVisible();
  await expect(page.getByText('Leans accept', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Clear and well supported.', { exact: true })).not.toBeVisible();
  await page.getByText('Review details', { exact: true }).first().click();
  await expect(page.getByText('Clear and well supported.', { exact: true })).toBeVisible();
  await page.getByText('Criterion scores', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'originality', exact: true })).toBeVisible();
});

test('recorded decisions show truthful delivery state and require recipient confirmation', async ({
  page,
}) => {
  const fixture = await mockApi(page);
  await page.goto(`${path}/recorded`);
  await expect(page.getByRole('table').getByText('Not sent', { exact: true })).toHaveCount(2);
  await expect(page.getByText('By Test Chair')).toHaveCount(2);
  await page.getByText('View full rationale', { exact: true }).first().click();
  await expect(page.getByText('Ready for publication', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Review and send' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('mira@example.test');
  expect(fixture.requests).toHaveLength(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Review and send' }).first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Send decision email', exact: true })
    .click();
  await expect(page.getByRole('table').getByText('Queued', { exact: true })).toBeVisible();
  expect(fixture.requests[0]!.body.paperIds).toEqual([id(12)]);
  expect(fixture.requests[0]!.endpoint).toContain(id(2002));
});

test('delivery states derive from email logs, never from notified timestamps', async ({ page }) => {
  const fixture = await mockApi(page);
  fixture.logs.push(
    {
      id: id(5001),
      relatedEntity: 'Decision',
      relatedEntityId: id(3000),
      status: 'SENT',
      queuedAt: '2026-10-20T10:00:00Z',
      sentAt: '2026-10-20T10:01:00Z',
    },
    {
      id: id(5002),
      relatedEntity: 'Decision',
      relatedEntityId: id(3001),
      status: 'FAILED',
      toEmail: 'mira@example.test',
      queuedAt: '2026-10-20T10:00:00Z',
      sentAt: null,
    },
  );
  await page.goto(`${path}/recorded`);
  await expect(page.getByRole('table').getByText('Sent', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').getByText('Failed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review and retry' })).toBeVisible();
  await page.getByLabel('Filter decision email').selectOption('Failed');
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(
    page.getByRole('link', { name: 'Recorded privacy workflows', exact: true }),
  ).toBeVisible();
});

test('email log failures do not enable unsafe duplicate sending', async ({ page }) => {
  await mockApi(page, { failLogs: true });
  await page.goto(`${path}/recorded`);
  await expect(
    page.getByRole('table').getByText('Status unavailable', { exact: true }),
  ).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Review and send' })).toHaveCount(0);
  await expect(page.getByRole('table').getByText('Not sent', { exact: true })).toHaveCount(0);
});

test('chairs can send unsent decisions without access to the full email log', async ({ page }) => {
  const fixture = await mockApi(page, { role: 'CHAIR' });
  await page.goto(`${path}/recorded`);
  await page.getByRole('button', { name: 'Review and send' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('mira@example.test');
  expect(fixture.requests).toHaveLength(0);
});

test('failed decision emails use the retry endpoint after recipient confirmation', async ({
  page,
}) => {
  const fixture = await mockApi(page);
  fixture.logs.push({
    id: id(5002),
    relatedEntity: 'Decision',
    relatedEntityId: id(3001),
    status: 'FAILED',
    toEmail: 'mira@example.test',
    queuedAt: '2026-10-20T10:00:00Z',
    sentAt: null,
  });
  await page.goto(`${path}/recorded`);
  await page.getByRole('button', { name: 'Review and retry' }).click();
  await expect(page.getByRole('dialog')).toContainText('mira@example.test');
  await page.getByRole('dialog').getByRole('button', { name: 'Retry email', exact: true }).click();
  await expect(page.getByRole('table').getByText('Queued', { exact: true })).toBeVisible();
  expect(fixture.requests[0]!.endpoint).toContain(`/notification-logs/${id(5002)}/resend`);
});

test('a new review cycle does not inherit an old decision draft', async ({ page }) => {
  const fixture = await mockApi(page);
  await page.goto(`${path}/pending`);
  await page.getByRole('radio', { name: /^Accept/ }).click();
  await page.getByLabel('Message to authors').fill('Old cycle note.');
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  fixture.rounds[0]!.id = id(8888);
  fixture.rounds[0]!.roundNumber = 2;
  await page.reload();
  await expect(page.getByLabel('Message to authors')).toHaveValue('');
  await expect(page.getByRole('radio', { name: /^Accept/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(page.getByText(/Review cycle 2/)).toBeVisible();
});

test('storage failures warn before leaving with an unprotected draft', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('decision-drafts:')) throw new Error('Storage unavailable');
      original.call(this, key, value);
    };
  });
  await mockApi(page);
  await page.goto(`${path}/pending`);
  await page.getByLabel('Message to authors').fill('Unsaved committee note.');
  await expect(page.getByRole('status').filter({ hasText: 'Draft not saved' })).toBeVisible();
  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('link', { name: 'All submissions', exact: true }).click();
  await expect(page).toHaveURL(`${path}/pending`);
  await expect(page.getByLabel('Message to authors')).toHaveValue('Unsaved committee note.');
});

test('pending decisions search matches title and code, with a recoverable empty state', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto(`${path}/pending`);
  const queue = page.getByRole('navigation', { name: 'Papers awaiting decision' });
  const search = page.getByRole('searchbox', { name: 'Find a paper' });
  await expect(queue.getByRole('button')).toHaveCount(2);
  await search.fill('  PRIVACY  ');
  await expect(queue.getByRole('button')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'Privacy in conference workflows' }),
  ).toBeVisible();
  await search.fill('sys-a1');
  await expect(page.getByRole('heading', { name: 'Reliable review systems' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next paper' })).toBeDisabled();
  await search.fill('no matching paper');
  await expect(queue.getByRole('status')).toContainText('No pending papers match this search');
  await expect(page.getByRole('radiogroup', { name: 'Outcome' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(queue.getByRole('button')).toHaveCount(2);
});

test('search covers papers on later API pages', async ({ page }) => {
  await mockApi(page, { many: true });
  await page.goto(`${path}/pending`);
  await page.getByRole('searchbox', { name: 'Find a paper' }).fill('extra-99');
  await expect(page.getByRole('heading', { name: 'Additional paper 99' })).toBeVisible();
});

test('search limits bulk selection and preserves decision drafts', async ({ page }) => {
  await mockApi(page);
  await page.goto(`${path}/pending`);
  await page
    .getByRole('radio', { name: /Accept/ })
    .first()
    .click();
  await page.getByRole('checkbox', { name: 'Select all visible pending papers' }).check();
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Find a paper' }).fill('SYS-B2');
  await expect(page.getByText('2 selected', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Select all visible pending papers' }).check();
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('radio', { name: /Accept/ }).first()).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByText('1 selected', { exact: true })).toHaveCount(0);
});

test('recorded decisions support title and code search', async ({ page }) => {
  await mockApi(page);
  await page.goto(`${path}/recorded`);
  const search = page.getByRole('searchbox', { name: 'Find a paper' });
  await search.fill('RELIABLE');
  await expect(page.getByRole('cell', { name: /Recorded reliable systems/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Recorded privacy workflows/ })).toHaveCount(0);
  await search.fill('rec-d4');
  await expect(page.getByRole('cell', { name: /Recorded privacy workflows/ })).toBeVisible();
  await search.fill('missing');
  await expect(page.getByRole('status').filter({ hasText: 'No recorded decisions' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('row')).toHaveCount(3);
});

for (const role of ['CHAIR', 'ORGANIZER', 'PLATFORM_ADMIN']) {
  test(`review dossier shows reviewer name and email fallback for ${role}`, async ({ page }) => {
    await mockApi(page, { role });
    await page.goto(`${path}/pending`);
    const dossier = page.getByRole('region', { name: 'Review dossier' });
    await expect(dossier.getByText('Ada Reviewer', { exact: true })).toBeVisible();
    await expect(dossier.getByText('unnamed@example.test', { exact: true })).toBeVisible();
    await expect(dossier.getByText('ada@example.test', { exact: true })).toHaveCount(0);
  });
}

test('a role outside the allowed identity roles does not render reviewer identity', async ({
  page,
}) => {
  await mockApi(page, { role: 'ORG_ADMIN' });
  await page.goto(`${path}/pending`);
  const dossier = page.getByRole('region', { name: 'Review dossier' });
  await expect(dossier.getByText('Reviewer 1', { exact: true })).toBeVisible();
  await expect(dossier.getByText('Ada Reviewer', { exact: true })).toHaveCount(0);
  await expect(dossier.getByText('unnamed@example.test', { exact: true })).toHaveCount(0);
});

test('search and reviewer labels fit desktop and mobile', async ({ page }) => {
  await mockApi(page);
  await page.goto(`${path}/pending`);
  await expect(page.getByText('Ada Reviewer', { exact: true })).toBeVisible();
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.getByRole('searchbox', { name: 'Find a paper' }).fill('SYS-B2');
    await expect(
      page.getByRole('heading', { name: 'Privacy in conference workflows' }),
    ).toBeVisible();
    await expect(page.getByText('unnamed@example.test', { exact: true })).toBeVisible();
    // The dashboard scrolls inside main; expand only the screenshot frame to capture the dossier.
    const original = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const shell = main.parentElement!.parentElement!;
      const state = { style: shell.getAttribute('style'), scrollTop: main.scrollTop };
      main.scrollTop = 0;
      shell.setAttribute('style', 'position:relative;inset:auto;height:auto;min-height:100vh');
      return state;
    });
    try {
      await page.screenshot({ path: `test-results/decisions-${name}.png`, fullPage: true });
    } finally {
      await page.evaluate((state) => {
        const main = document.querySelector('main')!;
        const shell = main.parentElement!.parentElement!;
        if (state.style === null) shell.removeAttribute('style');
        else shell.setAttribute('style', state.style);
        main.scrollTop = state.scrollTop;
      }, original);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
