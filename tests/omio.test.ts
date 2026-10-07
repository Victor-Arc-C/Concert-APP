import { afterEach, expect, it, vi } from 'vitest';
import { omioRouteUrl, omioSlug } from '../src/server/providers/omio';
import { parseEnvironment } from '../src/server/env';

afterEach(() => vi.unstubAllEnvs());
const affiliate = 'https://omio.sjv.io/c/7922007/409973/7385';

it('builds Omio route slugs like omio.fr does', () => {
  expect(omioSlug('Saint-Étienne')).toBe('saint-etienne');
  expect(omioSlug('Clermont-Ferrand')).toBe('clermont-ferrand');
  expect(omioSlug(' Aix en Provence ')).toBe('aix-en-provence');
});

it('wraps the route page in the Impact tracking link with non-personal sub IDs', () => {
  const url = new URL(omioRouteUrl('trains', 'Paris', 'Metz', affiliate)!);
  expect(`${url.origin}${url.pathname}`).toBe(affiliate);
  expect(url.searchParams.get('u')).toBe('https://www.omio.fr/trains/paris/metz');
  expect(url.searchParams.get('subId1')).toBe('encore-trip');
  expect(url.searchParams.get('subId2')).toBe('trains');
  // Without the affiliate link, still a useful route page, just unattributed.
  expect(omioRouteUrl('bus', 'Paris', 'Lyon', null)).toBe('https://www.omio.fr/bus/paris/lyon');
  // No route to yourself.
  expect(omioRouteUrl('bus', 'Paris', 'paris', affiliate)).toBeNull();
});

it('accepts only the long Impact link for Omio', () => {
  expect(parseEnvironment({ OMIO_AFFILIATE_URL: affiliate }).OMIO_AFFILIATE_URL).toBe(affiliate);
  expect(() =>
    parseEnvironment({ OMIO_AFFILIATE_URL: 'https://omio.sjv.io/AgXr0j?x=1' }),
  ).toThrow();
  expect(() => parseEnvironment({ OMIO_AFFILIATE_URL: 'https://evil.example/c/1/2/3' })).toThrow();
  expect(() => parseEnvironment({ OMIO_AFFILIATE_URL: 'http://omio.sjv.io/c/1/2/3' })).toThrow();
});
