import { randomUUID } from 'node:crypto';
import { displayPrice } from '../domain/pricing';
import { query } from './db';
import { currentUser } from './security';
import { env, spotifyAvailable, automaticConcertChecks } from './env';
import { defaults } from '../domain/catalog';
import { rankEvents } from '../domain/recommendations';
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
  const eventRows = await query<{ data: Concert }>('SELECT data FROM events WHERE sample=$1', [
    sample,
  ]);
  const events = eventRows.map(({ data: event }) =>
    event.provider === 'sample'
      ? event
      : {
          ...event,
          price: displayPrice(event.price, event.currency, event.provider, event.fetchedAt),
        },
  );
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
    alerts,
    spotifyConnected: user
      ? !!(await query('SELECT user_id FROM music_accounts WHERE user_id=$1', [user.id])).length
      : false,
    spotifyAvailable: spotifyAvailable(),
    liveAvailable: !!env().TICKETMASTER_API_KEY,
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
