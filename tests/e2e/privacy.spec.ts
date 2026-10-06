import { test, expect } from '@playwright/test';
const password = 'Encore-test-passphrase-2026';
const origin = 'http://127.0.0.1:3000';

test('privacy page states controller status, legal bases, region, retention, rights and beta terms', async ({
  page,
}) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy and beta terms' })).toBeVisible();
  // The test environment has no controller configured: the page must say so, not invent one.
  await expect(page.getByText('not configured on this deployment yet')).toBeVisible();
  for (const heading of ['Why (legal basis)', 'Where', 'How long', 'Your rights', 'Beta terms'])
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'cnil.fr' })).toHaveAttribute(
    'href',
    'https://www.cnil.fr',
  );
});

test('data export includes saved trips', async ({ page }) => {
  const send = (path: string, data: unknown) =>
    page.request.post(`/api/${path}`, { headers: { Origin: origin }, data });
  const email = `privacy-${Date.now()}@example.test`;
  expect((await send('auth/signup', { name: 'Privacy', email, password })).ok()).toBe(true);
  const exported = await (await page.request.get('/api/export')).json();
  expect(exported.savedTrips).toEqual([]);
  expect((await send('account/delete', { password })).ok()).toBe(true);
});
