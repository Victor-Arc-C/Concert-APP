import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
vi.mock('../src/server/security', () => ({ currentUser: vi.fn() }));
import { query } from '../src/server/db';
import { currentUser } from '../src/server/security';
import { getAppData } from '../src/server/data';
import { migrations } from '../src/server/schema';
import { defaults } from '../src/domain/catalog';
import { sampleEvents } from '../src/domain/sample';
import type { User } from '../src/domain/types';

const db = new PGlite();
const user = (id: string): User => ({
  id,
  name: id,
  email: `${id}@example.test`,
  mode: 'live',
  onboarded: true,
  preferences: { ...defaults, home: 'Limoges', scope: 'country', notifications: 'everything' },
});
const state = async (id: string) => {
  vi.mocked(currentUser).mockResolvedValue(user(id));
  return getAppData();
};
beforeAll(async () => {
  for (const m of migrations) await db.exec(m.sql);
  vi.mocked(query).mockImplementation(
    async (sql, params) => (await db.query(sql, params)).rows as never[],
  );
  for (const id of ['alice', 'bob', 'empty']) {
    await db.query(
      'INSERT INTO users(id,email,name,password_hash,preferences) VALUES($1,$2,$1,$3,$4)',
      [id, `${id}@example.test`, 'test', JSON.stringify(user(id).preferences)],
    );
  }
  for (const id of ['alice', 'bob']) {
    await db.query('INSERT INTO artists(id,data) VALUES($1,$2)', [
      `artist-${id}`,
      JSON.stringify({ id: `artist-${id}`, name: id, genre: 'Electronic', providerId: id }),
    ]);
    await db.query('INSERT INTO affinities(user_id,artist_id) VALUES($1,$2)', [id, `artist-${id}`]);
    const event = {
      ...sampleEvents()[0],
      id: `event-${id}`,
      artistIds: [`artist-${id}`],
      artist: id,
      provider: 'ticketmaster',
      externalId: id,
    };
    await db.query('INSERT INTO events(id,fingerprint,data,sample) VALUES($1,$1,$2,FALSE)', [
      event.id,
      JSON.stringify(event),
    ]);
  }
});
afterAll(async () => {
  await db.close();
});

it('isolates two live accounts across refreshes, including alerts and an empty account', async () => {
  for (const id of ['alice', 'bob', 'alice']) {
    const data = await state(id);
    expect(data.affinities.map((a) => a.artistId)).toEqual([`artist-${id}`]);
    expect(data.events.map((e) => e.id)).toEqual([`event-${id}`]);
    expect(data.allEvents.map((e) => e.id)).toEqual([`event-${id}`]);
    expect(data.alerts.map((a) => a.event_id)).toEqual([`event-${id}`]);
    expect(data.events[0].city).toBe('Paris'); // Travel from Limoges is allowed.
  }
  const empty = await state('empty');
  expect(empty.events).toEqual([]);
  expect(empty.allEvents).toEqual([]);
  expect(empty.alerts).toEqual([]);
});

it('keeps a personally saved show available without mixing it into the followed feed', async () => {
  await db.query(
    "INSERT INTO feedback(user_id,event_id,action) VALUES('alice','event-bob','saved')",
  );
  let data = await state('alice');
  expect(data.events.map((e) => e.id)).toEqual(['event-alice']);
  expect(data.saved.map((e) => e.id)).toEqual(['event-bob']);
  expect((await state('bob')).saved).toEqual([]);
  await db.query("UPDATE affinities SET hidden=TRUE WHERE user_id='alice'");
  data = await state('alice');
  expect(data.events).toEqual([]);
  expect(data.saved.map((e) => e.id)).toEqual(['event-bob']);
  expect((await state('bob')).events.map((e) => e.id)).toEqual(['event-bob']);
});
