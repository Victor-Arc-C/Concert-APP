import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/trips', () => ({
  tripSearchContext: vi.fn(async () => ({
    origin: { latitude: 48.8566, longitude: 2.3522 },
    venue: { latitude: 49.2603, longitude: 6.1062 },
    venueExact: true,
  })),
}));
vi.mock('../src/server/providers/fares', () => ({
  trainComparison: vi.fn(async () => ({
    status: 'priced',
    fares: [
      {
        carrier: 'OUIGO',
        station: 'Metz',
        stationCity: 'Metz',
        bookingUrl: null,
        lastMileKm: 17.5,
        standard: { min: 16, max: 79 },
        avantage: null,
      },
      {
        carrier: 'TGV INOUI',
        station: 'Metz',
        stationCity: 'Metz',
        bookingUrl: null,
        lastMileKm: 17.5,
        standard: { min: 25, max: 90 },
        avantage: null,
      },
    ],
    source: 'SNCF',
    dataUpdatedAt: null,
  })),
  carComparison: vi.fn(async () => ({ status: 'unavailable', reason: 'x' })),
}));
import { transportComparison } from '../src/server/transport-comparison';

afterEach(() => vi.unstubAllEnvs());

it('links each train route and the coach route to Omio through the affiliate link', async () => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('OMIO_AFFILIATE_URL', 'https://omio.sjv.io/c/7922007/409973/7385');
  const result = await transportComparison(
    { provider: 'ticketmaster', status: 'onsale', city: 'Amneville Les Thermes' } as never,
    'Paris',
  );
  expect(result?.train.status).toBe('priced');
  if (result?.train.status !== 'priced') return;
  for (const fare of result.train.fares)
    expect(new URL(fare.bookingUrl!).searchParams.get('u')).toBe(
      'https://www.omio.fr/trains/paris/metz',
    );
  // Coaches go to the station town, not the small venue town Omio has no page for.
  expect(result.coach.route).toBe('Paris → Metz');
  expect(new URL(result.coach.bookingUrl!).searchParams.get('u')).toBe(
    'https://www.omio.fr/bus/paris/metz',
  );
});
