import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { query } from './db';
import {
  authSchema,
  betaFeedbackSchema,
  intentSchema,
  preferencesSchema,
} from '../domain/validation';
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
import { schedulerAuthorized } from './scheduler-auth';
import { unsupportedLiveArtists } from '../domain/onboarding';
import { inviteCodes, inviteValid } from './invite';
import { ticketSources, selectTicketSource } from './tickets';
import { generateTripOptions } from './trips';
import { savedTripsForUser, saveTrip, tripEvent } from './saved-trips';
import { exportBetaFeedback, saveBetaFeedback } from './beta-feedback';
import { joinWaitlist, publicGigs, waitlistSchema } from './marketing';

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
    if (key === 'jobs' && (request.method === 'POST' || request.method === 'GET')) {
      // GET is what Vercel Cron sends (see vercel.json); POST is kept for external schedulers.
      if (!schedulerAuthorized(request.headers.get('authorization'), env().CRON_SECRET))
        throw new HttpError(401, 'Invalid scheduler credentials.');
      return ok(await runConcertChecks());
    }
    if (request.method === 'GET') {
      if (key === 'state') return ok(await getAppData());
      if (key === 'gigs')
        return NextResponse.json(await publicGigs(), {
          headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
        });
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
        // Each plan can call live travel providers with shared daily quotas.
        await rateLimit(`trips:${user.id}`, 20, 60);
        const eventId = url.searchParams.get('eventId') ?? '';
        await ownEvent(eventId, user);
        const event = await tripEvent(eventId);
        if (!event) throw new HttpError(404, 'Concert not found.');
        const options = await generateTripOptions(event, user);
        return ok({ options });
      }
      if (key === 'trips/saved') {
        await rateLimit(`trips:${user.id}`, 20, 60);
        return ok({ savedTrips: await savedTripsForUser(user) });
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
            betaFeedback: await exportBetaFeedback(user.id),
            savedTrips: await query(
              'SELECT id,event_id,trip_option_id,origin_city,destination_city,event_date,trip_data,created_at,updated_at FROM saved_trips WHERE user_id=$1',
              [user.id],
            ),
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
    if (key === 'waitlist') {
      await rateLimit('waitlist-global', 300, 60);
      const input = waitlistSchema.parse(await body(request));
      await rateLimit(`waitlist:${input.email}`, 5, 3600);
      await joinWaitlist(input);
      return ok();
    }
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
          source: z.enum(['manual', 'spotify', 'mixed', 'demo']).optional(),
        })
        .parse(await body(request));
      for (const id of input.artistIds) await artistExists(id);
      if (input.mode === 'live') {
        // Never complete a live onboarding that would silently show nothing but fiction.
        if (!env().TICKETMASTER_API_KEY)
          throw new HttpError(
            503,
            'Live concerts are not available right now. Try again later or explore the demo.',
          );
        const backed = await query<{ artist_id: string }>(
          'SELECT DISTINCT artist_id FROM artist_provider_records WHERE artist_id=ANY($1)',
          [[...new Set(input.artistIds)]],
        );
        if (
          unsupportedLiveArtists(
            input.artistIds,
            backed.map((row) => row.artist_id),
          ).length
        )
          throw new HttpError(400, 'Choose artists from the live search to see real concerts.');
      }
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
        input.source ? { source: input.source } : {},
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
      const event = await saveTrip(user, await body(request));
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

    if (key === 'beta-feedback') {
      await saveBetaFeedback(user, betaFeedbackSchema.parse(await body(request)));
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
