import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { migrations } from '../src/server/schema';
import {
  cheapestGoogleFlight,
  clearGoogleFareCache,
  parseGoogleFlights,
} from '../src/server/providers/google-flights';

const db = new PGlite();
beforeAll(async () => {
  for (const m of migrations) await db.exec(m.sql);
  vi.mocked(query).mockImplementation(
    async (sql, params) => (await db.query(sql, params)).rows as never[],
  );
});
afterAll(() => db.close());

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const leg = (from: string, to: string, departs: string, lands: string, airline = 'SAS') => ({
  departure_airport: { id: from, time: departs },
  arrival_airport: { id: to, time: lands },
  airline,
  flight_number: `${airline} 1`,
});
// SerpApi google_flights shape; times are local at each airport (Stockholm = Paris time).
const answer = {
  search_metadata: {
    google_flights_url: 'https://www.google.com/travel/flights?hl=en&tfs=abc',
  },
  best_flights: [
    // Cheapest, but lands 18:50 for a 19:30 show (deadline 16:30): too late.
    { price: 49, flights: [leg('BVA', 'NYO', '2027-02-12 16:10', '2027-02-12 18:50', 'Ryanair')] },
    // On time, one stop.
    {
      price: 96,
      flights: [
        leg('CDG', 'CPH', '2027-02-12 07:00', '2027-02-12 09:00'),
        leg('CPH', 'ARN', '2027-02-12 10:00', '2027-02-12 11:10'),
      ],
      layovers: [{ id: 'CPH' }],
    },
  ],
  other_flights: [
    {
      price: 120,
      flights: [leg('CDG', 'ARN', '2027-02-12 09:30', '2027-02-12 12:00', 'Air France')],
    },
    // The day before: not the concert day.
    { price: 40, flights: [leg('ORY', 'ARN', '2027-02-11 09:30', '2027-02-11 12:00')] },
    { price: 'cheap', flights: [] },
  ],
};
const deadline = Date.parse('2027-02-12T15:30:00Z'); // 16:30 in Stockholm

beforeEach(async () => {
  await clearGoogleFareCache();
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('SERPAPI_KEY', 'serp-test-key');
});
afterEach(() => vi.unstubAllEnvs());

it('keeps only priced itineraries with local departure and landing times', () => {
  const parsed = parseGoogleFlights(answer as never);
  expect(parsed.itineraries.map((i) => i.price)).toEqual([49, 96, 120, 40]);
  expect(parsed.itineraries[1]).toMatchObject({ transfers: 1, lands: '2027-02-12 11:10' });
  expect(
    parseGoogleFlights({ search_metadata: { google_flights_url: 'https://evil.test/' } }).url,
  ).toBeNull();
});

it('picks the cheapest Google Flights itinerary landing in time, searched once for every user', async () => {
  const calls: URL[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    calls.push(new URL(String(input)));
    return json(answer);
  }) as typeof fetch;
  const now = Date.parse('2026-10-09T12:00:00Z');
  const found = await cheapestGoogleFlight(
    'PAR',
    'STO',
    '2027-02-12',
    deadline,
    'Europe/Stockholm',
    'https://www.google.com/travel/flights?q=fallback',
    fetcher,
    now,
  );
  expect(found).toEqual({
    onTime: true,
    // Ryanair at €49 lands 18:50 for a 19:30 show: not even tight (40 min), so not offered.
    tight: null,
    fare: {
      price: 96,
      currency: 'EUR',
      airline: 'SAS',
      flightNumber: 'SAS 1',
      departureAt: '2027-02-12T07:00',
      arrivalAt: '2027-02-12T10:10:00.000Z',
      transfers: 1,
      bookingUrl: 'https://www.google.com/travel/flights?hl=en&tfs=abc',
      source: 'google',
    },
  });
  // Metropolitan codes become airport lists; one adult, one way, euros.
  expect(Object.fromEntries(calls[0].searchParams)).toMatchObject({
    engine: 'google_flights',
    departure_id: 'CDG,ORY,BVA',
    arrival_id: 'ARN,BMA,NYO',
    outbound_date: '2027-02-12',
    type: '2',
    currency: 'EUR',
    // As complete as the Google Flights page.
    deep_search: 'true',
    show_hidden: 'true',
    sort_by: '2',
  });
  // Within six hours, another user's page uses the stored answer.
  await cheapestGoogleFlight(
    'PAR',
    'STO',
    '2027-02-12',
    deadline,
    'Europe/Stockholm',
    '',
    fetcher,
    now + 3600000,
  );
  expect(calls).toHaveLength(1);
  await cheapestGoogleFlight(
    'PAR',
    'STO',
    '2027-02-12',
    deadline,
    'Europe/Stockholm',
    '',
    fetcher,
    now + 7 * 3600000,
  );
  expect(calls).toHaveLength(2);
});

it('says nothing without a key, and caches an empty day', async () => {
  vi.stubEnv('SERPAPI_KEY', '');
  const fetcher = vi.fn() as unknown as typeof fetch;
  expect(
    await cheapestGoogleFlight('PAR', 'STO', '2027-02-12', deadline, null, '', fetcher),
  ).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  vi.stubEnv('SERPAPI_KEY', 'serp-test-key');
  const empty = vi.fn(async () =>
    json({ error: "Google Flights hasn't returned any results for this query." }),
  );
  expect(
    await cheapestGoogleFlight('PAR', 'STO', '2027-02-12', deadline, null, '', empty as never),
  ).toBeNull();
  await cheapestGoogleFlight('PAR', 'STO', '2027-02-12', deadline, null, '', empty as never);
  expect(empty).toHaveBeenCalledTimes(1);
  // Other errors (quota, bad key) are not cached and surface to the caller.
  await clearGoogleFareCache();
  const failing = vi.fn(async () => json({ error: 'Your account has run out of searches.' }));
  await expect(
    cheapestGoogleFlight('PAR', 'STO', '2027-02-12', deadline, null, '', failing as never),
  ).rejects.toThrow();
});

it('offers a cheaper flight landing after the deadline but at least 1 h 30 before the show', async () => {
  const tightAnswer = {
    other_flights: [
      { price: 107, flights: [leg('CDG', 'ARN', '2027-02-12 12:25', '2027-02-12 14:55')] },
      // Lands 17:40 for a 19:30 show: after the 16:30 deadline, 1 h 50 before.
      {
        price: 62,
        flights: [leg('ORY', 'ARN', '2027-02-12 14:55', '2027-02-12 17:40', 'Transavia')],
      },
    ],
  };
  const fetcher = (async () => json(tightAnswer)) as unknown as typeof fetch;
  const found = await cheapestGoogleFlight(
    'PAR',
    'STO',
    '2027-02-12',
    deadline,
    'Europe/Stockholm',
    'https://www.google.com/travel/flights?q=fallback',
    fetcher,
  );
  expect(found?.fare.price).toBe(107);
  expect(found?.tight).toMatchObject({
    price: 62,
    airline: 'Transavia',
    arrivalAt: '2027-02-12T16:40:00.000Z',
  });
});
