import { describe, expect, it } from 'vitest';
import {
  formatReport,
  isExcluded,
  lastCompleteWeek,
  parseExcludeList,
  weeklyMetrics,
  type MetricAccount,
  type MetricEvent,
} from '../src/domain/metrics';

// Report week: Mon 28 Sep – Sun 4 Oct 2026 (UTC). Retention cohort: activated 14–20 Sep.
const weekStart = new Date('2026-09-28T00:00:00Z');
const now = new Date('2026-10-06T09:00:00Z');
const at = (iso: string) => new Date(`${iso}Z`);
const account = (id: string, createdAt = '2026-09-20T10:00:00', consent = true): MetricAccount => ({
  id,
  email: `${id}@beta.fr`,
  createdAt: at(createdAt),
  analyticsConsent: consent,
});
const live = { mode: 'live', provider: 'ticketmaster', source: 'feed' };
const ev = (
  userId: string,
  name: string,
  iso: string,
  props: Record<string, unknown> = {},
): MetricEvent => ({ userId, name, at: at(iso), properties: { ...live, ...props } });
const run = (accounts: MetricAccount[], events: MetricEvent[], exclude = parseExcludeList('')) =>
  weeklyMetrics({ accounts, events, weekStart, now, exclude });
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
        // b/e1: same concert, other user -> separate pair, not opened.
        ev('b', 'concert_impression', '2026-10-01T10:00:00', { eventId: 'e1' }),
        // b/e3: impressed in the window, opened after the window -> not counted.
        ev('b', 'concert_impression', '2026-10-04T23:00:00', { eventId: 'e3' }),
        ev('b', 'concert_opened', '2026-10-05T00:30:00', { eventId: 'e3' }),
        // Outside the window entirely.
        ev('b', 'concert_impression', '2026-09-27T23:59:59', { eventId: 'e4' }),
      ],
    );
    expect(metric(report, 'recommendationCtr')).toMatchObject({
      status: 'measured',
      numerator: 1,
      denominator: 4,
      percent: 25,
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
  it('follows accounts activated 14–20 Sep and counts meaningful activity on days 7–13', () => {
    const onboard = (id: string, day: string) => [
      ev(id, 'onboarding_completed', `${day}T10:00:00`),
      ev(id, 'concert_impression', `${day}T10:05:00`, { eventId: `first-${id}` }),
    ];
    const report = run(
      [
        account('kept', '2026-09-15T09:00:00'),
        account('lost', '2026-09-16T09:00:00'),
        account('too-early', '2026-09-16T09:00:00'),
        account('late-activation', '2026-09-05T09:00:00'),
        account('outside', '2026-09-22T09:00:00'),
      ],
      [
        // Activated 15 Sep; opens on day 8 -> retained.
        ...onboard('kept', '2026-09-15'),
        ev('kept', 'concert_opened', '2026-09-23T11:00:00', { eventId: 'x' }),
        // Activated 16 Sep; only a background-like impression on day 9 -> not retained.
        ...onboard('lost', '2026-09-16'),
        ev('lost', 'concert_impression', '2026-09-25T11:00:00', { eventId: 'x' }),
        // Activated 16 Sep; activity on day 6 and day 14 only -> not retained.
        ...onboard('too-early', '2026-09-16'),
        ev('too-early', 'concert_saved', '2026-09-22T11:00:00', { eventId: 'x' }),
        ev('too-early', 'ticket_link_clicked', '2026-09-30T10:06:00', { eventId: 'x' }),
        // First impression 10 days after signup -> never activated, not in the cohort.
        ...onboard('late-activation', '2026-09-15'),
        // Activated 22 Sep -> not in this cohort.
        ...onboard('outside', '2026-09-22'),
        ev('outside', 'concert_opened', '2026-09-30T11:00:00', { eventId: 'x' }),
      ],
    );
    expect(metric(report, 'week1Retention')).toMatchObject({
      status: 'measured',
      numerator: 1,
      denominator: 3,
      percent: 33.3,
    });
  });
});

describe('population filters', () => {
  const events = [
    ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
    ev('a', 'concert_opened', '2026-09-29T10:01:00', { eventId: 'e1' }),
    // Sample mode and fictional inventory never count, even when mislabelled live.
    ev('a', 'concert_impression', '2026-09-29T10:00:00', {
      eventId: 's1',
      mode: 'sample',
      provider: 'sample',
    }),
    ev('a', 'concert_impression', '2026-09-29T10:00:00', { eventId: 's2', provider: 'sample' }),
    // Not consented (consent revoked) and staff/test accounts.
    ev('revoked', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
    ev('staff', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
    ev('qa', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
    // Deleted account: no user row any more.
    ev('deleted', 'concert_impression', '2026-09-29T10:00:00', { eventId: 'e1' }),
  ];
  const accounts = [
    account('a'),
    account('revoked', undefined, false),
    account('staff'),
    { ...account('qa'), email: 'qa@example.test' },
  ];
  it('keeps only consented, live, non-staff accounts', () => {
    const report = run(accounts, events, parseExcludeList('Staff@beta.fr'));
    expect(metric(report, 'recommendationCtr')).toMatchObject({ numerator: 1, denominator: 1 });
    expect(report).toMatchObject({
      includedAccounts: 1,
      excludedAccounts: 2,
      notConsentedAccounts: 1,
    });
  });
  it('matches exclusions by email, user ID or @domain', () => {
    const exclude = parseExcludeList(' staff@beta.fr , user-42 ,@encore.team');
    expect(isExcluded(account('x'), exclude)).toBe(false);
    expect(isExcluded(account('user-42'), exclude)).toBe(true);
    expect(isExcluded({ ...account('y'), email: 'Victor@Encore.team' }, exclude)).toBe(true);
    expect(isExcluded({ ...account('z'), email: 'z@example.test' }, exclude)).toBe(true);
  });
});

describe('report', () => {
  it('refuses an unfinished week and defaults to the last complete one', () => {
    expect(() =>
      weeklyMetrics({
        accounts: [],
        events: [],
        weekStart: new Date('2026-10-05T00:00:00Z'),
        now,
        exclude: [],
      }),
    ).toThrow(/not finished/);
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
