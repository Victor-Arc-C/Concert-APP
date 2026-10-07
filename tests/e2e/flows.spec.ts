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
  await expect(
    page.getByRole('heading', { name: 'Where should the music take you?' }),
  ).toBeVisible();
  await page.getByLabel('Home city').selectOption('London');
  await page.getByRole('button', { name: 'Choose artists', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who would you love to see?' })).toBeVisible();
  for (const name of ['Fred again..', 'Billie Eilish', 'Kendrick Lamar', 'RAYE', 'Tame Impala'])
    await page
      .getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
      .click();
  await page.getByRole('button', { name: 'Find my concerts' }).click();
  await expect(page.getByRole('heading', { name: 'Your next great night.' })).toBeVisible();
  const initial = await (await page.request.get('/api/state')).json();
  expect(initial.user.preferences.notifications).toBe('off');
  expect(initial.alerts).toEqual([]);
  await page.goto('/app/settings');
  await page
    .getByRole('radio', {
      name: 'Important Home-city shows, favourites, must-see artists and sale reminders.',
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByText('Your preferences are saved', { exact: true })).toBeVisible();
  await page.goto('/app');

  await page.getByRole('button', { name: 'Save Fred again.. in Paris', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unsave Fred again.. in Paris' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unsave Fred again.. in Paris' })).toBeVisible();
  await page.goto('/app/saved');
  await expect(page.getByRole('heading', { name: 'Fred again..', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Unsave Fred again.. in Paris', exact: true }).click();
  await page.reload();
  expect((await (await page.request.get('/api/state')).json()).saved).toEqual([]);
  await page.goto('/app/events/sample-1');
  await page.getByRole('button', { name: 'Save this show', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Saved to your shows', exact: true }),
  ).toBeVisible();

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
  await page.getByLabel('Concerts from', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Concerts until', { exact: true }).fill('2027-12-31');
  await page.getByRole('radio', { name: 'Off No new alerts.', exact: true }).check();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByText('Your preferences are saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Home city')).toHaveValue('London');
  await expect(page.getByLabel('Preferred radius (km), optional')).toHaveValue('250');
  await expect(page.getByLabel('Concerts from', { exact: true })).toHaveValue('2026-10-01');
  await expect(page.getByLabel('Concerts until', { exact: true })).toHaveValue('2027-12-31');
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
  await expect(page.getByRole('heading', { name: 'Every show worth the trip.' })).toBeVisible();
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
  // CON-33: live onboarding never completes with fictional artists or without a live provider.
  const onboardingPreferences = {
    home: 'Paris',
    scope: 'europe',
    maxHours: null,
    radiusKm: null,
    budget: null,
    notifications: 'off',
    analytics: false,
  };
  expect(
    (
      await a.post('/api/onboarding', {
        data: {
          artistIds: ['fred-again'],
          mode: 'live',
          source: 'manual',
          preferences: onboardingPreferences,
        },
      })
    ).status(),
  ).toBe(503);
  expect((await (await a.get('/api/state')).json()).user.onboarded).toBe(false);
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
  expect((await a.get('/api/jobs')).status()).toBe(401);
  expect((await anon.get('/api/jobs')).status()).toBe(401);
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
  // The checks below are about layout, not image decoding, so don't wait for every screenshot.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Every show worth the trip.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Join the waitlist' })).toBeVisible();
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

test('Spotify onboarding selection uses canonical mappings, images, and explicit fallback state', async ({
  page,
}) => {
  const email = `spotify-picker-${Date.now()}@example.test`;
  expect(
    (
      await page.request.post('/api/auth/signup', {
        headers: { Origin: origin },
        data: { name: 'Spotify Picker', email, password },
      })
    ).ok(),
  ).toBe(true);
  await page.route('**/api/state', async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    state.spotifyAvailable = true;
    state.user.onboarded = false;
    state.artists.push({
      id: 'canonical-beyonce',
      name: 'Beyonce',
      genre: 'Pop',
      color: '#738691',
      initials: 'be',
      providerId: 'tm-beyonce',
    });
    await route.fulfill({ response, json: state });
  });
  await page.route('**/api/spotify/artists', async (route) => {
    await route.fulfill({
      json: {
        artists: [
          {
            id: 'spotify-beyonce',
            name: 'Beyoncé',
            url: 'https://open.spotify.com/artist/spotify-beyonce',
            artistId: 'canonical-beyonce',
            mapping: 'provider',
            image: 'https://i.scdn.co/image/beyonce',
          },
          {
            id: 'spotify-unknown',
            name: 'Unknown Artist',
            url: 'https://open.spotify.com/artist/spotify-unknown',
            artistId: 'spotify-unknown',
            mapping: 'spotify',
          },
        ],
      },
    });
  });
  await page.goto('/onboarding?music=connected');
  const mapped = page.getByRole('button', { name: /Beyoncé/ });
  await expect(mapped.locator('img')).toHaveAttribute('src', 'https://i.scdn.co/image/beyonce');
  await expect(mapped).toHaveAttribute('aria-pressed', 'false');
  await mapped.click();
  await expect(mapped).toHaveAttribute('aria-pressed', 'true');
  await expect(mapped).toHaveClass(/selected/);
  await mapped.click();
  await expect(mapped).toHaveAttribute('aria-pressed', 'false');
  const unmapped = page.getByRole('button', { name: /Unknown Artist/ });
  await expect(unmapped).toContainText('No live concerts found yet');
  await expect(unmapped.locator('img')).toHaveCount(0);
  await expect(unmapped).toContainText('Un');
  await expect(unmapped).toBeEnabled();
  await expect(unmapped).toHaveAttribute('aria-pressed', 'false');
  await unmapped.click();
  await expect(unmapped).toHaveAttribute('aria-pressed', 'true');
  await unmapped.click();
  await expect(unmapped).toHaveAttribute('aria-pressed', 'false');
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

test('live price display keeps unavailable state, provider currency and attribution', async ({
  page,
}) => {
  let price: number | null = null;
  let currency: string | null = null;
  await page.route('**/api/state', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    for (const events of [data.events, data.allEvents]) {
      const event = events.find((e: { id: string }) => e.id === 'sample-1');
      if (event)
        Object.assign(event, {
          price,
          currency,
          priceObservedAt: new Date().toISOString(),
          provider: 'ticketmaster',
          url: 'https://www.ticketmaster.fr/event/listing',
        });
    }
    await route.fulfill({ response, json: data });
  });
  await page.goto('/app/events/sample-1');
  await expect(page.locator('.ticket-price')).toHaveText('Price not listed');
  await expect(
    page.getByText('A current verified price is unavailable', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Check tickets on www.ticketmaster.fr' }),
  ).toBeEnabled();
  price = 79.5;
  currency = 'EUR';
  await page.reload();
  await expect(page.locator('.ticket-price')).toHaveText('€79.50');
  await expect(page.getByText(/Price observed/)).toBeVisible();
  await expect(page.getByText(/Source: Ticketmaster/)).toBeVisible();
  price = 90;
  currency = 'GBP';
  await page.reload();
  await expect(page.locator('.ticket-price')).toHaveText('£90');
  price = null;
  await page.reload();
  await expect(page.locator('.ticket-price')).toHaveText('Price not listed');
});

test('trip intelligence flow: concert -> plan trip -> compare itineraries -> save -> trips page', async ({
  page,
}) => {
  const email = `tripper-${Date.now()}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Sam');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Where should the music take you?' }),
  ).toBeVisible();
  await page.getByLabel('Home city').selectOption('Paris');
  await page.getByRole('button', { name: 'Choose artists', exact: true }).click();
  await page.getByRole('button', { name: 'Fred again..' }).click();
  await page.getByRole('button', { name: 'Find my concerts' }).click();
  await expect(page.getByRole('heading', { name: 'Your next great night.' })).toBeVisible();

  // Navigate to an out-of-town concert (Amsterdam)
  await page.goto('/app/events/sample-3');
  await expect(page.getByRole('link', { name: 'Plan this trip' })).toBeVisible();
  await page.getByRole('link', { name: 'Plan this trip' }).click();

  // On the Trip Planner screen
  await expect(page.getByRole('heading', { name: /in Amsterdam/ })).toBeVisible();
  await expect(page.getByText('Trip Intelligence')).toBeVisible();

  // Check that options are generated and loaded
  await expect(page.locator('.option-pill-group button').first()).toBeVisible();

  await expect(page.getByText('Sample trip — all travel, stays, prices and distances are fictional.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Check transport booking|Book this hotel at this price/ })).toHaveCount(0);

  // Check 3 steps: Ticket, Transport, Stay
  await expect(page.getByText('Concert Ticket')).toBeVisible();
  await expect(page.getByText(/Euro High-Speed Rail|Regional Express Airline|Intercity Coach/)).toBeVisible();
  await expect(page.getByText('1 night ·', { exact: false })).toBeVisible();


  // Save the trip
  await page.getByRole('button', { name: 'Save this trip' }).click();
  await expect(page.getByRole('button', { name: 'Trip saved' })).toBeVisible();

  // Navigate to Trips page
  await page.goto('/app/trips');
  await expect(page.getByRole('heading', { name: 'Trips' })).toBeVisible();
  await expect(page.getByText('Amsterdam')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View itinerary' })).toBeVisible();
});

test('trip API rejects snapshots, isolates saves and revalidates saved intent across modes', async ({ playwright }) => {
  const a = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  const b = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  const anon = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  try {
    expect((await anon.get('/api/trips?eventId=sample-3')).status()).toBe(401);
    expect((await anon.post('/api/trips/save', { data: { eventId: 'sample-3', tripOptionId: 'fake' } })).status()).toBe(401);
    for (const [i, context] of [a, b].entries()) {
      expect((await context.post('/api/auth/signup', { data: { email: `trip-safety-${i}-${Date.now()}@example.test`, password, name: 'Test' } })).ok()).toBe(true);
    }
    const { options } = await (await a.get('/api/trips?eventId=sample-3')).json();
    const selection = { eventId: 'sample-3', tripOptionId: options[0].id };
    for (const extra of [{ trip: options[0] }, { provider: 'arbitrary' }, { currency: 'bad' }, { price: -1 }, { bookingUrl: 'javascript:alert(1)' }, { userId: 'other' }]) {
      expect((await a.post('/api/trips/save', { data: { ...selection, ...extra } })).status()).toBe(400);
    }
    expect((await a.post('/api/trips/save', { data: { ...selection, eventId: 'sample-1' } })).status()).toBe(422);
    expect((await a.post('/api/trips/save', { headers: { Origin: 'https://evil.test' }, data: selection })).status()).toBe(403);
    expect((await a.post('/api/trips/save', { data: selection })).ok()).toBe(true);
    expect((await (await b.get('/api/trips/saved')).json()).savedTrips).toEqual([]);
    expect((await b.post('/api/trips/delete', { data: selection })).ok()).toBe(true);
    const fresh = (await (await a.get('/api/trips/saved')).json()).savedTrips;
    expect(fresh).toHaveLength(1);
    expect(fresh[0].revalidationStatus).toBe('current');
    expect(fresh[0].tripData.transport.kind).toBe('sample');
    expect(fresh[0].tripData.transport.bookingUrl).toBeNull();
    expect(fresh[0].tripData.label).toBeNull();
    expect((await a.post('/api/mode', { data: { mode: 'live' } })).ok()).toBe(true);
    const saved = (await (await a.get('/api/trips/saved')).json()).savedTrips;
    expect(saved).toHaveLength(1);
    expect(saved[0].tripData).toMatchObject({ planStatus: 'mode_changed', transport: null, accommodation: null, estimatedTotal: null, label: null });
    const state = await (await a.get('/api/state')).json();
    expect(state.savedTrips[0].tripData.transport).toBeNull();
  } finally {
    for (const context of [a, b]) await context.post('/api/account/delete', { data: { password } });
    await a.dispose(); await b.dispose(); await anon.dispose();
  }
});

test('manual live onboarding without Spotify: search, retry, demo opt-in, live submit', async ({
  page,
}) => {
  const email = `live-onboarding-${Date.now()}@example.test`;
  expect(
    (
      await page.request.post('/api/auth/signup', {
        headers: { Origin: origin },
        data: { name: 'Live Picker', email, password },
      })
    ).ok(),
  ).toBe(true);
  await page.route('**/api/state', async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    state.liveAvailable = true;
    state.spotifyAvailable = false;
    state.user.onboarded = false;
    await route.fulfill({ response, json: state });
  });
  let searchFails = true;
  await page.route('**/api/artists/search**', async (route) => {
    if (searchFails) {
      await route.fulfill({
        status: 503,
        json: { error: 'The concert provider is unavailable. Try again shortly.' },
      });
      return;
    }
    expect(new URL(route.request().url()).searchParams.get('q')).toBe('Angele');
    await route.fulfill({
      json: {
        artists: [
          {
            id: 'tm-artist-angele',
            name: 'Angèle',
            genre: 'Live music',
            initials: 'an',
            color: '#867496',
            providerId: 'K8vZ-angele',
          },
        ],
      },
    });
  });
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/api/onboarding', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Choose artists', exact: true }).click();
  await expect(page.getByLabel('Search real artists')).toBeVisible();
  // Fictional catalogue is not offered until the user opts into the demo.
  await expect(page.getByRole('button', { name: /Fred again\.\./ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Find my concerts' })).toBeDisabled();

  await page.getByLabel('Search real artists').fill('Angele');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('The concert provider is unavailable. Try again shortly.')).toBeVisible();
  searchFails = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  const angele = page.getByRole('button', { name: /Angèle/ });
  await expect(angele).toHaveAttribute('aria-pressed', 'false');
  await angele.click();
  await expect(angele).toHaveAttribute('aria-pressed', 'true');

  // Demo is an explicit, reversible choice and does not mix with live picks.
  await page.getByRole('button', { name: /Try the demo with fictional concerts/ }).click();
  await expect(page.getByText('Demo mode: concerts, dates and prices are fictional.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Fred again\.\./ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find my concerts' })).toBeDisabled();
  await page.getByRole('button', { name: 'Search real artists instead' }).click();

  await page.getByLabel('Search real artists').fill('Angele');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: /Angèle/ }).click();
  await page.getByRole('button', { name: 'Find my concerts' }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted).toMatchObject({
    artistIds: ['tm-artist-angele'],
    mode: 'live',
    source: 'manual',
  });
});
