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
});
const callback = () => `${new URL(env().APP_URL).origin}/api/spotify/callback`;
function requireAvailable() {
  if (!spotifyAvailable())
    throw new HttpError(
      503,
      'Spotify is not enabled for this pilot. Choose your artists manually.',
    );
}
export async function beginSpotify(userId: string) {
  requireAvailable();
  const state = randomBytes(32).toString('base64url'),
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
        }),
      ),
    })
    .parse(result)
    .items.map((a) => ({ name: a.name, url: a.external_urls.spotify }));
}
