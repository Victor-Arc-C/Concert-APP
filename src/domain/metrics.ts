// Weekly private-beta launch metrics (CON-37), computed exactly as docs/MVP_SCOPE.md defines them.
// Pure and self-contained (no imports) so it is unit-tested on fixtures and also runs from
// scripts/metrics-weekly.ts with Node's built-in TypeScript support.

export type MetricAccount = {
  id: string;
  createdAt: Date;
  /** Current analytics consent. Revoked consent deletes events and excludes the account. */
  analyticsConsent: boolean;
  /** Staff/test account, matched in SQL so emails never leave the database (ACCOUNTS_SQL). */
  excluded: boolean;
};

export type MetricEvent = {
  userId: string;
  name: string;
  at: Date;
  properties: Record<string, unknown>;
};

export type MetricResult = {
  key: 'activation' | 'recommendationCtr' | 'saveRate' | 'ticketLinkCtr' | 'week1Retention';
  label: string;
  status: 'measured' | 'n/a' | 'unavailable';
  numerator: number | null;
  denominator: number | null;
  /** Percentage rounded to one decimal, or null when not measured. */
  percent: number | null;
  detail: string;
};

export type WeeklyReport = {
  weekStart: Date;
  weekEnd: Date;
  generatedAt: Date;
  includedAccounts: number;
  excludedAccounts: number;
  notConsentedAccounts: number;
  metrics: MetricResult[];
  notes: string[];
};

const DAY = 86_400_000;
/** CON-9 cleanup removes analytics older than this, so older activity cannot be observed. */
export const ANALYTICS_RETENTION_DAYS = 30;
export const SMALL_COHORT = 10;
export const DEFAULT_EXCLUDE = ['@example.test'];

/** Splits METRICS_EXCLUDE into exact emails/user IDs ($1) and `@domain` suffixes ($2). */
export function parseExcludeList(raw: string | undefined) {
  const entries = [
    ...DEFAULT_EXCLUDE,
    ...(raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ];
  return {
    exact: entries.filter((e) => !e.startsWith('@')),
    domains: entries.filter((e) => e.startsWith('@')).map((e) => e.toLowerCase()),
  };
}

/** Accounts with consent and exclusion resolved inside the database. Params: parseExcludeList. */
export const ACCOUNTS_SQL = `
  SELECT id, created_at,
    COALESCE(preferences->>'analytics' = 'true', FALSE) AS consent,
    (lower(email) = ANY(SELECT lower(x) FROM unnest($1::text[]) AS x) OR id = ANY($1::text[])
      OR EXISTS (SELECT 1 FROM unnest($2::text[]) AS d WHERE right(lower(email), length(d)) = d)
    ) AS excluded
  FROM users`;

/** Monday 00:00 UTC of the given date's ISO week. */
export function weekStartOf(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
}

/** The most recent fully finished Monday–Sunday UTC week before `now`. */
export function lastCompleteWeek(now: Date) {
  return new Date(weekStartOf(now).getTime() - 7 * DAY);
}

const CONCERT_EVENTS = new Set([
  'concert_impression',
  'concert_opened',
  'concert_saved',
  'ticket_link_clicked',
]);
const MEANINGFUL = new Set(['concert_opened', 'concert_saved', 'ticket_link_clicked']);

/** Live mode only, and never fictional inventory, even if mislabelled. */
function isLive(event: MetricEvent) {
  if (event.properties.mode !== 'live') return false;
  if (!CONCERT_EVENTS.has(event.name)) return true;
  return (
    typeof event.properties.eventId === 'string' &&
    event.properties.eventId !== '' &&
    event.properties.provider !== 'sample'
  );
}

const pairKey = (event: MetricEvent) => `${event.userId}\u0000${event.properties.eventId}`;
const inWindow = (event: MetricEvent, start: Date, end: Date) =>
  event.at.getTime() >= start.getTime() && event.at.getTime() < end.getTime();

/** Earliest time per distinct user/concert pair. Repeated transmissions collapse into one pair. */
function earliestByPair(events: MetricEvent[]) {
  const pairs = new Map<string, number>();
  for (const event of events) {
    const key = pairKey(event),
      time = event.at.getTime();
    if (!pairs.has(key) || time < pairs.get(key)!) pairs.set(key, time);
  }
  return pairs;
}

/** Pairs from `base` that have at least one `follow` event strictly after the pair's base time. */
function followedPairs(base: Map<string, number>, follow: MetricEvent[]) {
  const hits = new Set<string>();
  for (const event of follow) {
    const key = pairKey(event),
      start = base.get(key);
    if (start !== undefined && event.at.getTime() > start) hits.add(key);
  }
  return hits.size;
}

function ratio(
  key: MetricResult['key'],
  label: string,
  numerator: number,
  denominator: number,
  describe: string,
): MetricResult {
  if (denominator === 0)
    return { key, label, status: 'n/a', numerator, denominator, percent: null, detail: describe };
  return {
    key,
    label,
    status: 'measured',
    numerator,
    denominator,
    percent: Math.round((numerator / denominator) * 1000) / 10,
    detail: describe,
  };
}

const dayLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);

export function weeklyMetrics(input: {
  accounts: MetricAccount[];
  events: MetricEvent[];
  weekStart: Date;
  now: Date;
}): WeeklyReport {
  const weekStart = weekStartOf(input.weekStart),
    weekEnd = new Date(weekStart.getTime() + 7 * DAY);
  if (weekEnd.getTime() > input.now.getTime())
    throw new Error(
      `The week starting ${weekStart.toISOString().slice(0, 10)} is not finished yet. Pick an earlier week.`,
    );
  const excluded = input.accounts.filter((a) => a.excluded);
  const notConsented = input.accounts.filter((a) => !a.analyticsConsent && !a.excluded);
  const eligible = new Map(
    input.accounts.filter((a) => a.analyticsConsent && !a.excluded).map((a) => [a.id, a]),
  );
  // Analytics older than the retention are deleted, so a window reaching further back is
  // incomplete: its metric is unavailable rather than computed from what is left.
  const observableFrom = input.now.getTime() - ANALYTICS_RETENTION_DAYS * DAY;
  const deleted = (label: string, key: MetricResult['key'], detail: string): MetricResult => ({
    key,
    label,
    status: 'unavailable',
    numerator: null,
    denominator: null,
    percent: null,
    detail,
  });
  const weekDeleted = `Not measurable: part of this week is older than the ${ANALYTICS_RETENTION_DAYS}-day analytics retention.`;
  const weekObservable = weekStart.getTime() >= observableFrom;
  // Events of deleted, revoked, staff/test or sample-mode activity never reach the metrics.
  const live = input.events.filter((e) => eligible.has(e.userId) && isLive(e));
  const week = live.filter((e) => inWindow(e, weekStart, weekEnd));
  const named = (name: string) => week.filter((e) => e.name === name);
  const notes: string[] = [];

  // Activation: signup happens before the consent choice, so its denominator is not recorded.
  const activation: MetricResult = {
    key: 'activation',
    label: 'Activation',
    status: 'unavailable',
    numerator: null,
    denominator: null,
    percent: null,
    detail: 'Not measured: signup happens before the consent choice (see docs/ANALYTICS.md).',
  };

  const impressed = earliestByPair(named('concert_impression'));
  const opened = followedPairs(impressed, named('concert_opened'));
  const saved = followedPairs(impressed, named('concert_saved'));
  const recommendationCtr = !weekObservable
    ? deleted('Recommendation CTR', 'recommendationCtr', weekDeleted)
    : ratio(
        'recommendationCtr',
        'Recommendation CTR',
        opened,
        impressed.size,
        `${opened} of ${impressed.size} concerts seen in the feed were then opened`,
      );
  const saveRate = !weekObservable
    ? deleted('Concert-save rate', 'saveRate', weekDeleted)
    : ratio(
        'saveRate',
        'Concert-save rate',
        saved,
        impressed.size,
        `${saved} of ${impressed.size} concerts seen in the feed were then saved`,
      );

  const openedWithLink = earliestByPair(
    named('concert_opened').filter((e) => e.properties.ticketLinkAvailable === true),
  );
  const clicked = followedPairs(openedWithLink, named('ticket_link_clicked'));
  const ticketLinkCtr = !weekObservable
    ? deleted('Ticket-link CTR', 'ticketLinkCtr', weekDeleted)
    : ratio(
        'ticketLinkCtr',
        'Ticket-link CTR',
        clicked,
        openedWithLink.size,
        `${clicked} of ${openedWithLink.size} opened concerts with a ticket link got a ticket click (not a purchase)`,
      );

  // Week-1 retention. Activation = first live impression after onboarding, within 7 days of signup.
  // The cohort activated in the week ending 14 days before the report week ends, so every
  // account has its full 14 days observable. Its signups and onboardings start up to 7 days
  // before the cohort week, and all of that must still be within the analytics retention.
  const cohortStart = new Date(weekEnd.getTime() - 21 * DAY),
    cohortEnd = new Date(weekEnd.getTime() - 14 * DAY),
    cohortObservable = cohortStart.getTime() - 7 * DAY >= observableFrom;
  let cohort = 0,
    retained = 0;
  for (const account of eligible.values()) {
    const own = live
      .filter((e) => e.userId === account.id)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    const onboarded = own.find((e) => e.name === 'onboarding_completed');
    if (!onboarded) continue;
    const activated = own.find(
      (e) =>
        e.name === 'concert_impression' &&
        e.at.getTime() >= onboarded.at.getTime() &&
        e.at.getTime() <= account.createdAt.getTime() + 7 * DAY,
    );
    if (!activated || !inWindow(activated, cohortStart, cohortEnd)) continue;
    cohort += 1;
    const from = activated.at.getTime() + 7 * DAY,
      to = activated.at.getTime() + 14 * DAY;
    if (own.some((e) => MEANINGFUL.has(e.name) && e.at.getTime() >= from && e.at.getTime() < to))
      retained += 1;
  }
  const week1Retention = !cohortObservable
    ? deleted(
        'Week-1 retention',
        'week1Retention',
        `Not measurable: its cohort's signups are older than the ${ANALYTICS_RETENTION_DAYS}-day analytics retention. For the latest week, run the report on Monday or Tuesday.`,
      )
    : ratio(
        'week1Retention',
        'Week-1 retention',
        retained,
        cohort,
        `${retained} of ${cohort} accounts activated ${dayLabel(cohortStart)} – ${dayLabel(new Date(cohortEnd.getTime() - DAY))} came back on days 7–13`,
      );

  const metrics = [activation, recommendationCtr, saveRate, ticketLinkCtr, week1Retention];
  if (
    metrics.some(
      (m) => m.status === 'measured' && m.denominator !== null && m.denominator < SMALL_COHORT,
    )
  )
    notes.push(
      `Small numbers: any count under ${SMALL_COHORT} is an anecdote, not a trend. Read it with the interviews.`,
    );
  notes.push(
    'Only consented accounts and live concerts are counted. This opt-in group may not represent all users.',
  );
  return {
    weekStart,
    weekEnd,
    generatedAt: input.now,
    includedAccounts: eligible.size,
    excludedAccounts: excluded.length,
    notConsentedAccounts: notConsented.length,
    metrics,
    notes,
  };
}

export function formatReport(report: WeeklyReport) {
  const result = (m: MetricResult) =>
    m.status === 'measured'
      ? `${m.percent!.toFixed(1)}%`
      : m.status === 'n/a'
        ? 'N/A'
        : 'unavailable';
  const width = Math.max(...report.metrics.map((m) => m.label.length));
  const lines = [
    'Showbound: weekly beta metrics',
    `Week: ${dayLabel(report.weekStart)} → ${dayLabel(new Date(report.weekEnd.getTime() - DAY))} (UTC)`,
    `Accounts counted: ${report.includedAccounts} consented · not consented: ${report.notConsentedAccounts} · staff/test excluded: ${report.excludedAccounts}`,
    '',
    ...report.metrics.map(
      (m) => `${m.label.padEnd(width)}  ${result(m).padStart(11)}  ${m.detail}`,
    ),
    '',
    ...report.notes.map((note) => `• ${note}`),
  ];
  return lines.join('\n');
}
