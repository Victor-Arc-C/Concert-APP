import { test, expect } from '@playwright/test';

test('language switch: French everywhere, remembered across pages and reloads, then back', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('heading', { name: 'Never miss your favourite artists live.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Français' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Ne rate plus jamais tes artistes préférés en live.' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect((await page.context().cookies()).find((c) => c.name === 'showbound_lang')?.value).toBe(
    'fr',
  );

  // The app, server-rendered metadata and formats follow the same choice after a reload.
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Qui joue' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Tout voir/ })).toBeVisible();
  await expect(page.getByText('€', { exact: false }).first()).toBeVisible();
  expect(await page.locator('.chip', { hasText: 'Dès' }).first().textContent()).toMatch(
    /Dès \d+\s€/,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Qui joue' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

  // A detail page: dates and labels in French, nothing left in English.
  await page.goto('/app/events/sample-1');
  await expect(page.getByRole('button', { name: 'Garder ce concert' })).toBeVisible();
  await expect(page.getByText(/novembre|décembre|janvier/).first()).toBeVisible();
  await expect(page.getByText('Save this show')).toHaveCount(0);
  // Recommendation reasons come from the server in English and must be shown in French.
  await expect(page.locator('.reason-list li').first()).toBeVisible();
  await expect(page.locator('.reason-list')).not.toContainText(/\b(You|your|In your|One of)\b/);

  await page.goto('/privacy');
  await expect(
    page.getByRole('heading', { name: 'Confidentialité et conditions de la bêta' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy and beta terms' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
