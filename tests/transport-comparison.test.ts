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
vi.mock('../src/server/providers/travelpayouts', () => ({
  landingDeadline: vi.fn(() => Date.parse('2027-05-12T14:00:00Z')),
  cheapestFlight: vi.fn(async () => ({
    onTime: true,
    fare: {
      price: 79,
      currency: 'EUR',
      airline: 'TO',
      flightNumber: '3500',
      departureAt: '2027-05-12T09:20:00+02:00',
      arrivalAt: '2027-05-12T10:35:00.000Z',
      transfers: 0,
      bookingUrl: 'https://www.aviasales.com/search/PAR1205ATH1',
    },
  })),
}));
vi.mock('../src/server/providers/google-flights', () => ({
  cheapestGoogleFlight: vi.fn(async () => null),
}));
import { trainRoutes } from '../src/server/providers/rail';
import { cheapestGoogleFlight } from '../src/server/providers/google-flights';
import { cheapestFlight } from '../src/server/providers/travelpayouts';
import { landBy, transportComparison } from '../src/server/transport-comparison';

const show = (city: string, localTime = '20:00:00') =>
  ({ provider: 'ticketmaster', status: 'onsale', city, date: '2027-05-12', localTime }) as never;
const u = (link: string | null | undefined) =>
  link ? Object.fromEntries(new URL(new URL(link).searchParams.get('u')!).searchParams) : null;

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('OMIO_ENABLED', 'true');
  vi.stubEnv('OMIO_PARTNER_ID', '987654321234');
});
afterEach(() => vi.unstubAllEnvs());

it('a show 300 km away: train first, car and coach, no plane, no estimated price', async () => {
  place.venue = { latitude: 49.2603, longitude: 6.1062 };
  const result = (await transportComparison(show('Amneville Les Thermes'), 'Paris'))!;
  expect(result.recommended).toBe('train');
  expect(result.flight).toBeNull();
  expect(cheapestFlight).not.toHaveBeenCalled();
  expect(result.train?.status).toBe('served');
  if (result.train?.status !== 'served') return;
  expect(u(result.train.routes[0].bookingUrl)).toMatchObject({
    departurePosTerm: 'Paris',
    arrivalPosTerm: 'Metz',
    departureDate: '2027-05-12',
    travelMode: 'TRAIN',
  });
  // Coaches use the known station town.
  expect(result.road?.coachRoute).toBe('Paris → Metz');
  expect(u(result.road?.coachUrl)).toMatchObject({
    departurePosTerm: 'Paris',
    arrivalPosTerm: 'Metz',
    travelMode: 'BUS',
  });
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
  expect(u(result.flight!.omioUrl)).toMatchObject({
    departurePosTerm: 'Paris',
    arrivalPosTerm: 'Athens',
    travelMode: 'FLIGHT',
  });
  // The cheapest flight landing in time, from the concert day's fares.
  expect(result.flight).toMatchObject({ fareOnTime: true, fare: { price: 79, airline: 'TO' } });
  expect(cheapestFlight).toHaveBeenCalledWith(
    'PAR',
    'ATH',
    '2027-05-12',
    Date.parse('2027-05-12T14:00:00Z'),
    expect.anything(),
    expect.anything(),
  );
});

it('prefers the live Google Flights price, falling back to Aviasales fares', async () => {
  place.venue = { latitude: 59.3083, longitude: 18.0786 }; // Fryshuset, Stockholm
  vi.mocked(cheapestFlight).mockClear();
  vi.mocked(cheapestGoogleFlight).mockResolvedValueOnce({
    onTime: true,
    fare: {
      price: 96,
      currency: 'EUR',
      airline: 'SAS',
      flightNumber: 'SK 1',
      departureAt: '2027-05-12T07:00',
      arrivalAt: '2027-05-12T10:10:00.000Z',
      transfers: 1,
      bookingUrl: 'https://www.google.com/travel/flights?tfs=abc',
      source: 'google',
    },
    tight: {
      price: 62,
      currency: 'EUR',
      airline: 'Transavia',
      flightNumber: 'TO 4500',
      departureAt: '2027-05-12T14:55',
      arrivalAt: '2027-05-12T15:10:00.000Z',
      transfers: 0,
      bookingUrl: 'https://www.google.com/travel/flights?tfs=abc',
      source: 'google',
    },
  });
  const result = (await transportComparison(show('Stockholm'), 'Paris'))!;
  expect(result.flight).toMatchObject({ to: 'Stockholm', fare: { price: 96, source: 'google' } });
  // The cheaper flight landing 1 h 50 before the show (17:00Z) is offered, not counted.
  expect(result.flight?.tightFare).toMatchObject({ fare: { price: 62 }, minutesBeforeShow: 110 });
  expect(cheapestFlight).not.toHaveBeenCalled();
  // Google has nothing for the day: Aviasales travellers' fares.
  const again = (await transportComparison(show('Stockholm'), 'Paris'))!;
  expect(again.flight?.fare?.price).toBe(79);
  expect(again.flight?.tightFare).toBeNull();
  expect(cheapestFlight).toHaveBeenCalledTimes(1);
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

it('does not create itinerary searches for past or unconfirmed concert dates', async () => {
  for (const date of ['2020-01-01', '', '2027-02-30'])
    expect(
      await transportComparison(
        { provider: 'ticketmaster', status: 'onsale', city: 'Berlin', date } as never,
        'Paris',
      ),
    ).toBeNull();
});
