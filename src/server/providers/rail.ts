// Which long-distance trains serve a concert, from official open data (no prices: the SNCF
// tables only give yearly price bands, which read as quotes and mislead; real fares come from
// the seller):
// - SNCF Voyageurs "Tarifs TGV INOUI et OUIGO" and "Tarifs Intercités" (ODbL): a route listed
//   there is a route those trains run.
// - SNCF "Gares de voyageurs": station positions, to find stations near the home city and venue.
// - geo.api.gouv.fr (official commune register): the town a station is in, for route links.
import type { Coordinates, TrainRoute } from '@/domain/trip-types';
import { providerJson } from './http';
import { distanceKm } from './liteapi';

const SNCF = 'https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets';
const ORIGIN_STATION_RADIUS_KM = 15;
const VENUE_STATION_RADIUS_KM = 40;
/** Stations within this distance of a hub's centre are that hub's (Paris: all its termini). */
const HUB_RADIUS_KM = 8;
/** How many hubs to try, the smallest detour first. */
const HUBS_TRIED = 3;
/** A change is worth it up to this many times the straight-line distance. */
const DETOUR = 1.35;
/**
 * Big long-distance rail hubs. A town with no direct TGV, OUIGO or Intercités to the concert
 * usually reaches one of them first (TER or car) and changes there: Auxerre → Paris → Brest.
 */
const HUBS: (Coordinates & { name: string })[] = [
  { name: 'Paris', latitude: 48.8566, longitude: 2.3522 },
  { name: 'Lyon', latitude: 45.764, longitude: 4.8357 },
  { name: 'Lille', latitude: 50.6292, longitude: 3.0573 },
  { name: 'Marseille', latitude: 43.2965, longitude: 5.3698 },
  { name: 'Bordeaux', latitude: 44.8378, longitude: -0.5792 },
  { name: 'Nantes', latitude: 47.2184, longitude: -1.5536 },
  { name: 'Rennes', latitude: 48.1035, longitude: -1.672 },
  { name: 'Strasbourg', latitude: 48.5734, longitude: 7.7521 },
  { name: 'Toulouse', latitude: 43.6047, longitude: 1.4442 },
  { name: 'Montpellier', latitude: 43.6108, longitude: 3.8767 },
  { name: 'Dijon', latitude: 47.3236, longitude: 5.0272 },
  { name: 'Tours', latitude: 47.3941, longitude: 0.6848 },
  { name: 'Metz', latitude: 49.1193, longitude: 6.1757 },
  { name: 'Nice', latitude: 43.7102, longitude: 7.262 },
];
const DAY_MS = 86400000;

type Fetcher = typeof fetch;
type Station = {
  name: string;
  uic: string;
  insee: string | null;
  latitude: number;
  longitude: number;
};
type ServiceRow = { carrier: string; uic: string };

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttl: number, load: () => Promise<T>, now: number) {
  const hit = cache.get(key);
  if (hit && now - hit.at < ttl) return hit.value as T;
  const value = await load();
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: now, value });
  return value;
}
export function clearRailCache() {
  cache.clear();
}

function records(url: string, params: Record<string, string>, fetcher: Fetcher) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return providerJson(target.toString(), {}, fetcher) as Promise<{
    results?: Record<string, unknown>[];
  }>;
}
const quoted = (values: string[]) => values.map((v) => `"${v.replace(/[^0-9]/g, '')}"`).join(',');

export async function stationsNear(
  point: Coordinates,
  radiusKm: number,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<Station[]> {
  const geom = `geom'POINT(${point.longitude} ${point.latitude})'`;
  return cached(
    `stations:${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}:${radiusKm}`,
    DAY_MS,
    async () => {
      const page = await records(
        `${SNCF}/gares-de-voyageurs/records`,
        {
          where: `within_distance(position_geographique, ${geom}, ${radiusKm}km)`,
          order_by: `distance(position_geographique, ${geom})`,
          limit: '40',
        },
        fetcher,
      );
      const stations: Station[] = [];
      for (const row of page.results ?? []) {
        const position = row.position_geographique as { lat?: number; lon?: number } | null;
        if (typeof row.nom !== 'string' || typeof position?.lat !== 'number') continue;
        for (const uic of String(row.codes_uic ?? '').split(/[;,\s]+/))
          if (/^\d{8}$/.test(uic))
            stations.push({
              name: row.nom,
              uic,
              insee: /^\d[\dAB]\d{3}$/.test(String(row.codeinsee)) ? String(row.codeinsee) : null,
              latitude: position.lat,
              longitude: position.lon as number,
            });
      }
      return stations;
    },
    now,
  );
}

/** Carriers running between two station sets, both directions, by station on the concert side. */
async function serviceRows(
  origins: string[],
  destinations: string[],
  fetcher: Fetcher,
  now: number,
): Promise<ServiceRow[]> {
  const o = quoted(origins),
    d = quoted(destinations);
  return cached(
    `service:${o}|${d}`,
    DAY_MS,
    async () => {
      const tgv = (from: string, to: string, side: 'origine' | 'destination') =>
        records(
          `${SNCF}/tarifs-tgv-inoui-ouigo/records`,
          {
            select: `transporteur, gare_${side}_code_uic as uic`,
            where: `gare_origine_code_uic in (${from}) and gare_destination_code_uic in (${to})`,
            group_by: `transporteur, gare_${side}_code_uic`,
            limit: '100',
          },
          fetcher,
        );
      const intercites = (from: string, to: string, side: 'origine' | 'destination') =>
        records(
          `${SNCF}/tarifs-intercites/records`,
          {
            select: `transporteur, ${side}_uic8 as uic`,
            where: `origine_uic8 in (${from}) and destination_uic8 in (${to})`,
            group_by: `transporteur, ${side}_uic8`,
            limit: '100',
          },
          fetcher,
        );
      // SNCF publishes most routes in one direction only.
      const pages = await Promise.all([
        tgv(o, d, 'destination'),
        tgv(d, o, 'origine'),
        intercites(o, d, 'destination'),
        intercites(d, o, 'origine'),
      ]);
      return pages
        .flatMap((page) => page.results ?? [])
        .filter((row) => typeof row.transporteur === 'string')
        .map((row) => ({
          carrier: String(row.transporteur).startsWith('Intercit')
            ? 'Intercités'
            : String(row.transporteur),
          uic: String(row.uic),
        }));
    },
    now,
  );
}

/** The town a station is in ("Lyon Part Dieu" → "Lyon"); arrondissements count as their city. */
export async function communeName(
  insee: string | null,
  fetcher: Fetcher = fetch,
  now = Date.now(),
) {
  if (!insee) return null;
  return cached(
    `commune:${insee}`,
    DAY_MS * 7,
    async () => {
      const commune = (await providerJson(
        `https://geo.api.gouv.fr/communes/${encodeURIComponent(insee)}?fields=nom`,
        {},
        fetcher,
      )) as { nom?: unknown };
      return typeof commune.nom === 'string'
        ? commune.nom.replace(/\s+\d+(er|e) Arrondissement$/i, '')
        : null;
    },
    now,
  ).catch(() => null);
}
const titleCase = (value: string) =>
  value.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
export type RailResult =
  | { status: 'served'; routes: TrainRoute[] }
  | { status: 'connection'; via: string; routes: TrainRoute[] }
  | { status: 'none'; reason: string };

/** Long-distance trains from the home city to the stations nearest the venue. */
export async function trainRoutes(
  home: Coordinates,
  venue: Coordinates,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<RailResult> {
  const [origins, nearVenue] = await Promise.all([
    stationsNear(home, ORIGIN_STATION_RADIUS_KM, fetcher, now),
    stationsNear(venue, VENUE_STATION_RADIUS_KM, fetcher, now),
  ]);
  if (!origins.length || !nearVenue.length)
    return { status: 'none', reason: 'Showbound covers trains within France for now.' };
  const homeUics = new Set(origins.map((s) => s.uic));
  const venueSide = nearVenue.filter((s) => !homeUics.has(s.uic));
  if (!venueSide.length)
    return { status: 'none', reason: 'The concert is in your home area: no train needed.' };
  const rows = await serviceRows(
    origins.map((s) => s.uic),
    venueSide.map((s) => s.uic),
    fetcher,
    now,
  );
  // Served arrival stations: the nearest to the venue, plus any other within 15 km of it
  // (Amnéville: TGV to Thionville, OUIGO to Metz).
  const byUic = new Map(venueSide.map((s) => [s.uic, s]));
  const served = [...new Set(rows.map((r) => r.uic))]
    .map((uic) => byUic.get(uic))
    .filter((s): s is Station => !!s)
    .sort((a, b) => distanceKm(a, venue) - distanceKm(b, venue));
  if (served.length)
    return { status: 'served', routes: await arrivalRoutes(served, rows, venue, fetcher, now) };
  const hub = await viaHub(home, venue, venueSide, homeUics, fetcher, now);
  if (hub) return hub;
  return {
    status: 'none',
    reason: 'No TGV, OUIGO or Intercités train runs to this area. Regional TER is not covered yet.',
  };
}

/** The served stations nearest the venue (two at most), as routes. */
async function arrivalRoutes(
  served: Station[],
  rows: ServiceRow[],
  venue: Coordinates,
  fetcher: Fetcher,
  now: number,
): Promise<TrainRoute[]> {
  const nearest = distanceKm(served[0], venue);
  const arrivals = served.filter((s) => distanceKm(s, venue) <= nearest + 15).slice(0, 2);
  const towns = await Promise.all(arrivals.map((a) => communeName(a.insee, fetcher, now)));
  return arrivals.map((arrival, index) => ({
    station: titleCase(arrival.name),
    stationCity: towns[index],
    carriers: [...new Set(rows.filter((r) => r.uic === arrival.uic).map((r) => r.carrier))].sort(),
    lastMileKm: Math.round(distanceKm(arrival, venue) * 10) / 10,
    bookingUrl: null,
  }));
}

/**
 * No direct long-distance train: the nearest hub to home that has one to the venue. Only hubs
 * on the way count (closer to the concert than home is, at most a third longer overall), so the
 * first leg is short and the change makes sense.
 */
async function viaHub(
  home: Coordinates,
  venue: Coordinates,
  venueSide: Station[],
  homeUics: Set<string>,
  fetcher: Fetcher,
  now: number,
): Promise<RailResult | null> {
  const direct = distanceKm(home, venue);
  const candidates = HUBS.filter(
    (hub) =>
      distanceKm(hub, venue) < direct &&
      distanceKm(home, hub) + distanceKm(hub, venue) <= direct * DETOUR,
  )
    .sort((a, b) => distanceKm(home, a) - distanceKm(home, b))
    .slice(0, HUBS_TRIED);
  const answers = await Promise.all(
    candidates.map(async (hub) => {
      const stations = (await stationsNear(hub, HUB_RADIUS_KM, fetcher, now)).filter(
        (s) => !homeUics.has(s.uic) && !venueSide.some((v) => v.uic === s.uic),
      );
      if (!stations.length) return null;
      const rows = await serviceRows(
        stations.map((s) => s.uic),
        venueSide.map((s) => s.uic),
        fetcher,
        now,
      );
      const byUic = new Map(venueSide.map((s) => [s.uic, s]));
      const served = [...new Set(rows.map((r) => r.uic))]
        .map((uic) => byUic.get(uic))
        .filter((s): s is Station => !!s)
        .sort((a, b) => distanceKm(a, venue) - distanceKm(b, venue));
      return served.length ? { hub, served, rows } : null;
    }),
  );
  const found = answers.find((answer) => answer !== null);
  if (!found) return null;
  return {
    status: 'connection',
    via: found.hub.name,
    routes: await arrivalRoutes(found.served, found.rows, venue, fetcher, now),
  };
}
