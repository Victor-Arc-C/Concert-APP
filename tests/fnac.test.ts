import { gzipSync } from 'node:zlib';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
vi.mock('../src/server/security', async (original) => ({
  ...(await original<typeof import('../src/server/security')>()),
  currentUser: vi.fn(),
}));
const feedList = 'https://ui.awin.com/productdata-darwin-download/publisher/1/' + 'a'.repeat(32);
vi.mock('../src/server/env', async (original) => {
  const actual = await original<typeof import('../src/server/env')>();
  return {
    ...actual,
    env: () => ({ ...actual.parseEnvironment({}), AWIN_FEED_LIST_URL: configured.url }),
  };
});
import { query } from '../src/server/db';
import { currentUser } from '../src/server/security';
import { migrate } from '../src/server/migrations';
import { getAppData } from '../src/server/data';
import { storeEvent } from '../src/server/providers/ticketmaster';
import { refreshFnacPrices } from '../src/server/providers/fnac';
import { selectTicketSource } from '../src/server/tickets';
import { csvRecords } from '../src/domain/csv';
import { fnacFeedColumns, fnacKey, fnacSession, matchFnacSession } from '../src/domain/fnac';
import { normalizeTicketmaster } from '../src/domain/normalization';
import { safeTicketUrl, ticketSellerHost } from '../src/domain/ticket-links';
import { parseEnvironment } from '../src/server/env';
import { defaults } from '../src/domain/catalog';
import type { Concert } from '../src/domain/types';

const configured: { url: string | undefined } = { url: `${feedList}/1/feedList` };
const link = (product: number) => `https://www.awin1.com/pclick.php?p=${product}&a=1&m=12494`;
const row = (overrides: Record<string, string> = {}) => ({
  aw_deep_link: link(1),
  merchant_product_id: '21085856',
  currency: 'EUR',
  stock_quantity: '2 - AVAILABLE',
  custom_5: 'FR',
  custom_7: '20:00',
  'Tickets:primary_artist': 'L2B',
  'Tickets:event_date': '2027-03-05',
  'Tickets:venue_name': 'Zénith de Toulouse Métropole',
  'Tickets:min_price': '55.0',
  'Tickets:max_price': '70.0',
  ...overrides,
});
const target = {
  id: 'event',
  artists: ['L2B'],
  venue: 'Zénith Toulouse Métropole',
  city: 'Toulouse',
  country: 'FR',
  date: '2027-03-05',
  localTime: '20:00:00',
};
const records = async (chunks: string[]) => {
  const all: string[][] = [];
  for await (const record of csvRecords(chunks)) all.push(record);
  return all;
};
afterEach(() => {
  vi.mocked(query).mockReset();
  vi.mocked(currentUser).mockReset();
  configured.url = `${feedList}/1/feedList`;
});

it('reads quoted fields, doubled quotes and line breaks across chunk boundaries', async () => {
  expect(await records(['a,"b,1"', ',"say ""hi""', '"\r\n"two\nlines",,x\n', 'last'])).toEqual([
    ['a', 'b,1', 'say "hi"'],
    ['two\nlines', '', 'x'],
    ['last'],
  ]);
  expect(await records(['"",1\n'])).toEqual([['', '1']]);
});

it('approves only the Awin click link of the Fnac Spectacles programme', () => {
  expect(ticketSellerHost(link(39291708711))).toBe('www.fnacspectacles.com');
  expect(ticketSellerHost('https://www.ticketmaster.fr/event/1')).toBe('www.ticketmaster.fr');
  for (const unsafe of [
    'https://www.awin1.com/pclick.php?p=1&a=1&m=999',
    'https://www.awin1.com/cread.php?awinmid=12494&ued=https%3A%2F%2Fevil.example',
    'https://www.awin1.com/pclick.php?p=x&a=1&m=12494',
    'https://awin1.com.evil.example/pclick.php?p=1&a=1&m=12494',
    'http://www.awin1.com/pclick.php?p=1&a=1&m=12494',
  ])
    expect(safeTicketUrl(unsafe)).toBe(false);
});

it('keeps a price only for sessions on sale and drops unusable rows', () => {
  expect(fnacSession(row())).toMatchObject({
    externalId: '21085856',
    time: '20:00',
    price: 55,
    priceMax: 70,
    currency: 'EUR',
  });
  for (const state of ['6 - NO_AMOUNT', '7 - BEFORE_ONSALE'])
    expect(fnacSession(row({ stock_quantity: state }))).toMatchObject({
      price: null,
      priceMax: null,
      currency: null,
    });
  for (const state of ['0 - UNKNOWN', '1 - CANCELED', '3 - UNDELIVERABLE', '8 - AFTER_OFFSALE', ''])
    expect(fnacSession(row({ stock_quantity: state }))).toBeNull();
  expect(fnacSession(row({ custom_7: '00:00' }))?.time).toBeNull();
  expect(fnacSession(row({ 'Tickets:min_price': '' }))?.price).toBeNull();
  expect(fnacSession(row({ 'Tickets:min_price': '-1' }))?.price).toBeNull();
  expect(fnacSession(row({ 'Tickets:max_price': '10' }))).toMatchObject({
    price: 55,
    priceMax: null,
  });
  const unusable: Record<string, string>[] = [
    { aw_deep_link: 'https://evil.example/tickets' },
    { merchant_product_id: '' },
    { 'Tickets:primary_artist': '' },
    { 'Tickets:event_date': '05/03/2027' },
    { custom_5: '' },
    { 'Tickets:venue_name': ' ' },
  ];
  for (const bad of unusable) expect(fnacSession(row(bad))).toBeNull();
});

it('matches a session on a distinctive venue or city word and refuses guesses', () => {
  const session = fnacSession(row())!;
  expect(matchFnacSession(target, [session]).session).toBe(session);
  // The city is enough when sellers name the venue differently.
  expect(matchFnacSession({ ...target, venue: 'Le Grand Hall' }, [session]).session).toBe(session);
  // "Zénith" alone names a kind of venue.
  expect(
    matchFnacSession({ ...target, venue: 'Zénith de Lille', city: 'Lille' }, [session]),
  ).toEqual({ session: null, ambiguous: false });
  // A reviewed rename: Fnac already sells Paris La Défense Arena under its new name.
  const plenitude = fnacSession(row({ 'Tickets:venue_name': 'Plenitude Arena' }))!;
  const defense = { ...target, venue: 'Paris La Défense Arena', city: 'Nanterre' };
  expect(matchFnacSession(defense, [plenitude]).session).toBe(plenitude);
  expect(matchFnacSession({ ...defense, venue: 'Accor Arena' }, [plenitude]).session).toBeNull();
  const matinee = fnacSession(row({ merchant_product_id: '2', custom_7: '15:00' }))!;
  expect(matchFnacSession(target, [matinee, session]).session).toBe(session);
  expect(matchFnacSession({ ...target, localTime: null }, [matinee, session])).toEqual({
    session: null,
    ambiguous: true,
  });
});

it('compares artists across joining words but not across names', () => {
  const key = (name: string) => fnacKey(name, '2026-10-19', 'fr');
  expect(key('Bigflo & Oli')).toBe(key('BIGFLO ET OLI'));
  expect(key('Bigflo and Oli')).toBe(key('Bigflo + Oli'));
  expect(key('Angèle')).toBe('angele|2026-10-19|FR');
  expect(key('Bigflo')).not.toBe(key('Bigflo & Oli'));
  expect(key('Etienne Daho')).not.toBe(key('ienne Daho'));
});

it('validates the Awin feed list address without echoing it', () => {
  expect(parseEnvironment({ AWIN_FEED_LIST_URL: '' }).AWIN_FEED_LIST_URL).toBeUndefined();
  expect(
    parseEnvironment({ AWIN_FEED_LIST_URL: `${feedList}/1/feedList` }).AWIN_FEED_LIST_URL,
  ).toBe(`${feedList}/1/feedList`);
  const secret = 'https://productdata.awin.com/datafeed/download/apikey/secret-key/';
  expect(() => parseEnvironment({ AWIN_FEED_LIST_URL: secret })).toThrow('Feed List Download');
  try {
    parseEnvironment({ AWIN_FEED_LIST_URL: secret });
  } catch (error) {
    expect(String(error)).not.toContain('secret-key');
  }
});

const feedUrl =
  'https://productdata.awin.com/datafeed/download/apikey/key/fid/23455/format/csv/language/fr/delimiter/%2C/compression/gzip/columns/data_feed_id%2Cmerchant_id/';
const csv = (lines: string[][]) =>
  lines.map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n');
const list = (status = 'active', url = feedUrl) =>
  csv([
    ['Advertiser ID', 'Advertiser Name', 'Membership Status', 'Feed ID', 'URL'],
    ['999', 'Someone else', 'active', '1', 'https://productdata.awin.com/other/'],
    ['12494', 'Fnac Spectacles FR', status, '23455', url],
  ]);
function awin(rows: Record<string, string>[], listBody = list()) {
  const requested: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url.endsWith('/feedList')) return new Response(listBody);
    return new Response(
      gzipSync(
        csv([fnacFeedColumns, ...rows.map((r) => fnacFeedColumns.map((column) => r[column]))]),
      ),
    );
  }) as typeof fetch;
  return { fetcher, requested };
}
const raw = {
  id: 'listing',
  name: 'L2B - Tournée des Zéniths',
  url: 'https://www.ticketmaster.fr/event/listing',
  dates: { start: { localDate: '2027-03-05', localTime: '20:00:00' }, status: { code: 'onsale' } },
  _embedded: {
    attractions: [{ id: 'attraction', name: 'L2B' }],
    venues: [
      {
        name: 'Zénith Toulouse Métropole',
        city: { name: 'Toulouse' },
        country: { countryCode: 'FR' },
      },
    ],
  },
};
async function database() {
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
  await migrate(db);
  await db.query(
    "INSERT INTO users(id,email,name,password_hash,preferences) VALUES('user','test@example.test','Test','x','{}')",
  );
  await db.query(`INSERT INTO artists(id,data) VALUES('artist','{"name":"L2B"}')`);
  await db.query("INSERT INTO affinities(user_id,artist_id) VALUES('user','artist')");
  return { pg, db };
}

it('attaches the matched session as its own source and shows its price with its own link', async () => {
  const { pg, db } = await database();
  try {
    const now = new Date();
    const event = (priceRanges?: unknown) =>
      normalizeTicketmaster({ ...raw, priceRanges }, 'artist', 'attraction', 'L2B', now)!;
    await storeEvent(event(), raw);
    const [{ id }] = await db.query<{ id: string }>('SELECT id FROM events');
    const { fetcher, requested } = awin([
      row(),
      row({ merchant_product_id: '3', 'Tickets:event_date': '2027-03-06' }),
      row({ merchant_product_id: '4', 'Tickets:primary_artist': 'Someone Else' }),
      row({ merchant_product_id: '5', custom_5: 'BE' }),
      row({ merchant_product_id: '6', 'Tickets:venue_name': 'Zénith de Lille' }),
    ]);
    expect(await refreshFnacPrices(fetcher, now)).toEqual({
      configured: true,
      concerts: 1,
      matched: 1,
      priced: 1,
      ambiguous: 0,
    });
    // Only the column list of the address Awin issued is replaced.
    expect(requested[1]).toBe(
      feedUrl.replace('data_feed_id%2Cmerchant_id', encodeURIComponent(fnacFeedColumns.join(','))),
    );
    const sources = await db.query<{ provider: string; external_id: string; price_min: string }>(
      'SELECT provider,external_id,price_min FROM ticket_sources ORDER BY provider',
    );
    expect(sources).toMatchObject([
      { provider: 'fnac', external_id: '21085856' },
      { provider: 'ticketmaster', external_id: 'listing', price_min: null },
    ]);
    const feed = async () => (await getAppData()).allEvents.find((e) => e.id === id)!;
    const second = {
      provider: 'fnac',
      externalId: '21085856',
      host: 'www.fnacspectacles.com',
      price: 55,
      currency: 'EUR',
      observedAt: now.toISOString(),
    };
    expect(await feed()).toMatchObject({
      price: 55,
      currency: 'EUR',
      priceObservedAt: now.toISOString(),
      priceFromSecondSeller: true,
      secondSeller: second,
      url: raw.url,
    });
    // The concert's own price wins when it has one; the second seller stays listed.
    await storeEvent(event([{ min: 60, currency: 'EUR' }]), raw);
    expect(await feed()).toMatchObject({
      price: 60,
      priceFromSecondSeller: false,
      secondSeller: second,
    });
    const stored = (await feed()) as Concert;
    expect((await selectTicketSource(stored)).provider).toBe('ticketmaster');
    expect(
      (await selectTicketSource(stored, { provider: 'fnac', externalId: '21085856' })).url,
    ).toBe(link(1));
    // Without the concert's own link there is no silent switch to another seller.
    await db.query("UPDATE ticket_sources SET disabled_at=NOW() WHERE provider='ticketmaster'");
    await expect(selectTicketSource(stored)).rejects.toMatchObject({ status: 422 });
    await db.query("UPDATE ticket_sources SET disabled_at=NULL WHERE provider='ticketmaster'");
    // A day-old feed price is no longer shown; the link survives for a week.
    await storeEvent(event(), raw);
    await db.query("UPDATE ticket_sources SET observed_at=$1 WHERE provider='fnac'", [
      new Date(now.getTime() - 86400001),
    ]);
    expect(await feed()).toMatchObject({
      price: null,
      priceFromSecondSeller: false,
      secondSeller: { price: null },
    });
    await db.query("UPDATE ticket_sources SET observed_at=$1 WHERE provider='fnac'", [
      new Date(now.getTime() - 8 * 86400000),
    ]);
    expect((await feed()).secondSeller).toBeNull();
    // A sold-out session keeps its link without a price.
    expect(
      await refreshFnacPrices(awin([row({ stock_quantity: '6 - NO_AMOUNT' })]).fetcher, now),
    ).toMatchObject({ matched: 1, priced: 0 });
    expect(await feed()).toMatchObject({ price: null, secondSeller: { price: null } });
    for (const status of ['cancelled', 'postponed'] as const) {
      await storeEvent({ ...event(), status }, raw);
      expect((await feed()).secondSeller).toBeNull();
      expect(await refreshFnacPrices(awin([row()]).fetcher, now)).toMatchObject({ concerts: 0 });
    }
  } finally {
    await pg.close();
  }
});

it('records two sessions it cannot tell apart instead of choosing one', async () => {
  const { pg, db } = await database();
  try {
    const now = new Date();
    const untimed = { ...raw, dates: { ...raw.dates, start: { localDate: '2027-03-05' } } };
    await storeEvent(normalizeTicketmaster(untimed, 'artist', 'attraction', 'L2B', now)!, untimed);
    const { fetcher } = awin([row(), row({ merchant_product_id: '2', custom_7: '15:00' })]);
    expect(await refreshFnacPrices(fetcher, now)).toMatchObject({ matched: 0, ambiguous: 1 });
    expect(await db.query("SELECT 1 FROM ticket_sources WHERE provider='fnac'")).toEqual([]);
    expect(await db.query('SELECT provider,external_id,reason FROM normalization_reviews')).toEqual(
      [{ provider: 'fnac', external_id: '2', reason: 'ambiguous_session' }],
    );
  } finally {
    await pg.close();
  }
});

it('stays off without configuration and fails without leaking the feed address', async () => {
  const { pg } = await database();
  try {
    const now = new Date();
    await storeEvent(normalizeTicketmaster(raw, 'artist', 'attraction', 'L2B', now)!, raw);
    configured.url = undefined;
    const idle = awin([row()]);
    expect(await refreshFnacPrices(idle.fetcher, now)).toMatchObject({ configured: false });
    expect(idle.requested).toEqual([]);
    configured.url = `${feedList}/1/feedList`;
    for (const body of [
      list('pending'),
      list('active', 'https://evil.example/datafeed/columns/a/'),
      list('active', feedUrl.replace('/compression/gzip', '/compression/zip')),
      'not a feed list',
    ]) {
      const { fetcher, requested } = awin([row()], body);
      const failure = await refreshFnacPrices(fetcher, now).catch((error: Error) => error);
      expect(failure).toBeInstanceOf(Error);
      expect(String((failure as Error).message)).not.toMatch(/apikey|https?:/i);
      expect(requested).toHaveLength(1);
    }
    const down = (async () => new Response('no', { status: 500 })) as typeof fetch;
    await expect(refreshFnacPrices(down, now)).rejects.toMatchObject({ status: 500 });
  } finally {
    await pg.close();
  }
});
