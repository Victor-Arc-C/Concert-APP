import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
vi.mock('../src/server/providers/ticketmaster', () => ({ syncArtists: vi.fn() }));
vi.mock('../src/server/data', () => ({ evaluateAlerts: vi.fn(), userLists: vi.fn() }));
import { query } from '../src/server/db';
import { syncArtists } from '../src/server/providers/ticketmaster';
import { evaluateAlerts, userLists } from '../src/server/data';
import { runConcertChecks } from '../src/server/jobs';
beforeEach(() => {
  vi.stubEnv('APP_ENV', 'local');
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it('coalesces concurrent runs and imports before evaluating alerts', async () => {
  vi.stubEnv('TICKETMASTER_API_KEY', 'test');
  vi.mocked(query)
    .mockResolvedValueOnce([
      { id: 'live', mode: 'live' },
      { id: 'sample', mode: 'sample' },
    ])
    .mockResolvedValue([]);
  vi.mocked(syncArtists).mockResolvedValue({ count: 0, failed: 0, message: 'Checked' });
  vi.mocked(userLists).mockResolvedValue({ affinities: [], intents: [], feedback: [] });
  const first = runConcertChecks();
  expect(runConcertChecks()).toBe(first);
  expect(await first).toEqual({ evaluated: 2, failures: 0 });
  expect(syncArtists).toHaveBeenCalledExactlyOnceWith('live');
  expect(evaluateAlerts).toHaveBeenCalledTimes(2);
  expect(vi.mocked(syncArtists).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(evaluateAlerts).mock.invocationCallOrder[0],
  ); // Retention cleanup runs before any slow provider sync, so a timeout cannot skip it.
  const cleanup = vi
    .mocked(query)
    .mock.calls.findIndex(([sql]) => String(sql).includes('DELETE FROM analytics'));
  expect(cleanup).toBeGreaterThan(-1);
  expect(vi.mocked(query).mock.invocationCallOrder[cleanup]).toBeLessThan(
    vi.mocked(syncArtists).mock.invocationCallOrder[0],
  );
});
it('continues other accounts after an account fails', async () => {
  vi.stubEnv('TICKETMASTER_API_KEY', 'test');
  vi.mocked(query)
    .mockResolvedValueOnce([
      { id: 'one', mode: 'live' },
      { id: 'two', mode: 'live' },
    ])
    .mockResolvedValue([]);
  vi.mocked(syncArtists).mockRejectedValueOnce(new Error('failure'));
  vi.mocked(syncArtists).mockResolvedValue({ count: 0, failed: 0, message: 'Checked' });
  vi.mocked(userLists).mockResolvedValue({ affinities: [], intents: [], feedback: [] });
  expect(await runConcertChecks()).toEqual({ evaluated: 1, failures: 1 });
  expect(evaluateAlerts).toHaveBeenCalledTimes(1);
});
