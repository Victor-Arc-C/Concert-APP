// Flight fares for the concert day from Travelpayouts (Aviasales Data API, v3 prices_for_dates).
// These are real fares Aviasales travellers found in the last 48 hours, not a live booking
// quote: the page says when to expect them to change and links to the live search.
import { env } from '../env';
import { providerJson } from './http';
import { wallToInstant } from './sncf';

const API = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';
const SEARCH = 'https://www.aviasales.com';
const CACHE_MS = 30 * 60 * 1000;

export type FlightFare = {
  price: number;
  currency: 'EUR';
  airline: string | null;
  flightNumber: string | null;
  departureAt: string;
  /** Departure plus flight time, when the source gives a duration. */
  arrivalAt: string | null;
  transfers: number | null;
  bookingUrl: string;
};

type Row = {
  price?: unknown;
  airline?: unknown;
  flight_number?: unknown;
  departure_at?: unknown;
  transfers?: unknown;
  duration?: unknown;
  duration_to?: unknown;
  link?: unknown;
};

const cache = new Map<string, { at: number; value: Row[] }>();
export function clearFlightCache() {
  cache.clear();
}

/** Aviasales search for one adult, one way: /search/PAR1205ATH1 (day and month). */
export function aviasalesSearchUrl(from: string, to: string, date: string, marker?: string) {
  const [, month, day] = date.split('-');
  const url = new URL(`${SEARCH}/search/${from}${day}${month}${to}1`);
  if (marker) url.searchParams.set('marker', marker);
  return url.toString();
}

function bookingUrl(row: Row, from: string, to: string, date: string, marker?: string) {
  // Prefer the exact itinerary link the API returns; never follow a link to another host.
  if (typeof row.link === 'string' && row.link.startsWith('/search/')) {
    const url = new URL(row.link, SEARCH);
    if (url.origin === SEARCH) {
      if (marker) url.searchParams.set('marker', marker);
      return url.toString();
    }
  }
  return aviasalesSearchUrl(from, to, date, marker);
}

/**
 * The cheapest flight on the concert day that lands early enough. A flight with no known
 * duration cannot prove it lands in time, so it is used only when nothing provably on time
 * exists, and the caller says so.
 */
export async function cheapestFlight(
  from: string,
  to: string,
  date: string,
  /** Latest landing instant (ms), e.g. three hours before the show; null when unknown. */
  landBy: number | null,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<{ fare: FlightFare; onTime: boolean | null } | null> {
  const settings = env();
  if (!settings.TRAVELPAYOUTS_TOKEN || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to))
    return null;
  const key = `${from}|${to}|${date}`;
  let rows = cache.get(key);
  if (!rows || now - rows.at >= CACHE_MS) {
    const url = new URL(API);
    for (const [name, value] of Object.entries({
      origin: from,
      destination: to,
      departure_at: date,
      one_way: 'true',
      sorting: 'price',
      currency: 'eur',
      limit: '30',
    }))
      url.searchParams.set(name, value);
    const body = (await providerJson(
      url.toString(),
      { headers: { 'X-Access-Token': settings.TRAVELPAYOUTS_TOKEN, accept: 'application/json' } },
      fetcher,
    )) as { success?: boolean; data?: Row[] };
    rows = { at: now, value: body.success === false ? [] : (body.data ?? []) };
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    cache.set(key, rows);
  }
  const fares = rows.value
    .map((row) => {
      const price = typeof row.price === 'number' && row.price > 0 ? row.price : null;
      const departure =
        typeof row.departure_at === 'string' ? Date.parse(row.departure_at) : Number.NaN;
      // Only flights leaving on the concert day itself.
      if (
        price === null ||
        !Number.isFinite(departure) ||
        !String(row.departure_at).startsWith(date)
      )
        return null;
      const minutes = [row.duration_to, row.duration].find(
        (value): value is number => typeof value === 'number' && value > 0 && value < 48 * 60,
      );
      const arrival = minutes ? departure + minutes * 60000 : null;
      return {
        fare: {
          price,
          currency: 'EUR' as const,
          airline: typeof row.airline === 'string' ? row.airline : null,
          flightNumber:
            typeof row.flight_number === 'string' || typeof row.flight_number === 'number'
              ? String(row.flight_number)
              : null,
          departureAt: String(row.departure_at),
          arrivalAt: arrival === null ? null : new Date(arrival).toISOString(),
          transfers: typeof row.transfers === 'number' ? row.transfers : null,
          bookingUrl: bookingUrl(row, from, to, date, settings.TRAVELPAYOUTS_MARKER),
        },
        onTime: landBy === null || arrival === null ? null : arrival <= landBy,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null && entry.onTime !== false)
    .sort(
      (a, b) =>
        Number(b.onTime === true) - Number(a.onTime === true) || a.fare.price - b.fare.price,
    );
  return fares[0] ?? null;
}

/** Show start in its own timezone, minus a margin, as an instant. */
export function landingDeadline(
  date: string,
  localTime: string | null | undefined,
  timeZone: string | null | undefined,
  marginHours = 3,
) {
  if (!localTime || !/^\d{2}:\d{2}/.test(localTime)) return null;
  const start = wallToInstant(date, `${localTime.slice(0, 5)}:00`, timeZone || 'Europe/Paris');
  return start - marginHours * 3600000;
}
