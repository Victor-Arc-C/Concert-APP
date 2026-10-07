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
  TripSearchContext,
} from '../domain/trip-types';
import { cities } from '../domain/catalog';
import {
  accommodationOptionSchema,
  currentQuote,
  recognizedQuote,
  scheduleOnly,
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
import { SncfTransportProvider } from './providers/sncf';
import { isProductionKey, LiteApiAccommodationProvider } from './providers/liteapi';
import { reportError } from './monitoring';
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

export function productionDeployment(settings = env()) {
  return (
    settings.APP_ENV === 'production' ||
    settings.VERCEL_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && !process.env.APP_ENV)
  );
}

export function selectTripProviders(mode: TripProviderMode, settings = env()): TripProviders {
  if (mode === 'sample')
    return {
      transport: new SampleTransportProvider(),
      accommodation: new SampleAccommodationProvider(),
    };
  // Live registry: only providers whose credentials are configured on the server.
  // Production accepts only a LiteAPI production key (sandbox keys return test prices).
  const hotelKey =
    settings.LITEAPI_API_KEY &&
    (!productionDeployment(settings) || isProductionKey(settings.LITEAPI_API_KEY))
      ? settings.LITEAPI_API_KEY
      : null;
  return {
    transport: settings.SNCF_API_KEY ? new SncfTransportProvider(settings.SNCF_API_KEY) : undefined,
    accommodation: hotelKey
      ? new LiteApiAccommodationProvider(hotelKey, settings.LITEAPI_WHITELABEL_URL ?? null)
      : undefined,
  };
}

const coordinate = (value: unknown, min: number, max: number) => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
};

/** Home city centre and venue coordinates (from the stored provider record, else city centre). */
export async function tripSearchContext(
  event: Concert,
  originCity: string,
): Promise<TripSearchContext> {
  const home = cities.find((city) => city.name.toLowerCase() === originCity.toLowerCase());
  let venue: TripSearchContext['venue'] = null;
  let venueExact = false;
  if (event.provider !== 'sample') {
    const [row] = await query<{ location: { latitude?: unknown; longitude?: unknown } | null }>(
      `SELECT raw->'_embedded'->'venues'->0->'location' AS location
       FROM event_provider_records WHERE event_id=$1 AND provider=$2 LIMIT 1`,
      [event.id, event.provider],
    );
    const latitude = coordinate(row?.location?.latitude, -90, 90);
    const longitude = coordinate(row?.location?.longitude, -180, 180);
    if (latitude !== null && longitude !== null) {
      venue = { latitude, longitude };
      venueExact = true;
    }
  }
  if (!venue) {
    const city = cities.find(
      (c) => c.name.toLowerCase() === event.city.toLowerCase() && c.country === event.country,
    );
    if (city) venue = { latitude: city.latitude, longitude: city.longitude };
  }
  return {
    origin: home ? { latitude: home.latitude, longitude: home.longitude } : null,
    venue,
    venueExact,
    eventTimezone: event.timezone,
  };
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
  context?: TripSearchContext,
): Promise<{ options: TransportOption[]; state: TripComponentState }> {
  if (!provider || provider.kind !== mode) return { options: [], state: 'unavailable' };
  try {
    const values = await provider.getOptions(
      origin,
      event.city,
      event.date,
      event.localTime,
      now,
      context,
    );
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
    // Bad key, exhausted quota and outages all fail closed; the founder sees them in the logs.
    if (mode === 'live') reportError('provider_failed');
    return { options: [], state: 'unavailable' };
  }
}

async function stayOptions(
  provider: AccommodationProvider | undefined,
  mode: TripProviderMode,
  event: Concert,
  now: Date,
  context?: TripSearchContext,
): Promise<{ options: AccommodationOption[]; state: TripComponentState }> {
  if (!provider || provider.kind !== mode) return { options: [], state: 'unavailable' };
  try {
    const values = await provider.getOptions(event.city, event.venue, event.date, 1, now, context);
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
      if (scheduleOnly(option)) {
        state = 'invalid';
        continue;
      }
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
    // Bad key, exhausted quota and outages all fail closed; the founder sees them in the logs.
    if (mode === 'live') reportError('provider_failed');
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
  // A fictional concert never gets real trains, hotels or booking links, whatever the mode.
  const selected =
    mode === 'live' && event.provider === 'sample' ? {} : (providers ?? selectTripProviders(mode));
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
  const context =
    mode === 'live' && (selected.transport || selected.accommodation)
      ? await tripSearchContext(event, originCity)
      : undefined;
  const [travel, stays] = await Promise.all([
    transportOptions(selected.transport, mode, originCity, event, now, context),
    stayOptions(selected.accommodation, mode, event, now, context),
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
