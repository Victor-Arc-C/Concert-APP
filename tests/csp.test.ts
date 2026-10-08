import { expect, it } from 'vitest';
import config, { artistImageHosts, spotifyImageHosts } from '../next.config';
import { attractionImage } from '../src/domain/artist-image';

it('allows only the Spotify and Ticketmaster image hosts used for artist photos', async () => {
  const headers = await config.headers?.();
  const csp = headers?.[0]?.headers.find((header) => header.key === 'Content-Security-Policy');
  expect(spotifyImageHosts).toEqual(['https://i.scdn.co']);
  expect(artistImageHosts).toEqual(['https://i.scdn.co', 'https://s1.ticketm.net']);
  expect(csp?.value).toContain("img-src 'self' data: https://i.scdn.co https://s1.ticketm.net;");
  expect(csp?.value).not.toContain('img-src *');
});

it('picks a real Ticketmaster attraction photo from its own host, never the generic fallback', () => {
  const host = 'https://s1.ticketm.net/dam/a/123';
  expect(
    attractionImage([
      { url: `${host}/fallback.jpg`, ratio: '4_3', width: 640, fallback: true },
      { url: `${host}/wide.jpg`, ratio: '16_9', width: 640, fallback: false },
      { url: `${host}/big.jpg`, ratio: '4_3', width: 1024, fallback: false },
      { url: `${host}/good.jpg`, ratio: '4_3', width: 305, fallback: false },
      { url: 'https://evil.example/x.jpg', ratio: '4_3', width: 640, fallback: false },
    ]),
  ).toBe(`${host}/good.jpg`);
  expect(attractionImage([{ url: 'http://s1.ticketm.net/x.jpg', ratio: '4_3' }])).toBeNull();
  expect(attractionImage(undefined)).toBeNull();
  expect(attractionImage([{ url: `${host}/only.jpg`, fallback: true }])).toBeNull();
});

it('allows Travelpayouts Drive on the public home page only', async () => {
  const headers = (await config.headers?.()) ?? [];
  const csp = (source: string) =>
    headers
      .filter((rule) => rule.source === source || rule.source === '/:path*')
      .flatMap((rule) => rule.headers)
      .filter((header) => header.key === 'Content-Security-Policy')
      .at(-1)?.value;
  expect(csp('/')).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://emrld.ltd");
  expect(csp('/')).toContain("connect-src 'self' https://emrld.ltd");
  // The app (accounts, trips, alerts) keeps the strict policy.
  expect(headers[0].headers.find((h) => h.key === 'Content-Security-Policy')?.value).not.toContain(
    'emrld',
  );
  expect(headers.findIndex((rule) => rule.source === '/')).toBeGreaterThan(0);
});
