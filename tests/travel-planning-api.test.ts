import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
vi.mock('../src/server/security', async (original) => ({
  ...(await original<typeof import('../src/server/security')>()),
  requireUser: vi.fn(),
  rateLimit: vi.fn(),
}));
import { query } from '../src/server/db';
import { requireUser, rateLimit, HttpError } from '../src/server/security';
import { handleApi } from '../src/server/api';
import { defaults } from '../src/domain/catalog';
import { sampleEvents } from '../src/domain/sample';
const event = {
  ...sampleEvents()[0],
  provider: 'ticketmaster',
  date: '2099-11-15',
  city: 'Berlin',
};
const origin = 'http://127.0.0.1:3107';
function request(action: string, input: unknown, from = origin) {
  return handleApi(
    new Request(`${origin}/api/travel/planning/${action}`, {
      method: 'POST',
      headers: { origin: from, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    ['travel', 'planning', action],
  );
}
beforeEach(() => {
  vi.stubEnv('APP_URL', origin);
  vi.stubEnv('OMIO_ENABLED', 'true');
  vi.stubEnv('OMIO_PARTNER_ID', '987654321234');
  vi.mocked(requireUser).mockResolvedValue({
    id: 'test',
    name: 'Test',
    email: 'private@example.test',
    mode: 'live',
    onboarded: true,
    preferences: { ...defaults, analytics: true },
  });
  vi.mocked(query).mockImplementation(async (sql) =>
    sql.startsWith('SELECT data FROM events') ? ([{ data: event }] as never[]) : [],
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it('authorizes the event in the current mode, rate limits, and generates the URL through the API', async () => {
  const opened = await request('open', { eventId: event.id });
  expect(opened.status).toBe(200);
  expect((await opened.json()).defaults.destination).toBe('Berlin');
  expect(query).toHaveBeenCalledWith('SELECT data FROM events WHERE id=$1 AND sample=$2', [
    event.id,
    false,
  ]);
  expect(rateLimit).toHaveBeenCalledWith('travel-planning:test', 30, 60);
  const response = await request('search', {
    eventId: event.id,
    search: {
      departure: 'Paris',
      destination: 'Berlin',
      departureDate: '2099-11-15',
      travelMode: 'TRAIN',
      locale: 'fr',
    },
  });
  expect(response.headers.get('cache-control')).toBe('no-store');
  const { url } = await response.json();
  expect(new URL(url).pathname).toBe('/c/987654321234/4057579/7385');
  expect(new URL(new URL(url).searchParams.get('u')!).searchParams.get('departureDate')).toBe(
    '2099-11-15',
  );
  const names = vi
    .mocked(query)
    .mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO analytics'))
    .map(([, p]) => p?.[2]);
  expect(names).toEqual([
    'travel_planning_opened',
    'travel_search_submitted',
    'omio_redirect_clicked',
  ]);
});
it('rejects cross-origin, signed-out, wrong-mode, and forged analytics/URL requests', async () => {
  expect((await request('open', { eventId: event.id }, 'https://evil.test')).status).toBe(403);
  vi.mocked(requireUser).mockRejectedValueOnce(new HttpError(401, 'Sign in to continue.'));
  expect((await request('open', { eventId: event.id })).status).toBe(401);
  vi.mocked(query).mockResolvedValueOnce([]);
  expect((await request('open', { eventId: 'wrong-mode' })).status).toBe(404);
  expect((await request('search', { eventId: event.id, url: 'https://evil.test' })).status).toBe(
    400,
  );
  expect((await request('open', { eventId: event.id, name: 'omio_redirect_clicked' })).status).toBe(
    400,
  );
});
it('validates unsupported modes and ignores no arbitrary redirect target', async () => {
  const response = await request('search', {
    eventId: event.id,
    search: {
      departure: 'Paris',
      destination: 'Berlin',
      departureDate: '2099-11-15',
      travelMode: 'CAR',
    },
  });
  expect(await response.json()).toEqual({ reason: 'invalid_search' });
});
