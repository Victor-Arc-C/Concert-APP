import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import {
  allowedPushEndpoint,
  deletePushSubscription,
  pushNewAlerts,
  pushSubscriptionSchema,
  savePushSubscription,
  sendTestPush,
  type PushSender,
} from '../src/server/push';
import { migrations } from '../src/server/schema';

const db = new PGlite();
const keys = {
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
};
const apple = 'https://web.push.apple.com/QGuQyavXutnMH8iBJr0O';
const google = 'https://fcm.googleapis.com/fcm/send/abc123';
async function addEvent(id: string, sample: boolean) {
  await db.query('INSERT INTO events(id,fingerprint,data,sample) VALUES($1,$1,$2,$3)', [
    id,
    JSON.stringify({ id }),
    sample,
  ]);
}
async function addAlert(id: string, eventId: string, createdAt: string, read = false) {
  await db.query(
    `INSERT INTO alerts(id,user_id,event_id,kind,title,body,created_at,read_at)
     VALUES($1,'u1',$2,$1,$3,'Body',$4,$5)`,
    [id, eventId, `Title ${id}`, createdAt, read ? createdAt : null],
  );
}
beforeAll(async () => {
  for (const m of migrations) await db.exec(m.sql);
  for (const id of ['u1', 'u2'])
    await db.query(
      'INSERT INTO users(id,email,name,password_hash,preferences) VALUES($1,$2,$1,$3,$4)',
      [id, `${id}@example.test`, 'test', '{}'],
    );
  vi.mocked(query).mockImplementation(
    async (sql, params) => (await db.query(sql, params)).rows as never[],
  );
});
beforeEach(async () => {
  await db.exec('DELETE FROM push_subscriptions; DELETE FROM alerts; DELETE FROM events;');
});
afterAll(async () => {
  await db.close();
});

it('only accepts browser vendor push services over HTTPS', () => {
  for (const endpoint of [
    apple,
    google,
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
  ])
    expect(allowedPushEndpoint(endpoint)).toBe(true);
  for (const endpoint of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com:8443/x',
    'https://evil.example/push.apple.com',
    'https://push.apple.com.evil.example/x',
    'https://169.254.169.254/latest/meta-data',
    'not a url',
  ])
    expect(allowedPushEndpoint(endpoint)).toBe(false);
  expect(() => pushSubscriptionSchema.parse({ endpoint: 'https://localhost/x', keys })).toThrow();
  expect(pushSubscriptionSchema.parse({ endpoint: apple, keys, expirationTime: null })).toEqual({
    endpoint: apple,
    keys,
  });
});

it('moves a re-subscribed device to the current account and removes it on request', async () => {
  await savePushSubscription('u1', { endpoint: apple, keys });
  await savePushSubscription('u2', { endpoint: apple, keys });
  let rows = (await db.query<{ user_id: string }>('SELECT user_id FROM push_subscriptions')).rows;
  expect(rows).toEqual([{ user_id: 'u2' }]);
  await deletePushSubscription('u1', apple); // Another account cannot remove it.
  expect((await db.query('SELECT 1 FROM push_subscriptions')).rows).toHaveLength(1);
  await deletePushSubscription('u2', apple);
  rows = (await db.query<{ user_id: string }>('SELECT user_id FROM push_subscriptions')).rows;
  expect(rows).toEqual([]);
});

it('pushes new unread live alerts, folds the rest into a summary and skips sample events', async () => {
  await savePushSubscription('u1', { endpoint: apple, keys });
  await addEvent('live-a', false);
  await addEvent('live-b', false);
  await addEvent('fake', true);
  await addAlert('old', 'live-a', '2026-10-06T05:00:00Z');
  await addAlert('read', 'live-b', '2026-10-07T05:01:00Z', true);
  await addAlert('sample', 'fake', '2026-10-07T05:01:00Z');
  for (let i = 1; i <= 4; i++) {
    await addEvent(`new-${i}`, false);
    await addAlert(`n${i}`, `new-${i}`, `2026-10-07T05:0${i}:00Z`);
  }
  const sent: { endpoint: string; title: string; url: string }[] = [];
  const send: PushSender = async (device, payload) => {
    sent.push({ endpoint: device.endpoint, title: payload.title, url: payload.url });
    return { gone: false };
  };
  expect(await pushNewAlerts('u1', '2026-10-07T05:00:00Z', send)).toBe(1);
  expect(sent.map((s) => s.title)).toEqual([
    'Title n4',
    'Title n3',
    'Title n2',
    '1 more concert for you',
  ]);
  expect(sent[0].url).toBe('/app/events/new-4');
  expect(sent[3].url).toBe('/app/alerts');
  const [device] = (
    await db.query<{ last_sent_at: string | null }>('SELECT last_sent_at FROM push_subscriptions')
  ).rows;
  expect(device.last_sent_at).not.toBeNull();
});

it('forgets devices the push service reports as gone and survives failures', async () => {
  await savePushSubscription('u1', { endpoint: apple, keys });
  await savePushSubscription('u1', { endpoint: google, keys });
  await addEvent('live-a', false);
  await addAlert('a', 'live-a', '2026-10-07T05:01:00Z');
  const send: PushSender = async (device) => {
    if (device.endpoint === apple) return { gone: true };
    throw new Error('push service down');
  };
  expect(await pushNewAlerts('u1', '2026-10-07T05:00:00Z', send)).toBe(0);
  const rows = (await db.query<{ endpoint: string }>('SELECT endpoint FROM push_subscriptions'))
    .rows;
  expect(rows).toEqual([{ endpoint: google }]);
});

it('does nothing without VAPID keys and explains a test push with no device', async () => {
  await addEvent('live-a', false);
  await addAlert('a', 'live-a', '2026-10-07T05:01:00Z');
  expect(await pushNewAlerts('u1', '2026-10-07T05:00:00Z', null)).toBe(0);
  await expect(sendTestPush('u1', null)).rejects.toThrow('not set up');
  const send: PushSender = async () => ({ gone: false });
  await expect(sendTestPush('u1', send)).rejects.toThrow('No device');
  await savePushSubscription('u1', { endpoint: apple, keys });
  expect(await sendTestPush('u1', send)).toBe(1);
});
