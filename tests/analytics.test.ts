import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { recordAnalytics, recordConcertAnalytics } from '../src/server/data';
import { reportError } from '../src/server/monitoring';
import { onRequestError } from '../src/instrumentation';
import { defaults } from '../src/domain/catalog';
import { sampleEvents } from '../src/domain/sample';
const user = {
  id: 'fixture',
  name: 'Private Name',
  email: 'private@example.test',
  mode: 'sample' as const,
  onboarded: true,
  preferences: { ...defaults, analytics: true },
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(query).mockReset();
});
it('does not query or write analytics before consent', async () => {
  const privateUser = { ...user, preferences: { ...defaults, analytics: false } };
  await recordAnalytics(privateUser, 'onboarding_completed');
  await recordConcertAnalytics(privateUser, sampleEvents()[0], 'concert_opened', 'detail');
  expect(query).not.toHaveBeenCalled();
});
it('records server-derived recommendation context without copying personal profile data', async () => {
  const event = sampleEvents()[0];
  vi.mocked(query)
    .mockResolvedValueOnce([{ artistId: event.artistIds[0], favorite: true, hidden: false }])
    .mockResolvedValue([]);
  await recordConcertAnalytics(user, event, 'concert_opened', 'detail');
  const call = vi
    .mocked(query)
    .mock.calls.find(([sql]) => sql.startsWith('INSERT INTO analytics'))!;
  const properties = JSON.parse(String(call[1]?.[3]));
  expect(properties).toMatchObject({
    eventId: event.id,
    mode: 'sample',
    provider: 'sample',
    source: 'detail',
    recommendationSource: 'favorite',
    ticketLinkAvailable: false,
  });
  expect(JSON.stringify(call)).not.toContain(user.email);
  expect(JSON.stringify(call)).not.toContain(user.name);
});
it('analytics failures do not fail user actions and emit only fixed diagnostic fields', async () => {
  vi.mocked(query).mockRejectedValue(new Error('password=private-token private@example.test'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(recordAnalytics(user, 'onboarding_completed')).resolves.toBeUndefined();
  reportError('api_unexpected');
  onRequestError();
  expect(log).toHaveBeenCalledTimes(3);
  for (const [line] of log.mock.calls) {
    expect(Object.keys(JSON.parse(line))).toEqual(['level', 'service', 'code', 'time']);
    expect(line).not.toMatch(/private|password|token|@/);
  }
});
