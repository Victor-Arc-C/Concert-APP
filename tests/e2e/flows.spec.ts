import { test, expect } from '@playwright/test';
const password = 'Encore-test-passphrase-2026';
const origin = 'http://127.0.0.1:3000';
test('founder flow: register, choose artists, save, persist, must-see, alert, dismiss, delete', async ({
  page,
}) => {
  const email = `founder-${Date.now()}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Alex');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who would you love to see?' })).toBeVisible();
  for (const name of ['Fred again..', 'Billie Eilish', 'Kendrick Lamar', 'RAYE', 'Tame Impala'])
    await page
      .getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
      .click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Find my concerts' }).click();
  await expect(page.getByRole('heading', { name: 'Your next great night.' })).toBeVisible();
  await page.getByRole('button', { name: 'Save Fred again.. in Paris', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unsave Fred again.. in Paris' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unsave Fred again.. in Paris' })).toBeVisible();
  await page.goto('/app/saved');
  await expect(page.getByRole('heading', { name: 'Fred again..', exact: true })).toBeVisible();
  await page.goto('/app/events/sample-1');
  await expect(page.getByRole('button', { name: 'No real tickets in sample mode' })).toBeDisabled();
  await page.getByRole('button', { name: 'I need to see this artist' }).click();
  await page.getByLabel('Maximum per ticket').fill('150');
  await page.getByLabel('Number of tickets').fill('2');
  await page.getByRole('button', { name: 'Save must-see preferences' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/app/alerts');
  await expect(page.getByRole('heading', { name: 'Fred again.. in Paris' })).toBeVisible();
  const state1 = await (await page.request.get('/api/state')).json();
  await page.reload();
  const state2 = await (await page.request.get('/api/state')).json();
  expect(state1.alerts.length).toBe(state2.alerts.length);
  await page.goto('/app/events/sample-1');
  await page.getByRole('button', { name: 'Not for me', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next great night.' })).toBeVisible();
  expect(
    (await (await page.request.get('/api/state')).json()).events.some(
      (e: { id: string }) => e.id === 'sample-1',
    ),
  ).toBe(false);
  await page.goto('/app/settings');
  await page.getByLabel('Home city').selectOption('London');
  await page.getByLabel('Preferred radius (km), optional').fill('250');
  await page.getByRole('radio', { name: 'Off No new alerts.', exact: true }).check();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByText('Your preferences are saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Home city')).toHaveValue('London');
  await expect(page.getByLabel('Preferred radius (km), optional')).toHaveValue('250');
  expect((await (await page.request.get('/api/state')).json()).user.preferences.notifications).toBe(
    'off',
  );
  const oldSession = (await page.context().cookies()).find((c) => c.name === 'encore_session')!;
  expect(oldSession.httpOnly).toBe(true);
  expect(oldSession.sameSite).toBe('Lax');
  expect(oldSession.expires).toBeGreaterThan(Date.now() / 1000);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect
    .poll(async () => (await (await page.request.get('/api/state')).json()).user)
    .toBeNull();
  const replay = await page.request.get('/api/state', {
    headers: { Cookie: `encore_session=${oldSession.value}` },
  });
  expect((await replay.json()).user).toBeNull();
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Incorrect-passphrase-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }),
  ).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next great night.' })).toBeVisible();
  await page.goto('/app/settings');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(page.getByLabel('Home city')).toHaveValue('London');
  await expect(page.getByLabel('Preferred radius (km), optional')).toHaveValue('250');
  const exportResponse = await page.request.get('/api/export');
  expect(exportResponse.ok()).toBe(true);
  expect(JSON.stringify(await exportResponse.json())).not.toContain('password_hash');
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await page.getByLabel('Confirm your current password').fill(password);
  await page.getByRole('button', { name: 'Delete my account permanently' }).click();
  await expect(page.getByRole('heading', { name: /Your favourite music/ })).toBeVisible();
  expect((await (await page.request.get('/api/state')).json()).user).toBeNull();
});
test('API authorisation, CSRF, account isolation and honest provider errors', async ({
  playwright,
}) => {
  const anon = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  expect(
    (await anon.post('/api/feedback', { data: { eventId: 'sample-1', action: 'saved' } })).status(),
  ).toBe(401);
  expect(
    (
      await anon.post('/api/auth/signup', {
        headers: { Origin: 'https://foreign.test' },
        data: { email: 'bad@example.test', password, name: 'Bad' },
      })
    ).status(),
  ).toBe(403);
  const a = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    }),
    b = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    });
  for (const [i, c] of [a, b].entries())
    expect(
      (
        await c.post('/api/auth/signup', {
          data: { email: `isolation-${i}-${Date.now()}@example.test`, password, name: 'Pilot' },
        })
      ).ok(),
    ).toBe(true);
  expect(
    (await a.post('/api/feedback', { data: { eventId: 'sample-1', action: 'saved' } })).ok(),
  ).toBe(true);
  expect((await (await b.get('/api/state')).json()).saved).toHaveLength(0);
  expect(
    (
      await a.post('/api/intent', {
        data: { artistId: 'fred-again', cities: [], tickets: 0, maxPrice: -1 },
      })
    ).status(),
  ).toBe(400);
  expect((await a.post('/api/outbound', { data: { eventId: 'sample-1' } })).status()).toBe(422);
  expect((await a.post('/api/spotify/connect', { data: {} })).status()).toBe(503);
  expect((await a.get('/api/spotify/artists')).status()).toBe(503);
  expect(
    (
      await a.post('/api/spotify/confirm', { data: { spotifyId: 'fixture', artistId: 'sample' } })
    ).status(),
  ).toBe(503);
  expect((await anon.post('/api/spotify/disconnect', { data: {} })).status()).toBe(401);
  expect((await a.post('/api/spotify/disconnect', { data: {} })).ok()).toBe(true);
  expect((await (await a.get('/api/export')).json()).spotifyChoices).toEqual([]);
  expect((await a.post('/api/jobs', { data: {} })).status()).toBe(401);
  await a.post('/api/mode', { data: { mode: 'live' } });
  const live = await (await a.get('/api/state')).json();
  expect(live.events).toHaveLength(0);
  expect(live.providerMessage).toContain('not configured');
  expect(
    (await a.post('/api/feedback', { data: { eventId: 'sample-1', action: 'saved' } })).status(),
  ).toBe(404);
  for (const c of [a, b])
    expect((await c.post('/api/account/delete', { data: { password } })).ok()).toBe(true);
  await Promise.all([a.dispose(), b.dispose(), anon.dispose()]);
});
test('desktop and mobile previews have working filters and no horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Your next great night.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/encore-desktop.png', fullPage: true });
  await page.getByLabel('Search your concerts').fill('no matching artist');
  await expect(page.getByRole('heading', { name: 'No shows match these filters.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/encore-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Try the sample experience' })).toBeVisible();
  await page.screenshot({ path: 'test-results/encore-landing-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('consented funnel events have validated concert context and disappear on opt-out', async ({
  page,
}) => {
  const headers = { Origin: origin };
  const send = (path: string, data: unknown) =>
    page.request.post(`/api/${path}`, { headers, data });
  expect(
    (
      await send('auth/signup', {
        name: 'Metrics fixture',
        email: `metrics-${Date.now()}@example.test`,
        password,
      })
    ).ok(),
  ).toBe(true);
  const preferences = {
    home: 'Paris',
    scope: 'europe',
    maxHours: null,
    radiusKm: null,
    budget: null,
    notifications: 'off',
    analytics: true,
  };
  expect(
    (await send('onboarding', { artistIds: ['fred-again'], mode: 'sample', preferences })).ok(),
  ).toBe(true);
  await page.goto('/app');
  await expect
    .poll(async () => {
      const exported = await (await page.request.get('/api/export')).json();
      return exported.analytics.some((e: { name: string }) => e.name === 'concert_impression');
    })
    .toBe(true);
  await page.goto('/app/events/sample-1');
  await expect
    .poll(async () => {
      const exported = await (await page.request.get('/api/export')).json();
      return exported.analytics.some((e: { name: string }) => e.name === 'concert_opened');
    })
    .toBe(true);
  expect(
    (await send('feedback', { eventId: 'sample-1', action: 'saved', source: 'detail' })).ok(),
  ).toBe(true);
  const exported = await (await page.request.get('/api/export')).json();
  expect(exported.analytics.map((e: { name: string }) => e.name)).toEqual(
    expect.arrayContaining([
      'onboarding_completed',
      'concert_impression',
      'concert_opened',
      'concert_saved',
    ]),
  );
  for (const e of exported.analytics.filter((e: { name: string }) =>
    e.name.startsWith('concert_'),
  )) {
    expect(e.properties).toMatchObject({
      mode: 'sample',
      recommendationSource: 'followed',
      ticketLinkAvailable: false,
    });
  }
  expect(
    (await send('analytics', { name: 'ticket_link_clicked', eventId: 'sample-1' })).status(),
  ).toBe(400);
  expect((await send('analytics', { name: 'concert_opened', eventId: 'not-real' })).status()).toBe(
    404,
  );
  expect(
    (
      await send('analytics', {
        name: 'concert_opened',
        eventId: 'sample-1',
        email: 'private@example.test',
      })
    ).status(),
  ).toBe(400);
  await send('preferences', { ...preferences, analytics: false });
  await send('analytics', { name: 'concert_opened', eventId: 'sample-1' });
  expect((await (await page.request.get('/api/export')).json()).analytics).toEqual([]);
  expect((await send('account/delete', { password })).ok()).toBe(true);
});

test('feed pages retain unique detail links and reset on search', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('button', { name: /^Show all/ }).click();
  const cards = page.locator('.concert-card');
  const initial = await cards.count();
  expect(initial).toBeLessThanOrEqual(8);
  const more = page.getByRole('button', { name: 'Show more concerts' });
  await expect(more).toBeVisible();
  await more.click();
  await expect(cards).toHaveCount(9);
  const urls = await cards
    .locator('.card-image-link')
    .evaluateAll((elements) => elements.map((e) => e.getAttribute('href')));
  expect(new Set(urls).size).toBe(urls.length);
  await page.getByLabel('Search your concerts').fill('Fred');
  expect(await cards.count()).toBeLessThanOrEqual(8);
  await cards.locator('h2 a').first().click();
  await expect(page).toHaveURL(/\/app\/events\//);
});

test('detail tolerates missing data and identifies the external ticket destination', async ({
  page,
}) => {
  let sourceUrl = 'https://www.ticketmaster.fr/example';
  await page.route('**/api/state', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const event = data.allEvents.find((e: { id: string }) => e.id === 'sample-1');
    Object.assign(event, {
      price: null,
      currency: null,
      localTime: null,
      saleAt: null,
      provider: 'ticketmaster',
      url: sourceUrl,
    });
    await route.fulfill({ response, json: data });
  });
  await page.goto('/app/events/sample-1');
  await expect(page.getByText('Time to be announced', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Check tickets on www.ticketmaster.fr' }),
  ).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Save this show', exact: true })).toBeVisible();
  await expect(page.getByText(/Source: Ticketmaster/)).toBeVisible();
  await expect(page.locator('.reason-list li').first()).toBeVisible();
  sourceUrl = 'https://unverified.example/tickets';
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ticket link unavailable' })).toBeDisabled();
});
