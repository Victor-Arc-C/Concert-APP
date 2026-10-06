import { randomUUID } from 'node:crypto';
import { displayPrice } from '../domain/pricing';
import { query } from './db';
import { currentUser } from './security';
import { env, spotifyAvailable, automaticConcertChecks } from './env';
import { inviteRequired } from './invite';
import { defaults } from '../domain/catalog';
import { europe, rankEvents } from '../domain/recommendations';
import { safeTicketUrl } from '../domain/normalization';
import { reportError } from './monitoring';
import type {
  Affinity,
  Alert,
  AppData,
  Artist,
  Concert,
  Feedback,
  Intent,
  User,
} from '../domain/types';
import type { SavedTrip } from '../domain/trip-types';

export async function userLists(userId: string) {
  const [affinities, intents, feedback] = await Promise.all([
    query<Affinity>(
      'SELECT artist_id AS "artistId",favorite,hidden FROM affinities WHERE user_id=$1',
      [userId],
    ),
    query<{ data: Intent }>('SELECT data FROM intents WHERE user_id=$1', [userId]),
    query<Feedback>('SELECT event_id AS "eventId",action FROM feedback WHERE user_id=$1', [userId]),
  ]);
  return { affinities, intents: intents.map((i) => i.data), feedback };
}
export async function evaluateAlerts(
  user: User,
  events: Concert[],
  affinities: Affinity[],
  intents: Intent[],
  feedback: Feedback[],
) {
  if (user.preferences.notifications === 'off') return;
  const ranked = rankEvents(events, affinities, intents, feedback, user.preferences);
  for (const event of ranked) {
    const until = event.saleAt ? new Date(event.saleAt).getTime() - Date.now() : Infinity;
    const critical = until > 0 && until <= 24 * 3600000;
    if (user.preferences.notifications === 'critical' && !critical) continue;
    const important =
      event.tier === 'Must see' ||
      event.city.toLowerCase() === user.preferences.home.toLowerCase() ||
      affinities.some((a) => a.favorite && !a.hidden && event.artistIds.includes(a.artistId));
    if (user.preferences.notifications === 'important' && !critical && !important) continue;
    const kind = critical ? `sale-${event.saleAt}` : 'discovery';
    await query(
      'INSERT INTO alerts(id,user_id,event_id,kind,title,body) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,event_id,kind) DO NOTHING',
      [
        randomUUID(),
        user.id,
        event.id,
        kind,
        critical ? `${event.artist}: sale within 24 hours` : `${event.artist} in ${event.city}`,
        `${event.provider === 'sample' ? 'Sample event. ' : ''}${event.venue}, ${event.date}. ${critical ? 'Check the official seller for sale details.' : 'A new opportunity for an artist you follow.'}`,
      ],
    );
  }
}
/** Live discovery candidates beyond the user's own artists (other followed live artists). */
export const LIVE_DISCOVERY_LIMIT = 100;
// One live response must stay far below Vercel's 4.5 MB limit however many artists other
// accounts follow: the user's saved/dismissed/clicked/alerted concerts and saved trips, upcoming
// European dates of their own (followed or hidden) artists, and a capped set of the nearest
// other upcoming European concerts for discovery.
export const LIVE_EVENTS_SQL = `
  SELECT e.data,t.price_min::float AS price,t.currency,
    t.observed_at AS "observedAt",t.disabled_at AS "disabledAt"
  FROM events e LEFT JOIN ticket_sources t ON t.event_id=e.id
    AND t.provider=e.data->>'provider' AND t.external_id=e.data->>'externalId'
  WHERE e.sample=FALSE AND (
    e.id IN (SELECT event_id FROM feedback WHERE user_id=$1
             UNION SELECT event_id FROM alerts WHERE user_id=$1
             UNION SELECT event_id FROM saved_trips WHERE user_id=$1)
    OR (e.data->>'date' >= $2 AND e.data->>'country' = ANY($3::text[]) AND (
      e.data->'artistIds' ?| $4::text[]
      OR e.id IN (SELECT d.id FROM events d
                  WHERE d.sample=FALSE AND d.data->>'date' >= $2
                    AND d.data->>'country' = ANY($3::text[])
                    AND NOT (d.data->'artistIds' ?| $4::text[])
                  ORDER BY d.data->>'date', d.id LIMIT $5))))`;
export async function getAppData(): Promise<AppData> {
  const user = await currentUser();
  const artistRows = await query<{ data: Artist }>(
    `SELECT a.data || CASE WHEN EXISTS (
      SELECT 1 FROM artist_provider_records p
      WHERE p.artist_id=a.id AND p.provider='spotify'
    ) THEN '{"spotifyBacked":true}'::jsonb ELSE '{}'::jsonb END AS data
     FROM artists a ORDER BY a.id`,
  );
  const sample = user?.mode !== 'live';
  const lists = user
    ? await userLists(user.id)
    : {
        affinities: artistRows
          .filter((a) => !a.data.providerId)
          .map((a) => ({
            artistId: a.data.id,
            favorite: a.data.id === 'fred-again',
            hidden: false,
          })),
        intents: [],
        feedback: [],
      };
  type EventRow = {
    data: Concert;
    price: number | null;
    currency: string | null;
    observedAt: Date | null;
    disabledAt: Date | null;
  };
  const eventRows =
    sample || !user
      ? await query<EventRow>(
          `SELECT e.data,t.price_min::float AS price,t.currency,
      t.observed_at AS "observedAt",t.disabled_at AS "disabledAt"
     FROM events e LEFT JOIN ticket_sources t ON t.event_id=e.id
      AND t.provider=e.data->>'provider' AND t.external_id=e.data->>'externalId'
     WHERE e.sample=TRUE`,
        )
      : await query<EventRow>(LIVE_EVENTS_SQL, [
          user.id,
          // One day of slack so a show tonight in any timezone is still listed.
          new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
          [...europe],
          // Hidden artists too: their own page still lists dates; ranking keeps them out of the feed.
          lists.affinities.map((a) => a.artistId),
          LIVE_DISCOVERY_LIMIT,
        ]);
  const events = eventRows.map(({ data: event, price, currency, observedAt, disabledAt }) =>
    event.provider === 'sample'
      ? event
      : {
          ...event,
          // Keep the exact listing's attribution; never borrow another source's price.
          price:
            observedAt && !disabledAt && !['cancelled', 'postponed'].includes(event.status)
              ? displayPrice(price, currency, event.provider, observedAt)
              : null,
          currency,
          priceObservedAt: observedAt ? new Date(observedAt).toISOString() : null,
        },
  );
  if (user) await evaluateAlerts(user, events, lists.affinities, lists.intents, lists.feedback);
  const alerts = user
    ? await query<Alert>(
        'SELECT id,event_id,title,body,read_at,created_at FROM alerts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 60',
        [user.id],
      )
    : [];
  const all = rankEvents(
    events,
    lists.affinities,
    lists.intents,
    lists.feedback,
    user?.preferences ?? defaults,
    new Date(),
    true,
    artistRows.map((a) => a.data),
  );
  return {
    user,
    artists: artistRows.map((a) => a.data),
    ...lists,
    events: rankEvents(
      events,
      lists.affinities,
      lists.intents,
      lists.feedback,
      user?.preferences ?? defaults,
      new Date(),
      false,
      artistRows.map((a) => a.data),
    ),
    allEvents: all,
    saved: all.filter((e) => e.saved),
    savedTrips: user
      ? await query<SavedTrip>(
          'SELECT id,user_id AS "userId",event_id AS "eventId",trip_option_id AS "tripOptionId",origin_city AS "originCity",destination_city AS "destinationCity",event_date AS "eventDate",trip_data AS "tripData",created_at AS "createdAt",updated_at AS "updatedAt" FROM saved_trips WHERE user_id=$1 ORDER BY created_at DESC',
          [user.id],
        )
      : [],

    alerts,

    spotifyConnected: user
      ? !!(await query('SELECT user_id FROM music_accounts WHERE user_id=$1', [user.id])).length
      : false,
    spotifyAvailable: spotifyAvailable(),
    liveAvailable: !!env().TICKETMASTER_API_KEY,
    inviteRequired: inviteRequired(),
    privacyContact: {
      controller: env().PRIVACY_CONTROLLER ?? null,
      email: env().PRIVACY_CONTACT_EMAIL ?? null,
    },
    automaticChecks: automaticConcertChecks(),
    artistChecks: user
      ? await query(
          `SELECT a.id AS "artistId", s.checked_at AS "checkedAt", s.message
       FROM artists a JOIN affinities f ON f.artist_id=a.id
       LEFT JOIN provider_sync s ON s.artist_id=a.id
       WHERE f.user_id=$1 AND f.hidden=FALSE AND a.data->>'providerId' IS NOT NULL`,
          [user.id],
        )
      : [],
    providerMessage: sample
      ? 'Sample experience. All concerts, dates and prices shown are fictional.'
      : env().TICKETMASTER_API_KEY
        ? 'Live listings from Ticketmaster. Coverage and prices may be incomplete.'
        : 'Live data is not configured. Add a Ticketmaster API key or switch to sample mode in settings.',
  };
}
export async function recordAnalytics(
  user: User,
  name: string,
  properties: Record<string, unknown> = {},
) {
  if (!user.preferences.analytics) return;
  await query('INSERT INTO analytics(id,user_id,name,properties) VALUES($1,$2,$3,$4)', [
    randomUUID(),
    user.id,
    name,
    JSON.stringify({ ...properties, mode: user.mode }),
  ]).catch(() => reportError('analytics_failed'));
}

export async function recordConcertAnalytics(
  user: User,
  event: Concert,
  name:
    | 'concert_impression'
    | 'concert_opened'
    | 'concert_saved'
    | 'concert_dismissed'
    | 'ticket_link_clicked',
  source: 'feed' | 'search' | 'detail' | 'saved',
) {
  if (!user.preferences.analytics) return;
  try {
    const { affinities } = await userLists(user.id);
    const matches = affinities.filter((a) => !a.hidden && event.artistIds.includes(a.artistId));
    await recordAnalytics(user, name, {
      eventId: event.id,
      source,
      recommendationSource: matches.some((a) => a.favorite)
        ? 'favorite'
        : matches.length
          ? 'followed'
          : 'discovery',
      provider: event.provider,
      ticketLinkAvailable:
        event.provider !== 'sample' &&
        !!event.url &&
        safeTicketUrl(event.url) &&
        !['cancelled', 'postponed'].includes(event.status),
    });
  } catch {
    reportError('analytics_failed');
  }
}
