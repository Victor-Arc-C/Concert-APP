import { PGlite } from '@electric-sql/pglite';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { migrate } from '../src/server/migrations';
import { materializeSpotifyArtist, resolveArtistIdentity } from '../src/server/identity';

afterEach(() => {
  vi.mocked(query).mockReset();
});

it('prefers provider IDs, falls back to normalized names and records ambiguous matches', async () => {
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
    await pg.exec(`
      INSERT INTO artists(id,data) VALUES
        ('a','{"name":"Beyoncé"}'),
        ('b','{"name":"Different"}');
      INSERT INTO artist_provider_records(provider,external_id,artist_id) VALUES
        ('seed','seed-a','a'),
        ('ticketmaster','tm-b','b');
    `);

    await expect(resolveArtistIdentity('ticketmaster', 'tm-b', 'Anything')).resolves.toEqual({
      artistId: 'b',
      source: 'provider',
      candidates: ['b'],
    });

    await expect(resolveArtistIdentity('ticketmaster', 'tm-new', 'BEYONCE!')).resolves.toEqual({
      artistId: 'a',
      source: 'name',
      candidates: ['a'],
    });

    await pg.exec(`
      INSERT INTO artists(id,data) VALUES('c','{"name":"Beyonce"}');
      INSERT INTO artist_provider_records(provider,external_id,artist_id)
      VALUES('seed','seed-c','c');
    `);

    await expect(resolveArtistIdentity('ticketmaster', 'tm-ambiguous', 'Beyoncé')).resolves.toEqual(
      {
        artistId: null,
        source: 'ambiguous',
        candidates: ['a', 'c'],
      },
    );

    expect(
      (
        await pg.query<{
          kind: string;
          provider: string;
          external_id: string;
          reason: string;
          candidates: string[];
        }>('SELECT kind,provider,external_id,reason,candidates FROM normalization_reviews')
      ).rows,
    ).toEqual([
      {
        kind: 'artist',
        provider: 'ticketmaster',
        external_id: 'tm-ambiguous',
        reason: 'normalized_name_collision',
        candidates: ['a', 'c'],
      },
    ]);
  } finally {
    await pg.close();
  }
});

it('materializes and reuses a Spotify identity without fabricating live coverage', async () => {
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
    await expect(materializeSpotifyArtist('spotify-123', 'New Artist')).resolves.toEqual({
      artistId: 'spotify-spotify-123',
      source: 'spotify',
    });
    await expect(materializeSpotifyArtist('spotify-123', 'New Artist')).resolves.toEqual({
      artistId: 'spotify-spotify-123',
      source: 'provider',
    });
    expect((await pg.query('SELECT id FROM artists')).rows).toEqual([
      { id: 'spotify-spotify-123' },
    ]);
    expect(
      (
        await pg.query<{ provider: string; external_id: string; artist_id: string }>(
          'SELECT provider,external_id,artist_id FROM artist_provider_records',
        )
      ).rows,
    ).toEqual([
      { provider: 'spotify', external_id: 'spotify-123', artist_id: 'spotify-spotify-123' },
    ]);
    expect((await pg.query("SELECT data->>'providerId' AS provider_id FROM artists")).rows).toEqual(
      [{ provider_id: null }],
    );
  } finally {
    await pg.close();
  }
});
