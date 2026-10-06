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
it('schedules a daily cron on the jobs route (Vercel Hobby allows once per day)', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    crons: { path: string; schedule: string }[];
  };
  expect(config.crons).toEqual([{ path: '/api/jobs', schedule: '0 5 * * *' }]);
});
