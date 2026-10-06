import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { sampleEvents } from '../src/domain/sample';
import { defaults } from '../src/domain/catalog';
import { assignTripLabels } from '../src/domain/trip-scoring';
import { currentQuote, currentTripView, safeTravelUrl } from '../src/domain/trip-safety';
import { generateTripOptions, selectTripProviders, tripProviderMode } from '../src/server/trips';
import { revalidateSavedTrip, saveTrip, savedTripsForUser } from '../src/server/saved-trips';
import {
  SampleAccommodationProvider,
  SampleTransportProvider,
} from '../src/server/providers/travel-sample';
import type {
  AccommodationProvider,
  TransportProvider,
  TripOption,
} from '../src/domain/trip-types';

const now = new Date('2026-10-06T12:00:00Z');
const event = sampleEvents(now)[2];
const user = {
  id: 'one',
  name: 'Test',
  email: 'test@example.test',
  mode: 'sample' as const,
  onboarded: true,
  preferences: defaults,
};
const liveEvent = { ...event, provider: 'ticketmaster' as const };
const liveUser = { ...user, mode: 'live' as const };
const testHosts = ['checkout.example.test'];
const liveFixtureProviders = async () => {
  const travel = (
    await new SampleTransportProvider().getOptions(
      'Paris',
      event.city,
      event.date,
      event.localTime,
      now,
    )
  ).map((o) => ({
    ...o,
    kind: 'live' as const,
    availability: 'available' as const,
    provider: 'fixture-travel',
    bookingUrl: 'https://checkout.example.test/travel',
  }));
  const stays = (
    await new SampleAccommodationProvider().getOptions(event.city, event.venue, event.date, 1, now)
  ).map((o) => ({
    ...o,
    kind: 'live' as const,
    availability: 'available' as const,
    provider: 'fixture-stays',
    bookingUrl: 'https://checkout.example.test/stay',
  }));
  const transport: TransportProvider = {
    name: 'Test fixture',
    kind: 'live',
    sourceIds: ['fixture-travel'],
    bookingHosts: testHosts,
    getOptions: vi.fn().mockResolvedValue(travel),
  };
  const accommodation: AccommodationProvider = {
    name: 'Test fixture',
    kind: 'live',
    sourceIds: ['fixture-stays'],
    bookingHosts: testHosts,
    getOptions: vi.fn().mockResolvedValue(stays),
  };
  return { transport, accommodation, travel, stays };
};
const row = (
  trip: TripOption,
  tripData: unknown = {
    version: 1,
    transport: trip.transport && { id: trip.transport.id, provider: trip.transport.provider },
    accommodation: trip.accommodation && {
      id: trip.accommodation.id,
      provider: trip.accommodation.provider,
    },
  },
) => ({
  id: 'saved',
  userId: user.id,
  eventId: event.id,
  tripOptionId: trip.id,
  originCity: 'Paris',
  destinationCity: event.city,
  eventDate: event.date,
  tripData,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
});
beforeEach(() => {
  vi.stubEnv('APP_ENV', 'test');
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('TICKETMASTER_API_KEY', '');
  vi.stubEnv('SPOTIFY_APPROVED', 'false');
  vi.stubEnv('AUTO_CONCERT_CHECKS', 'false');
  vi.mocked(query).mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(query).mockReset();
});

it.each(['test', 'local', 'development'] as const)(
  'allows explicit sample mode in %s, but never mixes live events/users with samples',
  async (appEnv) => {
    expect(tripProviderMode(event, user, appEnv)).toBe('sample');
    expect(tripProviderMode(liveEvent, liveUser, appEnv)).toBe('live');
    expect(tripProviderMode(liveEvent, user, appEnv)).toBe('live');
    expect(tripProviderMode(event, liveUser, appEnv)).toBe('live');
    const [trip] = await generateTripOptions(event, user, undefined, now);
    expect(trip.mode).toBe('sample');
    expect(trip.transport?.bookingUrl).toBeNull();
    expect(trip.accommodation?.bookingUrl).toBeNull();
  },
);
it('production denies samples, including injected sample adapters and an explicit sample user', async () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('DATABASE_URL', 'postgres://unused/test');
  vi.stubEnv('APP_URL', 'https://encore.example.test');
  const transport = new SampleTransportProvider(),
    accommodation = new SampleAccommodationProvider();
  const getTravel = vi.spyOn(transport, 'getOptions'),
    getStay = vi.spyOn(accommodation, 'getOptions');
  const [plan] = await generateTripOptions(event, user, { transport, accommodation }, now);
  expect(tripProviderMode(event, user)).toBe('live');
  expect(selectTripProviders('live')).toEqual({});
  expect(getTravel).not.toHaveBeenCalled();
  expect(getStay).not.toHaveBeenCalled();
  expect(plan).toMatchObject({
    transport: null,
    accommodation: null,
    ticketPrice: null,
    estimatedTotal: null,
    label: null,
    transportState: 'unavailable',
    accommodationState: 'unavailable',
  });
  const [livePlan] = await generateTripOptions(liveEvent, liveUser, undefined, now);
  expect(livePlan).toMatchObject({
    ticketPrice: event.price,
    transport: null,
    accommodation: null,
    estimatedTotal: null,
  });
});

it.each(['transport', 'accommodation', 'both'] as const)(
  'retains a concert plan with %s missing, no manufactured total or badges',
  async (missing) => {
    const p = await liveFixtureProviders();
    const providers = {
      transport: missing === 'transport' || missing === 'both' ? undefined : p.transport,
      accommodation:
        missing === 'accommodation' || missing === 'both' ? undefined : p.accommodation,
    };
    const plans = await generateTripOptions(liveEvent, liveUser, providers, now);
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(plan.estimatedTotal).toBeNull();
      expect(plan.label).toBeNull();
      if (missing !== 'accommodation') expect(plan.transport).toBeNull();
      if (missing !== 'transport') expect(plan.accommodation).toBeNull();
    }
  },
);
it('keeps missing/stale ticket prices unknown and does not award labels', async () => {
  const p = await liveFixtureProviders();
  for (const data of [
    { ...liveEvent, price: null },
    { ...liveEvent, priceObservedAt: new Date(+now - 86400001).toISOString() },
  ]) {
    const plans = await generateTripOptions(data, liveUser, p, now);
    expect(
      plans.every((o) => o.ticketPrice === null && o.estimatedTotal === null && o.label === null),
    ).toBe(true);
  }
});
it.each(['cancelled', 'postponed'] as const)('suppresses %s recommendations', async (status) => {
  expect(await generateTripOptions({ ...event, status }, user, undefined, now)).toEqual([]);
});
it('isolates outages and does not expose provider errors or substitute samples', async () => {
  const p = await liveFixtureProviders();
  vi.mocked(p.transport.getOptions).mockRejectedValue(new Error('private-key=secret'));
  const plans = await generateTripOptions(liveEvent, liveUser, p, now);
  expect(plans[0].transportState).toBe('unavailable');
  expect(plans[0].accommodation).not.toBeNull();
  expect(JSON.stringify(plans)).not.toContain('secret');
});
it.each([
  { currency: 'eu' },
  { price: -1 },
  { price: Infinity },
  { observedAt: 'yesterday' },
  { observedAt: new Date(+now + 1).toISOString() },
  { provider: 'arbitrary' },
  { kind: 'sample' },
  { expiresAt: new Date(+now - 1).toISOString() },
  { availability: 'unknown' },
  { availability: 'unavailable' },
])('rejects invalid/unavailable adapter observations: %j', async (patch) => {
  const p = await liveFixtureProviders();
  vi.mocked(p.transport.getOptions).mockResolvedValue(
    p.travel.map((o) => ({ ...o, ...patch })) as typeof p.travel,
  );
  const plans = await generateTripOptions(liveEvent, liveUser, p, now);
  expect(
    plans.every((o) => o.transport === null && o.estimatedTotal === null && o.label === null),
  ).toBe(true);
});
it('suppresses unsafe URLs and strips extra provider payload fields', async () => {
  const p = await liveFixtureProviders();
  vi.mocked(p.transport.getOptions).mockResolvedValue(
    p.travel.map((o) => ({ ...o, bookingUrl: 'javascript:alert(1)', privatePayload: 'secret' })),
  );
  const [trip] = await generateTripOptions(liveEvent, liveUser, p, now);
  expect(trip.transport?.bookingUrl).toBeNull();
  expect(JSON.stringify(trip)).not.toContain('secret');
});
it('requires exact approved HTTPS checkout hosts', () => {
  expect(safeTravelUrl('https://checkout.example.test/offer?id=1', testHosts)).toBe(true);
  for (const url of [
    'http://checkout.example.test',
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///tmp/test',
    'https://checkout.example.test.evil.test',
    'https://sub.checkout.example.test',
    'https://user:pass@checkout.example.test',
    'https://checkout.example.test:8443',
    'https://evil.test/redirect?to=checkout.example.test',
    ' https://checkout.example.test',
  ])
    expect(safeTravelUrl(url, testHosts)).toBe(false);
  expect(safeTravelUrl('https://checkout.example.test', [])).toBe(false);
});

describe('save and revalidation', () => {
  it('stores identifiers/intent only from a current server option', async () => {
    const [trip] = await generateTripOptions(event, user, undefined, now);
    vi.mocked(query).mockImplementation(async (sql) =>
      sql.includes('FROM events e')
        ? [{ data: event }]
        : sql.startsWith('INSERT INTO saved_trips')
          ? [{ id: 'saved' }]
          : [],
    );
    await saveTrip(user, { eventId: event.id, tripOptionId: trip.id }, now);
    const insert = vi
      .mocked(query)
      .mock.calls.find(([sql]) => sql.startsWith('INSERT INTO saved_trips'))!;
    const intent = JSON.parse(String(insert[1]?.[7]));
    expect(intent).toEqual({
      version: 1,
      transport: { id: trip.transport!.id, provider: trip.transport!.provider },
      accommodation: { id: trip.accommodation!.id, provider: trip.accommodation!.provider },
    });
    expect(JSON.stringify(intent)).not.toMatch(
      /price|currency|observedAt|bookingUrl|scores|Grand Stage/,
    );
    expect(insert[1]?.[1]).toBe(user.id);
  });
  it.each([
    { trip: { transport: { provider: 'evil' } } },
    { bookingUrl: 'javascript:alert(1)' },
    { currency: 'not-currency' },
    { price: -1 },
    { price: Infinity },
    { userId: 'another' },
  ])('rejects arbitrary client quote fields %j', async (fields) => {
    await expect(
      saveTrip(user, { eventId: event.id, tripOptionId: 'guessed', ...fields }, now),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects an unrelated option/event, mode mismatch, unknown event and cancelled/postponed events', async () => {
    const [trip] = await generateTripOptions(event, user, undefined, now);
    for (const data of [
      null,
      liveEvent,
      { ...event, status: 'cancelled' },
      { ...event, status: 'postponed' },
      sampleEvents(now)[0],
    ]) {
      vi.mocked(query).mockImplementation(async (sql) =>
        sql.includes('FROM events e') ? (data ? [{ data }] : []) : [],
      );
      await expect(
        saveTrip(user, { eventId: data?.id ?? 'missing', tripOptionId: trip.id }, now),
      ).rejects.toThrow();
    }
    expect(
      vi.mocked(query).mock.calls.some(([sql]) => sql.startsWith('INSERT INTO saved_trips')),
    ).toBe(false);
  });
  it('re-queries fresh selected references and never persists/reuses a quote snapshot', async () => {
    const [trip] = await generateTripOptions(event, user, undefined, now);
    const reopened = await revalidateSavedTrip(row(trip), event, user, new Date(+now + 60000));
    expect(reopened.revalidationStatus).toBe('current');
    expect(reopened.tripData.transport?.observedAt).toBe(new Date(+now + 60000).toISOString());
  });
  it.each([now.toISOString(), new Date(+now - 86400000).toISOString()])(
    'discards even fresh-looking legacy snapshots (%s), preserving intent',
    async (observedAt) => {
      const [trip] = await generateTripOptions(event, user, undefined, now);
      const saved = await revalidateSavedTrip(
        row(trip, {
          ...trip,
          transport: { ...trip.transport, observedAt, bookingUrl: 'https://evil.test', price: 1 },
        }),
        event,
        user,
        now,
      );
      expect(saved.revalidationStatus).toBe('legacy');
      expect(saved.tripData).toMatchObject({
        transport: null,
        accommodation: null,
        estimatedTotal: null,
        label: null,
      });
      expect(saved.id).toBe('saved');
      expect(JSON.stringify(saved)).not.toContain('evil.test');
    },
  );
  it('keeps intent with unavailable or expired providers and no current quote', async () => {
    const p = await liveFixtureProviders();
    const [trip] = await generateTripOptions(liveEvent, liveUser, p, now);
    const stored = row(trip);
    const missing = await revalidateSavedTrip(stored, liveEvent, liveUser, now);
    expect(missing.tripData).toMatchObject({
      transport: null,
      accommodation: null,
      estimatedTotal: null,
      label: null,
    });
    const expired = await revalidateSavedTrip(
      stored,
      liveEvent,
      liveUser,
      new Date(+now + 300001),
      p,
    );
    expect(expired.tripData.estimatedTotal).toBeNull();
    expect(expired.tripData.label).toBeNull();
    expect(expired.id).toBe('saved');
  });
  it.each(['cancelled', 'postponed', 'missing', 'changed', 'mode'] as const)(
    'suppresses saved active inventory when event is %s',
    async (reason) => {
      const [trip] = await generateTripOptions(event, user, undefined, now);
      const current =
        reason === 'missing'
          ? null
          : reason === 'changed'
            ? { ...event, date: '2027-01-01' }
            : reason === 'mode'
              ? liveEvent
              : { ...event, status: reason };
      const saved = await revalidateSavedTrip(row(trip), current, user, now);
      expect(saved.tripData.planStatus).not.toBe('active');
      expect(saved.tripData).toMatchObject({
        transport: null,
        accommodation: null,
        estimatedTotal: null,
        label: null,
      });
    },
  );
  it('sanitizes the shared saved-trip read path and isolates ownership', async () => {
    const [trip] = await generateTripOptions(event, user, undefined, now);
    vi.mocked(query).mockImplementation(async (sql) =>
      sql.includes('FROM saved_trips')
        ? [row(trip), { ...row(trip), userId: 'other' }]
        : sql.includes('FROM events e')
          ? [{ data: event }]
          : [],
    );
    const saved = await savedTripsForUser(user, now);
    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe(user.id);
  });
});

it('suppresses stale prices/availability and all labels on an already-open view', async () => {
  const p = await liveFixtureProviders();
  const [trip] = await generateTripOptions(liveEvent, liveUser, p, now);
  expect(currentQuote(trip.transport!, new Date(+now + 299999))).toBe(true);
  expect(currentQuote(trip.transport!, new Date(+now + 300000))).toBe(false);
  expect(currentTripView(trip, new Date(+now + 300000))).toMatchObject({
    transport: null,
    accommodation: null,
    estimatedTotal: null,
    label: null,
    transportState: 'stale',
  });
});
it.each([
  'stale',
  'expiry',
  'currency',
  'price',
  'partial',
  'missing',
  'mixed',
  'availability',
] as const)('suppresses every comparison badge when the set has %s data', async (fault) => {
  const p = await liveFixtureProviders();
  const trips = await generateTripOptions(liveEvent, liveUser, p, now);
  const second = structuredClone(trips[1]);
  if (fault === 'stale') second.transport!.observedAt = new Date(+now - 300000).toISOString();
  if (fault === 'expiry') second.accommodation!.expiresAt = now.toISOString();
  if (fault === 'currency') second.totalCurrency = 'GBP';
  if (fault === 'price') second.transport!.price = null;
  if (fault === 'partial') second.transport!.priceComplete = false;
  if (fault === 'missing') second.accommodation = null;
  if (fault === 'mixed') second.transport!.kind = 'sample';
  if (fault === 'availability') second.transport!.availability = 'unknown';
  expect(assignTripLabels([trips[0], second], now).every((o) => o.label === null)).toBe(true);
  expect(assignTripLabels([trips[0]], now)[0].label).toBeNull();
});

it('retains the selected current component when the other saved component fails', async () => {
  const p = await liveFixtureProviders();
  const [trip] = await generateTripOptions(liveEvent, liveUser, p, now);
  vi.mocked(p.accommodation.getOptions).mockRejectedValue(new Error('outage'));
  const saved = await revalidateSavedTrip(row(trip), liveEvent, liveUser, now, p);
  expect(saved.tripData.transport?.id).toBe(trip.transport?.id);
  expect(saved.tripData.accommodation).toBeNull();
  expect(saved.tripData.estimatedTotal).toBeNull();
  expect(saved.tripData.label).toBeNull();
});
it('refuses to save when the event changes between generation and the atomic write', async () => {
  const [trip] = await generateTripOptions(event, user, undefined, now);
  vi.mocked(query).mockImplementation(async (sql) =>
    sql.includes('FROM events e LEFT') ? [{ data: event }] : [],
  );
  await expect(
    saveTrip(user, { eventId: event.id, tripOptionId: trip.id }, now),
  ).rejects.toMatchObject({ status: 422 });
});
it('does not label a tied best score or an inconsistent total', async () => {
  const p = await liveFixtureProviders();
  const trips = await generateTripOptions(liveEvent, liveUser, p, now);
  trips[0].scores.overallScore = trips[1].scores.overallScore = 90;
  expect(assignTripLabels(trips, now).some((o) => o.label === 'Best value')).toBe(false);
  trips[0].estimatedTotal = 0;
  expect(assignTripLabels(trips, now).every((o) => o.label === null)).toBe(true);
});

it('rejects ambiguous duplicate provider option IDs', async () => {
  const p = await liveFixtureProviders();
  vi.mocked(p.transport.getOptions).mockResolvedValue([p.travel[0], { ...p.travel[0], price: 1 }]);
  const trips = await generateTripOptions(liveEvent, liveUser, p, now);
  expect(
    trips.every((o) => o.transport === null && o.label === null && o.estimatedTotal === null),
  ).toBe(true);
});
it('never emits a nonfinite total even from individually finite extreme amounts', async () => {
  const p = await liveFixtureProviders();
  vi.mocked(p.transport.getOptions).mockResolvedValue(
    p.travel.map((o) => ({ ...o, price: 1e308 })),
  );
  const trips = await generateTripOptions(liveEvent, liveUser, p, now);
  expect(trips.every((o) => o.estimatedTotal === null && o.label === null)).toBe(true);
});
