import { test, expect } from '@playwright/test';
import { defaults } from '../../src/domain/catalog';

test('a provincial fan sees their artists in Paris, with no concerts from another account', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('/signup');
  const origin = new URL(page.url()).origin;
  const password = 'Showbound-province-test-2026';
  await page.getByLabel('Your name').fill('Alice');
  await page.getByLabel('Email', { exact: true }).fill(`alice-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Where should the music take you?' }),
  ).toBeVisible();
  await page.getByLabel('Home city', { exact: true }).selectOption('Limoges');
  await page
    .getByRole('combobox', { name: 'Where would you go?', exact: true })
    .selectOption('country');
  await page.screenshot({ path: testInfo.outputPath('province-onboarding.png'), fullPage: true });
  await page.getByRole('button', { name: 'Choose artists', exact: true }).click();
  await page.getByRole('button', { name: /Fred again/ }).click();
  await page.getByRole('button', { name: 'Find my concerts' }).click();
  await expect(page.getByRole('heading', { name: 'Who’s on' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save Fred again.. in Paris', exact: true }),
  ).toBeVisible();
  const state = async () => (await page.request.get('/api/state')).json();
  let alice = await state();
  expect(alice.user.preferences).toMatchObject({ home: 'Limoges', scope: 'country' });
  expect(alice.events.map((e: { id: string }) => e.id)).toEqual(['sample-1']);

  const bob = await browser.newContext({ baseURL: origin });
  const post = (path: string, data: unknown) =>
    bob.request.post(`/api/${path}`, { data, headers: { Origin: origin } });
  try {
    expect(
      (
        await post('auth/signup', {
          name: 'Bob',
          email: `bob-${Date.now()}@example.test`,
          password,
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await post('onboarding', {
          artistIds: ['billie-eilish'],
          preferences: { ...defaults, home: 'Quimper', scope: 'country' },
          mode: 'sample',
        })
      ).ok(),
    ).toBe(true);
    const bobState = await (await bob.request.get('/api/state')).json();
    expect(bobState.events.map((e: { id: string }) => e.id)).toEqual(['sample-2']);
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Save Fred again.. in Paris', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Billie Eilish', exact: true })).toHaveCount(0);
    alice = await state();
    expect(alice.events.map((e: { id: string }) => e.id)).toEqual(['sample-1']);

    await page.goto('/app/events/sample-1');
    await page.getByRole('button', { name: 'I need to see this artist' }).click();
    await page
      .getByRole('combobox', { name: 'Add a city (up to 9)', exact: true })
      .selectOption('Paris');
    await page.getByRole('button', { name: 'Save must-see preferences' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect((await state()).intents[0].cities).toEqual(['Limoges', 'Paris']);

    await page.goto('/app/settings');
    await page.getByLabel('Home city', { exact: true }).selectOption('Bourges');
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(page.getByText('Your preferences are saved', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Home city', { exact: true })).toHaveValue('Bourges');
  } finally {
    await post('account/delete', {});
    await bob.close();
    await page.request.post('/api/account/delete', { data: {}, headers: { Origin: origin } });
  }
});
