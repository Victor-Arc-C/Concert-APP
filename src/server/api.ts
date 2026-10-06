import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { query } from './db';
import { authSchema, intentSchema, preferencesSchema } from '../domain/validation';
import { defaults } from '../domain/catalog';
import type { Concert, User } from '../domain/types';
import {
  checkOrigin,
  createSession,
  hashPassword,
  HttpError,
  logout,
  rateLimit,
  requireUser,
  verifyPassword,
} from './security';
import { getAppData, recordAnalytics, recordConcertAnalytics, userLists } from './data';
import { reportError } from './monitoring';
import { env } from './env';
import {
  beginSpotify,
  finishSpotify,
  spotifyArtists,
  cancelSpotify,
  disconnectSpotify,
  confirmSpotifyArtist,
} from './providers/spotify';
import { resolveSpotifyArtists, searchArtists, syncArtists } from './providers/ticketmaster';
import { ProviderError } from './providers/http';
import { runConcertChecks } from './jobs';
import { inviteCodes, inviteValid } from './invite';
import { ticketSources, selectTicketSource } from './tickets';
import { generateTripOptions } from './trips';
import type { SavedTrip } from '../domain/trip-types';


function onboardingSpotifyState(state: string) {
  try {
    return Buffer.from(state, 'base64url')[0] === 255;
  } catch {
    return false;
  }
}
async function body(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'The request is empty.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 20000) {
      await reader.cancel();
      throw new HttpError(413, 'This request is too large.');
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'The request could not be read.');
  }
}
async function artistExists(id: string) {
  if (!(await query('SELECT id FROM artists WHERE id=$1', [id])).length)
    throw new HttpError(404, 'Artist not found.');
}
async function ownEvent(id: string, user: User) {
  const [row] = await query<{ data: Concert }>(
    'SELECT data FROM events WHERE id=$1 AND sample=$2',
    [id, user.mode === 'sample'],
  );
  if (!row) throw new HttpError(404, 'Concert not found in this mode.');
  return row.data;
}
const ok = (data: unknown = { ok: true }) =>
  NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
export async function handleApi(request: Request, path: string[]): Promise<Response> {
  const key = path.join('/'),
    url = new URL(request.url);
  try {
    if (key === 'jobs' && request.method === 'POST') {
      const secret = env().CRON_SECRET,
        token = request.headers.get('authorization')?.replace(/^Bearer /, '');
      if (
        !secret ||
        !token ||
        Buffer.byteLength(secret) !== Buffer.byteLength(token) ||
        !timingSafeEqual(Buffer.from(secret), Buffer.from(token))
      )
        throw new HttpError(401, 'Invalid scheduler credentials.');
      return ok(await runConcertChecks());
    }
    if (request.method === 'GET') {
      if (key === 'state') return ok(await getAppData());
      if (key === 'spotify/callback') {
        const user = await requireUser();
        if (url.searchParams.get('error')) {
          await cancelSpotify(user.id, url.searchParams.get('state') ?? '');
          const destination = onboardingSpotifyState(url.searchParams.get('state') ?? '')
            ? '/onboarding'
            : '/app/artists';
          return NextResponse.redirect(new URL(`${destination}?music=denied`, env().APP_URL));
        }
        try {
          const destination = onboardingSpotifyState(url.searchParams.get('state') ?? '')
            ? '/onboarding'
            : '/app/artists';
          await finishSpotify(
            user.id,
            url.searchParams.get('state') ?? '',
            url.searchParams.get('code') ?? '',
          );
          await recordAnalytics(user, 'spotify_connected');
          return NextResponse.redirect(new URL(`${destination}?music=connected`, env().APP_URL));
        } catch {
          reportError('provider_failed');
          const destination = onboardingSpotifyState(url.searchParams.get('state') ?? '')
            ? '/onboarding'
            : '/app/artists';
          return NextResponse.redirect(new URL(`${destination}?music=failed`, env().APP_URL));
        }
      }
      const user = await requireUser();
      if (key === 'tickets')
        return ok({
          sources: await ticketSources(await ownEvent(url.searchParams.get('eventId') ?? '', user)),
        });
      if (key === 'trips') {
        const eventId = url.searchParams.get('eventId') ?? '';
        const event = await ownEvent(eventId, user);
        const options = await generateTripOptions(event, user);
        return ok({ options });
      }
      if (key === 'trips/saved') {
        const rows = await query<SavedTrip>(
          `SELECT id, user_id AS "userId", event_id AS "eventId", trip_option_id AS "tripOptionId",
           origin_city AS "originCity", destination_city AS "destinationCity", event_date AS "eventDate",
           trip_data AS "tripData", created_at AS "createdAt", updated_at AS "updatedAt"
           FROM saved_trips WHERE user_id=$1 ORDER BY created_at DESC`,
          [user.id],
        );
        return ok({ savedTrips: rows });
      }

      if (key === 'artists/search') {
        await rateLimit(`search:${user.id}`, 10, 60);
        const term = z.string().min(2).max(100).parse(url.searchParams.get('q'));
        return ok({ artists: await searchArtists(term) });
      }
      if (key === 'spotify/artists') {
        await rateLimit(`spotify:${user.id}`, 10, 60);
        return ok({ artists: await spotifyArtists(user.id) });
      }
      if (key === 'export') {
        const lists = await userLists(user.id);
        const alerts = await query('SELECT title,body,created_at FROM alerts WHERE user_id=$1', [
          user.id,
        ]);
        const analytics = await query(
          'SELECT name,properties,created_at FROM analytics WHERE user_id=$1',
          [user.id],
        );
        const clicks = await query(
          'SELECT event_id,provider,source_external_id,created_at FROM affiliate_clicks WHERE user_id=$1',
          [user.id],
        );
        return NextResponse.json(
          {
            user,
            ...lists,
            alerts,
            analytics,
            clicks,
            spotifyChoices: await query(
              'SELECT spotify_id,artist_id,affinity FROM spotify_artist_preferences WHERE user_id=$1',
              [user.id],
            ),
          },
          {
            headers: {
              'Content-Disposition': 'attachment; filename="encore-data.json"',
              'Cache-Control': 'no-store',
            },
          },
        );
      }
      throw new HttpError(404, 'This endpoint does not exist.');
    }
    if (request.method !== 'POST') throw new HttpError(405, 'Method not supported.');
    checkOrigin(request);
    if (key === 'auth/signup' || key === 'auth/login') {
      await rateLimit('auth-global', 100, 60);
      const input = authSchema.parse(await body(request));
      await rateLimit(`auth:${input.email}`, 8, 900);
      if (key === 'auth/signup') {
        if (!input.name) throw new HttpError(400, 'Add your name.');
        const codes = inviteCodes();
        if (codes.length) {
          // Checked before the account lookup so a missing code never reveals registered emails.
          await rateLimit('invite-global', 60, 900);
          if (!inviteValid(input.inviteCode, codes))
            throw new HttpError(
              403,
              'This invite code is not valid. Ask the person who invited you.',
            );
        }
        if ((await query('SELECT id FROM users WHERE email=$1', [input.email])).length)
          throw new HttpError(409, 'This account could not be created. Try signing in.');
        const id = randomUUID();
        await query(
          'INSERT INTO users(id,email,name,password_hash,preferences) VALUES($1,$2,$3,$4,$5)',
          [
            id,
            input.email,
            input.name,
            await hashPassword(input.password),
            JSON.stringify(defaults),
          ],
        );
        await createSession(id);
        return ok();
      }
      const [row] = await query<{ id: string; password_hash: string }>(
        'SELECT id,password_hash FROM users WHERE email=$1',
        [input.email],
      );
      const fallback = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
      const matches = await verifyPassword(input.password, row?.password_hash ?? fallback);
      if (!row || !matches) throw new HttpError(401, 'Email or password is incorrect.');
      await createSession(row.id);
      return ok();
    }
    const user = await requireUser();
    await rateLimit(`write:${user.id}`, 150, 60);
    if (key === 'auth/logout') {
      await logout();
      return ok();
    }
    if (key === 'onboarding') {
      const input = z
        .object({
          artistIds: z.array(z.string()).min(1).max(40),
          preferences: preferencesSchema,
          mode: z.enum(['sample', 'live']),
        })
        .parse(await body(request));
      for (const id of input.artistIds) await artistExists(id);
      await query('DELETE FROM affinities WHERE user_id=$1', [user.id]);
      for (const id of new Set(input.artistIds))
        await query('INSERT INTO affinities(user_id,artist_id) VALUES($1,$2)', [user.id, id]);
      await query(
        `INSERT INTO spotify_artist_preferences(user_id,spotify_id,artist_id,affinity)
         SELECT $1,p.external_id,p.artist_id,1
         FROM artist_provider_records p
         WHERE p.provider='spotify' AND p.artist_id=ANY($2)
         ON CONFLICT(user_id,spotify_id) DO UPDATE SET artist_id=EXCLUDED.artist_id,affinity=1`,
        [user.id, [...new Set(input.artistIds)]],
      );
      try {
        await resolveSpotifyArtists([...new Set(input.artistIds)]);
        await syncArtists(user.id);
      } catch (error) {
        if (!(error instanceof ProviderError) && !(error instanceof HttpError)) throw error;
        // Onboarding remains complete when provider resolution is unavailable.
      }
      await query('UPDATE users SET preferences=$1,mode=$2,onboarded=TRUE WHERE id=$3', [
        JSON.stringify(input.preferences),
        input.mode,
        user.id,
      ]);
      await recordAnalytics(
        { ...user, preferences: input.preferences, mode: input.mode },
        'onboarding_completed',
      );
      return ok();
    }
    if (key === 'preferences') {
      const input = preferencesSchema.parse(await body(request));
      await query('UPDATE users SET preferences=$1 WHERE id=$2', [JSON.stringify(input), user.id]);
      if (!input.analytics) await query('DELETE FROM analytics WHERE user_id=$1', [user.id]);
      if (input.notifications !== user.preferences.notifications && input.notifications !== 'off')
        await recordAnalytics({ ...user, preferences: input }, 'notification_enabled');
      return ok();
    }
    if (key === 'mode') {
      const input = z.object({ mode: z.enum(['sample', 'live']) }).parse(await body(request));
      await query('UPDATE users SET mode=$1 WHERE id=$2', [input.mode, user.id]);
      return ok();
    }
    if (key === 'affinity') {
      const input = z
        .object({
          artistId: z.string(),
          favorite: z.boolean(),
          hidden: z.boolean(),
          remove: z.boolean().optional(),
        })
        .parse(await body(request));
      await artistExists(input.artistId);
      if (input.remove)
        await query('DELETE FROM affinities WHERE user_id=$1 AND artist_id=$2', [
          user.id,
          input.artistId,
        ]);
      else
        await query(
          'INSERT INTO affinities(user_id,artist_id,favorite,hidden) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,artist_id) DO UPDATE SET favorite=EXCLUDED.favorite,hidden=EXCLUDED.hidden',
          [user.id, input.artistId, input.favorite, input.hidden],
        );
      return ok();
    }
    if (key === 'feedback') {
      const input = z
        .object({
          eventId: z.string(),
          action: z.enum(['saved', 'dismissed', 'clear']),
          source: z.enum(['feed', 'search', 'detail', 'saved']).default('detail'),
        })
        .parse(await body(request));
      const event = await ownEvent(input.eventId, user);
      if (input.action === 'clear')
        await query('DELETE FROM feedback WHERE user_id=$1 AND event_id=$2', [
          user.id,
          input.eventId,
        ]);
      else {
        await query(
          'INSERT INTO feedback(user_id,event_id,action) VALUES($1,$2,$3) ON CONFLICT(user_id,event_id) DO UPDATE SET action=EXCLUDED.action,created_at=NOW()',
          [user.id, input.eventId, input.action],
        );
        await recordConcertAnalytics(
          user,
          event,
          input.action === 'saved' ? 'concert_saved' : 'concert_dismissed',
          input.source,
        );
      }
      return ok();
    }
    if (key === 'feedback/reset') {
      await query("DELETE FROM feedback WHERE user_id=$1 AND action='dismissed'", [user.id]);
      return ok();
    }
    if (key === 'intent') {
      const raw = await body(request);
      const input = intentSchema.parse(raw);
      await artistExists(input.artistId);
      await query(
        'INSERT INTO intents(user_id,artist_id,data) VALUES($1,$2,$3) ON CONFLICT(user_id,artist_id) DO UPDATE SET data=EXCLUDED.data',
        [user.id, input.artistId, JSON.stringify(input)],
      );
      await query(
        'INSERT INTO affinities(user_id,artist_id,favorite) VALUES($1,$2,TRUE) ON CONFLICT(user_id,artist_id) DO UPDATE SET favorite=TRUE,hidden=FALSE',
        [user.id, input.artistId],
      );
      await recordAnalytics(user, 'must_see_clicked', { artistId: input.artistId });
      return ok();
    }
    if (key === 'intent/delete') {
      const { artistId } = z.object({ artistId: z.string() }).parse(await body(request));
      await query('DELETE FROM intents WHERE user_id=$1 AND artist_id=$2', [user.id, artistId]);
      return ok();
    }
    if (key === 'alerts/read') {
      const { id } = z.object({ id: z.string() }).parse(await body(request));
      await query('UPDATE alerts SET read_at=NOW() WHERE id=$1 AND user_id=$2', [id, user.id]);
      await recordAnalytics(user, 'notification_opened', { alertId: id });
      return ok();
    }
    if (key === 'spotify/confirm') {
      const input = z
        .object({ spotifyId: z.string().min(1).max(100), artistId: z.string().min(1).max(200) })
        .strict()
        .parse(await body(request));
      await rateLimit(`spotify:${user.id}`, 10, 60);
      await confirmSpotifyArtist(user.id, input.spotifyId, input.artistId);
      return ok();
    }
    if (key === 'spotify/connect') {
      const input = z
        .object({ returnTo: z.enum(['onboarding', 'artists']).default('artists') })
        .parse(await body(request));
      return ok({ url: await beginSpotify(user.id, input.returnTo) });
    }
    if (key === 'spotify/disconnect') {
      await disconnectSpotify(user.id);
      return ok();
    }
    if (key === 'sync') {
      await rateLimit(`sync:${user.id}`, 3, 3600);
      return ok(await syncArtists(user.id));
    }
    if (key === 'outbound') {
      const { eventId, source } = z
        .object({
          eventId: z.string(),
          source: z.object({ provider: z.string(), externalId: z.string() }).optional(),
        })
        .strict()
        .parse(await body(request));
      const event = await ownEvent(eventId, user);
      const selected = await selectTicketSource(event, source);
      if (['cancelled', 'postponed'].includes(event.status))
        throw new HttpError(422, 'Check the seller for changes before buying.');
      await query(
        'INSERT INTO affiliate_clicks(id,user_id,event_id,provider,source_external_id) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(), user.id, event.id, selected.provider, selected.externalId],
      );
      await query(
        "INSERT INTO feedback(user_id,event_id,action) VALUES($1,$2,'clicked') ON CONFLICT(user_id,event_id) DO NOTHING",
        [user.id, event.id],
      );
      await recordConcertAnalytics(user, event, 'ticket_link_clicked', 'detail');
      return ok({ url: selected.url });
    }
    if (key === 'trips/save') {
      const input = z
        .object({
          eventId: z.string().min(1),
          trip: z.object({
            id: z.string(),
            eventId: z.string(),
            originCity: z.string(),
            destinationCity: z.string(),
            destinationVenue: z.string(),
            eventDate: z.string(),
            ticketPrice: z.number().nullable(),
            ticketCurrency: z.string().nullable(),
            ticketObservedAt: z.string().nullable(),
            ticketProvider: z.string().nullable(),
            transport: z.any(),
            accommodation: z.any(),
            estimatedTotal: z.number().nullable(),
            totalCurrency: z.string().nullable(),
            scores: z.any(),
            label: z.string().nullable(),
            reasons: z.array(z.string()),
            generatedAt: z.string(),
          }),
        })
        .parse(await body(request));
      const event = await ownEvent(input.eventId, user);
      if (['cancelled', 'postponed'].includes(event.status)) {
        throw new HttpError(422, 'Cannot save a trip for a cancelled or postponed concert.');
      }
      const tripId = randomUUID();
      await query(
        `INSERT INTO saved_trips(id, user_id, event_id, trip_option_id, origin_city, destination_city, event_date, trip_data)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT(user_id, event_id, trip_option_id)
         DO UPDATE SET trip_data=EXCLUDED.trip_data, updated_at=NOW()`,
        [
          tripId,
          user.id,
          event.id,
          input.trip.id,
          input.trip.originCity,
          input.trip.destinationCity,
          input.trip.eventDate,
          JSON.stringify(input.trip),
        ],
      );
      await recordConcertAnalytics(user, event, 'concert_opened', 'detail');
      return ok();
    }
    if (key === 'trips/delete') {
      const input = z
        .object({
          eventId: z.string().min(1),
          tripOptionId: z.string().min(1),
        })
        .parse(await body(request));
      await query(
        'DELETE FROM saved_trips WHERE user_id=$1 AND event_id=$2 AND trip_option_id=$3',
        [user.id, input.eventId, input.tripOptionId],
      );
      return ok();
    }

    if (key === 'analytics') {
      const input = z
        .object({
          name: z.enum(['concert_impression', 'concert_opened']),
          eventId: z.string().min(1).max(160),
        })
        .strict()
        .parse(await body(request));
      const event = await ownEvent(input.eventId, user);
      await recordConcertAnalytics(
        user,
        event,
        input.name,
        input.name === 'concert_impression' ? 'feed' : 'detail',
      );
      return ok();
    }
    if (key === 'account/delete') {
      const input = z.object({ password: z.string().min(1) }).parse(await body(request));
      const [row] = await query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id=$1',
        [user.id],
      );
      if (!(await verifyPassword(input.password, row.password_hash)))
        throw new HttpError(403, 'Enter your current password to delete your account.');
      await query('DELETE FROM users WHERE id=$1', [user.id]);
      await logout();
      return ok();
    }
    throw new HttpError(404, 'This endpoint does not exist.');
  } catch (error) {
    if (error instanceof HttpError) return okError(error.message, error.status);
    if (error instanceof ProviderError) {
      reportError('provider_failed');
      return okError(error.message, error.status === 429 ? 429 : 502);
    }
    if (error instanceof z.ZodError)
      return okError(error.issues[0]?.message ?? 'Check the form and try again.', 400);
    // Never log request bodies, provider URLs, tokens or personal information.
    reportError('api_unexpected');
    return okError('The request could not be completed. Please try again.', 500);
  }
}
function okError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}
