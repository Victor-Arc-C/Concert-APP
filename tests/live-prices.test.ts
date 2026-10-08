import { PGlite } from '@electric-sql/pglite';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
vi.mock('../src/server/security', () => ({ currentUser: vi.fn() }));
import { query } from '../src/server/db';
import { currentUser } from '../src/server/security';
import { migrate } from '../src/server/migrations';
import { getAppData } from '../src/server/data';
import { storeEvent } from '../src/server/providers/ticketmaster';
import { normalizeTicketmaster } from '../src/domain/normalization';
import { defaults } from '../src/domain/catalog';
import { formatters } from '../src/i18n/format';
import { en } from '../src/i18n/en';

// What the app shows for a price: the formatted amount, or the explicit unknown label.
const money = (amount: number | null, currency: string | null) =>
  formatters('en').money(amount, currency) ?? en.common.priceNotListed;

const now = new Date();
const raw = {
  id: 'listing',
  name: 'Artist live',
  url: 'https://www.ticketmaster.fr/event/listing',
  dates: { start: { localDate: '2027-06-12', localTime: '20:00:00' }, status: { code: 'onsale' } },
  _embedded: {
    attractions: [{ id: 'attraction', name: 'Artist' }],
    venues: [{ name: 'Arena', city: { name: 'Paris' }, country: { countryCode: 'FR' } }],
  },
};
const normalize = (priceRanges?: unknown) =>
  normalizeTicketmaster({ ...raw, priceRanges }, 'artist', 'attraction', 'Artist', now)!;
afterEach(() => {
  vi.mocked(query).mockReset();
  vi.mocked(currentUser).mockReset();
});

it('keeps concerts with absent or malformed Discovery prices and finds the first usable range', () => {
  for (const ranges of [
    undefined,
    null,
    [],
    'bad',
    [{ min: -1, currency: 'EUR' }],
    [{ min: '70', currency: 'EUR' }],
    [{ min: 70, max: 60, currency: 'EUR' }],
    [{ min: 70, currency: 'eu' }],
  ]) {
    expect(normalize(ranges)).toMatchObject({ price: null, currency: null, status: 'onsale' });
  }
  expect(
    normalize([
      { min: -1, currency: 'EUR' },
      { min: 79.5, currency: 'EUR' },
    ]),
  ).toMatchObject({ price: 79.5, currency: 'EUR' });
  expect(normalize([{ min: 0, currency: 'GBP' }])).toMatchObject({ price: 0, currency: 'GBP' });
});

it('persists Discovery prices and serves the exact current source, never stale snapshots or other listings', async () => {
  const pg = new PGlite();
  const db = {
    query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
    execute: async (sql: string) => {
      await pg.exec(sql);
    },
  };
  vi.mocked(query).mockImplementation(db.query);
  vi.mocked(currentUser).mockResolvedValue({
    id: 'user',
    name: 'Test',
    email: 'test@example.test',
    mode: 'live',
    onboarded: true,
    preferences: { ...defaults, notifications: 'off' },
  });
  try {
    await migrate(db);
    const event = normalize([{ min: 79.5, currency: 'EUR' }]);
    await db.query(
      "INSERT INTO users(id,email,name,password_hash,preferences) VALUES('user','test@example.test','Test','x','{}')",
    );
    await db.query("INSERT INTO artists(id,data) VALUES('artist','{}')");
    await db.query("INSERT INTO affinities(user_id,artist_id) VALUES('user','artist')");
    await storeEvent(event, raw);
    const [{ id }] = await db.query<{ id: string }>('SELECT id FROM events');
    const feed = async () => (await getAppData()).allEvents.find((e) => e.id === id)!;
    expect(await feed()).toMatchObject({
      price: 79.5,
      currency: 'EUR',
      priceObservedAt: now.toISOString(),
    });
    const [stored] = await db.query<{ price_min: string; currency: string; observed_at: Date }>(
      'SELECT price_min,currency,observed_at FROM ticket_sources',
    );
    expect(Number(stored.price_min)).toBe(79.5);
    expect(stored.observed_at.toISOString()).toBe(now.toISOString());
    // A later official observation updates the source independently of the snapshot.
    await db.query("UPDATE ticket_sources SET price_min=90,currency='GBP',observed_at=$1", [now]);
    expect(await feed()).toMatchObject({ price: 90, currency: 'GBP' });
    await db.query(
      "INSERT INTO ticket_sources(event_id,provider,external_id,url,price_min,currency,observed_at) VALUES($1,'ticketmaster','another','https://www.ticketmaster.fr/event/another',1,'USD',$2)",
      [id, now],
    );
    expect(await feed()).toMatchObject({ price: 90, currency: 'GBP', externalId: 'listing' });
    for (const observedAt of [
      new Date(now.getTime() - 86400001),
      new Date(now.getTime() + 3600000),
    ]) {
      await db.query('UPDATE ticket_sources SET observed_at=$1 WHERE external_id=$2', [
        observedAt,
        'listing',
      ]);
      expect((await feed()).price).toBeNull();
    }
    await db.query(
      "UPDATE ticket_sources SET observed_at=$1,disabled_at=$1 WHERE external_id='listing'",
      [now],
    );
    expect((await feed()).price).toBeNull();
    await db.query("UPDATE ticket_sources SET disabled_at=NULL WHERE external_id='listing'");
    for (const status of ['cancelled', 'postponed'] as const) {
      await storeEvent({ ...event, status }, raw);
      expect(await feed()).toMatchObject({ status, price: null });
    }
    await storeEvent(normalize(), raw);
    expect(await feed()).toMatchObject({ price: null, currency: null, status: 'onsale' });
    await db.query("DELETE FROM ticket_sources WHERE external_id='listing'");
    expect((await feed()).price).toBeNull();
  } finally {
    await pg.close();
  }
});

it('renders explicit unavailable prices and preserves provider currency', () => {
  expect(money(null, null)).toBe('Price not listed');
  for (const value of [-1, NaN, Infinity]) expect(money(value, 'EUR')).toBe('Price not listed');
  expect(money(70, 'eu')).toBe('Price not listed');
  expect(money(79.5, 'EUR')).toBe('€79.50');
  expect(money(90, 'GBP')).toBe('£90');
  expect(money(0, 'EUR')).toBe('€0');
});
