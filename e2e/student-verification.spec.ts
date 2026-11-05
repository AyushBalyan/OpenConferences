import { expect, test } from '@playwright/test';
const conf = '00000000-0000-4000-8000-000000000001';
test('chairs can download clean proof, review clarification, and cannot approve unsafe or reviewed documents', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const rows = ['PENDING', 'CLARIFICATION_REQUESTED', 'APPROVED', 'PENDING'].map((status, i) => ({
    id: `proof-${i}`,
    paperTitle: `Student paper ${i}`,
    status,
    note: null,
    scanStatus: i === 3 ? 'INFECTED' : 'CLEAN',
    originalFilename: 'student-id.pdf',
  }));
  const conference = {
    id: conf,
    name: 'Student verification test',
    myRoles: ['CHAIR'],
    status: 'FINALIZATION',
  };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { data: [], nextCursor: null };
    if (path.endsWith('/get-session'))
      body = {
        session: { id: 'session', userId: conf, token: 'test', expiresAt: '2099-01-01T00:00:00Z' },
        user: { id: conf, name: 'Chair', email: 'chair@example.test', emailVerified: true },
      };
    else if (path.endsWith('/auth/me')) body = { id: conf, name: 'Chair', twoFactorEnabled: true };
    else if (path.endsWith('/conferences')) body = { data: [conference], nextCursor: null };
    else if (path.endsWith(`/conferences/${conf}`)) body = conference;
    else if (path.endsWith('/student-verifications')) body = { data: rows, nextCursor: null };
    else if (path.endsWith('/proof-0/download'))
      body = { downloadUrl: new URL('/student-test.pdf', page.url()).href, expiresInSeconds: 300 };
    await route.fulfill({ json: body });
  });
  await page.route('**/student-test.pdf', (route) =>
    route.fulfill({
      headers: { 'content-disposition': 'attachment; filename="student-id.pdf"' },
      contentType: 'application/pdf',
      body: '%PDF-1.4 test',
    }),
  );
  await page.goto(`/dashboard/conferences/${conf}/registrations/verifications`);
  const pending = page.getByRole('row').filter({ hasText: 'Student paper 0' });
  await expect(pending.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
  const clarification = page.getByRole('row').filter({ hasText: 'Student paper 1' });
  await expect(clarification.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Student paper 2' })
      .getByRole('button', { name: 'Approve', exact: true }),
  ).toBeDisabled();
  const unsafe = page.getByRole('row').filter({ hasText: 'Student paper 3' });
  await expect(unsafe.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await expect(unsafe.getByRole('button', { name: 'Download document' })).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath('student-verifications-desktop.png'),
    fullPage: true,
  });
  const download = page.waitForEvent('download');
  await pending.getByRole('button', { name: 'Download document' }).click();
  expect((await download).suggestedFilename()).toBe('student-id.pdf');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(clarification.getByRole('button', { name: 'Download document' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('student-verifications-mobile.png'),
    fullPage: true,
  });
});
