import { csvRecords } from '../../domain/csv';
import {
  fnacFeedColumns,
  fnacKey,
  fnacSession,
  matchFnacSession,
  type FnacSession,
  type FnacTarget,
} from '../../domain/fnac';
import type { Concert } from '../../domain/types';
import { query } from '../db';
import { env } from '../env';
import { recordNormalizationReview } from '../identity';
import { ProviderError } from './http';

// Fnac Spectacles is a second seller for concerts already in the catalogue: this reads the Awin
// product feed and attaches each exactly matched session as its own `ticket_sources` row. It
// never creates concerts and never writes into another seller's row.
const advertiserId = '12494';
// The programme's regions. Ticketmaster stays the only source elsewhere.
const markets = ['FR', 'BE', 'CH'];
const unavailable = 'Fnac Spectacles prices are unavailable. Try again later.';

export type FnacRefresh = {
  configured: boolean;
  concerts: number;
  matched: number;
  priced: number;
  ambiguous: number;
};

// Awin addresses carry the account's feed key: errors never include a URL or a response body.
async function download(url: string, fetcher: typeof fetch, timeout: number) {
  let response: Response;
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(timeout), cache: 'no-store' });
  } catch {
    throw new ProviderError(unavailable, 504);
  }
  if (!response.ok || !response.body) throw new ProviderError(unavailable, response.status || 502);
  return response.body;
}
async function* text(body: ReadableStream<Uint8Array>, gzip: boolean) {
  const bytes = gzip
    ? body.pipeThrough(new DecompressionStream('gzip') as TransformStream<Uint8Array, Uint8Array>)
    : body;
  const reader = bytes
    .pipeThrough(new TextDecoderStream() as TransformStream<Uint8Array, string>)
    .getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield value;
  }
}
/** CSV records as objects keyed by the header row, limited to the requested columns. */
async function* rows(chunks: AsyncIterable<string>, columns: string[]) {
  let positions: number[] | null = null;
  for await (const record of csvRecords(chunks)) {
    if (!positions) {
      positions = columns.map((column) => record.indexOf(column));
      if (positions.includes(-1)) throw new ProviderError(unavailable, 502);
      continue;
    }
    const row: Record<string, string> = {};
    for (const [index, column] of columns.entries()) row[column] = record[positions[index]] ?? '';
    yield row;
  }
  if (!positions) throw new ProviderError(unavailable, 502);
}

// The feed list names each feed this account may download and the address to use. Only the
// column list is replaced, so the request stays the one Awin issued for this advertiser.
async function feedAddress(listUrl: string, fetcher: typeof fetch) {
  const list = text(await download(listUrl, fetcher, 20000), false);
  for await (const row of rows(list, ['Advertiser ID', 'Membership Status', 'URL'])) {
    if (
      row['Advertiser ID'] !== advertiserId ||
      row['Membership Status'].toLowerCase() !== 'active'
    )
      continue;
    let url: URL;
    try {
      url = new URL(row.URL);
    } catch {
      break;
    }
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'productdata.awin.com' ||
      !/\/format\/csv\//.test(url.pathname) ||
      !/\/delimiter\/%2C\//i.test(url.pathname) ||
      !/\/compression\/gzip\//.test(url.pathname) ||
      !/\/columns\/[^/]+\//.test(url.pathname)
    )
      break;
    return row.URL.replace(
      /\/columns\/[^/]+\//,
      `/columns/${encodeURIComponent(fnacFeedColumns.join(','))}/`,
    );
  }
  throw new ProviderError('The Fnac Spectacles feed is not available to this Awin account.', 502);
}

async function upcomingConcerts(now: Date) {
  const events = await query<{ id: string; data: Concert }>(
    `SELECT id,data FROM events WHERE sample=FALSE AND data->>'date' >= $1
       AND data->>'country' = ANY($2::text[])
       AND data->>'status' NOT IN ('cancelled','postponed')`,
    [now.toISOString().slice(0, 10), markets],
  );
  const names = new Map(
    (
      await query<{ id: string; name: string }>(
        "SELECT id,data->>'name' AS name FROM artists WHERE id=ANY($1)",
        [[...new Set(events.flatMap(({ data }) => data.artistIds))]],
      )
    ).map(({ id, name }) => [id, name]),
  );
  return events.map(({ id, data }): FnacTarget => ({
    id,
    artists: [
      ...new Set([data.artist, ...data.artistIds.map((artistId) => names.get(artistId) ?? '')]),
    ].filter(Boolean),
    venue: data.venue,
    city: data.city,
    country: data.country,
    date: data.date,
    localTime: data.localTime,
  }));
}

async function refresh(fetcher: typeof fetch, now: Date): Promise<FnacRefresh> {
  const result = { configured: false, concerts: 0, matched: 0, priced: 0, ambiguous: 0 };
  const listUrl = env().AWIN_FEED_LIST_URL;
  if (!listUrl) return result;
  result.configured = true;
  const targets = await upcomingConcerts(now);
  result.concerts = targets.length;
  if (!targets.length) return result;

  const keysOf = (target: FnacTarget) =>
    target.artists.map((artist) => fnacKey(artist, target.date, target.country));
  const wanted = new Map<string, FnacSession[]>();
  for (const target of targets) for (const key of keysOf(target)) wanted.set(key, []);
  const feed = text(await download(await feedAddress(listUrl, fetcher), fetcher, 120000), true);
  for await (const row of rows(feed, fnacFeedColumns)) {
    const session = fnacSession(row);
    if (session) wanted.get(fnacKey(session.artist, session.date, session.country))?.push(session);
  }

  // A session belongs to one concert. Duplicate listings of the same show keep the one whose
  // start time agrees, then the lowest id, so repeated runs attach it to the same concert.
  const claims = new Map<string, { session: FnacSession; target: FnacTarget }>();
  for (const target of [...targets].sort((a, b) => a.id.localeCompare(b.id))) {
    const sessions = new Map(
      keysOf(target)
        .flatMap((key) => wanted.get(key) ?? [])
        .map((session) => [session.externalId, session]),
    );
    const { session, ambiguous } = matchFnacSession(target, [...sessions.values()]);
    if (ambiguous) {
      result.ambiguous++;
      const ids = [...sessions.keys()].sort();
      await recordNormalizationReview('event', 'fnac', ids[0], 'ambiguous_session', [target.id], {
        date: target.date,
        venue: target.venue,
        sessions: ids,
      });
    }
    if (!session) continue;
    const held = claims.get(session.externalId);
    const sameTime = (candidate: FnacTarget) => candidate.localTime?.slice(0, 5) === session.time;
    if (!held || (!sameTime(held.target) && sameTime(target)))
      claims.set(session.externalId, { session, target });
  }

  const matched = [...claims.values()];
  for (let start = 0; start < matched.length; start += 500) {
    const batch = matched.slice(start, start + 500);
    await query(
      `INSERT INTO ticket_sources(event_id,provider,external_id,url,price_min,price_max,currency,observed_at)
       SELECT event_id,'fnac',external_id,url,price_min,price_max,currency,$7::timestamptz
       FROM unnest($1::text[],$2::text[],$3::text[],$4::numeric[],$5::numeric[],$6::text[])
         AS s(event_id,external_id,url,price_min,price_max,currency)
       ON CONFLICT(provider,external_id) DO UPDATE SET event_id=EXCLUDED.event_id,url=EXCLUDED.url,
         price_min=EXCLUDED.price_min,price_max=EXCLUDED.price_max,currency=EXCLUDED.currency,
         observed_at=EXCLUDED.observed_at`,
      [
        batch.map(({ target }) => target.id),
        batch.map(({ session }) => session.externalId),
        batch.map(({ session }) => session.url),
        batch.map(({ session }) => session.price),
        batch.map(({ session }) => session.priceMax),
        batch.map(({ session }) => session.currency),
        now.toISOString(),
      ],
    );
  }
  result.matched = matched.length;
  result.priced = matched.filter(({ session }) => session.price !== null).length;
  return result;
}

// One download at a time: a second scheduler call joins the run in progress.
const state = globalThis as typeof globalThis & { encoreFnac?: Promise<FnacRefresh> };
export function refreshFnacPrices(fetcher: typeof fetch = fetch, now = new Date()) {
  state.encoreFnac ??= refresh(fetcher, now).finally(() => {
    state.encoreFnac = undefined;
  });
  return state.encoreFnac;
}
