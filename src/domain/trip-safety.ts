import { z } from 'zod';
import type {
  QuoteObservation,
  TripOption,
  TripProviderDefinition,
  TripProviderMode,
} from './trip-types';
import { displayPrice } from './pricing';

export const TRIP_QUOTE_MAX_AGE_MS = 5 * 60 * 1000;
const text = z.string().trim().min(1).max(300);
const time = z.iso.datetime({ offset: true });
const price = z.number().finite().nonnegative().nullable();
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .nullable();
const observation = {
  id: text,
  provider: text,
  kind: z.enum(['sample', 'live']),
  availability: z.enum(['sample', 'available', 'unavailable', 'unknown']),
  priceComplete: z.boolean(),
  price,
  currency,
  observedAt: time,
  expiresAt: time.nullable().optional(),
  bookingUrl: z.string().max(2000).nullable(),
};
export const transportOptionSchema = z.object({
  ...observation,
  mode: z.enum(['train', 'flight', 'bus']),
  origin: text,
  destination: text,
  departureAt: time,
  returnAt: time,
  durationMinutes: z.number().finite().positive(),
  changes: z.number().int().nonnegative(),
  operator: text.optional(),
});
export const accommodationOptionSchema = z.object({
  ...observation,
  name: text,
  city: text,
  checkIn: time,
  checkOut: time,
  guests: z.number().int().positive(),
  distanceKmToVenue: z.number().finite().nonnegative().nullable(),
});

// Hosts come from server-owned adapter definitions, never client/provider payloads.
// Samples have no checkout hosts or booking actions.
export function safeTravelUrl(value: string, hosts: readonly string[]): boolean {
  try {
    const url = new URL(value);
    return (
      value.trim() === value &&
      ![...value].some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === '\\',
      ) &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      hosts.includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function samplesAllowed(appEnv: string, userMode: TripProviderMode, eventProvider: string) {
  return (
    ['test', 'local', 'development'].includes(appEnv) &&
    userMode === 'sample' &&
    eventProvider === 'sample'
  );
}

// A live timetable result (e.g. SNCF) has no fare and no seat inventory: it is shown as a
// schedule only — price null, availability 'unknown', never priced, totalled or badged.
export function scheduleOnly(quote: QuoteObservation & { price?: number | null }) {
  return (
    quote.kind === 'live' &&
    quote.availability === 'unknown' &&
    quote.price == null &&
    !quote.priceComplete
  );
}

export function currentQuote(
  quote: QuoteObservation & { observedAt: string; price?: number | null },
  now: Date,
) {
  const age = now.getTime() - Date.parse(quote.observedAt);
  const expiry = quote.expiresAt == null ? null : Date.parse(quote.expiresAt);
  return (
    Number.isFinite(age) &&
    age >= 0 &&
    age < TRIP_QUOTE_MAX_AGE_MS &&
    (expiry === null || (Number.isFinite(expiry) && expiry > now.getTime())) &&
    ((quote.kind === 'sample' && quote.availability === 'sample') ||
      (quote.kind === 'live' && quote.availability === 'available') ||
      scheduleOnly(quote))
  );
}

export function recognizedQuote(
  quote: QuoteObservation & { provider: string },
  definition: TripProviderDefinition,
  mode: TripProviderMode,
) {
  return (
    definition.kind === mode && quote.kind === mode && definition.sourceIds.includes(quote.provider)
  );
}

// Keep an already-open page from continuing to display a quote beyond its lifetime.
export function currentTripView(trip: TripOption, now: Date): TripOption {
  const travelStale = !!trip.transport && !currentQuote(trip.transport, now);
  const stayStale = !!trip.accommodation && !currentQuote(trip.accommodation, now);
  const ticketStale =
    trip.ticketPrice !== null &&
    (!trip.ticketObservedAt ||
      displayPrice(
        trip.ticketPrice,
        trip.ticketCurrency,
        trip.ticketProvider ?? '',
        trip.ticketObservedAt,
        now,
      ) === null);
  if (!travelStale && !stayStale && !ticketStale) return trip;
  return {
    ...trip,
    transport: travelStale ? null : trip.transport,
    accommodation: stayStale ? null : trip.accommodation,
    transportState: travelStale ? 'stale' : trip.transportState,
    accommodationState: stayStale ? 'stale' : trip.accommodationState,
    ticketPrice: ticketStale ? null : trip.ticketPrice,
    ticketPriceState: ticketStale ? 'stale' : trip.ticketPriceState,
    estimatedTotal: null,
    totalCurrency: null,
    label: null,
    scores: {
      ...trip.scores,
      convenienceScore: travelStale || stayStale ? null : trip.scores.convenienceScore,
      overallScore: null,
    },
  };
}

export const saveTripSchema = z
  .object({
    eventId: z.string().min(1).max(160),
    tripOptionId: z.string().min(1).max(512),
  })
  .strict();
const reference = z.object({ id: text, provider: text }).strict();
export const savedTripIntentSchema = z
  .object({
    version: z.literal(1),
    transport: reference.nullable(),
    accommodation: reference.nullable(),
  })
  .strict();
