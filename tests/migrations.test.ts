import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/server/migrations';
import { migrations } from '../src/server/schema';

function adapter(pg: PGlite) {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
    execute: async (sql: string) => {
      await pg.exec(sql);
    },
  };
}

describe('versioned schema', () => {
  it('creates a fresh schema and can run again without duplicating versions', async () => {
    const pg = new PGlite();
    try {
      await migrate(adapter(pg));
      await migrate(adapter(pg));
      expect(
        (await pg.query('SELECT version FROM schema_migrations ORDER BY version')).rows,
      ).toEqual(migrations.map(({ version }) => ({ version })));
      const indexes = (
        await pg.query<{ indexname: string }>('SELECT indexname FROM pg_indexes')
      ).rows.map((r) => r.indexname);
      for (const name of [
        'events_mode_date',
        'sessions_user',
        'ticket_sources_event',
        'artist_provider_artist',
        'analytics_time',
        'saved_trips_user_time',
        'saved_trips_event',
      ])
        expect(indexes).toContain(name);

    } finally {
      await pg.close();
    }
  });

  it('preserves legacy records and enforces multi-provider identities and references', async () => {
    const pg = new PGlite();
    try {
      await pg.exec(migrations[0].sql);
      await pg.exec(
        'CREATE TABLE schema_migrations(version INT PRIMARY KEY); INSERT INTO schema_migrations VALUES(1)',
      );
      await pg.exec(`
        INSERT INTO users(id,email,name,password_hash,preferences) VALUES('u','fixture@example.test','Fixture','test-only','{"home":"Paris"}');
        INSERT INTO artists VALUES('a','{"name":"Same name"}'),('b','{"name":"Same name"}');
        INSERT INTO events VALUES('e','unique-fingerprint','{"city":"Paris","venue":"Existing venue","date":"2027-01-01"}',false);
        INSERT INTO feedback(user_id,event_id,action) VALUES('u','e','saved');
        INSERT INTO artist_provider_records VALUES('one','123','a');
      `);
      const before = (await pg.query('SELECT * FROM users')).rows;
      const eventBefore = (await pg.query('SELECT * FROM events')).rows;
      await migrate(adapter(pg));
      expect((await pg.query('SELECT * FROM users')).rows).toEqual(before);
      expect((await pg.query('SELECT * FROM events')).rows).toEqual(eventBefore);
      expect((await pg.query('SELECT action FROM feedback')).rows).toEqual([{ action: 'saved' }]);
      await pg.exec(`
        INSERT INTO artist_provider_records VALUES('two','123','a');
        INSERT INTO event_provider_records VALUES('one','123','e','{}',NOW()),('two','123','e','{}',NOW());
        INSERT INTO venues VALUES('v','Venue','Paris','FR',NULL,NULL);
        INSERT INTO venue_provider_records VALUES('one','v1','v'),('two','v2','v');
        INSERT INTO event_venues VALUES('e','v');
        INSERT INTO ticket_sources(event_id,provider,external_id,url) VALUES('e','one','123','https://example.test/one'),('e','two','123','https://example.test/two');
      `);
      expect(
        (await pg.query('SELECT * FROM ticket_sources WHERE event_id=$1', ['e'])).rows,
      ).toHaveLength(2);
      await expect(
        pg.exec("INSERT INTO artist_provider_records VALUES('one','123','b')"),
      ).rejects.toThrow();
      await expect(
        pg.exec("INSERT INTO events VALUES('other','unique-fingerprint','{}',false)"),
      ).rejects.toThrow();
      await expect(
        pg.exec(
          "INSERT INTO ticket_sources(event_id,provider,external_id) VALUES('e','one','123')",
        ),
      ).rejects.toThrow();
      await expect(pg.exec("INSERT INTO event_venues VALUES('missing','v')")).rejects.toThrow();
      await expect(
        pg.exec(
          "INSERT INTO ticket_sources(event_id,provider,external_id,price_min) VALUES('e','one','bad',-1)",
        ),
      ).rejects.toThrow();
    } finally {
      await pg.close();
    }
  });
});

it('upgrades saved snapshots to legacy intent and preserves plans after event deletion, with account isolation intact', async () => {
  const pg = new PGlite();
  try {
    for (const migration of migrations.filter(m => m.version <= 7)) await pg.exec(migration.sql);
    await pg.exec('CREATE TABLE schema_migrations(version INT PRIMARY KEY)');
    for (const migration of migrations.filter(m => m.version <= 7)) await pg.query('INSERT INTO schema_migrations VALUES($1)', [migration.version]);
    await pg.exec(`
      INSERT INTO users(id,email,name,password_hash,preferences) VALUES('trip-user','trip@example.test','Test','test-only','{}');
      INSERT INTO events VALUES('trip-event','trip-fingerprint','{}',false);
      INSERT INTO saved_trips(id,user_id,event_id,trip_option_id,origin_city,destination_city,event_date,trip_data)
      VALUES('plan','trip-user','trip-event','old-choice','Paris','Lyon','2027-01-01','{"transport":{"bookingUrl":"javascript:bad","price":999}}');
    `);
    await migrate(adapter(pg));
    expect((await pg.query('SELECT trip_data FROM saved_trips')).rows).toEqual([{ trip_data: { version: 0 } }]);
    await pg.exec("DELETE FROM events WHERE id='trip-event'");
    expect((await pg.query('SELECT event_id,origin_city FROM saved_trips')).rows).toEqual([{ event_id: 'trip-event', origin_city: 'Paris' }]);
    await pg.exec("DELETE FROM users WHERE id='trip-user'");
    expect((await pg.query('SELECT id FROM saved_trips')).rows).toEqual([]);
  } finally { await pg.close(); }
});
