import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { beginSpotify, finishSpotify, spotifyArtists } from '../src/server/providers/spotify';
import { encrypt, decrypt } from '../src/server/security';
const db = vi.mocked(query);
beforeEach(() => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('APP_URL', 'http://127.0.0.1:3000');
  vi.stubEnv('SPOTIFY_APPROVED', 'true');
  vi.stubEnv('SPOTIFY_CLIENT_ID', 'fixture-client');
  vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'fixture-secret');
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  db.mockReset();
});
const json = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
it('requests only top-artists scope with exact loopback callback, random state and encrypted PKCE', async () => {
  db.mockResolvedValue([]);
  const url = new URL(await beginSpotify('user'));
  expect(url.origin).toBe('https://accounts.spotify.com');
  expect(url.searchParams.get('scope')).toBe('user-top-read');
  expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:3000/api/spotify/callback');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('state')).toHaveLength(43);
  const stored = db.mock.calls[0][1]!;
  expect(decrypt(String(stored[2]))).toHaveLength(64);
  expect(stored[2]).not.toBe(decrypt(String(stored[2])));
});
it('exchanges a single-use state and stores only encrypted tokens', async () => {
  db.mockResolvedValueOnce([{ verifier: encrypt('fixture-verifier') }]).mockResolvedValue([]);
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600 }),
    );
  await finishSpotify('user', 'state', 'fixture-code');
  expect(db.mock.calls[0][0]).toContain('DELETE FROM oauth_attempts');
  expect(db.mock.calls[0][1]).toEqual(['state', 'user']);
  const params = new URLSearchParams(String(fetcher.mock.calls[0][1]?.body));
  expect(params.get('redirect_uri')).toBe('http://127.0.0.1:3000/api/spotify/callback');
  expect(params.get('code_verifier')).toBe('fixture-verifier');
  const stored = db.mock.calls[1][1]!;
  expect(decrypt(String(stored[1]))).toBe('fixture-access');
  expect(decrypt(String(stored[2]))).toBe('fixture-refresh');
  expect(stored).not.toContain('fixture-access');
  await expect(finishSpotify('user', 'state', 'fixture-code')).rejects.toMatchObject({
    status: 400,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('refreshes expired tokens, preserves the existing refresh token when not rotated and imports transiently', async () => {
  const refresh = encrypt('fixture-refresh');
  db.mockResolvedValueOnce([
    { access_token: encrypt('expired'), refresh_token: refresh, expires_at: new Date(0) },
  ]).mockResolvedValue([]);
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ access_token: 'fresh', expires_in: 3600 }))
    .mockResolvedValueOnce(
      json({
        items: [
          {
            id: 'artist-id',
            name: 'Artist',
            external_urls: { spotify: 'https://open.spotify.com/artist/artist-id' },
          },
        ],
      }),
    );
  expect(await spotifyArtists('user')).toEqual([
    { id: 'artist-id', name: 'Artist', url: 'https://open.spotify.com/artist/artist-id' },
  ]);
  expect(db.mock.calls[1][1]?.[1]).toBe(refresh);
  expect(fetcher.mock.calls[1][1]?.headers).toEqual({ Authorization: 'Bearer fresh' });
  expect(
    db.mock.calls.some(([sql]) =>
      /INSERT INTO (artists|affinities|artist_provider_records)/.test(sql),
    ),
  ).toBe(false);
});
it('retries one expired access token and encrypts a rotated refresh token', async () => {
  db.mockResolvedValueOnce([
    {
      access_token: encrypt('old'),
      refresh_token: encrypt('refresh'),
      expires_at: new Date(Date.now() + 3600000),
    },
  ]).mockResolvedValue([]);
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({}, 401))
    .mockResolvedValueOnce(
      json({ access_token: 'new', refresh_token: 'rotated', expires_in: 3600 }),
    )
    .mockResolvedValueOnce(json({ items: [] }));
  expect(await spotifyArtists('user')).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(decrypt(String(db.mock.calls[1][1]?.[1]))).toBe('rotated');
});
it.each([403, 429])(
  'preserves permission/quota failure %s without retry loops or token writes',
  async (status) => {
    db.mockResolvedValueOnce([
      {
        access_token: encrypt('old'),
        refresh_token: encrypt('refresh'),
        expires_at: new Date(Date.now() + 3600000),
      },
    ]);
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({}, status, { 'Retry-After': '90' }));
    await expect(spotifyArtists('user')).rejects.toMatchObject({ status, retryAfter: 90 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(db).toHaveBeenCalledTimes(1);
  },
);
it('keeps manual-first disabled state without network access', async () => {
  vi.stubEnv('SPOTIFY_APPROVED', 'false');
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await expect(beginSpotify('user')).rejects.toThrow('Choose your artists manually');
  expect(fetcher).not.toHaveBeenCalled();
});
it('rejects missing top-artist consent before storing tokens', async () => {
  db.mockResolvedValueOnce([{ verifier: encrypt('fixture-verifier') }]);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    json({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      scope: 'user-read-email',
    }),
  );
  await expect(finishSpotify('user', 'state', 'code')).rejects.toMatchObject({ status: 403 });
  expect(db).toHaveBeenCalledTimes(1);
});
it('offers reconnect for a revoked refresh grant without overwriting tokens', async () => {
  db.mockResolvedValueOnce([
    {
      access_token: encrypt('expired'),
      refresh_token: encrypt('revoked'),
      expires_at: new Date(0),
    },
  ]);
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(json({ error: 'invalid_grant' }, 400));
  await expect(spotifyArtists('user')).rejects.toThrow('Reconnect Spotify in Settings');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(db).toHaveBeenCalledTimes(1);
});
