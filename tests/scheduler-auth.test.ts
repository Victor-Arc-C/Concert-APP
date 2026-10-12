import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { schedulerAuthorized } from '../src/server/scheduler-auth';

const secret = 'a-long-random-cron-secret';

it('accepts the Vercel Cron bearer header', () => {
  expect(schedulerAuthorized(`Bearer ${secret}`, secret)).toBe(true);
});
it('rejects missing, wrong, or partial credentials', () => {
  expect(schedulerAuthorized(null, secret)).toBe(false);
  expect(schedulerAuthorized(undefined, secret)).toBe(false);
  expect(schedulerAuthorized('', secret)).toBe(false);
  expect(schedulerAuthorized('Bearer ', secret)).toBe(false);
  expect(schedulerAuthorized('Bearer wrong', secret)).toBe(false);
  expect(schedulerAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
  expect(schedulerAuthorized(`Bearer ${secret.slice(0, -1)}`, secret)).toBe(false);
});
it('rejects every request when no secret is configured', () => {
  expect(schedulerAuthorized('Bearer ', undefined)).toBe(false);
  expect(schedulerAuthorized(`Bearer ${secret}`, undefined)).toBe(false);
  expect(schedulerAuthorized(`Bearer ${secret}`, '')).toBe(false);
});
it('schedules daily crons on the jobs routes (Vercel Hobby allows once per day each)', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    crons: { path: string; schedule: string }[];
  };
  // Fnac prices are shown for 24 hours: two daily runs, after the concert check, leave no gap.
  expect(config.crons).toEqual([
    { path: '/api/jobs', schedule: '0 5 * * *' },
    { path: '/api/jobs/fnac', schedule: '30 5 * * *' },
    { path: '/api/jobs/fnac', schedule: '30 17 * * *' },
  ]);
  for (const cron of config.crons) expect(cron.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
});
