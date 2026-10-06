import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { evaluateAlerts } from '../src/server/data';
import { migrations } from '../src/server/schema';
import { defaults } from '../src/domain/catalog';
import { sampleEvents } from '../src/domain/sample';
import type { User } from '../src/domain/types';
const db = new PGlite();
const user: User = {
  id: 'test',
  name: 'Test',
  email: 'test@example.test',
  mode: 'sample',
  onboarded: true,
  preferences: { ...defaults, notifications: 'important' },
};
const base = sampleEvents()[0];
const events = Array.from({ length: 25 }, (_, i) => ({
  ...base,
  id: `event-${i}`,
  city: 'Paris',
  country: 'FR',
  saleAt: null,
}));
const affinity = base.artistIds.map((artistId) => ({ artistId, favorite: false, hidden: false }));
beforeAll(async () => {
  for (const m of migrations) await db.exec(m.sql);
  await db.query(
    'INSERT INTO users(id,email,name,password_hash,preferences) VALUES($1,$2,$3,$4,$5)',
    [user.id, user.email, user.name, 'test', JSON.stringify(user.preferences)],
  );
  for (const e of events)
    await db.query('INSERT INTO events(id,fingerprint,data,sample) VALUES($1,$2,$3,TRUE)', [
      e.id,
      e.id,
      JSON.stringify(e),
    ]);
  vi.mocked(query).mockImplementation(
    async (sql, params) => (await db.query(sql, params)).rows as never[],
  );
});
afterAll(async () => {
  await db.close();
});
it('alerts for home-city shows beyond the first 20 and never duplicates on repeat', async () => {
  await evaluateAlerts(user, events, affinity, [], []);
  await evaluateAlerts(user, events, affinity, [], []);
  const result = await db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM alerts');
  expect(result.rows[0].count).toBe(25);
});
it('respects off, hidden, dismissed and critical-only preferences', async () => {
  await db.exec('DELETE FROM alerts');
  await evaluateAlerts(
    { ...user, preferences: { ...user.preferences, notifications: 'off' } },
    events,
    affinity,
    [],
    [],
  );
  await evaluateAlerts(
    { ...user, preferences: { ...user.preferences, notifications: 'critical' } },
    events,
    affinity,
    [],
    [],
  );
  await evaluateAlerts(
    user,
    events,
    affinity.map((a) => ({ ...a, hidden: true })),
    [],
    [],
  );
  await evaluateAlerts(
    user,
    events,
    affinity,
    [],
    events.map((e) => ({ eventId: e.id, action: 'dismissed' })),
  );
  expect((await db.query('SELECT id FROM alerts')).rows).toHaveLength(0);
});

it('new-account defaults do not opt users into alerts', () => {
  expect(defaults.notifications).toBe('off');
});
