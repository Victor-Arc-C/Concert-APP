import { test, expect } from '@playwright/test';
const password = 'Encore-test-passphrase-2026';
const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

test('beta feedback: send from settings, export it, reject bad input, delete with account', async ({
  page,
}) => {
  const email = `feedback-${Date.now()}@example.test`;
  const send = (path: string, data: unknown) =>
    page.request.post(`/api/${path}`, { headers: { Origin: origin }, data });
  expect((await send('auth/signup', { name: 'Feedback', email, password })).ok()).toBe(true);
  expect((await send('beta-feedback', { message: 'x', screen: '/app' })).ok()).toBe(true);
  for (const bad of [
    { message: '', screen: '/app' },
    { message: 'x'.repeat(2001), screen: '/app' },
    { message: 'ok', rating: 6, screen: '/app' },
    { message: 'ok', screen: '/app', userId: 'someone-else' },
  ])
    expect((await send('beta-feedback', bad)).status()).toBe(400);
  expect(
    (
      await page.request.post('/api/beta-feedback', {
        headers: { Origin: 'https://evil.test' },
        data: { message: 'x', screen: '/app' },
      })
    ).status(),
  ).toBe(403);

  await page.goto('/app/settings');
  await page
    .locator('section', { hasText: 'Help shape the beta' })
    .getByRole('button', { name: 'Send feedback' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Send feedback' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Send feedback' })).toBeDisabled();
  await dialog.getByLabel('Your feedback').fill('I could not find my favourite artist.');
  await dialog.getByRole('button', { name: '4 out of 5' }).click();
  await expect(dialog.getByRole('button', { name: '4 out of 5' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByText('Thanks. Your feedback reached the Showbound team.')).toBeVisible();
  await expect(dialog).toHaveCount(0);

  const exported = await (await page.request.get('/api/export')).json();
  expect(exported.betaFeedback).toHaveLength(2);
  expect(exported.betaFeedback[1]).toMatchObject({
    message: 'I could not find my favourite artist.',
    rating: 4,
    screen: '/app/settings',
  });

  expect((await send('account/delete', { password })).ok()).toBe(true);
  expect((await send('beta-feedback', { message: 'x', screen: '/app' })).status()).toBe(401);
});
