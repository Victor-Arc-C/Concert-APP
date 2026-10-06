import { rankEvents } from '../src/domain/recommendations';
import { defaults } from '../src/domain/catalog';
import { sampleEvents } from '../src/domain/sample';
import { resolveArtistIdentity } from '../src/server/identity';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { migrate } from '../src/server/migrations';
import { encrypt } from '../src/server/security';
import {
  cancelSpotify,
  confirmSpotifyArtist,
  disconnectSpotify,
} from '../src/server/providers/spotify';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.mocked(query).mockReset();
});
it('stores only confirmed provider mapping, preserves manual preferences and removes tokens on disconnect', async () => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('SPOTIFY_APPROVED', 'true');
  vi.stubEnv('SPOTIFY_CLIENT_ID', 'fixture');
  vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'fixture');
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
  const pg = new PGlite();
  const adapter = {
    query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
    execute: async (sql: string) => {
      await pg.exec(sql);
    },
  };
  vi.mocked(query).mockImplementation(adapter.query);
  try {
    await migrate(adapter);
    await pg.exec(`INSERT INTO users(id,email,name,password_hash,preferences) VALUES('u','fixture@example.test','Fixture','test','{}');
      INSERT INTO artists VALUES('live','{"providerId":"tm-fixture","name":"Artist"}'),('sample','{"name":"Artist"}');
      INSERT INTO artist_provider_records VALUES('spotify','sp-id','live');
      INSERT INTO affinities(user_id,artist_id,favorite) VALUES('u','live',TRUE);
      INSERT INTO oauth_attempts VALUES('denied','u','encrypted',NOW()+INTERVAL '10 minutes'),('other','u','encrypted',NOW()+INTERVAL '10 minutes');`);
    await pg.query('INSERT INTO music_accounts VALUES($1,$2,$3,$4)', [
      'u',
      encrypt('access'),
      encrypt('refresh'),
      new Date(Date.now() + 3600000),
    ]);
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'sp-id',
                name: 'Artist',
                external_urls: { spotify: 'https://open.spotify.com/artist/sp-id' },
              },
            ],
          }),
        ),
    );
    await expect(confirmSpotifyArtist('u', 'forged', 'live')).rejects.toMatchObject({
      status: 422,
    });
    await expect(confirmSpotifyArtist('u', 'sp-id', 'sample')).rejects.toMatchObject({
      status: 422,
    });
    expect((await pg.query('SELECT * FROM spotify_artist_preferences')).rows).toEqual([]);
    await confirmSpotifyArtist('u', 'sp-id', 'live');
    await pg.exec(
      `INSERT INTO artist_provider_records VALUES('ticketmaster','tm-fixture','live') ON CONFLICT DO NOTHING`,
    );
    const identity = await resolveArtistIdentity(
      'ticketmaster',
      'tm-fixture',
      'Different display name',
    );
    const follows = (
      await pg.query<{ artistId: string; favorite: boolean; hidden: boolean }>(
        'SELECT artist_id AS "artistId",favorite,hidden FROM affinities',
      )
    ).rows;
    const now = new Date('2026-10-06T00:00:00Z');
    const concert = { ...sampleEvents(now)[0], artistIds: [identity.artistId!] };
    expect(rankEvents([concert], follows, [], [], defaults, now)).toHaveLength(1);
    await confirmSpotifyArtist('u', 'sp-id', 'live');
    expect(
      (
        await pg.query(
          'SELECT spotify_id,artist_id,affinity::float FROM spotify_artist_preferences',
        )
      ).rows,
    ).toEqual([{ spotify_id: 'sp-id', artist_id: 'live', affinity: 1 }]);
    await cancelSpotify('u', 'denied');
    expect((await pg.query('SELECT state FROM oauth_attempts')).rows).toEqual([{ state: 'other' }]);
    await disconnectSpotify('u');
    for (const table of ['music_accounts', 'oauth_attempts', 'spotify_artist_preferences'])
      expect((await pg.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
    expect((await pg.query('SELECT artist_id,favorite,hidden FROM affinities')).rows).toEqual([
      { artist_id: 'live', favorite: true, hidden: false },
    ]);
  } finally {
    await pg.close();
  }
});
