import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { query } from '../db';
import { env } from '../env';
import { HttpError, rateLimit } from '../security';
import { providerJson } from './http';
import { fingerprint, normalizeTicketmaster } from '../../domain/normalization';
import type { Artist, Concert } from '../../domain/types';
export interface EventProvider {
  events(artist: Artist): Promise<{ event: Concert; raw: unknown }[]>;
}
const responseSchema = z.object({
  _embedded: z
    .object({
      events: z.array(z.unknown()).optional(),
      attractions: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    })
    .optional(),
  page: z.object({ totalPages: z.number() }).optional(),
});
async function request(path: string, params: Record<string, string>) {
  await rateLimit('ticketmaster-global-second', 2, 1);
  await rateLimit('ticketmaster-global-day', 4900, 86400);
  const url = new URL(`https://app.ticketmaster.com/discovery/v2/${path}.json`);
  url.search = new URLSearchParams({
    ...params,
    // The API defaults to English and otherwise omits French-only listings.
    locale: '*',
    apikey: env().TICKETMASTER_API_KEY ?? '',
  }).toString();
  return responseSchema.parse(await providerJson(url.toString()));
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
    const mapping = await query<{ artist_id: string }>(
      'SELECT artist_id FROM artist_provider_records WHERE provider=$1 AND external_id=$2',
      ['ticketmaster', attraction.id],
    );
    const id = mapping[0]?.artist_id ?? `tm-artist-${attraction.id}`;
    const artist: Artist = {
      id,
      name: attraction.name,
      genre: 'Live music',
      initials: attraction.name.slice(0, 2).toLowerCase(),
      color: '#867496',
      providerId: attraction.id,
    };
    await query(
      'INSERT INTO artists(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',
      [id, JSON.stringify(artist)],
    );
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
    const results: { event: Concert; raw: unknown }[] = [];
    for (let page = 0; page < 5; page++) {
      if (page) await new Promise((resolve) => setTimeout(resolve, 1100));
      const data = await request('events', {
        attractionId: artist.providerId,
        size: '100',
        page: String(page),
        sort: 'date,asc',
      });
      for (const raw of data._embedded?.events ?? []) {
        const event = normalizeTicketmaster(raw, artist.id, artist.providerId, artist.name);
        if (event) results.push({ event, raw });
      }
      if (page + 1 >= (data.page?.totalPages ?? 1)) break;
    }
    return results;
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
  const id = mapping[0]?.event_id ?? same[0]?.id ?? randomUUID();
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
