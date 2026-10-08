import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrations } from '../src/server/schema';
import { LIVE_EVENTS_SQL } from '../src/server/data';
import { europe } from '../src/domain/recommendations';

// Live /api/state must not grow with every artist other accounts follow (Vercel 4.5 MB limit).
const db = new PGlite();
const today = '2026-10-07';
let n = 0;
async function event(id: string, artist: string, date: string, country = 'FR') {
  await db.query('INSERT INTO events(id,fingerprint,data,sample) VALUES($1,$2,$3,FALSE)', [
    id,
    `fp-${n++}`,
    JSON.stringify({ id, artistIds: [artist], date, country, provider: 'ticketmaster' }),
  ]);
}
beforeAll(async () => {
  for (const m of migrations) await db.exec(m.sql);
  await db.query(
    "INSERT INTO users(id,email,name,password_hash,preferences) VALUES('u','u@example.test','U','x','{}')",
  );
  await event('mine-upcoming', 'mine', '2026-11-01');
  await event('mine-today', 'mine', today);
  await event('mine-past', 'mine', '2026-09-01');
  await event('mine-us', 'mine', '2026-11-01', 'US');
  await event('saved-past', 'other', '2026-08-01');
  await event('alerted-us', 'other', '2026-12-01', 'US');
  await event('trip-past', 'trip-artist', '2026-09-15', 'ES');
  // A growing shared catalogue must not populate this account.
  for (let i = 0; i < 300; i++)
    await event(`other-${String(i).padStart(3, '0')}`, `other-${i}`, `2027-0${1 + (i % 9)}-15`);
  await db.exec(`
    INSERT INTO artists(id,data) VALUES('other','{}');
    INSERT INTO feedback(user_id,event_id,action) VALUES('u','saved-past','saved');
    INSERT INTO alerts(id,user_id,event_id,kind,title,body) VALUES('a','u','alerted-us','discovery','t','b');
    INSERT INTO saved_trips(id,user_id,event_id,trip_option_id,origin_city,destination_city,event_date,trip_data)
      VALUES('t','u','trip-past','opt','Paris','Madrid','2026-09-15','{}');
  `);
});
afterAll(async () => {
  await db.close();
});
const ids = async (followed: string[]) =>
  (
    await db.query<{ data: { id: string } }>(LIVE_EVENTS_SQL, ['u', today, [...europe], followed])
  ).rows.map((r) => r.data.id);

it('keeps upcoming European dates of followed artists plus saved and alerted concerts', async () => {
  const result = await ids(['mine']);
  expect(result).toEqual(
    expect.arrayContaining([
      'mine-upcoming',
      'mine-today',
      'saved-past',
      'alerted-us',
      'trip-past',
    ]),
  );
  expect(result).not.toContain('mine-past');
  expect(result).not.toContain('mine-us');
});
it('never loads unrelated concerts from the shared catalogue', async () => {
  const result = await ids(['mine']);
  expect(result.filter((id) => id.startsWith('other-'))).toEqual([]);
  expect(result).toHaveLength(5);
});
it('includes newly followed artists without adding any others', async () => {
  const followed = Array.from({ length: 50 }, (_, i) => `other-${i}`);
  const result = await ids(['mine', ...followed]);
  expect(result.filter((id) => id.startsWith('other-'))).toHaveLength(50);
  expect(result).toHaveLength(55);
});
it('keeps only personal history when the account follows no artist', async () => {
  expect((await ids([])).sort()).toEqual(['alerted-us', 'saved-past', 'trip-past']);
});
