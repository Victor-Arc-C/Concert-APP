import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/env', () => ({ automaticConcertChecks: vi.fn() }));
vi.mock('../src/server/jobs', () => ({
  runConcertChecks: vi.fn().mockResolvedValue({ evaluated: 0, failures: 0 }),
}));
import { automaticConcertChecks } from '../src/server/env';
import { runConcertChecks } from '../src/server/jobs';
import { startConcertScheduler } from '../src/server/scheduler';
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  delete (globalThis as typeof globalThis & { encoreTimer?: unknown }).encoreTimer;
});
it('starts once, checks after startup, then checks every five minutes', async () => {
  vi.useFakeTimers();
  vi.mocked(automaticConcertChecks).mockReturnValue(true);
  startConcertScheduler();
  startConcertScheduler();
  await vi.advanceTimersByTimeAsync(14999);
  expect(runConcertChecks).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(runConcertChecks).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(285000);
  expect(runConcertChecks).toHaveBeenCalledTimes(2);
});
it('does not start a timer when disabled', async () => {
  vi.useFakeTimers();
  vi.mocked(automaticConcertChecks).mockReturnValue(false);
  startConcertScheduler();
  await vi.advanceTimersByTimeAsync(600000);
  expect(runConcertChecks).not.toHaveBeenCalled();
});
