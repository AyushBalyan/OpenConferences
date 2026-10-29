import { expect, test, type Page } from '@playwright/test';

const conferenceId = '00000000-0000-4000-8000-000000000001';
const paperId = '00000000-0000-4000-8000-000000000004';
const userId = '00000000-0000-4000-8000-000000000003';
const path = `/dashboard/conferences/${conferenceId}/submissions/${paperId}`;

async function mockRevision(page: Page, options: { expired?: boolean; fail?: boolean } = {}) {
  let scanStatus: 'PENDING_SCAN' | 'CLEAN' | null = null;
  let note = '';
  let filename = '';
  let releaseUpload: (() => void) | undefined;
  const uploadGate = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });
  const conference = {
    id: conferenceId,
    name: 'Revision test conference',
    status: 'REVIEWING',
    myRoles: ['AUTHOR'],
  };
  await page.route('**/revision-test-upload', async (route) => {
    await uploadGate;
    await route.fulfill({ status: options.fail ? 500 : 200, body: '' });
  });
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const revisionVersion = scanStatus
      ? {
          id: 'revision-version',
          kind: 'REVISION',
          note,
          createdAt: '2099-01-02T00:00:00Z',
          fileAsset: { originalFilename: filename, scanStatus },
        }
      : null;
    let body: unknown = { data: [], nextCursor: null };
    let status = 200;
    if (endpoint.endsWith('/get-session'))
      body = {
        session: { id: 'session', userId, token: 'test', expiresAt: '2099-01-01T00:00:00Z' },
        user: {
          id: userId,
          name: 'Test Author',
          email: 'author@example.test',
          emailVerified: true,
        },
      };
    else if (endpoint === '/auth/me')
      body = { id: userId, name: 'Test Author', email: 'author@example.test' };
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint === `/conferences/${conferenceId}`) body = conference;
    else if (endpoint.endsWith(`/papers/${paperId}`))
      body = {
        id: paperId,
        status: 'UNDER_REVIEW',
        title: 'Reliable revision workflows',
        submittedById: userId,
        abstract: 'The original abstract stays in the submission record.',
        keywords: [],
        authorships: [],
        revisionDueAt: options.expired ? '2020-01-01T00:00:00Z' : '2099-11-12T12:00:00Z',
        latestCycleId: scanStatus === 'CLEAN' ? 'cycle-2' : 'cycle-1',
        revisionVersion,
        latestVersion: revisionVersion,
        currentVersion:
          scanStatus === 'CLEAN'
            ? revisionVersion
            : { kind: 'SUBMISSION', fileAsset: { scanStatus: 'CLEAN' } },
      };
    else if (endpoint.endsWith('/decision'))
      body = {
        outcome: 'MAJOR_REVISION',
        roundId: 'cycle-1',
        createdAt: '2026-10-27T00:00:00Z',
        rationale: 'Expand the multilingual evaluation and explain the annotation process.',
      };
    else if (endpoint.endsWith('/rebuttal')) {
      status = 404;
      body = {};
    } else if (endpoint.endsWith('/versions/initiate')) {
      filename = route.request().postDataJSON().originalFilename;
      body = { uploadUrl: 'http://localhost:3000/revision-test-upload', objectKey: 'revision.pdf' };
    } else if (endpoint.endsWith('/versions/complete')) {
      note = route.request().postDataJSON().note;
      scanStatus = 'PENDING_SCAN';
      status = 201;
      body = {};
    }
    await route.fulfill({ status, json: body });
  });
  return {
    releaseUpload: () => releaseUpload?.(),
    finishScan: () => {
      scanStatus = 'CLEAN';
    },
  };
}

test('puts the revision form first and distinguishes uploading, scanning and submission', async ({
  page,
}) => {
  const api = await mockRevision(page);
  await page.goto(`${path}?section=overview`);
  await page.getByRole('button', { name: 'Upload revised PDF', exact: true }).click();
  await expect(page).toHaveURL(/section=submission#revision$/);
  await expect(page.getByRole('heading', { name: 'Submit your revised manuscript' })).toBeVisible();
  await expect(
    page.getByText('The original abstract stays in the submission record.'),
  ).toBeHidden();
  const submit = page.getByRole('button', { name: 'Submit revised PDF and response', exact: true });
  await expect(submit).toBeDisabled();
  await page.locator('input[type=file]').setInputFiles({
    name: 'revised.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 revision'),
  });
  await expect(submit).toBeDisabled();
  await page
    .getByLabel('Response to reviewers')
    .fill('Expanded the multilingual evaluation and documented the annotation process.');
  await submit.click();
  await expect(page.getByRole('button', { name: 'Uploading revision…' })).toBeDisabled();
  api.releaseUpload();
  await expect(
    page.getByText('Your PDF was uploaded. We’re checking the file; this updates automatically.'),
  ).toBeVisible();
  api.finishScan();
  await expect(
    page.getByRole('heading', { name: 'Revision submitted', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Your revision has been submitted for review.')).toBeVisible();
  await expect(
    page.getByText('Expanded the multilingual evaluation and documented the annotation process.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Submit revised PDF and response', exact: true }),
  ).toHaveCount(0);
});

test('keeps the form discoverable on mobile and preserves input after an upload failure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await mockRevision(page, { fail: true });
  await page.goto(`${path}?section=submission`);
  const picker = page.getByRole('button', { name: 'Drop your PDF here, or browse' });
  await expect(picker).toBeInViewport();
  await page.locator('input[type=file]').setInputFiles({
    name: 'retry-revision.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 revision'),
  });
  await page
    .getByLabel('Response to reviewers')
    .fill('The updated analysis addresses each review.');
  await page.getByRole('button', { name: 'Submit revised PDF and response', exact: true }).click();
  api.releaseUpload();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Your PDF could not be uploaded. Please try again.' }),
  ).toBeVisible();
  await expect(page.getByText('retry-revision.pdf', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Response to reviewers')).toHaveValue(
    'The updated analysis addresses each review.',
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('explains an expired deadline without presenting an upload action', async ({ page }) => {
  await mockRevision(page, { expired: true });
  await page.goto(`${path}?section=submission`);
  await expect(
    page.getByText(
      'The revision deadline has passed. Contact the organizers to request an extension.',
    ),
  ).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(0);
});
