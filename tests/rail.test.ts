import { beforeEach, expect, it } from 'vitest';
import { clearRailCache, communeName, trainRoutes } from '../src/server/providers/rail';

const paris = { latitude: 48.8566, longitude: 2.3522 };
const galaxie = { latitude: 49.2603, longitude: 6.1062 };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function fetcher(handler: (url: URL) => unknown) {
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
  if (url.pathname.endsWith('/tarifs-tgv-inoui-ouigo/records'))
    // Paris → venue side: OUIGO to Metz. Venue side → Paris: TGV INOUI from Thionville and Metz.
    return url.searchParams.get('where')!.startsWith('gare_origine_code_uic in ("87113001")')
      ? { results: [{ transporteur: 'OUIGO', uic: '87192039' }] }
      : {
          results: [
            { transporteur: 'TGV INOUI', uic: '87191007' },
            { transporteur: 'TGV INOUI', uic: '87192039' },
          ],
        };
  if (url.pathname.endsWith('/tarifs-intercites/records')) return { results: [] };
  throw new Error(`unexpected ${url}`);
}
beforeEach(() => clearRailCache());

it('lists the trains that run to each nearby station, both published directions, no prices', async () => {
  const { fn, calls } = fetcher(sncf);
  expect(await trainRoutes(paris, galaxie, fn)).toEqual({
    status: 'served',
    routes: [
      {
        station: 'Thionville',
        stationCity: 'Thionville',
        carriers: ['TGV INOUI'],
        lastMileKm: 11.4,
        bookingUrl: null,
      },
      {
        station: 'Metz',
        stationCity: 'Metz',
        carriers: ['OUIGO', 'TGV INOUI'],
        lastMileKm: 17.5,
        bookingUrl: null,
      },
    ],
  });
  // Nothing about prices is requested any more.
  const tables = calls.filter((c) => c.pathname.includes('tarifs'));
  expect(tables.every((c) => !c.searchParams.get('select')!.includes('prix'))).toBe(true);
  // Cached: a second plan for the same route does not call SNCF again.
  const before = calls.length;
  await trainRoutes(paris, galaxie, fn);
  expect(calls.length).toBe(before);
});

it('says so when no long-distance train runs there, and outside France', async () => {
  const { fn } = fetcher((url) =>
    url.pathname.includes('gares-de-voyageurs') ? sncf(url) : { results: [] },
  );
  expect((await trainRoutes(paris, galaxie, fn)).status).toBe('none');
  clearRailCache();
  const { fn: abroad } = fetcher(() => ({ results: [] }));
  expect(await trainRoutes(paris, { latitude: 50.85, longitude: 4.35 }, abroad)).toEqual({
    status: 'none',
    reason: 'Showbound covers trains within France for now.',
  });
});

it('names the town of a station, folding city arrondissements into the city', async () => {
  const { fn } = fetcher((url) => ({
    nom: url.pathname.endsWith('69383') ? 'Lyon 3e Arrondissement' : 'Paris 1er Arrondissement',
  }));
  expect(await communeName('69383', fn)).toBe('Lyon');
  expect(await communeName('75101', fn)).toBe('Paris');
  expect(await communeName(null, fn)).toBeNull();
});

it('no direct train from a small town: change at the hub that has one (Auxerre → Paris → Brest)', async () => {
  const auxerre = { latitude: 47.7982, longitude: 3.5673 };
  const brest = { latitude: 48.3904, longitude: -4.4861 };
  const { fn } = fetcher((url) => {
    if (url.hostname === 'geo.api.gouv.fr') return { nom: 'Brest' };
    const where = url.searchParams.get('where')!;
    if (url.pathname.endsWith('/gares-de-voyageurs/records')) {
      if (where.includes('3.5673'))
        return { results: [station('Auxerre', '87683003', 47.7936, 3.5813)] };
      if (where.includes('-4.4861'))
        return { results: [station('Brest', '87474098', 48.3879, -4.4795, '29019')] };
      if (where.includes('2.3522'))
        return { results: [station('Paris Montparnasse', '87391003', 48.8412, 2.3209)] };
      return { results: [] };
    }
    if (url.pathname.endsWith('/tarifs-tgv-inoui-ouigo/records'))
      // Only Paris has a TGV to Brest; Auxerre has none to anywhere listed.
      return where.includes('87391003') && where.includes('87474098')
        ? { results: [{ transporteur: 'TGV INOUI', uic: '87474098' }] }
        : { results: [] };
    return { results: [] };
  });
  expect(await trainRoutes(auxerre, brest, fn)).toEqual({
    status: 'connection',
    via: 'Paris',
    routes: [
      {
        station: 'Brest',
        stationCity: 'Brest',
        carriers: ['TGV INOUI'],
        lastMileKm: 0.6,
        bookingUrl: null,
      },
    ],
  });
});
