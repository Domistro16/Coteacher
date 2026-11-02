import { expect, test } from '@playwright/test';

// UI-only issuer simulation: this test never sends an email or verifies SMTP.
test('unconfirmed sign-in explains verification and can resend without a password', async ({ page }) => {
  await page.route('**/api/v1/config', route => route.fulfill({ json: {
    managed: true, simulated: true, connectedTutor: false, liveVoice: false,
    schoolUrl: 'http://127.0.0.1:4275', teacherUrl: 'http://127.0.0.1:4274', studentUrl: 'http://127.0.0.1:4273',
  } }));
  await page.route('**/api/v1/me', route => route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } }));
  await page.route('**/api/v1/login', route => route.fulfill({ status: 401, json: {
    error: 'Confirm your email before signing in. Check your inbox and spam folder, or resend the confirmation email.',
  } }));
  const attempts: Record<string, unknown>[] = [];
  await page.route('**/api/v1/auth/resend', route => {
    attempts.push(route.request().postDataJSON());
    return route.fulfill(attempts.length === 1
      ? { status: 503, json: { error: 'The confirmation email could not be sent right now. Please try again later.' } }
      : { json: { message: 'If this account still needs confirmation, a new email has been sent. Check your inbox and spam folder.' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Resend confirmation email', exact: true }).click();
  expect(attempts).toHaveLength(0);
  await page.getByLabel('Email or school-issued username').fill('fictional@invalid.example');
  await page.getByLabel('Password', { exact: true }).fill('fictional-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Confirm your email before signing in');
  await page.getByLabel('Password', { exact: true }).clear();
  await page.getByRole('button', { name: 'Resend confirmation email', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be sent');
  await expect(page.getByText(/a new email has been sent/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Resend confirmation email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Check your inbox and spam folder');
  expect(attempts).toEqual([
    { email: 'fictional@invalid.example', role: 'owner' },
    { email: 'fictional@invalid.example', role: 'owner' },
  ]);
});
