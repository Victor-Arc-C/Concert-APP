import { beforeEach, expect, it } from 'vitest';
import { carComparison, clearFareCache, trainComparison } from '../src/server/providers/fares';

const paris = { latitude: 48.8566, longitude: 2.3522 };
const galaxie = { latitude: 49.2603, longitude: 6.1062 };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

type Handler = (url: URL) => unknown;
function fetcher(handler: Handler) {
  const calls: URL[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    return json(handler(url));
  }) as typeof fetch;
  return { fn, calls };
}
const station = (nom: string, uic: string, lat: number, lon: number, codeinsee?: string) => ({
  nom,
  codes_uic: uic,
  codeinsee,
  position_geographique: { lat, lon },
});
function sncf(url: URL) {
  if (url.hostname === 'geo.api.gouv.fr')
    return { nom: { '57463': 'Metz', '57672': 'Thionville' }[url.pathname.split('/').pop()!] };
  if (url.pathname.endsWith('/gares-de-voyageurs/records'))
    return url.searchParams.get('where')!.includes('2.3522')
      ? { results: [station('Paris Est', '87113001', 48.876, 2.359)] }
      : {
          results: [
            station('Thionville', '87191007', 49.3539, 6.1695, '57672'),
            station('Metz', '87192039', 49.1095, 6.1766, '57463'),
            station('Hagondange', '87191114', 49.2535, 6.1645),
          ],
        };
  if (url.pathname.endsWith('/tarifs-tgv-inoui-ouigo/records')) {
    const where = url.searchParams.get('where')!;
    // Paris → venue side: OUIGO to Metz. Venue side → Paris: TGV INOUI from Thionville.
    return where.startsWith('classe="2" and gare_origine_code_uic in ("87113001")')
      ? {
          results: [
            {
              transporteur: 'OUIGO',
              station: 'METZ VILLE',
              uic: '87192039',
              profil_tarifaire: 'Tarif Normal',
              lo: 16,
              hi: 79,
            },
          ],
        }
      : {
          results: [
            {
              transporteur: 'TGV INOUI',
              station: 'THIONVILLE',
              uic: '87191007',
              profil_tarifaire: 'Tarif Normal',
              lo: 20.5,
              hi: 95,
            },
            {
              transporteur: 'TGV INOUI',
              station: 'THIONVILLE',
              uic: '87191007',
              profil_tarifaire: 'Tarif Avantage',
              lo: 14.3,
              hi: 66,
            },
            {
              transporteur: 'TGV INOUI',
              station: 'THIONVILLE',
              uic: '87191007',
              profil_tarifaire: 'Tarif Réglementé',
              lo: 70,
              hi: 88,
            },
          ],
        };
  }
  if (url.pathname.endsWith('/tarifs-intercites/records')) return { results: [] };
  if (url.pathname.endsWith('/tarifs-tgv-inoui-ouigo'))
    return { metas: { default: { modified: '2026-03-17T09:50:01+00:00' } } };
  throw new Error(`unexpected ${url}`);
}
beforeEach(() => clearFareCache());

it('prices the train to each nearby station, both published directions, without regulated fares', async () => {
  const { fn, calls } = fetcher(sncf);
  const train = await trainComparison(paris, galaxie, fn);
  expect(train).toEqual({
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
        station: 'Thionville',
        stationCity: 'Thionville',
        bookingUrl: null,
        lastMileKm: 11.4,
        standard: { min: 20.5, max: 95 },
        avantage: { min: 14.3, max: 66 },
      },
    ],
    source: 'SNCF Voyageurs open data (ODbL)',
    dataUpdatedAt: '2026-03-17T09:50:01.000Z',
  });
  // Second-class only, and station codes are digits only inside the query.
  const fares = calls.filter(
    (c) => c.pathname.endsWith('/records') && c.pathname.includes('tarifs'),
  );
  expect(fares.every((c) => c.searchParams.get('where')!.startsWith('classe="2"'))).toBe(true);
  // Cached: a second plan for the same route does not call SNCF again.
  const before = calls.length;
  await trainComparison(paris, galaxie, fn);
  expect(calls.length).toBe(before);
});

it('says so when no long-distance fare exists instead of guessing', async () => {
  const { fn } = fetcher((url) =>
    url.pathname.includes('gares-de-voyageurs') ? sncf(url) : { results: [] },
  );
  const train = await trainComparison(paris, galaxie, fn);
  expect(train.status).toBe('unpriced');
  const { fn: abroad } = fetcher(() => ({ results: [] }));
  clearFareCache();
  expect(await trainComparison(paris, { latitude: 50.85, longitude: 4.35 }, abroad)).toEqual({
    status: 'unpriced',
    reason: 'SNCF publishes fares for stations in France only.',
  });
});

it('estimates fuel from the official average price and refuses an implausible feed', async () => {
  const { fn } = fetcher(() => ({ results: [{ price: 2.159, stations: 9796 }] }));
  const car = await carComparison(paris, galaxie, fn, Date.parse('2026-10-07T12:00:00Z'));
  expect(car).toMatchObject({
    status: 'estimated',
    roadKm: 360,
    litres: 23.4,
    pricePerLitre: 2.159,
    fuelCost: 51,
    priceObservedAt: '2026-10-07T12:00:00.000Z',
  });
  clearFareCache();
  const { fn: broken } = fetcher(() => ({ results: [{ price: 0.01 }] }));
  expect(await carComparison(paris, galaxie, broken)).toEqual({
    status: 'unavailable',
    reason: 'Fuel prices are unavailable right now.',
  });
});

it('never prices travel for fictional, cancelled or postponed concerts', async () => {
  const { transportComparison } = await import('../src/server/transport-comparison');
  const { fn, calls } = fetcher(sncf);
  for (const event of [
    { provider: 'sample', status: 'onsale' },
    { provider: 'ticketmaster', status: 'cancelled' },
    { provider: 'ticketmaster', status: 'postponed' },
  ])
    expect(await transportComparison(event as never, 'Paris', fn)).toBeNull();
  expect(calls).toHaveLength(0);
});

it('names the town of a station, folding city arrondissements into the city', async () => {
  const { communeName } = await import('../src/server/providers/fares');
  const { fn } = fetcher((url) => ({
    nom: url.pathname.endsWith('69383') ? 'Lyon 3e Arrondissement' : 'Paris 1er Arrondissement',
  }));
  expect(await communeName('69383', fn)).toBe('Lyon');
  expect(await communeName('75101', fn)).toBe('Paris');
  expect(await communeName(null, fn)).toBeNull();
});
