import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { openTravelPlanning, submitTravelSearch } from '../src/server/travel-planning';
import { planningToday, validDate, type TravelSearch } from '../src/domain/travel-planning';
import { omioSearchUrl } from '../src/server/providers/omio';
import { defaults } from '../src/domain/catalog';
import { sampleEvents } from '../src/domain/sample';
import type { Concert, User } from '../src/domain/types';
const now = new Date('2026-11-14T23:30:00Z');
const event: Concert = {
  ...sampleEvents()[0],
  provider: 'ticketmaster',
  city: 'Berlin',
  date: '2026-11-15',
  timezone: 'Europe/Berlin',
};
const user: User = {
  id: 'fixture',
  name: 'Private',
  email: 'private@example.test',
  mode: 'live',
  onboarded: true,
  preferences: { ...defaults, home: 'Paris', analytics: true },
};
const provider = {
  id: 'omio' as const,
  configured: () => true,
  buildLink: (search: TravelSearch) => omioSearchUrl(search, '987654321234'),
};
const search: TravelSearch = {
  departure: 'Private origin',
  destination: 'Berlin',
  departureDate: event.date,
  locale: 'en',
};
const analytics = () =>
  vi
    .mocked(query)
    .mock.calls.map(([, p]) => ({ name: p?.[2], properties: JSON.parse(String(p?.[3])) }));
beforeEach(() => vi.mocked(query).mockResolvedValue([]));
afterEach(() => vi.clearAllMocks());

it('prefills saved home and verified destination using the exact event-local calendar date', async () => {
  const result = await openTravelPlanning(event, user, provider, now);
  expect(result).toMatchObject({
    reason: null,
    today: '2026-11-14',
    defaults: {
      departure: 'Paris',
      destination: 'Berlin',
      departureDate: '2026-11-15',
      returnDate: '',
    },
  });
  expect(analytics()[0].name).toBe('travel_planning_opened');
});
it('leaves missing/unknown locations blank without inventing Paris or a destination', async () => {
  const result = await openTravelPlanning(
    { ...event, city: 'Unknown' },
    { ...user, preferences: { ...user.preferences, home: '' } },
    provider,
    now,
  );
  expect(result.defaults).toMatchObject({ departure: '', destination: '' });
});
it('handles midnight, DST, leap years, and missing/invalid zones without host-timezone dependence', () => {
  expect(planningToday('America/Los_Angeles', now)).toBe('2026-11-14');
  expect(planningToday('Europe/Berlin', now)).toBe('2026-11-15');
  expect(planningToday('Europe/Paris', new Date('2026-03-29T01:30Z'))).toBe('2026-03-29');
  expect(planningToday('Invalid/Zone', now)).toBe('2026-11-14');
  expect(planningToday(null, new Date('2026-11-15T01:00Z'))).toBe('2026-11-14');
  expect(validDate('2028-02-29')).toBe(true);
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '', '2026-11-15T00:00Z'])
    expect(validDate(date)).toBe(false);
});
it.each([
  [{ provider: 'sample' }, 'sample'],
  [{ status: 'cancelled' }, 'inactive'],
  [{ status: 'postponed' }, 'inactive'],
  [{ date: '' }, 'event_date'],
  [{ date: '2026-11-14' }, 'past'],
] as const)('blocks unavailable concerts on both open and submit: %j', async (patch, reason) => {
  const concert = { ...event, ...patch };
  expect((await openTravelPlanning(concert, user, provider, now)).reason).toBe(reason);
  expect(await submitTravelSearch(concert, user, search, provider, now)).toEqual({ reason });
  expect(analytics().some((a) => a.name === 'omio_redirect_clicked')).toBe(false);
});
it('reports missing configuration and never issues a fallback', async () => {
  const disabled = { ...provider, configured: () => false };
  expect((await openTravelPlanning(event, user, disabled, now)).reason).toBe('unconfigured');
  expect(await submitTravelSearch(event, user, search, disabled, now)).toEqual({
    reason: 'unconfigured',
  });
});
it.each([
  [{ departure: '' }, 'invalid_search'],
  [{ destination: 'TBA' }, 'invalid_search'],
  [{ departureDate: '2026-11-13' }, 'dates'],
  [{ returnDate: '2026-11-14' }, 'dates'],
  [{ departure: 'Bérlin' }, 'same_city'],
  [{ travelMode: 'CAR' }, 'invalid_search'],
  [{ url: 'https://evil.test' }, 'invalid_search'],
])('rejects invalid user input: %j', async (patch, reason) => {
  expect(await submitTravelSearch(event, user, { ...search, ...patch }, provider, now)).toEqual({
    reason,
  });
  expect(analytics().map((a) => a.name)).toEqual([
    'travel_search_submitted',
    'travel_planning_failed',
  ]);
});
it('allows edited locations and dates, emits all events with safe metadata, and preserves opt-out', async () => {
  const edited = {
    ...search,
    destination: 'München',
    travelMode: 'BUS' as const,
    returnDate: '2026-11-17',
  };
  const result = await submitTravelSearch(event, user, edited, provider, now);
  expect(result.url).toBeTruthy();
  expect(analytics().map((a) => a.name)).toEqual([
    'travel_search_submitted',
    'omio_redirect_clicked',
  ]);
  expect(analytics()[1].properties).toMatchObject({
    eventId: event.id,
    destination: 'Berlin',
    provider: 'omio',
    travelMode: 'BUS',
    mode: 'live',
  });
  expect(JSON.stringify(analytics())).not.toMatch(/Private|private@|München|2026-11-17|https:/);
  vi.mocked(query).mockClear();
  const privateUser = { ...user, preferences: { ...user.preferences, analytics: false } };
  await openTravelPlanning(event, privateUser, provider, now);
  await submitTravelSearch(event, privateUser, edited, provider, now);
  await submitTravelSearch(event, privateUser, {}, provider, now);
  expect(query).not.toHaveBeenCalled();
});
it('reports a link-generation failure without a click', async () => {
  expect(
    await submitTravelSearch(event, user, search, { ...provider, buildLink: () => null }, now),
  ).toEqual({ reason: 'redirect' });
  expect(analytics().map((a) => a.name)).not.toContain('omio_redirect_clicked');
});

it('does not use the venue timezone to reject a departure day still current at the origin', async () => {
  const result = await submitTravelSearch(
    event,
    user,
    { ...search, departure: 'Los Angeles', departureDate: '2026-11-14' },
    provider,
    now,
  );
  expect(result.url).toBeTruthy();
});

it('tolerates absent location fields in older stored records', async () => {
  const result = await openTravelPlanning(
    { ...event, city: null } as unknown as Concert,
    { ...user, preferences: { ...user.preferences, home: undefined } } as unknown as User,
    provider,
    now,
  );
  expect(result.defaults).toMatchObject({ departure: '', destination: '' });
});
