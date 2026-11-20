import { expect, test, type Page } from '@playwright/test';

const conf = '00000000-0000-4000-8000-000000000001';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const path = `/dashboard/conferences/${conf}/registrations/all`;
const DAY = 86_400_000;
const UNPAID = ['PENDING', 'ADDITIONAL_PAYMENT_REQUIRED'];

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
    // Only the third paper was accepted after the conference early-bird date.
    windowOpensAt: new Date(now - (index === 2 ? 0 : 30) * DAY).toISOString(),
    earlyBirdExtendedUntil: null as string | null,
    // Paid on different days; the unpaid ones have no registration date.
    registeredAt:
      status === 'PAID'
        ? '2026-11-02T09:00:00Z'
        : status === 'AWAITING_VERIFICATION'
          ? '2026-11-12T09:00:00Z'
          : null,
  }));
}

async function mockApi(page: Page, rows = fixtures()) {
  const requests: URLSearchParams[] = [];
  const extensions: Array<{ registrationIds: string[]; earlyBirdEndsAt: string | null }> = [];
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
    else if (url.pathname.endsWith('/registrations/early-bird-extension')) {
      const input = route.request().postDataJSON() as (typeof extensions)[number];
      extensions.push(input);
      const updated: string[] = [];
      const skipped: Array<{ registrationId: string; reason: string }> = [];
      for (const registrationId of input.registrationIds) {
        const target = rows.find((row) => row.id === registrationId);
        if (target?.status === 'PENDING') {
          target.earlyBirdExtendedUntil = input.earlyBirdEndsAt;
          updated.push(registrationId);
        } else skipped.push({ registrationId, reason: 'Already paid or no longer payable' });
      }
      body = { updated, skipped };
    } else if (url.pathname.endsWith('/registrations')) {
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
      if (url.searchParams.get('sort') === 'registered') {
        const sign = url.searchParams.get('direction') === 'asc' ? 1 : -1;
        // Unregistered rows stay last in either direction, as the API does.
        data.sort((a, b) =>
          a.registeredAt && b.registeredAt
            ? sign * (Date.parse(a.registeredAt) - Date.parse(b.registeredAt))
            : Number(!a.registeredAt) - Number(!b.registeredAt),
        );
      }
      const offset = Number(url.searchParams.get('cursor') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 50);
      body = {
        data: data.slice(offset, offset + limit),
        nextCursor: offset + limit < data.length ? String(offset + limit) : null,
        ...(offset
          ? {}
          : {
              earlyBirdEndsAt: new Date(now - DAY).toISOString(),
              summary: {
                total: rows.length,
                paid: rows.filter((row) => matches(row, 'paid')).length,
                awaitingVerification: rows.filter((row) => matches(row, 'AWAITING_VERIFICATION'))
                  .length,
                unpaid: rows.filter((row) => matches(row, 'unpaid')).length,
                overdue: rows.filter((row) => matches(row, 'overdue')).length,
                atRisk: rows.filter((row) => matches(row, 'at-risk')).length,
              },
            }),
      };
    }
    await route.fulfill({ json: body });
  });
  return { requests, extensions };
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
  await expect(view(page, /^Unpaid/)).toContainText('3');
  await expect(view(page, /^Past deadline/)).toContainText('1');
  await expect(view(page, /^Due within 7 days/)).toContainText('2');
  await expect(view(page, /^Paid\s*\d/)).toContainText('1');
  await expect(view(page, /^Paid, student not approved/)).toContainText('1');

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
  // Money is in; only the student document is outstanding, so there is no countdown.
  await expect(student).toContainText('Paid · student approval pending');
  await expect(student).toContainText('Paid at student rate');
  await expect(student.getByRole('cell', { name: 'Student', exact: true })).toBeVisible();
  await expect(student).not.toContainText('days left');
  await expect(row(page, 'Additional payment needed')).toContainText('Additional payment required');
  await expect(row(page, 'Discarded entry')).toContainText('Discarded for non-payment');
  await expect(row(page, 'Cancelled graph study')).not.toContainText('Overdue');
  await page.screenshot({ path: testInfo.outputPath('registrations-desktop.png'), fullPage: true });
});

test('an organiser extends the early-bird rate for selected unpaid papers', async ({
  page,
}, testInfo) => {
  const { extensions } = await mockApi(page);
  await page.goto(path);

  const late = row(page, 'Soon-due storage engines');
  await expect(late).toContainText('Accepted after early bird ended');
  await expect(row(page, 'Overdue consensus protocols')).not.toContainText('early bird');
  // Only papers that have not paid can be chosen.
  await expect(row(page, 'Graph neural routing').getByRole('checkbox')).toHaveCount(0);
  await expect(row(page, 'Additional payment needed').getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Extend early bird' })).toHaveCount(0);

  await late.getByRole('checkbox', { name: 'Select Soon-due storage engines' }).check();
  await expect(page.getByText('1 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Extend early bird' }).click();
  const dialog = page.getByRole('dialog', { name: 'Extend early-bird rate for 1 paper' });
  await expect(dialog.getByRole('button', { name: 'Remove extension' })).toHaveCount(0);
  const until = dialog.getByLabel('Early-bird rate available until');
  await expect(until).toBeFocused();
  await expect(until).not.toHaveValue('');

  // A date that has passed is refused before anything is sent.
  await until.fill('2020-01-01T10:00');
  await dialog.getByRole('button', { name: 'Extend early bird' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Choose a date and time in the future.');
  expect(extensions).toHaveLength(0);

  await until.fill('2099-03-04T17:30');
  await page.screenshot({ path: testInfo.outputPath('early-bird-dialog.png') });
  await dialog.getByRole('button', { name: 'Extend early bird' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Early-bird rate extended for 1 paper.' }),
  ).toBeVisible();
  expect(extensions).toEqual([
    { registrationIds: [id(102)], earlyBirdEndsAt: new Date('2099-03-04T17:30').toISOString() },
  ]);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('1 selected')).toHaveCount(0);
  await expect(late).toContainText('Early bird until');
  await expect(late).not.toContainText('Accepted after early bird ended');
  await page.screenshot({ path: testInfo.outputPath('early-bird-extended.png'), fullPage: true });

  // Select everything shown, then take the extension away again.
  await page.getByRole('checkbox', { name: 'Select all unpaid registrations shown' }).check();
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Extend early bird' }).click();
  await page
    .getByRole('dialog', { name: 'Extend early-bird rate for 2 papers' })
    .getByRole('button', { name: 'Remove extension' })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Early-bird extension removed for 2 papers.' }),
  ).toBeVisible();
  expect(extensions[1]).toEqual({ registrationIds: [id(101), id(102)], earlyBirdEndsAt: null });
  await expect(late).toContainText('Accepted after early bird ended');
});

test('the registration date is shown and the list sorts from its column headers', async ({
  page,
}, testInfo) => {
  const { requests } = await mockApi(page);
  await page.goto(path);
  const titles = () => page.getByRole('row').getByRole('link').allTextContents();
  const header = (name: string) => page.getByRole('columnheader', { name });

  await expect(row(page, 'Graph neural routing')).toContainText('Nov 2, 2026');
  await expect(row(page, 'Overdue consensus protocols')).toContainText('Not registered');
  await expect(header('Registered')).toHaveAttribute('aria-sort', 'none');
  expect(requests.at(-1)?.get('sort')).toBeNull();

  // First click: newest registration first, with unregistered papers after them.
  await header('Registered').getByRole('button').click();
  await expect(page).toHaveURL(/sort=registered&dir=desc/);
  await expect(header('Registered')).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(titles).toEqual(expect.arrayContaining(['Graph neural routing']));
  await expect
    .poll(async () => (await titles()).slice(0, 2))
    .toEqual(['Student verification pending', 'Graph neural routing']);
  expect(requests.at(-1)?.get('sort')).toBe('registered');
  expect(requests.at(-1)?.get('direction')).toBe('desc');
  await page.screenshot({ path: testInfo.outputPath('registrations-sorted.png'), fullPage: true });

  // Second click reverses it; another column takes over the sort.
  await header('Registered').getByRole('button').click();
  await expect(header('Registered')).toHaveAttribute('aria-sort', 'ascending');
  await expect
    .poll(async () => (await titles()).slice(0, 2))
    .toEqual(['Graph neural routing', 'Student verification pending']);
  await header('Deadline').getByRole('button').click();
  await expect(page).toHaveURL(/sort=deadline&dir=asc/);
  await expect(header('Registered')).toHaveAttribute('aria-sort', 'none');
  expect(requests.at(-1)?.get('sort')).toBe('deadline');

  // The order is part of the link, and a phone sorts from a menu instead.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${path}?sort=registered&dir=asc`);
  const menu = page.getByRole('combobox', { name: 'Sort registrations' });
  await expect(menu).toHaveValue('registered:asc');
  await expect(page.getByRole('listitem').first()).toContainText('Graph neural routing');
  await expect(page.getByRole('listitem').first()).toContainText('Nov 2, 2026');
  await menu.selectOption('deadline:asc');
  await expect(page).toHaveURL(/sort=deadline&dir=asc/);
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

  await view(page, /^Paid, student not approved/).click();
  await expect(page).toHaveURL(/\?status=AWAITING_VERIFICATION$/);
  await expect(view(page, /^Paid, student not approved/)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(row(page, 'Student verification pending')).toBeVisible();
  expect(api.requests.at(-1)!.get('status')).toBe('AWAITING_VERIFICATION');

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
    'Paper code,Paper,Billing name,Billing email,Audience,Status,Amount,Currency,Deadline,Registration date,Early bird extended until,Submitted',
  );
  expect(lines).toHaveLength(1 + 3 + 120);
  expect(lines.some((line) => line.startsWith('BULK-7,"Bulk paper, ""quoted"" 7",Bola Ade,'))).toBe(
    true,
  );
  expect(lines.some((line) => line.includes('Graph neural routing'))).toBe(false);
  await expect(
    page.getByRole('status').filter({ hasText: 'Exported 123 registrations.' }),
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
