import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const place = vi.hoisted(() => ({
  venue: { latitude: 49.2603, longitude: 6.1062 },
}));
vi.mock('../src/server/trips', () => ({
  tripSearchContext: vi.fn(async () => ({
    origin: { latitude: 48.8566, longitude: 2.3522 },
    venue: place.venue,
    venueExact: true,
  })),
}));
vi.mock('../src/server/providers/rail', () => ({
  trainRoutes: vi.fn(async () => ({
    status: 'served',
    routes: [
      {
        station: 'Metz',
        stationCity: 'Metz',
        carriers: ['OUIGO', 'TGV INOUI'],
        lastMileKm: 17.5,
        bookingUrl: null,
      },
    ],
  })),
}));
import { trainRoutes } from '../src/server/providers/rail';
import { landBy, transportComparison } from '../src/server/transport-comparison';

const show = (city: string, localTime = '20:00:00') =>
  ({ provider: 'ticketmaster', status: 'onsale', city, date: '2027-05-12', localTime }) as never;
const u = (link: string | null | undefined) => (link ? new URL(link).searchParams.get('u') : null);

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('OMIO_AFFILIATE_URL', 'https://omio.sjv.io/c/7922007/409973/7385');
});
afterEach(() => vi.unstubAllEnvs());

it('a show 300 km away: train first, car and coach, no plane, no estimated price', async () => {
  place.venue = { latitude: 49.2603, longitude: 6.1062 };
  const result = (await transportComparison(show('Amneville Les Thermes'), 'Paris'))!;
  expect(result.recommended).toBe('train');
  expect(result.flight).toBeNull();
  expect(result.train?.status).toBe('served');
  if (result.train?.status !== 'served') return;
  expect(u(result.train.routes[0].bookingUrl)).toBe('https://www.omio.fr/trains/paris/metz');
  // Coaches go to the station town, not the small venue town Omio has no page for.
  expect(result.road?.coachRoute).toBe('Paris → Metz');
  expect(u(result.road?.coachUrl)).toBe('https://www.omio.fr/bus/paris/metz');
  expect(JSON.stringify(result)).not.toMatch(/fuel|price"|min"|max"/);
});

it('a show in Athens: the plane only, landing three hours before the show', async () => {
  place.venue = { latitude: 38.0364, longitude: 23.7871 }; // Telekom Center, Marousi
  vi.mocked(trainRoutes).mockClear();
  const result = (await transportComparison(show('Marousi'), 'Paris'))!;
  expect(result.recommended).toBe('flight');
  expect(result.road).toBeNull();
  expect(result.train).toBeNull();
  expect(trainRoutes).not.toHaveBeenCalled();
  expect(result.flight).toMatchObject({ from: 'Paris', to: 'Athens', landBy: '17:00' });
  const search = new URL(result.flight!.searchUrl);
  expect(search.hostname).toBe('www.google.com');
  expect(search.searchParams.get('q')).toBe('Flights from PAR to ATH on 2027-05-12 one way');
  expect(u(result.flight!.omioUrl)).toBe('https://www.omio.fr/vols/paris/athenes');
});

it('a show 600 km away by train: train first, plane offered too', async () => {
  place.venue = { latitude: 43.2696, longitude: 5.3958 }; // Marseille
  const result = (await transportComparison(show('Marseille'), 'Paris'))!;
  expect(result.recommended).toBe('train');
  expect(result.flight?.to).toBe('Marseille');
  expect(result.road).not.toBeNull();
});

it('lands with three hours to spare, or says to fly the day before for an early show', () => {
  expect(landBy('20:00:00')).toBe('17:00');
  expect(landBy('21:30')).toBe('18:30');
  expect(landBy('08:00:00')).toBeNull();
  expect(landBy(null)).toBeNull();
});

it('never routes fictional, cancelled or postponed concerts', async () => {
  for (const event of [
    { provider: 'sample', status: 'onsale' },
    { provider: 'ticketmaster', status: 'cancelled' },
    { provider: 'ticketmaster', status: 'postponed' },
  ])
    expect(await transportComparison(event as never, 'Paris')).toBeNull();
});
