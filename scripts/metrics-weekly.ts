// npm run metrics:weekly [-- --week YYYY-MM-DD]
// Read-only weekly report of the five CON-5 launch metrics. See docs/ANALYTICS.md.
import { existsSync } from 'node:fs';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import {
  ANALYTICS_RETENTION_DAYS,
  formatReport,
  lastCompleteWeek,
  parseExcludeList,
  weekStartOf,
  weeklyMetrics,
  type MetricAccount,
  type MetricEvent,
} from '../src/domain/metrics.ts';

type Query = <T>(sql: string, params?: unknown[]) => Promise<T[]>;

async function withReadOnlyDatabase<T>(run: (query: Query) => Promise<T>): Promise<T> {
  const url = process.env.METRICS_DATABASE_URL || process.env.DATABASE_URL;
  if (url) {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      // The report never writes: the whole session runs inside a read-only transaction.
      await client.query('BEGIN READ ONLY');
      const result = await run(async (sql, params = []) => (await client.query(sql, params)).rows);
      await client.query('COMMIT');
      return result;
    } finally {
      await client.end();
    }
  }
  const path = process.env.LOCAL_DATABASE_PATH || '.data/encore';
  console.error(`No METRICS_DATABASE_URL set: reading the local database in ${path}.`);
  // Opening a missing folder would silently create an empty database.
  if (!existsSync(path))
    throw new Error(
      `No database found in ${path}. Set METRICS_DATABASE_URL in .env.local (see docs/ANALYTICS.md).`,
    );
  const db = new PGlite(path);
  try {
    return await run(async (sql, params = []) => (await db.query(sql, params)).rows as never[]);
  } finally {
    await db.close();
  }
}

function requestedWeek(now: Date) {
  const index = process.argv.indexOf('--week');
  if (index === -1) return lastCompleteWeek(now);
  const value = process.argv[index + 1] ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
    throw new Error('Use --week YYYY-MM-DD (any day of the week you want).');
  return weekStartOf(new Date(`${value}T00:00:00Z`));
}

async function main() {
  const now = new Date(),
    weekStart = requestedWeek(now);
  // Retention needs up to 21 days before the report week ends, and nothing older than
  // the analytics retention exists anyway.
  const since = new Date(
    Math.min(
      weekStart.getTime() - 14 * 86_400_000,
      now.getTime() - ANALYTICS_RETENTION_DAYS * 86_400_000,
    ),
  );
  const { accounts, events } = await withReadOnlyDatabase(async (query) => {
    const users = await query<{ id: string; email: string; created_at: Date; consent: boolean }>(
      `SELECT id, email, created_at, COALESCE(preferences->>'analytics' = 'true', FALSE) AS consent
       FROM users`,
    );
    const rows = await query<{
      user_id: string;
      name: string;
      created_at: Date;
      properties: Record<string, unknown>;
    }>(
      `SELECT user_id, name, created_at, properties FROM analytics
       WHERE user_id IS NOT NULL AND created_at >= $1 AND name = ANY($2)`,
      [
        since,
        [
          'onboarding_completed',
          'concert_impression',
          'concert_opened',
          'concert_saved',
          'ticket_link_clicked',
        ],
      ],
    );
    return {
      accounts: users.map((u): MetricAccount => ({
        id: u.id,
        email: u.email,
        createdAt: new Date(u.created_at),
        analyticsConsent: u.consent === true,
      })),
      events: rows.map((r): MetricEvent => ({
        userId: r.user_id,
        name: r.name,
        at: new Date(r.created_at),
        properties: r.properties ?? {},
      })),
    };
  });
  const report = weeklyMetrics({
    accounts,
    events,
    weekStart,
    now,
    exclude: parseExcludeList(process.env.METRICS_EXCLUDE),
  });
  console.log(formatReport(report));
}

main().catch((error: unknown) => {
  // Never print connection strings or stack traces that could contain them.
  console.error(
    `Could not build the report: ${error instanceof Error ? error.message.replace(/postgres(ql)?:\/\/\S+/g, '[database URL]') : 'unknown error'}`,
  );
  process.exitCode = 1;
});
