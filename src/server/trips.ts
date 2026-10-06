import { createHash } from 'node:crypto';
import type { Concert, User } from '../domain/types';
import type {
  AccommodationOption,
  AccommodationProvider,
  TransportOption,
  TransportProvider,
  TripComponentState,
  TripOption,
  TripPlanStatus,
  TripProviderMode,
} from '../domain/trip-types';
import {
  accommodationOptionSchema,
  currentQuote,
  recognizedQuote,
  samplesAllowed,
  safeTravelUrl,
  transportOptionSchema,
} from '../domain/trip-safety';
import { displayPrice } from '../domain/pricing';
import {
  assignTripLabels,
  calculateConvenienceScore,
  calculateCostScore,
  calculateMusicFit,
  calculateOverallScore,
  calculateTotalCost,
} from '../domain/trip-scoring';
import { SampleAccommodationProvider, SampleTransportProvider } from './providers/travel-sample';
import { query } from './db';
import { env } from './env';

export type TripProviders = {
  transport?: TransportProvider;
  accommodation?: AccommodationProvider;
};

export function tripProviderMode(
  event: Concert,
  user: User | null,
  appEnv = env().APP_ENV,
): TripProviderMode {
  // A production deployment must not inherit the local profile's default sample access.
  if (
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && !process.env.APP_ENV)
  )
    return 'live';
  return samplesAllowed(appEnv, user?.mode ?? 'sample', event.provider) ? 'sample' : 'live';
}

export function selectTripProviders(mode: TripProviderMode): TripProviders {
  // There is no approved live adapter. A live registry entry must be added explicitly.
  return mode === 'sample'
    ? { transport: new SampleTransportProvider(), accommodation: new SampleAccommodationProvider() }
    : {};
}

export function eventPlanStatus(event: Concert, now: Date): TripPlanStatus {
  if (event.status === 'cancelled' || event.status === 'postponed') return event.status;
  if (!Number.isFinite(Date.parse(event.date)) || event.date < now.toISOString().slice(0, 10))
    return 'past';
  return 'active';
}

async function transportOptions(
  provider: TransportProvider | undefined,
  mode: TripProviderMode,
  origin: string,
  event: Concert,
  now: Date,
): Promise<{ options: TransportOption[]; state: TripComponentState }> {
  if (!provider || provider.kind !== mode) return { options: [], state: 'unavailable' };
  try {
    const values = await provider.getOptions(origin, event.city, event.date, event.localTime, now);
    if (new Set(values.map((value) => value.id)).size !== values.length)
      return { options: [], state: 'invalid' };
    const options: TransportOption[] = [];
    let state: TripComponentState = 'unavailable';
    for (const value of values) {
      const parsed = transportOptionSchema.safeParse(value);
      if (!parsed.success || !recognizedQuote(parsed.data, provider, mode)) {
        state = 'invalid';
        continue;
      }
      const option = parsed.data;
      if (
        option.origin !== origin ||
        option.destination !== event.city ||
        option.departureAt.slice(0, 10) !== event.date ||
        Date.parse(option.returnAt) <= Date.parse(option.departureAt) ||
        (option.price !== null && !option.currency)
      ) {
        state = 'invalid';
        continue;
      }
      if (!currentQuote(option, now)) {
        state =
          option.availability === 'unknown' || option.availability === 'unavailable'
            ? 'unavailable'
            : 'stale';
        continue;
      }
      options.push({
        ...option,
        bookingUrl:
          mode === 'live' &&
          option.bookingUrl &&
          safeTravelUrl(option.bookingUrl, provider.bookingHosts)
            ? option.bookingUrl
            : null,
      });
    }
    return { options, state: options.length ? 'ready' : state };
  } catch {
    return { options: [], state: 'unavailable' };
  }
}

async function stayOptions(
  provider: AccommodationProvider | undefined,
  mode: TripProviderMode,
  event: Concert,
  now: Date,
): Promise<{ options: AccommodationOption[]; state: TripComponentState }> {
  if (!provider || provider.kind !== mode) return { options: [], state: 'unavailable' };
  try {
    const values = await provider.getOptions(event.city, event.venue, event.date, 1, now);
    if (new Set(values.map((value) => value.id)).size !== values.length)
      return { options: [], state: 'invalid' };
    const options: AccommodationOption[] = [];
    let state: TripComponentState = 'unavailable';
    for (const value of values) {
      const parsed = accommodationOptionSchema.safeParse(value);
      if (!parsed.success || !recognizedQuote(parsed.data, provider, mode)) {
        state = 'invalid';
        continue;
      }
      const option = parsed.data;
      if (
        option.city !== event.city ||
        option.checkIn.slice(0, 10) !== event.date ||
        option.guests !== 1 ||
        Date.parse(option.checkOut) <= Date.parse(option.checkIn) ||
        (option.price !== null && !option.currency)
      ) {
        state = 'invalid';
        continue;
      }
      if (!currentQuote(option, now)) {
        state =
          option.availability === 'unknown' || option.availability === 'unavailable'
            ? 'unavailable'
            : 'stale';
        continue;
      }
      options.push({
        ...option,
        bookingUrl:
          mode === 'live' &&
          option.bookingUrl &&
          safeTravelUrl(option.bookingUrl, provider.bookingHosts)
            ? option.bookingUrl
            : null,
      });
    }
    return { options, state: options.length ? 'ready' : state };
  } catch {
    return { options: [], state: 'unavailable' };
  }
}

export function emptyTrip(
  event: Concert,
  origin: string,
  mode: TripProviderMode,
  now: Date,
): TripOption {
  const status = eventPlanStatus(event, now);
  const observedAt = event.priceObservedAt ?? event.fetchedAt;
  const price =
    status === 'active' && (event.provider !== 'sample' || mode === 'sample')
      ? displayPrice(event.price, event.currency, event.provider, observedAt, now)
      : null;
  return {
    id: `plan-${event.id}`,
    eventId: event.id,
    originCity: origin,
    destinationCity: event.city,
    destinationVenue: event.venue,
    eventDate: event.date,
    mode,
    planStatus: status,
    ticketPrice: price,
    ticketCurrency: price === null ? null : event.currency,
    ticketObservedAt: Number.isFinite(Date.parse(observedAt)) ? observedAt : null,
    ticketProvider: event.provider,
    ticketPriceState: price !== null ? 'ready' : event.price !== null ? 'stale' : 'unavailable',
    transport: null,
    accommodation: null,
    transportState: 'unavailable',
    accommodationState: 'unavailable',
    estimatedTotal: null,
    totalCurrency: null,
    scores: { musicFit: 30, costScore: 50, convenienceScore: null, overallScore: null },
    label: null,
    reasons: [],
    generatedAt: now.toISOString(),
  };
}

export async function generateTripOptions(
  event: Concert,
  user: User | null,
  providers?: TripProviders,
  now = new Date(),
  originCity = user?.preferences.home || 'Paris',
): Promise<TripOption[]> {
  if (eventPlanStatus(event, now) !== 'active') return [];
  const mode = tripProviderMode(event, user);
  const selected = providers ?? selectTripProviders(mode);
  const [affinities, intents] = user
    ? await Promise.all([
        query<{ artist_id: string; favorite: boolean; hidden: boolean }>(
          'SELECT artist_id, favorite, hidden FROM affinities WHERE user_id=$1',
          [user.id],
        ),
        query<{ artist_id: string; data: { cities: string[] } }>(
          'SELECT artist_id, data FROM intents WHERE user_id=$1',
          [user.id],
        ),
      ])
    : [[], []];
  const musicFit = calculateMusicFit(
    event.artistIds,
    affinities.map((r) => ({ artistId: r.artist_id, favorite: r.favorite, hidden: r.hidden })),
    intents.map((r) => ({ artistId: r.artist_id, cities: r.data?.cities || [] })),
  );
  const [travel, stays] = await Promise.all([
    transportOptions(selected.transport, mode, originCity, event, now),
    stayOptions(selected.accommodation, mode, event, now),
  ]);
  const base = emptyTrip(event, originCity, mode, now);
  const candidates: TripOption[] = [];
  for (let i = 0; i < Math.max(1, travel.options.length, stays.options.length); i++) {
    const transport = travel.options[Math.min(i, travel.options.length - 1)] ?? null;
    const accommodation = stays.options[Math.min(i, stays.options.length - 1)] ?? null;
    const { total, currency } = calculateTotalCost(
      base.ticketPrice,
      base.ticketCurrency,
      transport?.priceComplete ? transport.price : null,
      transport?.currency ?? null,
      accommodation?.priceComplete ? accommodation.price : null,
      accommodation?.currency ?? null,
    );
    const costScore = calculateCostScore(total, user?.preferences.budget);
    const convenienceScore =
      transport && accommodation ? calculateConvenienceScore(transport, accommodation) : null;
    const overallScore =
      convenienceScore === null
        ? null
        : calculateOverallScore(musicFit, convenienceScore, costScore);
    const reference = JSON.stringify([
      event.id,
      originCity,
      event.date,
      transport?.provider,
      transport?.id,
      accommodation?.provider,
      accommodation?.id,
    ]);
    candidates.push({
      ...base,
      id: `trip-${createHash('sha256').update(reference).digest('hex')}`,
      transport,
      accommodation,
      transportState: transport ? 'ready' : travel.state,
      accommodationState: accommodation ? 'ready' : stays.state,
      estimatedTotal: total,
      totalCurrency: currency,
      scores: { musicFit, costScore, convenienceScore, overallScore },
      reasons: musicFit >= 90 ? ['High music match for your taste'] : [],
    });
  }
  return assignTripLabels(candidates, now);
}
