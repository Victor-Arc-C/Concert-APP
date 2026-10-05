import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { env } from './env';
import { migrations } from './schema';
import { artists } from '../domain/catalog';
import { sampleEvents } from '../domain/sample';
import { fingerprint } from '../domain/normalization';
type DB = {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string): Promise<void>;
};
const globalDB = globalThis as typeof globalThis & { encoreDB?: Promise<DB> };
async function connect(): Promise<DB> {
  const settings = env();
  let db: DB;
  if (settings.DATABASE_URL) {
    const pool = new Pool({ connectionString: settings.DATABASE_URL, max: 5 });
    db = {
      query: async <T>(sql: string, params: unknown[] = []) =>
        (await pool.query(sql, params)).rows as T[],
      execute: async (sql: string) => {
        await pool.query(sql);
      },
    };
  } else {
    if (process.env.VERCEL) throw new Error('Configure DATABASE_URL for hosted deployment.');
    const path = resolve(settings.LOCAL_DATABASE_PATH);
    await mkdir(dirname(path), { recursive: true });
    const pg = new PGlite(path);
    db = {
      query: async <T>(sql: string, params: unknown[] = []) =>
        (await pg.query<T>(sql, params)).rows,
      execute: async (sql: string) => {
        await pg.exec(sql);
      },
    };
  }
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY)');
  for (const migration of migrations) {
    if (
      !(
        await db.query('SELECT version FROM schema_migrations WHERE version=$1', [
          migration.version,
        ])
      ).length
    ) {
      // Single-process local migration; managed Postgres migrations must run once before replicas start.
      await db.execute(
        `BEGIN; ${migration.sql} INSERT INTO schema_migrations(version) VALUES (${migration.version}); COMMIT;`,
      );
    }
  }
  for (const artist of artists)
    await db.query('INSERT INTO artists(id,data) VALUES ($1,$2) ON CONFLICT(id) DO NOTHING', [
      artist.id,
      JSON.stringify(artist),
    ]);
  const existing = await db.query('SELECT id FROM events WHERE sample=TRUE LIMIT 1');
  if (!existing.length)
    for (const event of sampleEvents())
      await db.query(
        'INSERT INTO events(id,fingerprint,data,sample) VALUES ($1,$2,$3,TRUE) ON CONFLICT DO NOTHING',
        [event.id, fingerprint(event), JSON.stringify(event)],
      );
  return db;
}
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  globalDB.encoreDB ??= connect().catch((error) => {
    globalDB.encoreDB = undefined;
    throw error;
  });
  return (await globalDB.encoreDB).query<T>(sql, params);
}
