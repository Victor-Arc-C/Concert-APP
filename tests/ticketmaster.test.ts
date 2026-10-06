import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { migrate } from '../src/server/migrations';
import {
  resolveSpotifyArtists,
  syncArtists,
  TicketmasterProvider,
} from '../src/server/providers/ticketmaster';
const db = vi.mocked(query);
beforeEach(() => {
  vi.stubEnv('APP_ENV', 'local');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  db.mockReset();
});
it('guides sample-only users once without calling the provider', async () => {
  vi.stubEnv('TICKETMASTER_API_KEY', 'test-key');
  db.mockResolvedValueOnce([
    { data: { id: 'sample-a', name: 'Artist A' } },
    { data: { id: 'sample-b', name: 'Artist B' } },
  ]);
  const provider = vi.spyOn(TicketmasterProvider.prototype, 'events');
  const result = await syncArtists('test-user');
  expect(result.count).toBe(0);
  expect(result.message).toContain('No live artists followed yet');
  expect(result.message).not.toContain('Artist A');
  expect(provider).not.toHaveBeenCalled();
  expect(db).toHaveBeenCalledTimes(1);
});
it('skips sample artists while respecting the cache for live artists', async () => {
  vi.stubEnv('TICKETMASTER_API_KEY', 'test-key');
  db.mockResolvedValueOnce([
    { data: { id: 'sample-a', name: 'Artist A' } },
    { data: { id: 'live-b', name: 'Artist B', providerId: 'tm-b' } },
  ]).mockResolvedValueOnce([{ artist_id: 'live-b' }]);
  const result = await syncArtists('test-user');
  expect(result.message).toContain('1 sample artist was skipped');
  expect(db).toHaveBeenCalledTimes(2);
  expect(db.mock.calls[1][1]).toEqual(['live-b']);
});
it('requests all locales so French-only concerts are included', async () => {
  vi.stubEnv('TICKETMASTER_API_KEY', 'test-key');
  db.mockResolvedValue([{ count: 1 }]);
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        _embedded: {
          events: [
            {
              id: 'paris-date',
              name: 'TAME IMPALA',
              dates: { start: { localDate: '2027-06-12' } },
              _embedded: {
                attractions: [{ id: 'tm-tame', name: 'Tame Impala' }],
                venues: [
                  { name: 'Accor Arena', city: { name: 'Paris' }, country: { countryCode: 'FR' } },
                ],
              },
            },
          ],
        },
        page: { totalPages: 1 },
      }),
    ),
  );
  const events = await new TicketmasterProvider().events({
    id: 'tame',
    providerId: 'tm-tame',
    name: 'Tame Impala',
    genre: 'Rock',
    color: '#000',
    initials: 'ti',
  });
  expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('locale')).toBe('*');
  expect(events[0].event.city).toBe('Paris');
});
it('backs off recent failures and reports them instead of claiming success', async () => {
  vi.stubEnv('TICKETMASTER_API_KEY', 'test-key');
  db.mockResolvedValueOnce([
    { data: { id: 'live-a', name: 'A', providerId: 'tm-a' } },
  ]).mockResolvedValueOnce([{ message: 'Provider unavailable; retry pending.' }]);
  const provider = vi.spyOn(TicketmasterProvider.prototype, 'events');
  const result = await syncArtists('test-user');
  expect(result.failed).toBe(1);
  expect(result.message).toContain('retry pending');
  expect(provider).not.toHaveBeenCalled();
});

it('maps exact normalized matches and leaves ambiguous or absent artists unresolved', async () => {
  vi.stubEnv('TICKETMASTER_API_KEY', 'test-key');
  const pg = new PGlite();
  const adapter = {
    query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
    execute: async (sql: string) => {
      await pg.exec(sql);
    },
  };
  db.mockImplementation(adapter.query);
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const keyword = new URL(String(input)).searchParams.get('keyword');
    const attractions =
      keyword === 'Drake'
        ? [{ id: 'tm-drake', name: 'DRAKE' }]
        : keyword === 'Nono La Grinta'
          ? [
              { id: 'tm-nono-a', name: 'Nono La Grinta' },
              { id: 'tm-nono-b', name: 'Nono La Grinta' },
            ]
          : [];
    return new Response(JSON.stringify({ _embedded: { attractions } }));
  });
  try {
    await migrate(adapter);
    await pg.exec(`
      INSERT INTO artists(id,data) VALUES
        ('spotify-drake','{"name":"Drake"}'),
        ('spotify-nono','{"name":"Nono La Grinta"}'),
        ('spotify-triangle','{"name":"Triangle des Bermudes"}');
      INSERT INTO artist_provider_records(provider,external_id,artist_id) VALUES
        ('spotify','sp-drake','spotify-drake'),
        ('spotify','sp-nono','spotify-nono'),
        ('spotify','sp-triangle','spotify-triangle');
    `);
    await expect(
      resolveSpotifyArtists(['spotify-drake', 'spotify-nono', 'spotify-triangle']),
    ).resolves.toEqual({
      resolved: ['spotify-drake'],
      unresolved: ['spotify-nono', 'spotify-triangle'],
    });
    expect(
      (await pg.query('SELECT * FROM artist_provider_records WHERE provider=$1', ['ticketmaster']))
        .rows,
    ).toEqual([{ provider: 'ticketmaster', external_id: 'tm-drake', artist_id: 'spotify-drake' }]);
    expect(
      (
        await pg.query(
          "SELECT data->>'providerId' AS provider_id FROM artists WHERE id='spotify-drake'",
        )
      ).rows,
    ).toEqual([{ provider_id: 'tm-drake' }]);
    expect(fetcher).toHaveBeenCalled();
  } finally {
    await pg.close();
  }
});
