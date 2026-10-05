import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { query } from './db';
import { authSchema, intentSchema, preferencesSchema, analyticNames } from '../domain/validation';
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
import { getAppData, recordAnalytics, userLists } from './data';
import { env } from './env';
import { beginSpotify, finishSpotify, spotifyArtists } from './providers/spotify';
import { searchArtists, syncArtists } from './providers/ticketmaster';
import { safeTicketUrl } from '../domain/normalization';
import { ProviderError } from './providers/http';
import { runConcertChecks } from './jobs';
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
        if (url.searchParams.get('error'))
          return NextResponse.redirect(new URL('/app/settings?music=denied', env().APP_URL));
        try {
          await finishSpotify(
            user.id,
            url.searchParams.get('state') ?? '',
            url.searchParams.get('code') ?? '',
          );
          await recordAnalytics(user, 'spotify_connected');
          return NextResponse.redirect(new URL('/app/artists?music=connected', env().APP_URL));
        } catch {
          return NextResponse.redirect(new URL('/app/settings?music=failed', env().APP_URL));
        }
      }
      const user = await requireUser();
      if (key === 'artists/search') {
        await rateLimit(`search:${user.id}`, 10, 60);
        const term = z.string().min(2).max(100).parse(url.searchParams.get('q'));
        return ok({ artists: await searchArtists(term) });
      }
      if (key === 'spotify/artists') return ok({ artists: await spotifyArtists(user.id) });
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
          'SELECT event_id,provider,created_at FROM affiliate_clicks WHERE user_id=$1',
          [user.id],
        );
        return NextResponse.json(
          { user, ...lists, alerts, analytics, clicks },
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
      await ownEvent(input.eventId, user);
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
        await recordAnalytics(
          user,
          input.action === 'saved' ? 'concert_saved' : 'concert_dismissed',
          { eventId: input.eventId, source: input.source },
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
    if (key === 'spotify/connect') return ok({ url: await beginSpotify(user.id) });
    if (key === 'spotify/disconnect') {
      await query('DELETE FROM music_accounts WHERE user_id=$1', [user.id]);
      await query('DELETE FROM oauth_attempts WHERE user_id=$1', [user.id]);
      return ok();
    }
    if (key === 'sync') {
      await rateLimit(`sync:${user.id}`, 3, 3600);
      return ok(await syncArtists(user.id));
    }
    if (key === 'outbound') {
      const { eventId } = z.object({ eventId: z.string() }).parse(await body(request));
      const event = await ownEvent(eventId, user);
      if (event.provider === 'sample' || !event.url || !safeTicketUrl(event.url))
        throw new HttpError(422, 'No verified ticket link is available for this concert.');
      if (['cancelled', 'postponed'].includes(event.status))
        throw new HttpError(422, 'Check the seller for changes before buying.');
      await query(
        'INSERT INTO affiliate_clicks(id,user_id,event_id,provider) VALUES($1,$2,$3,$4)',
        [randomUUID(), user.id, event.id, event.provider],
      );
      await query(
        "INSERT INTO feedback(user_id,event_id,action) VALUES($1,$2,'clicked') ON CONFLICT(user_id,event_id) DO NOTHING",
        [user.id, event.id],
      );
      await recordAnalytics(user, 'ticket_link_clicked', { eventId: event.id });
      return ok({ url: event.url });
    }
    if (key === 'analytics') {
      const input = z
        .object({ name: z.enum(analyticNames), eventId: z.string().max(160).optional() })
        .parse(await body(request));
      await recordAnalytics(user, input.name, { eventId: input.eventId });
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
    if (error instanceof ProviderError)
      return okError(error.message, error.status === 429 ? 429 : 502);
    if (error instanceof z.ZodError)
      return okError(error.issues[0]?.message ?? 'Check the form and try again.', 400);
    // Never log request bodies, provider URLs, tokens or personal information.
    console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
    return okError('The request could not be completed. Please try again.', 500);
  }
}
function okError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}
