import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  aviasalesSearchUrl,
  cheapestFlight,
  clearFlightCache,
  landingDeadline,
} from '../src/server/providers/travelpayouts';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
// Shape of /aviasales/v3/prices_for_dates rows (prices in the requested currency).
const rows = [
  // Cheapest, but lands too late for a 20:00 show in Athens (deadline 17:00 local = 14:00Z).
  {
    price: 41,
    airline: 'W6',
    flight_number: 4321,
    departure_at: '2027-05-12T15:30:00+02:00',
    transfers: 0,
    duration_to: 195,
    link: '/search/PAR1205ATH1?t=W6',
  },
  // Lands 13:35 local (10:35Z): on time.
  {
    price: 79,
    airline: 'TO',
    flight_number: '3500',
    departure_at: '2027-05-12T09:20:00+02:00',
    transfers: 0,
    duration_to: 195,
    link: '/search/PAR1205ATH1?t=TO',
  },
  {
    price: 86,
    airline: 'A3',
    flight_number: '611',
    departure_at: '2027-05-12T11:05:00+02:00',
    transfers: 0,
    duration_to: 190,
  },
  // The day before: not the concert day.
  {
    price: 30,
    airline: 'U2',
    flight_number: '1',
    departure_at: '2027-05-11T10:00:00+02:00',
    transfers: 0,
    duration_to: 190,
  },
  { price: 'free', departure_at: '2027-05-12T08:00:00+02:00' },
];

beforeEach(() => {
  clearFlightCache();
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('TRAVELPAYOUTS_TOKEN', 'tp-token');
  vi.stubEnv('TRAVELPAYOUTS_MARKER', '123456');
});
afterEach(() => vi.unstubAllEnvs());

it('picks the cheapest concert-day flight that lands in time, with a marked booking link', async () => {
  const fetcher = vi.fn(async () => json({ success: true, data: rows }));
  const deadline = landingDeadline('2027-05-12', '20:00:00', 'Europe/Athens');
  expect(new Date(deadline!).toISOString()).toBe('2027-05-12T14:00:00.000Z');
  const result = await cheapestFlight('PAR', 'ATH', '2027-05-12', deadline, fetcher as never);
  expect(result).toEqual({
    onTime: true,
    fare: {
      price: 79,
      currency: 'EUR',
      airline: 'TO',
      flightNumber: '3500',
      departureAt: '2027-05-12T09:20:00+02:00',
      arrivalAt: '2027-05-12T10:35:00.000Z',
      transfers: 0,
      bookingUrl: 'https://www.aviasales.com/search/PAR1205ATH1?t=TO&marker=123456',
      source: 'aviasales',
    },
  });
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  const query = new URL(url).searchParams;
  expect(Object.fromEntries(query)).toMatchObject({
    origin: 'PAR',
    destination: 'ATH',
    departure_at: '2027-05-12',
    one_way: 'true',
    currency: 'eur',
  });
  // The token travels in a header, never in the URL.
  expect(url).not.toContain('tp-token');
  expect((init.headers as Record<string, string>)['X-Access-Token']).toBe('tp-token');
  // Cached for the next plan.
  await cheapestFlight('PAR', 'ATH', '2027-05-12', deadline, fetcher as never);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('without a show time, the cheapest that day; without a token, nothing', async () => {
  const fetcher = vi.fn(async () => json({ success: true, data: rows }));
  const result = await cheapestFlight('PAR', 'ATH', '2027-05-12', null, fetcher as never);
  expect(result?.fare.price).toBe(41);
  expect(result?.onTime).toBeNull();
  vi.stubEnv('TRAVELPAYOUTS_TOKEN', '');
  clearFlightCache();
  expect(await cheapestFlight('PAR', 'ATH', '2027-05-12', null, fetcher as never)).toBeNull();
});

it('never links outside Aviasales and builds the search link when none is given', async () => {
  const fetcher = vi.fn(async () =>
    json({
      success: true,
      data: [
        {
          price: 50,
          departure_at: '2027-05-12T09:00:00+02:00',
          duration_to: 190,
          link: 'https://evil.example/x',
        },
      ],
    }),
  );
  const result = await cheapestFlight('PAR', 'ATH', '2027-05-12', null, fetcher as never);
  expect(result?.fare.bookingUrl).toBe(
    'https://www.aviasales.com/search/PAR1205ATH1?marker=123456',
  );
  expect(aviasalesSearchUrl('LYS', 'BCN', '2027-01-09')).toBe(
    'https://www.aviasales.com/search/LYS0901BCN1',
  );
});
