import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import {
  ACCOUNTS_SQL,
  formatReport,
  lastCompleteWeek,
  parseExcludeList,
  weeklyMetrics,
  type MetricAccount,
  type MetricEvent,
} from '../src/domain/metrics';
import { migrations } from '../src/server/schema';

// Report week: Mon 28 Sep – Sun 4 Oct 2026 (UTC). Retention cohort: activated 14–20 Sep.
// Analytics retention horizon at `now`: 6 Sep 2026 09:00 UTC.
const weekStart = new Date('2026-09-28T00:00:00Z');
const now = new Date('2026-10-06T09:00:00Z');
const at = (iso: string) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
const account = (
  id: string,
  createdAt = '2026-09-20T10:00:00',
  consent = true,
  excluded = false,
): MetricAccount => ({ id, createdAt: at(createdAt), analyticsConsent: consent, excluded });
const live = { mode: 'live', provider: 'ticketmaster', source: 'feed' };
const ev = (
  userId: string,
  name: string,
  iso: string,
  props: Record<string, unknown> = {},
): MetricEvent => ({ userId, name, at: at(iso), properties: { ...live, ...props } });
const run = (accounts: MetricAccount[], events: MetricEvent[], when = now, week = weekStart) =>
  weeklyMetrics({ accounts, events, weekStart: week, now: when });
const metric = (report: ReturnType<typeof run>, key: string) =>
  report.metrics.find((m) => m.key === key)!;

describe('activation', () => {
  it('is reported unavailable, never estimated', () => {
    const report = run(
      [account('a')],
      [
        ev('a', 'onboarding_completed', '2026-09-28T10:00:00'),
        ev('a', 'concert_impression', '2026-09-28T10:01:00', { eventId: 'e1' }),
      ],
    );
    expect(metric(report, 'activation')).toMatchObject({
      status: 'unavailable',
      numerator: null,
      denominator: null,
      percent: null,
    });
  });
});

describe('recommendation CTR', () => {
  it('counts distinct user/concert pairs and requires the open to follow an impression', () => {
    const report = run(
      [account('a'), account('b')],
      [
        // a/e1: two impressions and two opens -> one impressed pair, one opened pair.
        ev('a', 'concert_impression', '2026-09-28T10:00:00', { eventId: 'e1' }),
        ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
        ev('a', 'concert_opened', '2026-09-28T10:05:00', { eventId: 'e1' }),
        ev('a', 'concert_opened', '2026-09-30T10:05:00', { eventId: 'e1' }),
        // a/e2: opened before it was ever impressed -> not counted.
        ev('a', 'concert_opened', '2026-09-28T09:00:00', { eventId: 'e2' }),
        ev('a', 'concert_impression', '2026-09-28T11:00:00', { eventId: 'e2' }),
        // a/e5: open recorded at the very same instant as the impression -> does not follow it.
        ev('a', 'concert_impression', '2026-09-30T12:00:00', { eventId: 'e5' }),
        ev('a', 'concert_opened', '2026-09-30T12:00:00', { eventId: 'e5' }),
        // b/e1: same concert, other user -> separate pair, not opened.
        ev('b', 'concert_impression', '2026-10-01T10:00:00', { eventId: 'e1' }),
        // b/e3: impressed in the window, opened exactly when the window ends -> not counted.
        ev('b', 'concert_impression', '2026-10-04T23:00:00', { eventId: 'e3' }),
        ev('b', 'concert_opened', '2026-10-05T00:00:00', { eventId: 'e3' }),
        // Outside the window on both edges.
        ev('b', 'concert_impression', '2026-09-27T23:59:59.999', { eventId: 'e4' }),
        ev('b', 'concert_impression', '2026-10-05T00:00:00', { eventId: 'e6' }),
      ],
    );
    expect(metric(report, 'recommendationCtr')).toMatchObject({
      status: 'measured',
      numerator: 1,
      denominator: 5,
      percent: 20,
    });
  });
});

describe('concert-save rate', () => {
  it('counts repeated save toggles once and only after an impression', () => {
    const report = run(
      [account('a')],
      [
        ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
        ev('a', 'concert_saved', '2026-09-29T10:01:00', { eventId: 'e1' }),
        ev('a', 'concert_saved', '2026-09-29T10:02:00', { eventId: 'e1' }),
        ev('a', 'concert_saved', '2026-09-29T10:03:00', { eventId: 'e1' }),
        ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e2' }),
        ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e3' }),
        // Saved from search without any feed impression: not part of this metric.
        ev('a', 'concert_saved', '2026-09-29T12:00:00', { eventId: 'e9' }),
      ],
    );
    expect(metric(report, 'saveRate')).toMatchObject({
      numerator: 1,
      denominator: 3,
      percent: 33.3,
    });
  });
});

describe('ticket-link CTR', () => {
  it('uses opened details with an enabled ticket link as the denominator', () => {
    const report = run(
      [account('a'), account('b')],
      [
        ev('a', 'concert_opened', '2026-09-30T10:00:00', {
          eventId: 'e1',
          ticketLinkAvailable: true,
        }),
        ev('a', 'ticket_link_clicked', '2026-09-30T10:01:00', {
          eventId: 'e1',
          ticketLinkAvailable: true,
        }),
        ev('a', 'ticket_link_clicked', '2026-09-30T10:02:00', {
          eventId: 'e1',
          ticketLinkAvailable: true,
        }),
        ev('b', 'concert_opened', '2026-09-30T10:00:00', {
          eventId: 'e1',
          ticketLinkAvailable: true,
        }),
        // No enabled link: not in the denominator.
        ev('b', 'concert_opened', '2026-09-30T10:00:00', {
          eventId: 'e2',
          ticketLinkAvailable: false,
        }),
        // Click without a prior open with a link: not counted.
        ev('b', 'ticket_link_clicked', '2026-09-30T09:00:00', {
          eventId: 'e3',
          ticketLinkAvailable: true,
        }),
      ],
    );
    expect(metric(report, 'ticketLinkCtr')).toMatchObject({
      numerator: 1,
      denominator: 2,
      percent: 50,
    });
  });
  it('shows N/A on a zero denominator', () => {
    expect(metric(run([account('a')], []), 'ticketLinkCtr')).toMatchObject({
      status: 'n/a',
      numerator: 0,
      denominator: 0,
      percent: null,
    });
  });
});

describe('week-1 retention', () => {
  const onboard = (id: string, day: string) => [
    ev(id, 'onboarding_completed', `${day}T10:00:00`),
    ev(id, 'concert_impression', `${day}T10:05:00`, { eventId: `first-${id}` }),
  ];
  const report = run(
    [
      account('kept', '2026-09-15T09:00:00'),
      account('lost', '2026-09-16T09:00:00'),
      account('boundaries', '2026-09-16T09:00:00'),
      account('last-day', '2026-09-20T09:00:00'),
      account('late-activation', '2026-09-08T09:00:00'),
      account('pre-onboarding', '2026-09-14T09:00:00'),
      account('before-cohort', '2026-09-13T09:00:00'),
      account('after-cohort', '2026-09-21T09:00:00'),
    ],
    [
      // Activated 15 Sep 10:05; opens on day 8 -> retained.
      ...onboard('kept', '2026-09-15'),
      ev('kept', 'concert_opened', '2026-09-23T11:00:00', { eventId: 'x' }),
      // Activated 16 Sep; only an impression on day 9 -> not retained (not meaningful).
      ...onboard('lost', '2026-09-16'),
      ev('lost', 'concert_impression', '2026-09-25T11:00:00', { eventId: 'x' }),
      // Activated 16 Sep 10:05; activity just before day 7 and exactly at day 14 -> not retained.
      ...onboard('boundaries', '2026-09-16'),
      ev('boundaries', 'concert_saved', '2026-09-23T10:04:59.999', { eventId: 'x' }),
      ev('boundaries', 'ticket_link_clicked', '2026-09-30T10:05:00', { eventId: 'x' }),
      // Activated on the last cohort day; opens exactly at day 7 -> retained.
      ...onboard('last-day', '2026-09-20'),
      ev('last-day', 'concert_opened', '2026-09-27T10:05:00', { eventId: 'x' }),
      // First impression 8 days after signup -> never activated, not in the cohort.
      ev('late-activation', 'onboarding_completed', '2026-09-08T10:00:00'),
      ev('late-activation', 'concert_impression', '2026-09-16T10:00:00', { eventId: 'x' }),
      ev('late-activation', 'concert_opened', '2026-09-24T10:00:00', { eventId: 'x' }),
      // Impression before onboarding does not activate; the next one is after 7 days.
      ev('pre-onboarding', 'concert_impression', '2026-09-14T10:00:00', { eventId: 'x' }),
      ev('pre-onboarding', 'onboarding_completed', '2026-09-20T10:00:00'),
      ev('pre-onboarding', 'concert_impression', '2026-09-22T10:00:00', { eventId: 'x' }),
      ev('pre-onboarding', 'concert_opened', '2026-09-22T10:01:00', { eventId: 'x' }),
      // Activated 1 ms before the cohort starts, and on the day after it ends -> outside.
      ev('before-cohort', 'onboarding_completed', '2026-09-13T10:00:00'),
      ev('before-cohort', 'concert_impression', '2026-09-13T23:59:59.999', { eventId: 'x' }),
      ev('before-cohort', 'concert_opened', '2026-09-21T10:00:00', { eventId: 'x' }),
      ...onboard('after-cohort', '2026-09-21'),
      ev('after-cohort', 'concert_opened', '2026-09-29T11:00:00', { eventId: 'x' }),
    ],
  );
  it('follows accounts activated 14–20 Sep and counts open/save/click on days 7–13', () => {
    expect(metric(report, 'week1Retention')).toMatchObject({
      status: 'measured',
      numerator: 2,
      denominator: 4,
      percent: 50,
    });
  });
});

describe('deleted data is never reported as measured', () => {
  it('marks every metric unavailable for a week older than the analytics retention', () => {
    const events = [
      ev('a', 'concert_impression', '2026-09-06T10:00:00', { eventId: 'e1' }),
      ev('a', 'concert_opened', '2026-09-06T10:01:00', { eventId: 'e1' }),
    ];
    const report = run(
      [account('a', '2026-08-01T00:00:00')],
      events,
      now,
      at('2026-08-31T00:00:00'),
    );
    for (const key of ['recommendationCtr', 'saveRate', 'ticketLinkCtr', 'week1Retention'])
      expect(metric(report, key)).toMatchObject({ status: 'unavailable', percent: null });
  });
  it('marks retention unavailable when the report runs too late for its cohort', () => {
    const late = run([account('a')], [], at('2026-10-08T09:00:00'));
    expect(metric(late, 'week1Retention').status).toBe('unavailable');
    expect(metric(late, 'recommendationCtr').status).toBe('n/a');
  });
});

describe('population filters', () => {
  const events = [
    ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
    ev('a', 'concert_opened', '2026-09-29T10:01:00', { eventId: 'e1' }),
    // Sample mode never counts, even with a real provider; fictional inventory never counts.
    ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 's1', mode: 'sample' }),
    ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 's2', provider: 'sample' }),
    // Not consented (consent revoked) and staff/test accounts.
    ev('revoked', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
    ev('staff', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
    // Deleted account: no user row any more.
    ev('deleted', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
  ];
  it('keeps only consented, live, non-staff accounts', () => {
    const report = run(
      [account('a'), account('revoked', undefined, false), account('staff', undefined, true, true)],
      events,
    );
    expect(metric(report, 'recommendationCtr')).toMatchObject({ numerator: 1, denominator: 1 });
    expect(report).toMatchObject({
      includedAccounts: 1,
      excludedAccounts: 1,
      notConsentedAccounts: 1,
    });
  });
  it('matches exclusions in SQL by email, user ID or @domain, without returning emails', async () => {
    const db = new PGlite();
    try {
      for (const m of migrations) await db.exec(m.sql);
      for (const [id, email, consent] of [
        ['u1', 'friend@beta.fr', true],
        ['u2', 'Staff@Beta.fr', true],
        ['user-42', 'someone@beta.fr', true],
        ['u4', 'victor@ENCORE.team', true],
        ['u5', 'qa@example.test', true],
        ['u6', 'notencore.team@beta.fr', false],
      ] as const)
        await db.query(
          'INSERT INTO users(id,email,name,password_hash,preferences) VALUES($1,$2,$3,$4,$5)',
          [id, email, 'Test', 'test-only', JSON.stringify({ analytics: consent })],
        );
      const exclude = parseExcludeList(' staff@beta.fr , user-42 ,@encore.team');
      const rows = (
        await db.query<Record<string, unknown>>(`${ACCOUNTS_SQL} ORDER BY id`, [
          exclude.exact,
          exclude.domains,
        ])
      ).rows;
      expect(rows.map((r) => [r.id, r.excluded, r.consent])).toEqual([
        ['u1', false, true],
        ['u2', true, true],
        ['u4', true, true],
        ['u5', true, true],
        ['u6', false, false],
        ['user-42', true, true],
      ]);
      expect(Object.keys(rows[0])).not.toContain('email');
    } finally {
      await db.close();
    }
  });
});

describe('report', () => {
  it('refuses an unfinished week and defaults to the last complete one', () => {
    expect(() => run([], [], now, at('2026-10-05T00:00:00'))).toThrow(/not finished/);
    expect(lastCompleteWeek(now).toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });
  it('prints counts beside percentages, N/A and unavailable in a short table', () => {
    const text = formatReport(
      run(
        [account('a')],
        [
          ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
          ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e2' }),
          ev('a', 'concert_opened', '2026-09-29T10:01:00', { eventId: 'e1' }),
        ],
      ),
    );
    expect(text).toContain('Week: Mon, 28 Sept 2026 → Sun, 4 Oct 2026 (UTC)');
    expect(text).toMatch(/Recommendation CTR\s+50\.0%\s+1 of 2 concerts seen/);
    expect(text).toMatch(/Ticket-link CTR\s+N\/A/);
    expect(text).toMatch(/Activation\s+unavailable/);
    expect(text).toContain('Small numbers');
    expect(text.split('\n').length).toBeLessThan(15);
  });
});
