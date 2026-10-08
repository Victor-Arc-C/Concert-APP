import webpush from 'web-push';
import { z } from 'zod';
import { query } from './db';
import { env, pushAvailable } from './env';
import { reportError } from './monitoring';
import { HttpError } from './security';
import { resolveLocale, type Locale } from '../i18n/config';
import { formatters } from '../i18n/format';
import { translate, translateAlertTitle } from '../i18n/server-text';

// The server POSTs to the endpoint a browser hands us, so only accept the browser vendors'
// push services. Anything else could point the server at an arbitrary URL.
const pushHosts = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];
export function allowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && pushHosts.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}
const base64url = z
  .string()
  .min(16)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+=*$/);
export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(1000)
    .refine(allowedPushEndpoint, 'This browser push service is not supported.'),
  keys: z.object({ p256dh: base64url, auth: base64url }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type PushPayload = { title: string; body: string; url: string; tag: string };
type StoredSubscription = { endpoint: string; p256dh: string; auth: string };
export type PushSender = (
  subscription: StoredSubscription,
  payload: PushPayload,
) => Promise<{ gone: boolean }>;

const devicesPerUser = 10;
/** Most recent alerts pushed individually per run; the rest are folded into one summary. */
const individualPushes = 3;

export async function savePushSubscription(userId: string, input: PushSubscriptionInput) {
  // Re-subscribing the same device (or a device that changed hands) moves it to this account.
  await query(
    `INSERT INTO push_subscriptions(endpoint,user_id,p256dh,auth) VALUES($1,$2,$3,$4)
     ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,created_at=NOW()`,
    [input.endpoint, userId, input.keys.p256dh, input.keys.auth],
  );
  await query(
    `DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint NOT IN (
       SELECT endpoint FROM push_subscriptions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2)`,
    [userId, devicesPerUser],
  );
}
export async function deletePushSubscription(userId: string, endpoint: string) {
  await query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2', [
    userId,
    endpoint,
  ]);
}

function vapidSender(): PushSender | null {
  if (!pushAvailable()) return null;
  const settings = env();
  const subject =
    settings.VAPID_SUBJECT ??
    (settings.PRIVACY_CONTACT_EMAIL
      ? `mailto:${settings.PRIVACY_CONTACT_EMAIL}`
      : settings.APP_URL);
  const vapidDetails = {
    subject,
    publicKey: settings.VAPID_PUBLIC_KEY!,
    privateKey: settings.VAPID_PRIVATE_KEY!,
  };
  return async (subscription, payload) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        { vapidDetails, TTL: 24 * 3600, urgency: 'normal', timeout: 10_000 },
      );
      return { gone: false };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404/410: the browser dropped the subscription (app removed, permission revoked).
      if (status === 404 || status === 410) return { gone: true };
      throw error;
    }
  };
}

async function sendToUser(userId: string, payloads: PushPayload[], send: PushSender) {
  const devices = await query<StoredSubscription>(
    'SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=$1',
    [userId],
  );
  let delivered = 0;
  for (const device of devices) {
    let reached = false;
    for (const payload of payloads) {
      try {
        const result = await send(device, payload);
        if (result.gone) {
          await query('DELETE FROM push_subscriptions WHERE endpoint=$1', [device.endpoint]);
          break;
        }
        reached = true;
      } catch {
        // Never log endpoints: they identify a device.
        reportError('push_failed');
        break;
      }
    }
    if (reached) {
      delivered++;
      await query('UPDATE push_subscriptions SET last_sent_at=NOW() WHERE endpoint=$1', [
        device.endpoint,
      ]);
    }
  }
  return delivered;
}

/** The language the user last chose in the app; English when they never chose. */
async function userLocale(userId: string): Promise<Locale> {
  const [row] = await query<{ locale: string | null }>(
    "SELECT preferences->>'locale' AS locale FROM users WHERE id=$1",
    [userId],
  );
  return resolveLocale(row?.locale);
}
/** Alerts are stored in English; notifications go out in the user's language. */
function localized(payload: PushPayload, locale: Locale): PushPayload {
  if (locale === 'en') return payload;
  const f = formatters(locale);
  return {
    ...payload,
    title: translateAlertTitle(payload.title, locale),
    body: translate(payload.body, locale).replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) =>
      f.dateLong(iso),
    ),
  };
}

/** Push the user's unread live alerts created since `since` (database time) to their devices. */
export async function pushNewAlerts(userId: string, since: string, send = vapidSender()) {
  if (!send) return 0;
  const alerts = await query<{ id: string; event_id: string; title: string; body: string }>(
    `SELECT a.id,a.event_id,a.title,a.body FROM alerts a JOIN events e ON e.id=a.event_id
     WHERE a.user_id=$1 AND a.created_at>=$2 AND a.read_at IS NULL AND e.sample=FALSE
     ORDER BY a.created_at DESC, a.id`,
    [userId, since],
  );
  if (!alerts.length) return 0;
  const payloads: PushPayload[] = alerts.slice(0, individualPushes).map((alert) => ({
    title: alert.title,
    body: alert.body,
    url: `/app/events/${encodeURIComponent(alert.event_id)}`,
    tag: `alert-${alert.id}`,
  }));
  const rest = alerts.length - payloads.length;
  if (rest > 0)
    payloads.push({
      title: `${rest} more concert${rest === 1 ? '' : 's'} for you`,
      body: 'Open Showbound to see every new match.',
      url: '/app/alerts',
      tag: 'alert-summary',
    });
  const locale = await userLocale(userId);
  return sendToUser(
    userId,
    payloads.map((payload) => localized(payload, locale)),
    send,
  );
}

export async function sendTestPush(userId: string, send = vapidSender()) {
  if (!send) throw new HttpError(503, 'Push notifications are not set up on this server yet.');
  const locale = await userLocale(userId);
  const delivered = await sendToUser(
    userId,
    [
      localized(
        {
          title: 'Showbound notifications are on',
          body: 'New shows by the artists you follow will arrive here.',
          url: '/app/alerts',
          tag: 'test',
        },
        locale,
      ),
    ],
    send,
  );
  if (!delivered) throw new HttpError(404, 'No device is subscribed. Turn notifications on first.');
  return delivered;
}
