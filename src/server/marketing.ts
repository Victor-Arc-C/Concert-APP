import { z } from 'zod';
import { query } from './db';
import { cities as catalogCities } from '../domain/catalog';
import {
  homeCities,
  inEurope,
  WAITLIST_PUBLIC_THRESHOLD,
  type PublicCity,
  type PublicGigs,
} from '../domain/marketing';
import type { Concert } from '../domain/types';

type Row = { data: Concert; latitude: number | null; longitude: number | null };
const GIGS_PER_CITY = 12;

async function upcoming(sample: boolean, today: string) {
  return query<Row>(
    `SELECT e.data, v.latitude, v.longitude FROM events e
     LEFT JOIN event_venues ev ON ev.event_id=e.id
     LEFT JOIN venues v ON v.id=ev.venue_id
     WHERE e.sample=$1 AND e.data->>'date' >= $2 AND e.data->>'status' <> 'cancelled'
     ORDER BY e.data->>'date'`,
    [sample, today],
  );
}

export function groupByCity(rows: Row[], mode: PublicGigs['mode']): PublicCity[] {
  const byCity = new Map<string, PublicCity>();
  for (const { data, latitude, longitude } of rows) {
    const known = catalogCities.find((c) => c.name.toLowerCase() === data.city.toLowerCase());
    const lat = latitude ?? known?.latitude,
      lon = longitude ?? known?.longitude;
    if (lat == null || lon == null || !inEurope(lat, lon)) continue;
    const key = `${data.city.toLowerCase()}|${data.country}`;
    const city = byCity.get(key) ?? {
      name: data.city,
      country: data.country,
      latitude: lat,
      longitude: lon,
      gigs: [],
      total: 0,
    };
    city.total++;
    if (city.gigs.length < GIGS_PER_CITY)
      city.gigs.push({
        artist: data.artist,
        venue: data.venue,
        // Sample dates are fictional, so they never leave the server.
        date: mode === 'live' ? data.date : null,
      });
    byCity.set(key, city);
  }
  return [...byCity.values()].sort((a, b) => b.total - a.total);
}

export async function publicGigs(now = new Date()): Promise<PublicGigs> {
  const today = now.toISOString().slice(0, 10);
  let mode: PublicGigs['mode'] = 'live';
  let rows = await upcoming(false, today);
  if (!rows.length) {
    mode = 'sample';
    rows = await upcoming(true, today);
  }
  const cities = groupByCity(rows, mode);
  const shown = rows.filter((row) =>
    cities.some((c) => c.name.toLowerCase() === row.data.city.toLowerCase()),
  );
  const [{ count }] = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM waitlist',
  );
  return {
    mode,
    cities,
    stats: {
      shows: shown.length,
      artists: new Set(shown.map((row) => row.data.artist.toLowerCase())).size,
      cities: cities.length,
      countries: new Set(cities.map((c) => c.country)).size,
    },
    waitlist: Number(count) >= WAITLIST_PUBLIC_THRESHOLD ? Number(count) : null,
  };
}

export const waitlistSchema = z.object({
  // Trim before validating so autofill's trailing space is not an error.
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254)),
  homeCity: z
    .string()
    .refine((city) => homeCities.includes(city), 'Pick a city from the list.')
    .optional(),
});

/** Idempotent: re-joining only updates the home city, so the response never reveals sign-ups. */
export async function joinWaitlist(input: z.infer<typeof waitlistSchema>) {
  await query(
    `INSERT INTO waitlist(email,home_city) VALUES($1,$2)
     ON CONFLICT(email) DO UPDATE SET home_city=COALESCE(EXCLUDED.home_city, waitlist.home_city)`,
    [input.email, input.homeCity ?? null],
  );
}
