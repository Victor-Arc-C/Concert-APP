// Published fares and fuel prices for the transport comparison on a trip plan.
// Sources are official open data, read through their public APIs:
// - SNCF Voyageurs "Tarifs TGV INOUI et OUIGO" and "Tarifs Intercités" (ODbL): the price band
//   per route and fare profile. Bands, not live quotes: the seller sets the actual price.
// - SNCF "Gares de voyageurs": station positions, to find stations near the home city and venue.
// - Ministère de l'Économie "Prix des carburants en France – flux instantané": pump prices.
import type { Coordinates, FareBand, TrainFare, TransportComparison } from '@/domain/trip-types';
import { providerJson } from './http';
import { distanceKm } from './liteapi';

const SNCF = 'https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets';
const FUEL =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
/** Straight-line to road distance; French road detour indexes are around 1.2 to 1.4. */
export const ROAD_FACTOR = 1.3;
/** Average petrol car consumption used for the estimate (litres per 100 km). */
export const CONSUMPTION_L_PER_100KM = 6.5;
const ORIGIN_STATION_RADIUS_KM = 15;
const VENUE_STATION_RADIUS_KM = 40;
const DAY_MS = 86400000;

type Fetcher = typeof fetch;
type Station = { name: string; uic: string; latitude: number; longitude: number };
type FareRow = {
  carrier: string;
  station: string;
  uic: string;
  profile: string;
  min: number;
  max: number;
};

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttl: number, load: () => Promise<T>, now: number) {
  const hit = cache.get(key);
  if (hit && now - hit.at < ttl) return hit.value as T;
  const value = await load();
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: now, value });
  return value;
}
export function clearFareCache() {
  cache.clear();
}

function records(url: string, params: Record<string, string>, fetcher: Fetcher) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return providerJson(target.toString(), {}, fetcher) as Promise<{
    results?: Record<string, unknown>[];
  }>;
}
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
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
              latitude: position.lat,
              longitude: position.lon as number,
            });
      }
      return stations;
    },
    now,
  );
}

/** Fare bands between two station sets, both directions, grouped by carrier and arrival side. */
async function fareRows(
  origins: string[],
  destinations: string[],
  fetcher: Fetcher,
  now: number,
): Promise<FareRow[]> {
  const o = quoted(origins),
    d = quoted(destinations);
  return cached(
    `fares:${o}|${d}`,
    DAY_MS / 2,
    async () => {
      const tgv = (from: string, to: string, side: 'origine' | 'destination') =>
        records(
          `${SNCF}/tarifs-tgv-inoui-ouigo/records`,
          {
            select: `transporteur, gare_${side} as station, gare_${side}_code_uic as uic, profil_tarifaire, min(prix_minimum) as lo, max(prix_maximum) as hi`,
            where: `classe="2" and gare_origine_code_uic in (${from}) and gare_destination_code_uic in (${to})`,
            group_by: `transporteur, gare_${side}, gare_${side}_code_uic, profil_tarifaire`,
            limit: '100',
          },
          fetcher,
        );
      const intercites = (from: string, to: string, side: 'origine' | 'destination') =>
        records(
          `${SNCF}/tarifs-intercites/records`,
          {
            select: `transporteur, ${side} as station, ${side}_uic8 as uic, profil_tarifaire, min(prix_min) as lo, max(prix_max) as hi`,
            where: `classe="2" and type_place="assise" and origine_uic8 in (${from}) and destination_uic8 in (${to})`,
            group_by: `transporteur, ${side}, ${side}_uic8, profil_tarifaire`,
            limit: '100',
          },
          fetcher,
        );
      // Rows name the station on the concert side, whichever direction SNCF published.
      const pages = await Promise.all([
        tgv(o, d, 'destination'),
        tgv(d, o, 'origine'),
        intercites(o, d, 'destination'),
        intercites(d, o, 'origine'),
      ]);
      const rows: FareRow[] = [];
      for (const row of pages.flatMap((page) => page.results ?? [])) {
        const min = number(row.lo),
          max = number(row.hi);
        if (min === null || max === null || typeof row.transporteur !== 'string') continue;
        rows.push({
          carrier: row.transporteur.startsWith('Intercit') ? 'Intercités' : row.transporteur,
          station: String(row.station),
          uic: String(row.uic),
          profile: String(row.profil_tarifaire),
          min,
          max: Math.max(min, max),
        });
      }
      return rows;
    },
    now,
  );
}

const titleCase = (value: string) =>
  value.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
const merge = (band: FareBand | null, min: number, max: number): FareBand =>
  band ? { min: Math.min(band.min, min), max: Math.max(band.max, max) } : { min, max };

/** When SNCF last updated the TGV fare table, so the page can say how current the bands are. */
async function faresUpdatedAt(fetcher: Fetcher, now: number) {
  return cached(
    'fares:modified',
    DAY_MS,
    async () => {
      const meta = (await providerJson(`${SNCF}/tarifs-tgv-inoui-ouigo`, {}, fetcher)) as {
        metas?: { default?: { modified?: unknown } };
      };
      const modified = meta.metas?.default?.modified;
      return typeof modified === 'string' && Number.isFinite(Date.parse(modified))
        ? new Date(modified).toISOString()
        : null;
    },
    now,
  ).catch(() => null);
}

export async function trainComparison(
  home: Coordinates,
  venue: Coordinates,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<TransportComparison['train']> {
  const [origins, nearVenue] = await Promise.all([
    stationsNear(home, ORIGIN_STATION_RADIUS_KM, fetcher, now),
    stationsNear(venue, VENUE_STATION_RADIUS_KM, fetcher, now),
  ]);
  if (!origins.length || !nearVenue.length)
    return {
      status: 'unpriced',
      reason: 'SNCF publishes fares for stations in France only.',
    };
  const homeUics = new Set(origins.map((s) => s.uic));
  const venueSide = nearVenue.filter((s) => !homeUics.has(s.uic));
  if (!venueSide.length)
    return { status: 'unpriced', reason: 'The concert is in your home area: no train needed.' };
  const rows = await fareRows(
    origins.map((s) => s.uic),
    venueSide.map((s) => s.uic),
    fetcher,
    now,
  );
  // Arrival stations with published long-distance fares: the nearest to the venue, plus any
  // other within 15 km of it (Amnéville: TGV to Thionville, OUIGO to Metz).
  const byUic = new Map(venueSide.map((s) => [s.uic, s]));
  const served = [...new Set(rows.map((r) => r.uic))]
    .map((uic) => byUic.get(uic))
    .filter((s): s is Station => !!s)
    .sort((a, b) => distanceKm(a, venue) - distanceKm(b, venue));
  if (!served.length)
    return {
      status: 'unpriced',
      reason:
        'No TGV, OUIGO or Intercités fares are published for this route. Regional TER trains are not covered yet.',
    };
  const nearest = distanceKm(served[0], venue);
  const arrivals = served.filter((s) => distanceKm(s, venue) <= nearest + 15).slice(0, 2);
  const fares = new Map<string, TrainFare>();
  for (const arrival of arrivals)
    for (const row of rows.filter((r) => r.uic === arrival.uic)) {
      const key = `${row.carrier}|${arrival.uic}`;
      const fare = fares.get(key) ?? {
        carrier: row.carrier,
        station: titleCase(arrival.name),
        lastMileKm: Math.round(distanceKm(arrival, venue) * 10) / 10,
        standard: null,
        avantage: null,
      };
      if (row.profile === 'Tarif Normal') fare.standard = merge(fare.standard, row.min, row.max);
      else if (row.profile === 'Tarif Avantage')
        fare.avantage = merge(fare.avantage, row.min, row.max);
      else continue;
      fares.set(key, fare);
    }
  return {
    status: 'priced',
    fares: [...fares.values()].sort(
      (a, b) => (a.standard?.min ?? Infinity) - (b.standard?.min ?? Infinity),
    ),
    source: 'SNCF Voyageurs open data (ODbL)',
    dataUpdatedAt: await faresUpdatedAt(fetcher, now),
  };
}

/** National average E10 pump price, from today's official price feed. */
export async function fuelPrice(fetcher: Fetcher = fetch, now = Date.now()) {
  return cached(
    'fuel:e10',
    DAY_MS / 4,
    async () => {
      const page = await records(
        FUEL,
        { select: 'avg(e10_prix) as price, count(*) as stations', limit: '1' },
        fetcher,
      );
      const price = number(page.results?.[0]?.price);
      // A national average outside this band means the feed is broken, not that fuel is free.
      if (price === null || price < 0.8 || price > 4) return null;
      return {
        pricePerLitre: Math.round(price * 1000) / 1000,
        observedAt: new Date(now).toISOString(),
      };
    },
    now,
  );
}

export async function carComparison(
  home: Coordinates,
  venue: Coordinates,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<TransportComparison['car']> {
  const fuel = await fuelPrice(fetcher, now);
  if (!fuel) return { status: 'unavailable', reason: 'Fuel prices are unavailable right now.' };
  const roadKm = Math.round(distanceKm(home, venue) * ROAD_FACTOR);
  if (roadKm < 5) return { status: 'unavailable', reason: 'The venue is in your home area.' };
  const litres = Math.round(((roadKm * CONSUMPTION_L_PER_100KM) / 100) * 10) / 10;
  return {
    status: 'estimated',
    roadKm,
    litres,
    pricePerLitre: fuel.pricePerLitre,
    fuelCost: Math.round(litres * fuel.pricePerLitre),
    consumptionPer100Km: CONSUMPTION_L_PER_100KM,
    priceObservedAt: fuel.observedAt,
    source: 'Prix des carburants (French government open data), national E10 average',
  };
}
