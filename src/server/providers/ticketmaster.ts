import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { query } from '../db';
import { env } from '../env';
import { HttpError, rateLimit } from '../security';
import { ProviderError, providerJson } from './http';
import {
  compareEventIdentity,
  fingerprint,
  normalizeArtistName,
  normalizeTicketmaster,
} from '../../domain/normalization';
import type { Artist, Concert } from '../../domain/types';
import { recordNormalizationReview, resolveArtistIdentity } from '../identity';
import { attractionImage } from '../../domain/artist-image';
export interface EventProvider {
  events(artist: Artist): Promise<{ event: Concert; raw: unknown }[]>;
}
// Reviewed provider IDs, not a name-based alias rule. See docs/ARTIST_RECORDS.md.
const verifiedAttractionFamilies = [['K8vZ917KBrV', 'K8vZ917pPdf']];
const maxArtistRequests = 5;
const responseSchema = z.object({
  _embedded: z
    .object({
      events: z.array(z.unknown()).optional(),
      attractions: z
        .array(z.object({ id: z.string(), name: z.string(), images: z.unknown().optional() }))
        .optional(),
    })
    .optional(),
  page: z.object({ totalPages: z.number() }).optional(),
});
async function request(path: string, params: Record<string, string>) {
  const [cooldown] = await query<{ seconds: number }>(
    "SELECT EXTRACT(EPOCH FROM retry_at-NOW()) AS seconds FROM provider_backoff WHERE provider='ticketmaster' AND retry_at>NOW()",
  );
  if (cooldown?.seconds)
    throw new ProviderError(
      'Concert provider retry is scheduled. Please try again later.',
      429,
      Number(cooldown.seconds),
    );
  await rateLimit('ticketmaster-global-second', 2, 1);
  await rateLimit('ticketmaster-global-day', 4900, 86400);
  const url = new URL(`https://app.ticketmaster.com/discovery/v2/${path}.json`);
  url.search = new URLSearchParams({
    ...params,
    // The API defaults to English and otherwise omits French-only listings.
    locale: '*',
    apikey: env().TICKETMASTER_API_KEY ?? '',
  }).toString();
  try {
    return responseSchema.parse(await providerJson(url.toString()));
  } catch (error) {
    if (error instanceof ProviderError && (error.status === 429 || error.status >= 500)) {
      const seconds = Math.max(900, error.retryAfter ?? 0);
      await query(
        "INSERT INTO provider_backoff(provider,retry_at) VALUES('ticketmaster',NOW()+($1 * INTERVAL '1 second')) ON CONFLICT(provider) DO UPDATE SET retry_at=GREATEST(provider_backoff.retry_at,EXCLUDED.retry_at)",
        [seconds],
      );
    }
    throw error;
  }
}

function searchTerms(name: string) {
  const normalized = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return [...new Set([name, normalized].filter(Boolean))];
}

async function discoverAttractions(name: string) {
  const attractions = new Map<string, { id: string; name: string }>();
  for (const keyword of searchTerms(name)) {
    const data = await request('attractions', {
      keyword,
      classificationName: 'music',
      size: '20',
    });
    for (const attraction of data._embedded?.attractions ?? [])
      attractions.set(attraction.id, attraction);
  }
  return [...attractions.values()];
}

export async function resolveSpotifyArtists(artistIds: string[]) {
  if (!env().TICKETMASTER_API_KEY) return { resolved: [], unresolved: artistIds };
  const rows = await query<{ id: string; name: string; data: Artist }>(
    `SELECT a.id,a.data->>'name' AS name,a.data
     FROM artists a
     JOIN artist_provider_records p ON p.artist_id=a.id AND p.provider='spotify'
     WHERE a.id=ANY($1)`,
    [artistIds],
  );
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const [index, artist] of rows.entries()) {
    if (index) await new Promise((resolve) => setTimeout(resolve, 550));
    try {
      if (artist.data.providerId) {
        resolved.push(artist.id);
        continue;
      }
      const [mapped] = await query<{ external_id: string }>(
        'SELECT external_id FROM artist_provider_records WHERE provider=$1 AND artist_id=$2',
        ['ticketmaster', artist.id],
      );
      if (mapped) {
        await query(
          `UPDATE artists SET data=jsonb_set(data,'{providerId}',$2::jsonb,TRUE)
           WHERE id=$1`,
          [artist.id, JSON.stringify(mapped.external_id)],
        );
        resolved.push(artist.id);
        continue;
      }
      const attractions = await discoverAttractions(artist.name);
      const exact = attractions.filter(
        (attraction) => normalizeArtistName(attraction.name) === normalizeArtistName(artist.name),
      );
      if (exact.length !== 1) {
        unresolved.push(artist.id);
        if (exact.length > 1)
          await recordNormalizationReview(
            'artist',
            'ticketmaster',
            artist.id,
            'automatic_name_collision',
            exact.map((attraction) => attraction.id),
            { name: artist.name },
          );
        continue;
      }
      const [existing] = await query<{ artist_id: string }>(
        'SELECT artist_id FROM artist_provider_records WHERE provider=$1 AND external_id=$2',
        ['ticketmaster', exact[0].id],
      );
      if (existing && existing.artist_id !== artist.id) {
        unresolved.push(artist.id);
        continue;
      }
      await query(
        `UPDATE artists SET data=jsonb_set(data,'{providerId}',$2::jsonb,TRUE)
         WHERE id=$1`,
        [artist.id, JSON.stringify(exact[0].id)],
      );
      await query(
        `INSERT INTO artist_provider_records(provider,external_id,artist_id)
         VALUES($1,$2,$3) ON CONFLICT(provider,external_id) DO NOTHING`,
        ['ticketmaster', exact[0].id, artist.id],
      );
      resolved.push(artist.id);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      unresolved.push(artist.id);
    }
  }
  return { resolved, unresolved };
}
export async function searchArtists(term: string): Promise<Artist[]> {
  if (!env().TICKETMASTER_API_KEY)
    throw new HttpError(503, 'Add a Ticketmaster API key to search the live artist catalogue.');
  const data = await request('attractions', {
    keyword: term,
    classificationName: 'music',
    size: '12',
  });
  const found: Artist[] = [];
  for (const attraction of data._embedded?.attractions ?? []) {
    const identity = await resolveArtistIdentity('ticketmaster', attraction.id, attraction.name);
    const id = identity.artistId ?? `tm-artist-${attraction.id}`;
    const artist: Artist = {
      id,
      name: attraction.name,
      genre: 'Live music',
      initials: attraction.name.slice(0, 2).toLowerCase(),
      color: '#867496',
      providerId: attraction.id,
    };
    await query(
      'INSERT INTO artists(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=artists.data || EXCLUDED.data',
      [id, JSON.stringify(artist)],
    );
    // A Ticketmaster photo fills the gap only; a photo the artist already has (Spotify) stays.
    const image = attractionImage(attraction.images);
    if (image) {
      const [row] = await query<{ image: string | null }>(
        `UPDATE artists SET data=jsonb_set(data,'{image}',to_jsonb(COALESCE(data->>'image',$2::text)),TRUE)
         WHERE id=$1 RETURNING data->>'image' AS image`,
        [id, image],
      );
      if (row?.image) artist.image = row.image;
    }
    await query(
      'INSERT INTO artist_provider_records(provider,external_id,artist_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      ['ticketmaster', attraction.id, id],
    );
    found.push(artist);
  }
  return found;
}
export class TicketmasterProvider implements EventProvider {
  async events(artist: Artist) {
    if (!artist.providerId)
      throw new HttpError(
        422,
        `Choose ${artist.name} from the live artist search to confirm its identity.`,
      );
    const mapped = await query<{ external_id: string }>(
      'SELECT external_id FROM artist_provider_records WHERE provider=$1 AND artist_id=$2 ORDER BY external_id',
      ['ticketmaster', artist.id],
    );
    const attractionIds = [
      ...new Set(
        [artist.providerId, ...mapped.map((row) => row.external_id)].flatMap(
          (id) => verifiedAttractionFamilies.find((family) => family.includes(id)) ?? [id],
        ),
      ),
    ];
    if (attractionIds.length > maxArtistRequests)
      throw new HttpError(
        422,
        'This artist has too many linked records for this pilot. Contact support.',
      );

    const results = new Map<string, { event: Concert; raw: unknown }>();
    let activeIds = attractionIds;
    let requests = 0;
    // Read each regional record once before spending the remaining shared budget on paging.
    for (let page = 0; activeIds.length && requests < maxArtistRequests; page++) {
      const nextIds: string[] = [];
      for (const attractionId of activeIds) {
        if (requests >= maxArtistRequests) break;
        if (requests) await new Promise((resolve) => setTimeout(resolve, 1100));
        const data = await request('events', {
          attractionId,
          size: '100',
          page: String(page),
          sort: 'date,asc',
        });
        requests++;
        for (const raw of data._embedded?.events ?? []) {
          const event = normalizeTicketmaster(raw, artist.id, attractionId, artist.name);
          if (event) results.set(event.externalId, { event, raw });
        }
        if (page + 1 < (data.page?.totalPages ?? 1)) nextIds.push(attractionId);
      }
      activeIds = nextIds;
    }
    return [...results.values()];
  }
}
export async function storeEvent(event: Concert, raw: unknown) {
  const mapping = await query<{ event_id: string }>(
    'SELECT event_id FROM event_provider_records WHERE provider=$1 AND external_id=$2',
    [event.provider, event.externalId],
  );
  const same = await query<{ id: string }>('SELECT id FROM events WHERE fingerprint=$1', [
    fingerprint(event),
  ]);
  let id = mapping[0]?.event_id ?? same[0]?.id;
  if (!id && !event.localTime) {
    const candidates = await query<{ id: string; data: Concert }>(
      "SELECT id,data FROM events WHERE sample=FALSE AND data->>'date'=$1",
      [event.date],
    );
    const ambiguous = candidates.filter(
      ({ data }) => compareEventIdentity(event, data) === 'ambiguous',
    );
    if (ambiguous.length)
      await recordNormalizationReview(
        'event',
        event.provider,
        event.externalId,
        'missing_time_candidate',
        ambiguous.map(({ id: candidateId }) => candidateId),
        { date: event.date, venue: event.venue, city: event.city, artistIds: event.artistIds },
      );
  }
  id ??= randomUUID();
  const previous = await query<{ data: Concert }>('SELECT data FROM events WHERE id=$1', [id]);
  if (previous[0])
    event = {
      ...event,
      artistIds: [...new Set([...previous[0].data.artistIds, ...event.artistIds])],
    };
  await query(
    'INSERT INTO events(id,fingerprint,data,sample) VALUES($1,$2,$3,FALSE) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,fingerprint=EXCLUDED.fingerprint',
    [id, fingerprint(event), JSON.stringify({ ...event, id })],
  );
  await query(
    `INSERT INTO ticket_sources(event_id,provider,external_id,url,price_min,currency,observed_at)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(provider,external_id) DO UPDATE SET event_id=EXCLUDED.event_id,url=EXCLUDED.url,
       price_min=EXCLUDED.price_min,currency=EXCLUDED.currency,observed_at=EXCLUDED.observed_at`,
    [id, event.provider, event.externalId, event.url, event.price, event.currency, event.fetchedAt],
  );
  await query(
    'INSERT INTO event_provider_records(provider,external_id,event_id,raw) VALUES($1,$2,$3,$4) ON CONFLICT(provider,external_id) DO UPDATE SET raw=EXCLUDED.raw,fetched_at=NOW()',
    [event.provider, event.externalId, id, JSON.stringify(raw)],
  );
}
async function performSync(userId: string) {
  if (!env().TICKETMASTER_API_KEY)
    throw new HttpError(
      503,
      'Live concerts need a Ticketmaster API key. Sample mode remains available in settings.',
    );
  const rows = await query<{ data: Artist }>(
    'SELECT a.data FROM artists a JOIN affinities f ON f.artist_id=a.id WHERE f.user_id=$1 AND f.hidden=FALSE',
    [userId],
  );
  const messages: string[] = [];
  const liveArtists = rows.filter(({ data }) => data.providerId);
  const skipped = rows.length - liveArtists.length;
  if (!liveArtists.length)
    return {
      count: 0,
      failed: 0,
      message:
        'No live artists followed yet. Open Find live artists, search for an artist, and follow the correct result. Your sample selections are kept separately.',
    };
  let count = 0;
  for (const { data: artist } of liveArtists) {
    const cached = await query<{ message: string | null }>(
      "SELECT message FROM provider_sync WHERE artist_id=$1 AND ((message IS NULL AND checked_at>NOW()-INTERVAL '1 hour') OR (message IS NOT NULL AND checked_at>NOW()-INTERVAL '15 minutes'))",
      [artist.id],
    );
    if (cached.length) {
      if (cached[0].message) messages.push(cached[0].message);
      continue;
    }
    try {
      for (const item of await new TicketmasterProvider().events(artist)) {
        await storeEvent(item.event, item.raw);
        count++;
      }
      await query(
        'INSERT INTO provider_sync(artist_id) VALUES($1) ON CONFLICT(artist_id) DO UPDATE SET checked_at=NOW(),message=NULL',
        [artist.id],
      );
    } catch (error) {
      const message =
        error instanceof HttpError
          ? error.message
          : 'Concert provider check failed. We’ll retry in 15 minutes.';
      messages.push(message);
      await query(
        'INSERT INTO provider_sync(artist_id,message) VALUES($1,$2) ON CONFLICT(artist_id) DO UPDATE SET checked_at=NOW(),message=EXCLUDED.message',
        [artist.id, message],
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return {
    count,
    failed: messages.length,
    message: messages.length
      ? [...new Set(messages)].join(' ')
      : `Concert listings are up to date. Coverage is limited to Ticketmaster.${skipped ? ` ${skipped} sample artist${skipped === 1 ? ' was' : 's were'} skipped.` : ''}`,
  };
}

// Serialize manual and scheduled imports in the single-process local pilot.
const syncState = globalThis as typeof globalThis & { encoreSyncQueue?: Promise<unknown> };
export function syncArtists(userId: string) {
  const task = (syncState.encoreSyncQueue ?? Promise.resolve()).then(() => performSync(userId));
  syncState.encoreSyncQueue = task.catch(() => undefined);
  return task;
}
