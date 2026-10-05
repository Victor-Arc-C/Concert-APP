import { PGlite } from '@electric-sql/pglite';
import { expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { migrate } from '../src/server/migrations';
import { storeEvent, TicketmasterProvider } from '../src/server/providers/ticketmaster';
import { sampleEvents } from '../src/domain/sample';

it('repeated ingestion preserves canonical IDs, updates raw provenance and respects shared retry delays', async () => {
  const pg = new PGlite();
  const db = {
    query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
    execute: async (sql: string) => {
      await pg.exec(sql);
    },
  };
  vi.mocked(query).mockImplementation(db.query);
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('TICKETMASTER_API_KEY', 'test-only');
  try {
    await migrate(db);
    const event = {
      ...sampleEvents(new Date('2026-10-05'))[0],
      provider: 'ticketmaster' as const,
      externalId: 'external-one',
    };
    await storeEvent(event, { id: 'external-one', version: 1 });
    const first = await db.query<{ id: string }>('SELECT id FROM events');
    await storeEvent({ ...event, price: 80 }, { id: 'external-one', version: 2 });
    expect(await db.query('SELECT id FROM events')).toEqual(first);
    expect(
      (await db.query<{ data: { price: number } }>('SELECT data FROM events'))[0].data.price,
    ).toBe(80);
    expect(
      await db.query('SELECT provider,external_id,event_id,raw FROM event_provider_records'),
    ).toEqual([
      {
        provider: 'ticketmaster',
        external_id: 'external-one',
        event_id: first[0].id,
        raw: { id: 'external-one', version: 2 },
      },
    ]);

    await storeEvent(
      { ...event, localTime: null, externalId: 'external-unknown-time' },
      { id: 'external-unknown-time' },
    );
    expect(await db.query('SELECT id FROM events')).toHaveLength(2);
    expect(
      await db.query('SELECT kind,provider,external_id,reason FROM normalization_reviews'),
    ).toEqual([
      {
        kind: 'event',
        provider: 'ticketmaster',
        external_id: 'external-unknown-time',
        reason: 'missing_time_candidate',
      },
    ]);

    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '7200' } }));
    const artist = {
      id: 'a',
      name: 'A',
      providerId: 'tm-a',
      color: '#000',
      genre: 'Rock',
      initials: 'a',
    };
    await expect(new TicketmasterProvider().events(artist)).rejects.toMatchObject({ status: 429 });
    await expect(
      new TicketmasterProvider().events({ ...artist, providerId: 'tm-b' }),
    ).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [backoff] = await db.query<{ seconds: number }>(
      'SELECT EXTRACT(EPOCH FROM retry_at-NOW()) AS seconds FROM provider_backoff',
    );
    expect(Number(backoff.seconds)).toBeGreaterThan(7190);
  } finally {
    await pg.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.mocked(query).mockReset();
  }
});
