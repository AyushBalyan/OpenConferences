import { expect, test, type Page } from '@playwright/test';

const conf = '00000000-0000-4000-8000-000000000001';
const path = `/dashboard/conferences/${conf}/registrations/verifications`;

const paperId = (i: number) => `00000000-0000-4000-8000-00000000010${i}`;

async function mockApi(page: Page, options: { empty?: boolean; delayMs?: number } = {}) {
  const rows = options.empty
    ? []
    : ['PENDING', 'CLARIFICATION_REQUESTED', 'APPROVED', 'PENDING'].map((status, i) => ({
        id: `proof-${i}`,
        paperId: paperId(i),
        submissionNumber: `STU-${i}`,
        paperTitle: `Student paper ${i}`,
        status,
        note: i === 1 ? 'Please upload both sides.' : null,
        scanStatus: i === 3 ? 'INFECTED' : 'CLEAN',
        originalFilename: 'student-id.pdf',
      }));
  const documentRequests: string[] = [];
  const paperRequests: string[] = [];
  const reviews: Array<{ id: string; body: { action: string; note?: string } }> = [];
  const conference = {
    id: conf,
    name: 'Student verification test',
    myRoles: ['CHAIR'],
    status: 'FINALIZATION',
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
    else if (url.pathname.endsWith('/student-verifications')) {
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      body = { data: rows, nextCursor: null };
    } else if (url.pathname.endsWith('/review')) {
      const id = url.pathname.split('/').at(-2)!;
      const input = route.request().postDataJSON() as { action: string; note?: string };
      reviews.push({ id, body: input });
      const row = rows.find((item) => item.id === id)!;
      row.status =
        input.action === 'APPROVE'
          ? 'APPROVED'
          : input.action === 'REJECT'
            ? 'REJECTED'
            : 'CLARIFICATION_REQUESTED';
      row.note = input.note ?? null;
      body = { registration: {}, message: 'Reviewed' };
    } else if (url.pathname.endsWith('/proof-0/download')) {
      const disposition = url.searchParams.get('disposition') ?? 'attachment';
      documentRequests.push(disposition);
      body = {
        downloadUrl: new URL(`/student-test.pdf?as=${disposition}`, page.url()).href,
        expiresInSeconds: 300,
      };
    } else if (url.pathname.endsWith(`/papers/${paperId(0)}`))
      body = {
        id: paperId(0),
        currentVersionId: 'version-0',
        currentVersion: { id: 'version-0', fileAsset: { scanStatus: 'CLEAN' } },
      };
    else if (url.pathname.endsWith('/versions/version-0/download')) {
      paperRequests.push(url.searchParams.get('disposition') ?? 'attachment');
      body = { downloadUrl: new URL('/paper-test.html', page.url()).href, expiresInSeconds: 300 };
    }
    await route.fulfill({ json: body });
  });
  // A real viewer would render the PDF; a page stands in so the new tab can be read.
  await page
    .context()
    .route('**/student-test.pdf?as=inline', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Student document</title>' }),
    );
  await page
    .context()
    .route('**/paper-test.html', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Paper PDF</title>' }),
    );
  await page.route('**/student-test.pdf?as=attachment', (route) =>
    route.fulfill({
      headers: { 'content-disposition': 'attachment; filename="student-id.pdf"' },
      contentType: 'application/pdf',
      body: '%PDF-1.4 test',
    }),
  );
  return { reviews, documentRequests, paperRequests };
}

// The review controls sit in a second row that opens on click; the paper link identifies the main one.
const mainRow = (page: Page, title: string) =>
  page.getByRole('row').filter({ has: page.getByRole('link', { name: title, exact: true }) });
const reviewPanel = (page: Page, id: string) => page.locator(`[data-verification="${id}"]`);
const toggle = (page: Page, title: string, label: 'Review' | 'Details for' = 'Review') =>
  page.getByRole('button', { name: `${label} ${title}`, exact: true });

test('the queue shows what needs review and guards unsafe or decided documents', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const api = await mockApi(page);
  await page.goto(path);

  // Only undecided documents by default; the approved one is behind "All".
  await expect(page.getByRole('button', { name: 'Needs review (3)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(mainRow(page, 'Student paper 0')).toBeVisible();
  await expect(mainRow(page, 'Student paper 1')).toBeVisible();
  await expect(mainRow(page, 'Student paper 3')).toBeVisible();
  await expect(mainRow(page, 'Student paper 2')).toHaveCount(0);
  await expect(
    page
      .getByRole('navigation', { name: 'Registration views' })
      .getByRole('link', { name: /Student verifications/ }),
  ).toContainText('3');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Registrations');

  // Rows start closed; the files and the decision open on click, as on Decisions.
  await expect(page.locator('[data-verification]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  const first = toggle(page, 'Student paper 0');
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await expect(reviewPanel(page, 'proof-0').getByRole('button', { name: 'Approve' })).toBeEnabled();
  await toggle(page, 'Student paper 1').click();
  await expect(reviewPanel(page, 'proof-1').getByRole('button', { name: 'Approve' })).toBeEnabled();
  await expect(reviewPanel(page, 'proof-1')).toContainText('Please upload both sides.');
  await toggle(page, 'Student paper 3').click();
  const unsafe = reviewPanel(page, 'proof-3');
  await expect(unsafe.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await expect(unsafe).toContainText('Approval unlocks once the document passes its file check.');
  await expect(unsafe.getByRole('button', { name: 'Open student document' })).toBeDisabled();
  await expect(unsafe.getByRole('button', { name: 'Download document' })).toBeDisabled();
  await expect(mainRow(page, 'Student paper 3')).toContainText('Unsafe document');
  await page.screenshot({
    path: testInfo.outputPath('student-verifications-desktop.png'),
    fullPage: true,
  });

  // Both files open in a new tab, so the queue stays where it is.
  const panel = reviewPanel(page, 'proof-0');
  const documentTab = page.waitForEvent('popup');
  await panel.getByRole('button', { name: 'Open student document' }).click();
  await expect(await documentTab).toHaveTitle('Student document');
  expect(api.documentRequests).toEqual(['inline']);
  const paperTab = page.waitForEvent('popup');
  await panel.getByRole('button', { name: 'Open paper PDF' }).click();
  await expect(await paperTab).toHaveTitle('Paper PDF');
  expect(api.paperRequests).toEqual(['inline']);
  await expect(page).toHaveURL(new RegExp(`${path}$`));

  // Downloading still saves the original file.
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download document' }).click();
  expect((await download).suggestedFilename()).toBe('student-id.pdf');
  expect(api.documentRequests).toEqual(['inline', 'attachment']);
  await expect(page).toHaveURL(new RegExp(`${path}$`));

  await first.click();
  await expect(reviewPanel(page, 'proof-0')).toHaveCount(0);

  await page.getByRole('button', { name: 'All (4)' }).click();
  await expect(mainRow(page, 'Student paper 2')).toContainText('Approved');
  await toggle(page, 'Student paper 2', 'Details for').click();
  await expect(reviewPanel(page, 'proof-2').getByRole('button', { name: 'Approve' })).toHaveCount(
    0,
  );
  await expect(reviewPanel(page, 'proof-2')).toContainText('No note was sent to the author.');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Student paper 1' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^(Review|Details for) Student paper/ }),
  ).toHaveCount(4);
  await toggle(page, 'Student paper 0').click();
  await expect(reviewPanel(page, 'proof-0').getByRole('button', { name: 'Approve' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('student-verifications-mobile.png'),
    fullPage: true,
  });
});

test('rejecting or asking for clarification needs a written note and a confirmation', async ({
  page,
}) => {
  const api = await mockApi(page);
  await page.goto(path);
  await toggle(page, 'Student paper 0').click();
  const panel = reviewPanel(page, 'proof-0');
  const reject = panel.getByRole('button', { name: 'Reject' });
  const clarify = panel.getByRole('button', { name: 'Request clarification' });
  await expect(reject).toBeDisabled();
  await expect(clarify).toBeDisabled();
  await expect(panel).toContainText('Write a note to request clarification or reject.');

  await panel.getByLabel('Note to the author for Student paper 0').fill('The ID has expired.');
  await reject.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Student paper 0');
  await expect(dialog).toContainText('The ID has expired.');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(api.reviews).toHaveLength(0);

  await reject.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reject student rate' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Student rate rejected.' }),
  ).toBeVisible();
  expect(api.reviews).toEqual([
    { id: 'proof-0', body: { action: 'REJECT', note: 'The ID has expired.' } },
  ]);
  // The decided row leaves the queue and the tab count drops.
  await expect(mainRow(page, 'Student paper 0')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Needs review (2)' })).toBeVisible();

  await toggle(page, 'Student paper 1').click();
  const second = reviewPanel(page, 'proof-1');
  await second.getByLabel('Note to the author for Student paper 1').fill('Send a clearer scan.');
  await second.getByRole('button', { name: 'Request clarification' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Clarification requested from the author.' }),
  ).toBeVisible();
  expect(api.reviews[1]).toEqual({
    id: 'proof-1',
    body: { action: 'CLARIFY', note: 'Send a clearer scan.' },
  });
});

test('approval needs no note and an empty queue is only shown once loading has finished', async ({
  page,
}) => {
  const api = await mockApi(page, { delayMs: 1500 });
  await page.goto(path);
  await expect(page.getByRole('status', { name: 'Loading student verifications' })).toBeVisible();
  await expect(page.getByText('No student verifications yet')).toHaveCount(0);
  await expect(page.getByText('Nothing needs review')).toHaveCount(0);

  await toggle(page, 'Student paper 0').click();
  await reviewPanel(page, 'proof-0').getByRole('button', { name: 'Approve' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Student rate approved.' }),
  ).toBeVisible();
  expect(api.reviews).toEqual([{ id: 'proof-0', body: { action: 'APPROVE' } }]);
});

test('a conference with no student documents says so', async ({ page }) => {
  await mockApi(page, { empty: true });
  await page.goto(path);
  await expect(page.getByText('No student verifications yet')).toBeVisible();
});
