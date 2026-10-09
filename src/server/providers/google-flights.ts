// Live Google Flights prices for the concert day, through SerpApi's Google Flights engine
// (serpapi.com/google-flights-api). Each answer is what Google Flights showed when it was
// fetched; it is cached a few hours for every user, so the plan's monthly searches last.
import { airportCodes } from '@/domain/airport-cities';
import { query } from '../db';
import { env } from '../env';
import { providerJson } from './http';
import { wallToInstant } from './sncf';
import type { FlightFare } from './travelpayouts';

const API = 'https://serpapi.com/search.json';
const GOOGLE_FLIGHTS = 'https://www.google.com/travel/flights';
export const GOOGLE_FARE_CACHE_HOURS = 6;
/** Deep search matches the Google Flights page but takes longer than a quick search. */
const SEARCH_TIMEOUT_MS = 40000;
/** Bump when the search parameters change, so older answers are not reused. */
const CACHE_VERSION = 'google:v2:';
/** A flight landing after the deadline but at least this long before the show is "tight". */
export const TIGHT_EXTRA_MS = 90 * 60000;

/** One itinerary as Google Flights listed it; times are local at each airport. */
type Itinerary = {
  price: number;
  departs: string; // "2027-02-12 07:10"
  lands: string;
  airline: string | null;
  flightNumber: string | null;
  transfers: number;
};
type Answer = { itineraries: Itinerary[]; url: string | null };

type Segment = {
  departure_airport?: { time?: unknown };
  arrival_airport?: { time?: unknown };
  airline?: unknown;
  flight_number?: unknown;
};
type Row = { price?: unknown; flights?: Segment[]; layovers?: unknown[] };

const TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

export function parseGoogleFlights(body: {
  best_flights?: Row[];
  other_flights?: Row[];
  search_metadata?: { google_flights_url?: unknown };
}): Answer {
  const itineraries: Itinerary[] = [];
  for (const row of [...(body.best_flights ?? []), ...(body.other_flights ?? [])]) {
    const segments = row.flights ?? [];
    const first = segments[0],
      last = segments[segments.length - 1];
    const departs = first?.departure_airport?.time,
      lands = last?.arrival_airport?.time;
    if (
      typeof row.price !== 'number' ||
      row.price <= 0 ||
      typeof departs !== 'string' ||
      typeof lands !== 'string' ||
      !TIME.test(departs) ||
      !TIME.test(lands)
    )
      continue;
    itineraries.push({
      price: row.price,
      departs,
      lands,
      airline: typeof first.airline === 'string' ? first.airline : null,
      flightNumber: typeof first.flight_number === 'string' ? first.flight_number : null,
      transfers: Array.isArray(row.layovers) ? row.layovers.length : segments.length - 1,
    });
  }
  const url = body.search_metadata?.google_flights_url;
  return {
    itineraries,
    url: typeof url === 'string' && url.startsWith(`${GOOGLE_FLIGHTS}?`) ? url : null,
  };
}

async function search(from: string, to: string, date: string, key: string, fetcher: typeof fetch) {
  const url = new URL(API);
  for (const [name, value] of Object.entries({
    engine: 'google_flights',
    departure_id: airportCodes(from),
    arrival_id: airportCodes(to),
    outbound_date: date,
    type: '2', // one way
    adults: '1',
    currency: 'EUR',
    hl: 'en',
    gl: 'fr',
    // The quick search misses flights the Google Flights page lists (a SAS nonstop at €107
    // was missing, a €140 one-stop shown instead). Deep search is "identical to the browser";
    // hidden results and price order make sure the cheapest are in the answer.
    deep_search: 'true',
    show_hidden: 'true',
    sort_by: '2',
    api_key: key,
  }))
    url.searchParams.set(name, value);
  const body = (await providerJson(
    url.toString(),
    { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) },
    fetcher,
  )) as Parameters<typeof parseGoogleFlights>[0] & { error?: unknown };
  // "No results" is an answer worth caching; any other error is not.
  if (typeof body.error === 'string' && !/hasn.t returned any results/i.test(body.error))
    throw new Error('SerpApi error');
  return parseGoogleFlights(body);
}

export async function clearGoogleFareCache() {
  await query(`DELETE FROM fare_cache WHERE key LIKE 'google%'`);
}

/**
 * The cheapest Google Flights itinerary leaving on the concert day that lands by `landBy`
 * (an instant, in ms). Null without a SerpApi key or when nothing fits.
 */
export async function cheapestGoogleFlight(
  from: string,
  to: string,
  date: string,
  landBy: number | null,
  /** The concert's timezone: Google gives arrival times local to the arrival airport. */
  timeZone: string | null | undefined,
  /** Where to book when Google gives no link back to the same search. */
  searchUrl: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<{
  fare: FlightFare;
  onTime: boolean | null;
  /** Cheaper than `fare`, landing after the deadline but still before the show. */
  tight: FlightFare | null;
} | null> {
  const key = env().SERPAPI_KEY;
  if (!key || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null;
  const cacheKey = `${CACHE_VERSION}${from}|${to}|${date}`;
  const [hit] = await query<{ value: Answer; fetched_at: string | Date }>(
    'SELECT value, fetched_at FROM fare_cache WHERE key=$1',
    [cacheKey],
  );
  let answer: Answer;
  if (hit && now - new Date(hit.fetched_at).getTime() < GOOGLE_FARE_CACHE_HOURS * 3600000)
    answer = hit.value;
  else {
    answer = await search(from, to, date, key, fetcher);
    await query(
      `INSERT INTO fare_cache(key, value, fetched_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, fetched_at=EXCLUDED.fetched_at`,
      [cacheKey, JSON.stringify(answer), new Date(now).toISOString()],
    );
  }
  const all = answer.itineraries
    .filter((it) => it.departs.startsWith(date))
    .map((it) => {
      const [day, time] = it.lands.split(' ');
      const arrival = wallToInstant(day, `${time}:00`, timeZone || 'Europe/Paris');
      return {
        fare: {
          price: it.price,
          currency: 'EUR' as const,
          airline: it.airline,
          flightNumber: it.flightNumber,
          departureAt: it.departs.replace(' ', 'T'),
          arrivalAt: Number.isFinite(arrival) ? new Date(arrival).toISOString() : null,
          transfers: it.transfers,
          bookingUrl: answer.url ?? searchUrl,
          source: 'google' as const,
        },
        onTime: landBy === null || !Number.isFinite(arrival) ? null : arrival <= landBy,
        arrival,
      };
    })
    .sort((a, b) => a.fare.price - b.fare.price);
  const best = all.find((entry) => entry.onTime !== false);
  if (!best) return null;
  const tight =
    landBy === null
      ? null
      : all.find(
          (entry) =>
            entry.onTime === false &&
            entry.fare.price < best.fare.price &&
            entry.arrival <= landBy + TIGHT_EXTRA_MS,
        );
  return { fare: best.fare, onTime: best.onTime, tight: tight?.fare ?? null };
}
