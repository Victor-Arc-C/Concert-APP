import { test, expect, type Page } from '@playwright/test';
import { defaults } from '../../src/domain/catalog';
import type { TripOption } from '../../src/domain/trip-types';

// Provider fixtures exercise the UI without making live-provider calls or creating bookings.
async function tripFixture(
  page: Page,
  settings: { direct?: boolean; failed?: boolean; sample?: boolean; cancelled?: boolean } = {},
) {
  const now = new Date().toISOString();
  const event = {
    id: 'travel-ui',
    artistIds: ['ninho'],
    artist: 'Ninho',
    title: 'Ninho',
    venue: 'GALAXIE',
    city: 'Amneville Les Thermes',
    country: 'FR',
    date: '2027-01-20',
    localTime: '20:00:00',
    timezone: 'Europe/Paris',
    status: settings.cancelled ? 'cancelled' : 'onsale',
    price: null,
    currency: null,
    saleAt: null,
    provider: settings.sample ? 'sample' : 'ticketmaster',
    externalId: 'fixture',
    url: 'https://www.ticketmaster.fr/',
    fetchedAt: now,
    priceObservedAt: null,
    image: '',
    genre: 'Hip-hop',
    score: 75,
    reasons: [],
  };
  const state = {
    user: {
      id: 'ui-test',
      name: 'Test',
      email: 'ui@example.test',
      mode: settings.sample ? 'sample' : 'live',
      onboarded: true,
      preferences: defaults,
    },
    artists: [],
    affinities: [],
    intents: [],
    events: [event],
    allEvents: [event],
    saved: [],
    savedTrips: [],
    alerts: [],
    spotifyConnected: false,
    spotifyAvailable: false,
    liveAvailable: true,
    automaticChecks: false,
    artistChecks: [],
    providerMessage: null,
  };
  const base: TripOption = {
    id: 'plan-1',
    eventId: event.id,
    originCity: 'Paris',
    destinationCity: event.city,
    destinationVenue: event.venue,
    eventDate: event.date,
    mode: settings.sample ? 'sample' : 'live',
    planStatus: 'active',
    ticketPrice: null,
    ticketCurrency: null,
    ticketObservedAt: null,
    ticketProvider: event.provider,
    ticketPriceState: 'unavailable',
    transportState: 'unavailable',
    accommodationState: 'ready',
    transport: null,
    accommodation: {
      kind: settings.sample ? 'sample' : 'live',
      availability: settings.sample ? 'sample' : 'available',
      priceComplete: true,
      id: 'hotel-1',
      provider: settings.sample ? 'sample' : 'liteapi',
      name: 'Enzo Hôtels Diane - Logis Amnéville',
      city: event.city,
      checkIn: '2027-01-20T15:00:00Z',
      checkOut: '2027-01-21T11:00:00Z',
      guests: 1,
      price: 63.18,
      currency: 'EUR',
      distanceKmToVenue: 0.5,
      observedAt: now,
      bookingUrl: settings.direct ? 'https://stays.encore.test/hotels/h1?checkin=2027-01-20' : null,
    },
    estimatedTotal: null,
    totalCurrency: null,
    scores: { musicFit: 75, costScore: 50, convenienceScore: null, overallScore: 72 },
    label: null,
    reasons: [],
    generatedAt: now,
  };
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.route('**/api/trips?*', (route) =>
    settings.failed
      ? route.fulfill({ status: 503, json: { error: 'Provider unavailable' } })
      : route.fulfill({
          json: {
            options: settings.cancelled
              ? []
              : [
                  base,
                  {
                    ...base,
                    id: 'plan-2',
                    accommodation: {
                      ...base.accommodation!,
                      id: 'hotel-2',
                      name: 'Grand Hôtel Amnéville',
                      price: 89,
                    },
                  },
                ],
          },
        }),
  );
  // Registered after /api/trips so it takes precedence for the comparison request.
  await page.route('**/api/trips/compare?*', (route) =>
    route.fulfill({
      json: {
        comparison:
          settings.sample || settings.cancelled
            ? null
            : {
                origin: 'Paris',
                train: {
                  status: 'priced',
                  fares: [
                    {
                      carrier: 'OUIGO',
                      station: 'Metz Ville',
                      stationCity: 'Metz',
                      bookingUrl:
                        'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Ftrains%2Fparis%2Fmetz&subId1=encore-trip&subId2=trains',
                      lastMileKm: 18.4,
                      standard: { min: 16, max: 79 },
                      avantage: null,
                    },
                    {
                      carrier: 'TGV INOUI',
                      station: 'Thionville',
                      stationCity: 'Thionville',
                      bookingUrl:
                        'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Ftrains%2Fparis%2Fthionville&subId1=encore-trip&subId2=trains',
                      lastMileKm: 11.4,
                      standard: { min: 20.5, max: 95 },
                      avantage: { min: 14.3, max: 66 },
                    },
                  ],
                  source: 'SNCF Voyageurs open data (ODbL)',
                  dataUpdatedAt: '2026-03-17T09:50:01.000Z',
                },
                car: {
                  status: 'estimated',
                  roadKm: 360,
                  litres: 23.4,
                  pricePerLitre: 2.159,
                  fuelCost: 51,
                  consumptionPer100Km: 6.5,
                  priceObservedAt: now,
                  source: 'Prix des carburants',
                },
                coach: {
                  status: 'unpriced',
                  reason: 'Coach fares change with every departure; Omio compares them live.',
                  bookingUrl:
                    'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Fbus%2Fparis%2Fmetz&subId1=encore-trip&subId2=bus',
                  route: 'Paris → Metz',
                },
              },
      },
    }),
  );
  await page.goto('/app/trips/travel-ui');
  await expect(page.getByRole('heading', { name: 'Ninho in Amneville Les Thermes' })).toBeVisible();
}

test('compares published fares for every way to travel, with the seller links', async ({
  page,
}) => {
  await tripFixture(page);
  await expect(
    page.getByText('SNCF publishes exact train times 23 days ahead', { exact: false }),
  ).toBeVisible();
  const getThere = page.getByRole('region', { name: 'Getting there' });
  await expect(getThere.getByText('from €16')).toBeVisible();
  await expect(getThere.getByRole('row', { name: /OUIGO.*Metz Ville.*€16–€79/ })).toBeVisible();
  await expect(
    getThere.getByRole('row', { name: /TGV INOUI.*Thionville.*€20\.50–€95.*€14\.30–€66/ }),
  ).toBeVisible();
  await expect(getThere.getByText('≈ €51 fuel')).toBeVisible();
  await expect(getThere.getByText('Live fares on Omio')).toBeVisible();
  await expect(
    getThere.getByRole('link', { name: 'Times and tickets Paris → Metz on Omio' }),
  ).toHaveAttribute(
    'href',
    'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Ftrains%2Fparis%2Fmetz&subId1=encore-trip&subId2=trains',
  );
  await expect(
    getThere.getByRole('link', { name: 'Times and tickets Paris → Thionville on Omio' }),
  ).toHaveAttribute(
    'href',
    'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Ftrains%2Fparis%2Fthionville&subId1=encore-trip&subId2=trains',
  );
  await expect(
    getThere.getByRole('link', { name: 'Coaches Paris → Metz on Omio' }),
  ).toHaveAttribute(
    'href',
    'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Fbus%2Fparis%2Fmetz&subId1=encore-trip&subId2=bus',
  );
  await expect(getThere.getByRole('link', { name: 'Exact fares on SNCF Connect' })).toHaveAttribute(
    'href',
    'https://www.sncf-connect.com/',
  );
  const driving = new URL(
    (await getThere
      .getByRole('link', { name: 'Driving route and tolls' })
      .getAttribute('href')) as string,
  );
  expect(driving.searchParams.get('destination')).toBe('GALAXIE, Amneville Les Thermes');
  expect(driving.searchParams.get('origin')).toBe('Paris');
  await getThere.screenshot({ path: 'test-results/getting-there-desktop.png' });
  await expect(page.getByText('Overall unavailable', { exact: false })).toBeVisible();
  const hotel = page.getByRole('link', { name: 'Find this hotel on Booking.com' });
  let url = new URL((await hotel.getAttribute('href')) as string);
  expect(url.searchParams.get('ss')).toContain('Enzo Hôtels Diane');
  expect(url.searchParams.get('checkin')).toBe('2027-01-20');
  expect(url.searchParams.get('checkout')).toBe('2027-01-21');
  await page.getByRole('button', { name: /Grand Hôtel Amnéville/ }).click();
  await expect(page.getByRole('button', { name: /Grand Hôtel Amnéville/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  url = new URL((await hotel.getAttribute('href')) as string);
  expect(url.searchParams.get('ss')).toContain('Grand Hôtel Amnéville');
  await page.screenshot({ path: 'test-results/trip-interface-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await getThere.screenshot({ path: 'test-results/getting-there-mobile.png' });
  await expect(hotel).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/trip-interface-mobile.png', fullPage: true });
});

test('uses the configured direct hotel booking URL ahead of external search', async ({ page }) => {
  await tripFixture(page, { direct: true });
  await expect(page.getByRole('link', { name: 'Book this hotel at this price' })).toHaveAttribute(
    'href',
    'https://stays.encore.test/hotels/h1?checkin=2027-01-20',
  );
  await expect(page.getByRole('link', { name: 'Find this hotel on Booking.com' })).toHaveCount(0);
});

test('a provider error offers retry and external searches, then recovers', async ({ page }) => {
  await tripFixture(page, { failed: true });
  await expect(page.getByText('Could not load travel options.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Exact fares on SNCF Connect' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Search hotels on Booking.com' })).toBeVisible();
  await page.route('**/api/trips?eventId=*', (route) => route.fulfill({ json: { options: [] } }));
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByText('Could not load travel options.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Search hotels on Booking.com' })).toBeVisible();
});

test('sample and cancelled concerts offer no real travel or hotel search', async ({ page }) => {
  await tripFixture(page, { sample: true });
  await expect(page.getByRole('button', { name: /Enzo Hôtels/ })).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: /SNCF Connect|FlixBus|Omio|Driving route|Public transport|Booking.com/,
    }),
  ).toHaveCount(0);
  await page.unrouteAll();
  await tripFixture(page, { cancelled: true });
  await expect(
    page.getByText('Trip recommendations are suppressed', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: /SNCF Connect|FlixBus|Omio|Driving route|Public transport|Booking.com/,
    }),
  ).toHaveCount(0);
});
