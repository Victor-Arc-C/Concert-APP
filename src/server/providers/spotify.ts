import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { query } from '../db';
import { env, spotifyAvailable } from '../env';
import { decrypt, encrypt, HttpError } from '../security';
import { providerJson, ProviderError } from './http';
const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive(),
  scope: z.string().optional(),
});
const callback = () => `${new URL(env().APP_URL).origin}/api/spotify/callback`;
function requireAvailable() {
  if (!spotifyAvailable())
    throw new HttpError(
      503,
      'Spotify is not enabled for this pilot. Choose your artists manually.',
    );
}
export async function beginSpotify(userId: string, returnTo: 'onboarding' | 'artists' = 'artists') {
  requireAvailable();
  const stateBytes = randomBytes(32);
  stateBytes[0] = returnTo === 'onboarding' ? 255 : 0;
  const state = stateBytes.toString('base64url'),
    verifier = randomBytes(48).toString('base64url');
  await query(
    "INSERT INTO oauth_attempts(state,user_id,verifier,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes')",
    [state, userId, encrypt(verifier)],
  );
  const params = new URLSearchParams({
    client_id: env().SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: callback(),
    scope: 'user-top-read',
    show_dialog: 'true',
    state,
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}
async function tokenRequest(params: Record<string, string>) {
  return tokenSchema.parse(
    await providerJson('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${env().SPOTIFY_CLIENT_ID}:${env().SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams(params),
    }),
  );
}
export async function finishSpotify(userId: string, state: string, code: string) {
  requireAvailable();
  const [attempt] = await query<{ verifier: string }>(
    'DELETE FROM oauth_attempts WHERE state=$1 AND user_id=$2 AND expires_at>NOW() RETURNING verifier',
    [state, userId],
  );
  if (!attempt)
    throw new HttpError(
      400,
      'This music connection expired or could not be verified. Start again.',
    );
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callback(),
    code_verifier: decrypt(attempt.verifier),
  });
  if (tokens.scope !== undefined && !tokens.scope.split(' ').includes('user-top-read'))
    throw new HttpError(403, 'Spotify did not grant top-artist access. Reconnect and approve it.');
  if (!tokens.refresh_token)
    throw new HttpError(
      502,
      'Spotify did not grant a refresh token. Reconnect and approve access.',
    );
  await query(
    'INSERT INTO music_accounts(user_id,access_token,refresh_token,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET access_token=EXCLUDED.access_token,refresh_token=EXCLUDED.refresh_token,expires_at=EXCLUDED.expires_at',
    [
      userId,
      encrypt(tokens.access_token),
      encrypt(tokens.refresh_token),
      new Date(Date.now() + tokens.expires_in * 1000),
    ],
  );
}
export async function spotifyArtists(userId: string) {
  requireAvailable();
  const [account] = await query<{ access_token: string; refresh_token: string; expires_at: Date }>(
    'SELECT access_token,refresh_token,expires_at FROM music_accounts WHERE user_id=$1',
    [userId],
  );
  if (!account) throw new HttpError(404, 'Connect Spotify first.');
  let token = decrypt(account.access_token);
  const refresh = async () => {
    const t = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: decrypt(account.refresh_token),
    }).catch((error: unknown) => {
      if (error instanceof ProviderError && [400, 401].includes(error.status))
        throw new ProviderError(
          'Spotify access expired or was revoked. Reconnect Spotify in Settings.',
          401,
        );
      throw error;
    });
    token = t.access_token;
    await query(
      'UPDATE music_accounts SET access_token=$1,refresh_token=$2,expires_at=$3 WHERE user_id=$4',
      [
        encrypt(token),
        t.refresh_token ? encrypt(t.refresh_token) : account.refresh_token,
        new Date(Date.now() + t.expires_in * 1000),
        userId,
      ],
    );
  };
  if (new Date(account.expires_at).getTime() < Date.now() + 60000) await refresh();
  const get = () =>
    providerJson('https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=30', {
      headers: { Authorization: `Bearer ${token}` },
    });
  let result: unknown;
  try {
    result = await get();
  } catch (error) {
    if (error instanceof ProviderError && error.status === 401) {
      await refresh();
      result = await get();
    } else throw error;
  }
  // Returned transiently for explicit user selection. No listening metrics, ranks or raw profile persisted.
  return z
    .object({
      items: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          external_urls: z.object({ spotify: z.url() }),
          images: z.array(z.object({ url: z.url() })).default([]),
        }),
      ),
    })
    .parse(result)
    .items.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.external_urls.spotify,
      image: a.images[0]?.url,
    }));
}

export async function cancelSpotify(userId: string, state: string) {
  await query('DELETE FROM oauth_attempts WHERE user_id=$1 AND state=$2', [userId, state]);
}
export async function disconnectSpotify(userId: string) {
  await query(
    `WITH tokens AS (DELETE FROM music_accounts WHERE user_id=$1),
    attempts AS (DELETE FROM oauth_attempts WHERE user_id=$1)
    DELETE FROM spotify_artist_preferences WHERE user_id=$1`,
    [userId],
  );
}
export async function confirmSpotifyArtist(userId: string, spotifyId: string, artistId: string) {
  // Recheck provider membership; never trust a client-supplied name, score or URL.
  if (!(await spotifyArtists(userId)).some((artist) => artist.id === spotifyId))
    throw new HttpError(422, 'Reload your Spotify artists and choose again.');
  // One statement makes the explicit follow and its source mapping atomic.
  // 1 means an explicit confirmed choice, not a listening-derived rank or probability.
  const saved = await query(
    `WITH followed AS (
    INSERT INTO affinities(user_id,artist_id)
    SELECT $1,id FROM artists WHERE id=$3 AND data->>'providerId' IS NOT NULL
    ON CONFLICT(user_id,artist_id) DO UPDATE SET hidden=FALSE
    RETURNING artist_id
  ) INSERT INTO spotify_artist_preferences(user_id,spotify_id,artist_id,affinity)
    SELECT $1,$2,artist_id,1 FROM followed
    ON CONFLICT(user_id,spotify_id) DO UPDATE SET artist_id=EXCLUDED.artist_id,affinity=1
    RETURNING artist_id`,
    [userId, spotifyId, artistId],
  );
  if (!saved.length) throw new HttpError(422, 'Choose an artist from the live catalogue.');
}
