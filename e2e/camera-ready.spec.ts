import { expect, test, type Page } from '@playwright/test';

const conferenceId = '00000000-0000-4000-8000-000000000001';
const paperId = '00000000-0000-4000-8000-000000000002';
const userId = '00000000-0000-4000-8000-000000000003';
const paperPath = `/dashboard/conferences/${conferenceId}/submissions/${paperId}`;

async function mockAcceptedPaper(
  page: Page,
  replacement = false,
  options: { student?: boolean; documentFailure?: boolean } = {},
) {
  let completedDocuments = 0;
  const registration = {
    status: 'PENDING',
    audience: options.student ? 'STUDENT' : 'REGULAR',
    deadlineAt: '2099-11-25T12:00:00Z',
    amountDueMinor: 0,
    feeSchedule: {},
    latestVerification: null as { status: string; note: null } | null,
  };
  const conference = {
    id: conferenceId,
    name: 'Camera-ready test conference',
    myRoles: ['AUTHOR'],
    status: 'REVIEWING',
    cameraReadyDueAt: '2099-11-25T12:00:00Z',
  };
  let scanStatus = replacement ? 'CLEAN' : null;
  let filename = 'original-final.pdf';
  let failUpload = false;
  let releaseUpload: (() => void) | undefined;
  const uploadGate = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });
  await page.route('**/camera-ready-test-upload', async (route) => {
    await uploadGate;
    await route.fulfill({ status: failUpload ? 500 : 200, body: '' });
  });
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const version = scanStatus
      ? {
          id: 'camera-version',
          kind: 'CAMERA_READY',
          fileAsset: { originalFilename: filename, scanStatus },
        }
      : null;
    let status = 200;
    let body: unknown = { data: [], nextCursor: null };
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
        title: 'Reliable conference workflows',
        submittedById: userId,
        status: scanStatus === 'CLEAN' ? 'CAMERA_READY' : 'DECISION_MADE',
        keywords: [],
        authorships: [],
        cameraReadyVersion: version,
        currentVersion: { fileAsset: { scanStatus: 'CLEAN' } },
      };
    else if (endpoint.endsWith('/decision'))
      body = { outcome: 'ACCEPT', rationale: 'Ready for publication.' };
    else if (endpoint.endsWith('/rebuttal')) {
      status = 404;
      body = {};
    } else if (endpoint.endsWith('/registration')) body = registration;
    else if (endpoint.endsWith('/registration/payment'))
      body = { provider: 'mock', keyId: 'mock_key_id' };
    else if (endpoint.endsWith('/student-verification/initiate'))
      body = {
        uploadUrl: 'http://localhost:3000/student-proof-test-upload',
        objectKey: 'student-proof.pdf',
      };
    else if (endpoint.endsWith('/student-verification/complete')) {
      completedDocuments += 1;
      registration.latestVerification = { status: 'PENDING', note: null };
      status = 201;
      body = registration.latestVerification;
    } else if (endpoint.endsWith('/versions/initiate')) {
      filename = route.request().postDataJSON().originalFilename;
      body = {
        uploadUrl: 'http://localhost:3000/camera-ready-test-upload',
        objectKey: 'final.pdf',
      };
    } else if (endpoint.endsWith('/versions/complete')) {
      scanStatus = 'PENDING_SCAN';
      status = 201;
      body = {};
    }
    await route.fulfill({ status, json: body });
  });
  await page.route('**/student-proof-test-upload', async (route) => {
    await uploadGate;
    await route.fulfill({ status: options.documentFailure ? 500 : 200, body: '' });
  });
  return {
    completedDocuments: () => completedDocuments,
    releaseUpload: () => releaseUpload?.(),
    failUpload: () => {
      failUpload = true;
    },
    allowUpload: () => {
      failUpload = false;
    },
    finishScan: () => {
      scanStatus = 'CLEAN';
    },
  };
}

test('unavailable payments show a message that remains visible after registration refresh', async ({
  page,
}) => {
  await mockAcceptedPaper(page);
  await page.goto(`${paperPath}?section=registration`);
  await page.getByRole('button', { name: 'Pay now', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Online payment is unavailable' }),
  ).toHaveText('Online payment is unavailable right now. Please contact the organizers.');
});

test('student proof lists acceptable documents, validates files and confirms receipt before payment', async ({
  page,
}) => {
  const api = await mockAcceptedPaper(page, false, { student: true });
  await page.goto(`${paperPath}?section=registration`);
  await expect(page.getByText('A current student ID showing your enrollment period')).toBeVisible();
  await expect(
    page.getByText('An enrollment or bonafide certificate from your institution'),
  ).toBeVisible();
  await expect(
    page.getByText('An official letter confirming your current student status'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay now', exact: true })).toHaveCount(0);
  const input = page.getByLabel('Choose student proof document');
  await input.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a document'),
  });
  await expect(page.getByText('Choose a PDF, JPEG, or PNG file.')).toBeVisible();
  await input.setInputFiles({
    name: 'oversize.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(10_485_761),
  });
  await expect(
    page.getByText('This file is too large. Choose a document under 10 MB.'),
  ).toBeVisible();
  await input.setInputFiles({
    name: 'student-id.png',
    mimeType: 'image/png',
    buffer: Buffer.from('student proof fixture'),
  });
  await page.getByRole('button', { name: 'Upload student proof', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Uploading document…', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save category', exact: true })).toBeDisabled();
  api.releaseUpload();
  await expect(page.getByText('Document received', { exact: true })).toBeVisible();
  await expect(page.getByText('student-id.png', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay now', exact: true })).toBeEnabled();
});

test('student proof keeps the selected document after a failed upload and does not enable payment', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await mockAcceptedPaper(page, false, { student: true, documentFailure: true });
  await page.goto(`${paperPath}?section=registration`);
  await page.getByLabel('Choose student proof document').setInputFiles({
    name: 'enrollment.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 student proof'),
  });
  await page.getByRole('button', { name: 'Upload student proof', exact: true }).click();
  api.releaseUpload();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Your document could not be uploaded.' }),
  ).toBeVisible();
  await expect(page.getByText('enrollment.pdf', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Upload student proof', exact: true }),
  ).toBeEnabled();
  expect(api.completedDocuments()).toBe(0);
  await expect(page.getByRole('button', { name: 'Pay now', exact: true })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('separates registration and shows upload, scanning and completion feedback', async ({
  page,
}, testInfo) => {
  const api = await mockAcceptedPaper(page);
  await page.goto(`${paperPath}?section=final`);
  await expect(page.getByText('No camera-ready PDF uploaded yet.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Conference registration', exact: true, level: 2 }),
  ).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({
    name: 'final.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  await page.getByRole('button', { name: 'Upload camera-ready PDF', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Uploading camera-ready PDF…', exact: true }),
  ).toBeDisabled();
  api.releaseUpload();
  await expect(page.getByText('final.pdf uploaded successfully.')).toBeVisible();
  await expect(
    page.getByText('Uploaded · Checking your PDF. Status updates automatically.'),
  ).toBeVisible();
  api.finishScan();
  await expect(page.getByText('Uploaded successfully.')).toBeVisible({
    timeout: 10000,
  });
  await page.screenshot({ path: testInfo.outputPath('camera-ready-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Registration', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Conference registration', exact: true, level: 2 }),
  ).toBeVisible();
  await expect(page.getByText('Camera-ready submission', { exact: true })).toHaveCount(0);
});

test('labels replacement explicitly and keeps the selected file after failure', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await mockAcceptedPaper(page, true);
  await page.goto(`${paperPath}?section=camera-ready`);
  await expect(page.getByText('original-final.pdf', { exact: true })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'replacement.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 replacement'),
  });
  await page.getByRole('button', { name: 'Replace camera-ready PDF', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Uploading replacement…', exact: true }),
  ).toBeDisabled();
  api.failUpload();
  api.releaseUpload();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Your PDF could not be uploaded. Please try again.' }),
  ).toBeVisible();
  await expect(page.getByText('replacement.pdf', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Replace camera-ready PDF', exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('camera-ready-mobile.png'), fullPage: true });
  api.allowUpload();
  await page.getByRole('button', { name: 'Replace camera-ready PDF', exact: true }).click();
  await expect(page.getByText('replacement.pdf replacement uploaded successfully.')).toBeVisible();
  await expect(
    page.getByText('Uploaded · Checking your PDF. Status updates automatically.'),
  ).toBeVisible();
});
