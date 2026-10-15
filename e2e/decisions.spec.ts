import { test, expect, type Page } from '@playwright/test';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const conferenceId = id(1),
  userId = id(2);
const path = `/dashboard/conferences/${conferenceId}/reviews/decisions`;

async function mockApi(page: Page, options: { role?: string; many?: boolean } = {}) {
  const conference = {
    id: conferenceId,
    organizationId: conferenceId,
    name: 'Decision test conference',
    slug: 'decision-test',
    status: 'REVIEWING',
    blindingMode: 'DOUBLE',
    version: 1,
    myRoles: [options.role ?? 'CHAIR'],
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
      version: 1,
    }));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/v1', '');
    let body: unknown = { data: [], nextCursor: null };
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
        data: rounds.map((r) => ({ paperId: r.paperId, cycleId: r.id, warning: null })),
      };
    else if (endpoint.endsWith('/rounds')) body = { data: rounds, nextCursor: null };
    else if (endpoint.endsWith('/decisions')) body = { data: decisions, nextCursor: null };
    else if (endpoint.endsWith('/papers')) {
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
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
      headers: {
        'access-control-allow-origin': 'http://localhost:3000',
        'access-control-allow-credentials': 'true',
      },
    });
  });
}

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
