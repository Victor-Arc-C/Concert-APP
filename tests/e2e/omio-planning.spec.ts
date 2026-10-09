import { test, expect, type Page } from '@playwright/test';
import { defaults } from '../../src/domain/catalog';
import { sampleEvents } from '../../src/domain/sample';
import { omioSearchUrl } from '../../src/server/providers/omio';
import type { TravelSearch } from '../../src/domain/travel-planning';

async function fixture(
  page: Page,
  settings: { missing?: boolean; reason?: string; failure?: boolean } = {},
) {
  const event = {
    ...sampleEvents()[0],
    id: 'omio-ui',
    provider: 'ticketmaster',
    city: settings.missing ? '' : 'Berlin',
    date: '2099-11-15',
    timezone: 'Europe/Berlin',
    reasons: [],
    saved: false,
    tier: 'Artist you follow',
    score: 80,
  };
  const state = {
    user: {
      id: 'fixture',
      name: 'Test',
      email: 'test@example.test',
      mode: 'live',
      onboarded: true,
      preferences: { ...defaults, home: settings.missing ? '' : 'Paris' },
    },
    artists: [],
    affinities: [],
    intents: [],
    events: [event],
    allEvents: [event],
    saved: [],
    alerts: [],
    spotifyConnected: false,
    spotifyAvailable: false,
    liveAvailable: true,
    automaticChecks: false,
    artistChecks: [],
    providerMessage: null,
  };
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.route('**/api/analytics', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/travel/planning/open', (route) =>
    settings.failure
      ? route.fulfill({ status: 503, json: { error: 'Unavailable' } })
      : route.fulfill({
          json: {
            provider: 'omio',
            reason: settings.reason ?? null,
            today: '2099-11-01',
            defaults: {
              departure: state.user.preferences.home,
              destination: event.city,
              departureDate: event.date,
              returnDate: '',
              locale: 'en',
            },
          },
        }),
  );
  // Isolated UI test: synthetic partner ID; all external navigation intercepted below.
  await page.route('**/api/travel/planning/search', (route) => {
    const search = route.request().postDataJSON().search as TravelSearch;
    return route.fulfill({ json: { url: omioSearchUrl(search, '987654321234') } });
  });
  await page.route('https://omio.sjv.io/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Intercepted Omio handoff</h1>' }),
  );
  await page.goto('/app/events/omio-ui');
  await page.getByRole('button', { name: 'Plan your trip', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('edits prefilled details and hands off the encoded route on desktop and mobile', async ({
  page,
}) => {
  await fixture(page);
  const dialog = page.getByRole('dialog');
  await expect(page.getByLabel('Departure city')).toHaveValue('Paris');
  await expect(page.getByLabel('Destination city')).toHaveValue('Berlin');
  await expect(page.getByLabel('Departure date', { exact: true })).toHaveValue('2099-11-15');
  await expect(page.getByLabel('Return date (optional)')).toHaveValue('');
  await expect(dialog).toContainText('only a suggestion');
  await expect(dialog).toContainText('affiliate link');
  await page.getByLabel('Departure city').fill('Saint-Étienne & Lyon');
  await page.getByLabel('Destination city').fill('München, DE');
  await page.getByLabel('Departure date', { exact: true }).fill('2099-11-14');
  await page.getByLabel('Return date (optional)').fill('2099-11-16');
  await page.getByLabel('Transportation preference').selectOption('TRAIN');
  await dialog.screenshot({
    animations: 'disabled',
    path: `test-results/omio-desktop-${test.info().project.name}.png`,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await dialog.screenshot({
    animations: 'disabled',
    path: `test-results/omio-mobile-${test.info().project.name}.png`,
  });
  const submitted = page.waitForRequest('**/api/travel/planning/search');
  await page.getByRole('button', { name: 'Continue to Omio' }).click();
  expect((await submitted).postDataJSON()).toMatchObject({
    eventId: 'omio-ui',
    search: {
      departure: 'Saint-Étienne & Lyon',
      destination: 'München, DE',
      departureDate: '2099-11-14',
      returnDate: '2099-11-16',
      travelMode: 'TRAIN',
    },
  });
  await expect(page.getByRole('heading', { name: 'Intercepted Omio handoff' })).toBeVisible();
  const outer = new URL(page.url());
  expect(outer.pathname).toBe('/c/987654321234/4057579/7385');
  const inner = new URL(outer.searchParams.get('u')!);
  expect(inner.searchParams.get('departurePosTerm')).toBe('Saint-Étienne & Lyon');
  expect(inner.searchParams.get('arrivalPosTerm')).toBe('München, DE');
});

test('missing cities stay blank, required inputs block submission, Escape restores focus', async ({
  page,
}) => {
  await fixture(page, { missing: true });
  await expect(page.getByLabel('Departure city')).toHaveValue('');
  await expect(page.getByLabel('Destination city')).toHaveValue('');
  let submitted = false;
  page.on('request', (request) => {
    if (request.url().endsWith('/planning/search')) submitted = true;
  });
  await page.getByRole('button', { name: 'Continue to Omio' }).click();
  expect(submitted).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Plan your trip', exact: true })).toBeFocused();
});

for (const reason of ['unconfigured', 'sample', 'past', 'inactive', 'event_date']) {
  test(`no outbound action when ${reason}`, async ({ page }) => {
    await fixture(page, { reason });
    await expect(page.getByRole('dialog').getByRole('status')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to Omio' })).toHaveCount(0);
  });
}

test('loading failures retry; server validation and unsafe URLs keep the form editable', async ({
  page,
}) => {
  await fixture(page, { failure: true });
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not reach');
  await page.route('**/api/travel/planning/open', (route) =>
    route.fulfill({
      json: {
        provider: 'omio',
        reason: null,
        today: '2099-11-01',
        defaults: {
          departure: 'Paris',
          destination: 'Berlin',
          departureDate: '2099-11-15',
          locale: 'en',
        },
      },
    }),
  );
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.route('**/api/travel/planning/search', (route) =>
    route.fulfill({ json: { reason: 'same_city' } }),
  );
  await page.getByRole('button', { name: 'Continue to Omio' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'These cities are the same',
  );
  await page.route('**/api/travel/planning/search', (route) =>
    route.fulfill({ json: { url: 'https://evil.test/' } }),
  );
  await page.getByRole('button', { name: 'Continue to Omio' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('valid Omio link');
  await expect(page).toHaveURL(/\/app\/events\/omio-ui$/);
});

test('French labels and handoff locale follow the selected language', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Français' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.goto('/app/events/omio-ui');
  await page.getByRole('button', { name: 'Préparer ton voyage', exact: true }).click();
  await expect(page.getByLabel('Ville de départ')).toHaveValue('Paris');
  await page.getByRole('button', { name: 'Continuer sur Omio' }).click();
  await expect(page.getByRole('heading', { name: 'Intercepted Omio handoff' })).toBeVisible();
  expect(new URL(new URL(page.url()).searchParams.get('u')!).searchParams.get('locale')).toBe('fr');
});

test('closing during a pending search prevents a late redirect', async ({ page }) => {
  await fixture(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/travel/planning/search', async (route) => {
    await held;
    await route.fulfill({
      json: { url: omioSearchUrl(route.request().postDataJSON().search, '987654321234') },
    });
  });
  const request = page.waitForRequest('**/api/travel/planning/search');
  await page.getByRole('button', { name: 'Continue to Omio' }).click();
  await request;
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const response = page.waitForResponse('**/api/travel/planning/search');
  release();
  await response;
  // Reopening also verifies the pending action did not leave the form stuck busy.
  await page.getByRole('button', { name: 'Plan your trip', exact: true }).click();
  await expect(page.getByLabel('Departure city')).toHaveValue('Paris');
  await expect(page.getByRole('button', { name: 'Continue to Omio' })).toBeEnabled();
  await expect(page).toHaveURL(/\/app\/events\/omio-ui$/);
});
