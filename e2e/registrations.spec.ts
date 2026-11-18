import { expect, test, type Page } from '@playwright/test';

const conf = '00000000-0000-4000-8000-000000000001';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const path = `/dashboard/conferences/${conf}/registrations/all`;
const DAY = 86_400_000;
const UNPAID = ['PENDING', 'AWAITING_VERIFICATION', 'ADDITIONAL_PAYMENT_REQUIRED'];

function fixtures() {
  const now = Date.now();
  return [
    ['Graph neural routing', 'PAID', 'REGULAR', -20, 'Asha Rao', 'asha@example.test'],
    ['Overdue consensus protocols', 'PENDING', 'REGULAR', -2.5, 'Bola Ade', 'bola@example.test'],
    ['Soon-due storage engines', 'PENDING', 'REGULAR', 3.5, null, null],
    ['Student verification pending', 'AWAITING_VERIFICATION', 'STUDENT', 30.5, 'Chen Li', null],
    ['Cancelled graph study', 'CANCELLED', 'REGULAR', -10, null, null],
    ['Additional payment needed', 'ADDITIONAL_PAYMENT_REQUIRED', 'REGULAR', 5.5, null, null],
    ['Discarded entry', 'DISCARDED_NONPAYMENT', 'REGULAR', -40, null, null],
  ].map(([title, status, audience, days, billingName, billingEmail], index) => ({
    id: id(100 + index),
    paperId: id(200 + index),
    conferenceId: conf,
    organizationId: conf,
    paperTitle: title as string,
    submissionNumber: `REG-${index + 1}`,
    paperSubmittedAt: '2026-10-05T10:00:00Z',
    status: status as string,
    audience: audience as string,
    amountDueMinor: 20000,
    currency: 'USD',
    deadlineAt: new Date(now + (days as number) * DAY).toISOString(),
    billingName,
    billingEmail,
  }));
}

async function mockApi(page: Page, rows = fixtures()) {
  const requests: URLSearchParams[] = [];
  const conference = {
    id: conf,
    name: 'Registration test',
    myRoles: ['CHAIR'],
    status: 'REVIEWING',
  };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = { data: [], nextCursor: null };
    if (url.pathname.endsWith('/get-session'))
      body = {
        session: { id: 'session', userId: conf, token: 'test', expiresAt: '2099-01-01T00:00:00Z' },
        user: { id: conf, name: 'Chair', email: 'chair@example.test', emailVerified: true },
      };
    else if (url.pathname.endsWith('/auth/me'))
      body = { id: conf, name: 'Chair', twoFactorEnabled: true };
    else if (url.pathname.endsWith('/conferences')) body = { data: [conference], nextCursor: null };
    else if (url.pathname.endsWith(`/conferences/${conf}`)) body = conference;
    else if (url.pathname.endsWith('/student-verifications'))
      body = { data: [{ id: 'proof', status: 'PENDING', note: null }], nextCursor: null };
    else if (url.pathname.endsWith('/registrations')) {
      requests.push(url.searchParams);
      const now = Date.now();
      const status = url.searchParams.get('status');
      const audience = url.searchParams.get('audience');
      const search = url.searchParams.get('search')?.toLowerCase();
      const due = (row: (typeof rows)[number]) => Date.parse(row.deadlineAt);
      const matches = (row: (typeof rows)[number], view: string | null) =>
        !view ||
        (view === 'paid'
          ? row.status === 'PAID'
          : view === 'unpaid'
            ? UNPAID.includes(row.status)
            : view === 'overdue'
              ? UNPAID.includes(row.status) && due(row) < now
              : view === 'at-risk'
                ? UNPAID.includes(row.status) && due(row) >= now && due(row) <= now + 7 * DAY
                : row.status === view);
      const data = rows.filter(
        (row) =>
          matches(row, status) &&
          (!audience || row.audience === audience) &&
          (!search ||
            [row.paperTitle, row.submissionNumber, row.billingName, row.billingEmail].some(
              (value) => value?.toLowerCase().includes(search),
            )),
      );
      const offset = Number(url.searchParams.get('cursor') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 50);
      body = {
        data: data.slice(offset, offset + limit),
        nextCursor: offset + limit < data.length ? String(offset + limit) : null,
        ...(offset
          ? {}
          : {
              summary: {
                total: rows.length,
                paid: rows.filter((row) => matches(row, 'paid')).length,
                unpaid: rows.filter((row) => matches(row, 'unpaid')).length,
                overdue: rows.filter((row) => matches(row, 'overdue')).length,
                atRisk: rows.filter((row) => matches(row, 'at-risk')).length,
              },
            }),
      };
    }
    await route.fulfill({ json: body });
  });
  return { requests };
}

const view = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Registration views' }).getByRole('button', { name });
const row = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title });

test('rows show real statuses, money, deadlines and who to contact', async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Registrations');
  await expect(page.getByRole('heading', { name: 'All registrations' })).toHaveCount(0);
  const tabs = page.getByRole('navigation', { name: 'Registration views' });
  await expect(tabs.getByRole('link', { name: 'All registrations' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(tabs.getByRole('link', { name: /Student verifications/ })).toContainText('1');

  await expect(view(page, /^All/)).toContainText('7');
  await expect(view(page, /^Unpaid/)).toContainText('4');
  await expect(view(page, /^Past deadline/)).toContainText('1');
  await expect(view(page, /^Due within 7 days/)).toContainText('2');
  await expect(view(page, /^Paid/)).toContainText('1');

  const paid = row(page, 'Graph neural routing');
  await expect(paid.getByRole('link', { name: 'Graph neural routing' })).toHaveAttribute(
    'href',
    `/dashboard/conferences/${conf}/submissions/${id(200)}?section=registration`,
  );
  await expect(paid).toContainText('REG-1');
  await expect(paid).toContainText('Asha Rao · asha@example.test');
  await expect(paid).toContainText('$200.00');
  await expect(paid.getByText('Paid', { exact: true })).toHaveCount(2);
  await expect(paid).not.toContainText('Overdue');

  const overdue = row(page, 'Overdue consensus protocols');
  await expect(overdue).toContainText('Pending payment');
  await expect(overdue).toContainText('Overdue by 2 days');
  await expect(overdue.getByText('Due', { exact: true })).toBeVisible();
  await expect(row(page, 'Soon-due storage engines')).toContainText('3 days left');
  await expect(row(page, 'Soon-due storage engines')).toContainText('No billing contact yet');

  const student = row(page, 'Student verification pending');
  await expect(student).toContainText('Awaiting verification');
  await expect(student.getByRole('cell', { name: 'Student', exact: true })).toBeVisible();
  await expect(student).toContainText('30 days left');
  await expect(row(page, 'Additional payment needed')).toContainText('Additional payment required');
  await expect(row(page, 'Discarded entry')).toContainText('Discarded for non-payment');
  await expect(row(page, 'Cancelled graph study')).not.toContainText('Overdue');
  await page.screenshot({ path: testInfo.outputPath('registrations-desktop.png'), fullPage: true });
});

test('views, status, audience and search filter through the API and stay in the URL', async ({
  page,
}) => {
  const api = await mockApi(page);
  await page.goto(path);
  await view(page, /^Past deadline/).click();
  await expect(page).toHaveURL(/\?status=overdue$/);
  await expect(view(page, /^Past deadline/)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(row(page, 'Overdue consensus protocols')).toBeVisible();
  expect(api.requests.at(-1)!.get('status')).toBe('overdue');
  // Counts describe the whole conference, not the filtered list.
  await expect(view(page, /^All/)).toContainText('7');

  await page.getByLabel('Filter by exact status').selectOption('CANCELLED');
  await expect(page).toHaveURL(/\?status=CANCELLED$/);
  await expect(row(page, 'Cancelled graph study')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(view(page, /^Past deadline/)).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('row')).toHaveCount(8);

  await page.getByLabel('Filter by audience').selectOption('STUDENT');
  await expect(page.getByRole('row')).toHaveCount(2);
  expect(api.requests.at(-1)!.get('audience')).toBe('STUDENT');
  await page.getByLabel('Filter by audience').selectOption('');
  await expect(page.getByRole('row')).toHaveCount(8);

  const before = api.requests.length;
  await page.getByLabel('Find a registration').fill('bola@');
  await expect(row(page, 'Overdue consensus protocols')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page).toHaveURL(/\?q=bola%40$/);
  // Typing is debounced into one request rather than one per keystroke.
  expect(api.requests.length - before).toBe(1);
  expect(api.requests.at(-1)!.get('search')).toBe('bola@');

  await page.getByLabel('Find a registration').fill('nothing like this');
  await expect(
    page.getByRole('status').filter({ hasText: 'No registrations match these filters' }),
  ).toBeVisible();
});

test('a filtered link opens that view directly and survives a reload', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto(`${path}?status=at-risk&audience=REGULAR`);
  await expect(view(page, /^Due within 7 days/)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Filter by audience')).toHaveValue('REGULAR');
  await expect(page.getByRole('row')).toHaveCount(3);
  expect(api.requests[0]!.get('status')).toBe('at-risk');
  await page.reload();
  await expect(page.getByRole('row')).toHaveCount(3);
  // An unknown status in the URL is ignored rather than sent to the API.
  await page.goto(`${path}?status=bogus`);
  await expect(page.getByRole('row')).toHaveCount(8);
  expect(api.requests.at(-1)!.get('status')).toBeNull();
});

test('export downloads every row of the current view, across pages', async ({ page }) => {
  const rows = [
    ...fixtures(),
    ...Array.from({ length: 120 }, (_, index) => ({
      ...fixtures()[1]!,
      id: id(1000 + index),
      paperId: id(2000 + index),
      paperTitle: `Bulk paper, "quoted" ${index}`,
      submissionNumber: `BULK-${index}`,
    })),
  ];
  await mockApi(page, rows);
  await page.goto(`${path}?status=unpaid`);
  await expect(page.getByText('50+ registrations shown')).toBeVisible();
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByText('100+ registrations shown')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('registrations-unpaid.csv');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const lines = Buffer.concat(chunks).toString('utf8').split('\r\n');
  expect(lines[0]).toBe(
    'Paper code,Paper,Billing name,Billing email,Audience,Status,Amount,Currency,Deadline,Submitted',
  );
  expect(lines).toHaveLength(1 + 4 + 120);
  expect(lines.some((line) => line.startsWith('BULK-7,"Bulk paper, ""quoted"" 7",Bola Ade,'))).toBe(
    true,
  );
  expect(lines.some((line) => line.includes('Graph neural routing'))).toBe(false);
  await expect(
    page.getByRole('status').filter({ hasText: 'Exported 124 registrations.' }),
  ).toBeVisible();
});

test('an empty conference explains itself and a phone gets cards without sideways scrolling', async ({
  page,
}, testInfo) => {
  await mockApi(page, []);
  await page.goto(path);
  await expect(page.getByText('No registrations yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  await page.unroute('**/api/v1/**');

  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await expect(page.getByRole('link', { name: 'Overdue consensus protocols' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: 'Overdue by 2 days' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('registrations-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
