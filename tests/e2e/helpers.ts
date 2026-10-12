import { expect, type Page } from '@playwright/test';

/**
 * Submits the artist choice and follows the loader to the feed, one stage at a time. A single
 * assertion on the feed heading has to fit the onboarding request, a state reload, the loader's
 * deliberate 1.8 s "ready" hold, the route change and the feed's own state fetch into one 5 s
 * window, which a slow WebKit run does not always manage.
 */
export async function findConcerts(page: Page) {
  const saved = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/onboarding',
  );
  await page.getByRole('button', { name: 'Find my concerts' }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'See your shows' })).toBeVisible();
  // Nothing is clicked: the loader moves on to the feed by itself.
  await page.waitForURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Who’s on' })).toBeVisible();
}
