import { afterEach, expect, it, vi } from 'vitest';
import { omioPartnerId, omioRouteUrl, omioSearchUrl } from '../src/server/providers/omio';
import { safeOmioRedirect, type TravelSearch } from '../src/domain/travel-planning';

// Synthetic ID, used only for deterministic URL tests. No request leaves this test.
const partner = '987654321234';
const search: TravelSearch = {
  departure: 'Saint-Étienne & Lyon + 50%',
  destination: 'München, DE',
  departureDate: '2027-11-15',
  returnDate: '2027-11-16',
  travelMode: 'TRAIN',
  locale: 'fr',
};
afterEach(() => vi.unstubAllEnvs());

it('uses the official Impact campaign and encodes both nested URL layers reversibly', () => {
  const result = omioSearchUrl(search, partner)!;
  const outer = new URL(result);
  expect(outer.origin + outer.pathname).toBe(`https://omio.sjv.io/c/${partner}/4057579/7385`);
  expect([...outer.searchParams.keys()]).toEqual(['u']);
  const inner = new URL(outer.searchParams.get('u')!);
  expect(inner.origin + inner.pathname).toBe(
    'https://www.omio.com/links/626fa8a9-f982-43d0-ace9-9a13f6b14612',
  );
  expect(Object.fromEntries(inner.searchParams)).toEqual({
    departurePosTerm: search.departure,
    arrivalPosTerm: search.destination,
    departureDate: search.departureDate,
    returnDate: search.returnDate,
    travelMode: 'TRAIN',
    locale: 'fr',
    currency: 'EUR',
  });
  expect(result).toContain('%25C3%2589');
  expect(result).toContain('%2526');
  expect(safeOmioRedirect(result)).toBe(true);
});

it('preserves international locations and omits optional one-way parameters', () => {
  const link = omioSearchUrl(
    { ...search, departure: '東京', destination: '大阪', returnDate: '', travelMode: undefined },
    partner,
  )!;
  const inner = new URL(new URL(link).searchParams.get('u')!);
  expect(inner.searchParams.get('departurePosTerm')).toBe('東京');
  expect(inner.searchParams.has('returnDate')).toBe(false);
  expect(inner.searchParams.has('travelMode')).toBe(false);
});

it.each([undefined, '', '0', '-4', 'placeholder', '123/evil', '1?u=evil'])(
  'fails closed for partner ID %s',
  (id) => {
    vi.stubEnv('OMIO_ENABLED', 'true');
    vi.stubEnv('OMIO_PARTNER_ID', id);
    expect(omioPartnerId()).toBeNull();
    expect(omioSearchUrl(search)).toBeNull();
  },
);

it('requires explicit activation and never falls back to legacy or untracked URLs', () => {
  vi.stubEnv('OMIO_ENABLED', 'false');
  vi.stubEnv('OMIO_PARTNER_ID', partner);
  vi.stubEnv('OMIO_AFFILIATE_URL', `https://omio.sjv.io/c/${partner}/409973/7385`);
  expect(omioSearchUrl(search)).toBeNull();
  expect(omioRouteUrl('bus', 'Paris', 'Lyon', '2027-11-15')).toBeNull();
  vi.stubEnv('OMIO_ENABLED', 'true');
  expect(safeOmioRedirect(omioRouteUrl('bus', 'Paris', 'Lyon', '2027-11-15')!)).toBe(true);
});

it.each([
  { departure: '' },
  { destination: 'Unknown' },
  { departureDate: '2027-02-29' },
  { returnDate: '2027-11-14' },
  { travelMode: 'CAR' },
  { locale: 'javascript:' },
  { departure: 'Paris', destination: 'paris' },
  { departure: 'Paris\nFR' },
])('rejects invalid search %j', (input) => {
  expect(omioSearchUrl({ ...search, ...input } as TravelSearch, partner)).toBeNull();
});

it('rejects unsafe outer URLs, arbitrary destinations, duplicate parameters and extra redirects', () => {
  const good = omioSearchUrl(search, partner)!;
  for (const bad of [
    'javascript:alert(1)',
    '//omio.sjv.io/c/1/2/3',
    good.replace('https:', 'http:'),
    good.replace('omio.sjv.io', 'omio.sjv.io.evil.test'),
    good.replace('omio.sjv.io', 'user@omio.sjv.io'),
    good + '#fragment',
    good + '&u=https://evil.test',
    good + '&redirect=https://evil.test',
  ]) {
    expect(safeOmioRedirect(bad)).toBe(false);
  }
  const outer = new URL(good);
  outer.searchParams.set('u', 'https://evil.test');
  expect(safeOmioRedirect(outer.toString())).toBe(false);
  const inner = new URL(new URL(good).searchParams.get('u')!);
  inner.searchParams.append('arrivalPosTerm', 'Other');
  outer.searchParams.set('u', inner.toString());
  expect(safeOmioRedirect(outer.toString())).toBe(false);
});
