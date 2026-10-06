import { expect, it } from 'vitest';
import config, { spotifyImageHosts } from '../next.config';

it('allows only the Spotify CDN host used for artist images', async () => {
  const headers = await config.headers?.();
  const csp = headers?.[0]?.headers.find((header) => header.key === 'Content-Security-Policy');
  expect(spotifyImageHosts).toEqual(['https://i.scdn.co']);
  expect(csp?.value).toContain("img-src 'self' data: https://i.scdn.co");
  expect(csp?.value).not.toContain('img-src *');
});
