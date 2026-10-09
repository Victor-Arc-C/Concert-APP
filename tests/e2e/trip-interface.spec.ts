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
      board: settings.sample ? null : 'Room only',
      refundable: settings.sample ? null : false,
      verifiedAt: settings.sample ? null : now,
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
                distanceKm: 280,
                recommended: 'train',
                flight: null,
                train: {
                  status: 'served',
                  routes: [
                    {
                      station: 'Thionville',
                      stationCity: 'Thionville',
                      carriers: ['TGV INOUI'],
                      lastMileKm: 11.4,
                      bookingUrl:
                        'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Ftrains%2Fparis%2Fthionville&subId1=encore-trip&subId2=trains',
                    },
                    {
                      station: 'Metz',
                      stationCity: 'Metz',
                      carriers: ['OUIGO', 'TGV INOUI'],
                      lastMileKm: 17.5,
                      bookingUrl:
                        'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Ftrains%2Fparis%2Fmetz&subId1=encore-trip&subId2=trains',
                    },
                  ],
                },
                road: {
                  coachUrl:
                    'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Fbus%2Fparis%2Fmetz&subId1=encore-trip&subId2=bus',
                  coachRoute: 'Paris → Metz',
                },
              },
      },
    }),
  );
  await page.goto('/app/trips/travel-ui');
  await expect(page.getByRole('heading', { name: 'Ninho in Amneville Les Thermes' })).toBeVisible();
}

test('lists the real ways there, best first, each linked to a live search and no estimate', async ({
  page,
}) => {
  await tripFixture(page);
  await expect(
    page.getByText('SNCF publishes exact train times 23 days ahead', { exact: false }),
  ).toBeVisible();
  const getThere = page.getByRole('region', { name: 'Getting there' });
  await expect(getThere.getByText('Paris → Amneville Les Thermes · 280 km')).toBeVisible();
  // Train first (best way), then car, coach, venue. No plane for 280 km.
  expect(
    await getThere
      .locator('.mode-row')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-mode'))),
  ).toEqual(['train', 'car', 'coach', 'venue']);
  await expect(getThere.locator('[data-mode=train] .mode-tag')).toHaveText('Best way');
  await expect(getThere.getByText('OUIGO, TGV INOUI to Metz')).toBeVisible();
  // Nothing in the panel is an estimated price.
  await expect(getThere).not.toContainText('€');
  await expect(getThere).not.toContainText('fuel');
  await expect(
    getThere.getByRole('link', { name: 'Live times and prices Paris → Metz on Omio' }),
  ).toHaveAttribute(
    'href',
    'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Ftrains%2Fparis%2Fmetz&subId1=encore-trip&subId2=trains',
  );
  await expect(
    getThere.getByRole('link', { name: 'Live coach times and prices Paris → Metz on Omio' }),
  ).toHaveAttribute(
    'href',
    'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Fbus%2Fparis%2Fmetz&subId1=encore-trip&subId2=bus',
  );
  await expect(getThere.getByRole('link', { name: 'Or book on SNCF Connect' })).toHaveAttribute(
    'href',
    'https://www.sncf-connect.com/',
  );
  const driving = new URL(
    (await getThere
      .getByRole('link', { name: 'Driving time, route and tolls on Google Maps' })
      .getAttribute('href')) as string,
  );
  expect(driving.searchParams.get('destination')).toBe('GALAXIE, Amneville Les Thermes');
  expect(driving.searchParams.get('origin')).toBe('Paris');
  await getThere.screenshot({ path: 'test-results/getting-there-desktop.png' });
  await expect(page.getByText('Overall unavailable', { exact: false })).toBeVisible();
  // The total adds what is priced and names what is missing, instead of "not available".
  const total = page.locator('.trip-total');
  await expect(total.locator('.total-label')).toHaveText('Trip so far');
  await expect(total.locator('.total-price')).toHaveText('€63.18');
  await expect(total.getByText('Not listed: check the seller')).toBeVisible();
  await expect(total.getByText('Live fares in Getting there')).toBeVisible();
  await expect(page.getByRole('button', { name: /€63\.18 so far/ }).first()).toBeVisible();
  await expect(page.getByText('0.5 km from GALAXIE · Room only · Non-refundable')).toBeVisible();
  await expect(
    page.getByText('Room availability confirmed with the hotel supplier at', { exact: false }),
  ).toBeVisible();
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
  await expect(page.getByRole('link', { name: 'Or book on SNCF Connect' })).toBeVisible();
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

test('a far-away show offers the plane first, with the landing deadline, and no car or coach', async ({
  page,
}) => {
  await tripFixture(page);
  await page.route('**/api/trips/compare?*', (route) =>
    route.fulfill({
      json: {
        comparison: {
          origin: 'Paris',
          distanceKm: 2100,
          recommended: 'flight',
          flight: {
            from: 'Paris',
            to: 'Athens',
            searchUrl:
              'https://www.google.com/travel/flights?q=Flights+from+PAR+to+ATH+on+2027-01-20+one+way&hl=en&curr=EUR',
            omioUrl:
              'https://omio.sjv.io/c/7922007/409973/7385?u=https%3A%2F%2Fwww.omio.fr%2Fvols%2Fparis%2Fathenes&subId1=encore-trip&subId2=vols',
            date: '2027-01-20',
            landBy: '17:00',
            fare: {
              price: 79,
              currency: 'EUR',
              airline: 'TO',
              flightNumber: '3500',
              departureAt: '2027-01-20T09:20:00+01:00',
              arrivalAt: '2027-01-20T11:35:00.000Z',
              transfers: 0,
              bookingUrl: 'https://www.aviasales.com/search/PAR2001ATH1?marker=123456',
              source: 'aviasales',
            },
            fareOnTime: true,
          },
          train: null,
          road: null,
        },
      },
    }),
  );
  await page.reload();
  const getThere = page.getByRole('region', { name: 'Getting there' });
  await expect(getThere.getByText('Plane')).toBeVisible();
  expect(
    await getThere
      .locator('.mode-row')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-mode'))),
  ).toEqual(['flight', 'venue']);
  await expect(
    getThere.getByText('Paris → Athens on 20 January. Pick a flight landing by 17:00', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    getThere.getByRole('link', { name: 'Live flight prices on Google Flights' }),
  ).toHaveAttribute('href', /google\.com\/travel\/flights\?q=Flights\+from\+PAR\+to\+ATH/);
  await expect(getThere.getByRole('link', { name: 'Compare flights on Omio' })).toBeVisible();
  await expect(getThere.getByText('Car')).toHaveCount(0);
  await expect(getThere.getByText('Coach')).toHaveCount(0);
  // The cheapest flight landing in time, priced, and added to the trip so far.
  await expect(getThere.locator('[data-mode=flight] .mode-price')).toHaveText('€79');
  await expect(getThere.getByText('TO 3500')).toBeVisible();
  await expect(getThere.getByText('departs 09:20, lands 12:35 local time · direct')).toBeVisible();
  await expect(
    getThere.getByRole('link', { name: 'Book this flight on Aviasales' }),
  ).toHaveAttribute('href', 'https://www.aviasales.com/search/PAR2001ATH1?marker=123456');
  const total = page.locator('.trip-total');
  await expect(total.locator('.total-price')).toHaveText('€142.18');
  // The itinerary step shows that same flight instead of "no timetable".
  const step = page.locator('.trip-step', { hasText: 'Plane · TO 3500' });
  await expect(step).toContainText('€79');
  await expect(step).toContainText('departs 09:20, lands 12:35 local time · direct');
  await expect(step.getByRole('link', { name: 'Book this flight on Aviasales' })).toBeVisible();
  await expect(page.getByText('No verified round-trip timetable', { exact: false })).toHaveCount(0);
  await getThere.screenshot({ path: 'test-results/getting-there-far.png' });
});

const farComparison = (fare: unknown, train: unknown = null) => ({
  comparison: {
    origin: 'Paris',
    distanceKm: 1540,
    recommended: 'flight',
    flight: {
      from: 'Paris',
      to: 'Stockholm',
      searchUrl:
        'https://www.google.com/travel/flights?q=Flights+from+PAR+to+STO+on+2027-01-20+one+way&hl=en&curr=EUR',
      omioUrl: null,
      date: '2027-01-20',
      landBy: '16:30',
      fare,
      fareOnTime: fare ? true : null,
    },
    train,
    road: null,
  },
});

test('a far show with no fare yet: the itinerary says fly, never the SNCF timetable window', async ({
  page,
}) => {
  await tripFixture(page);
  await page.route('**/api/trips/compare?*', (route) =>
    route.fulfill({ json: farComparison(null) }),
  );
  await page.reload();
  const step = page.locator('.trip-step', { hasText: 'No flight price found for this day yet' });
  await expect(step).toContainText('Plane');
  await expect(step).toContainText('Paris → Stockholm on 20 January');
  await expect(
    step.getByRole('link', { name: 'Live flight prices on Google Flights' }),
  ).toHaveAttribute('href', /PAR\+to\+STO/);
  await expect(page.getByText('SNCF publishes exact train times', { exact: false })).toHaveCount(0);
});

test('a Google Flights price shows on the right, and a train with a change says where', async ({
  page,
}) => {
  await tripFixture(page);
  await page.route('**/api/trips/compare?*', (route) =>
    route.fulfill({
      json: farComparison(
        {
          price: 96,
          currency: 'EUR',
          airline: 'SAS',
          flightNumber: 'SK 576',
          departureAt: '2027-01-20T07:00',
          arrivalAt: '2027-01-20T10:10:00.000Z',
          transfers: 1,
          bookingUrl: 'https://www.google.com/travel/flights?hl=en&tfs=abc',
          source: 'google',
        },
        {
          status: 'connection',
          via: 'Paris',
          routes: [
            {
              station: 'Brest',
              stationCity: 'Brest',
              carriers: ['TGV INOUI'],
              lastMileKm: 0.6,
              bookingUrl: null,
            },
          ],
        },
      ),
    }),
  );
  await page.reload();
  const getThere = page.getByRole('region', { name: 'Getting there' });
  await expect(getThere.locator('[data-mode=flight] .mode-price')).toHaveText('€96');
  await expect(
    getThere.getByRole('link', { name: 'See this flight on Google Flights' }),
  ).toHaveAttribute('href', 'https://www.google.com/travel/flights?hl=en&tfs=abc');
  // One Google Flights link, not two.
  await expect(getThere.getByRole('link', { name: /Google Flights/ })).toHaveCount(1);
  await expect(
    getThere.getByText('landing in time on Google Flights, checked in the last 6 hours', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    getThere.getByText('Get to Paris first (regional TER or car)', { exact: false }),
  ).toBeVisible();
  await expect(getThere.locator('[data-mode=train]')).toContainText('TGV INOUI to Brest');
  const step = page.locator('.trip-step', { hasText: 'Plane · SAS SK 576' });
  await expect(step).toContainText('€96');
  await expect(step.getByRole('link', { name: 'See this flight on Google Flights' })).toBeVisible();
  await getThere.screenshot({ path: 'test-results/getting-there-google.png' });
});
