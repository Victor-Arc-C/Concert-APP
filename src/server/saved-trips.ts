import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Concert, User } from '../domain/types';
import type { SavedTrip, TripOption } from '../domain/trip-types';
import { saveTripSchema, savedTripIntentSchema } from '../domain/trip-safety';
import { query } from './db';
import { HttpError } from './security';
import {
  calculateTotalCost,
  calculateCostScore,
  calculateConvenienceScore,
  calculateOverallScore,
} from '../domain/trip-scoring';
import { emptyTrip, eventPlanStatus, generateTripOptions, tripProviderMode } from './trips';
import type { TripProviders } from './trips';

type StoredTrip = Omit<SavedTrip, 'tripData' | 'revalidationStatus'> & { tripData: unknown };

// Use exactly this event's current ticket source, never the price in its old JSON snapshot.
export async function tripEvent(id: string): Promise<Concert | null> {
  const [row] = await query<{
    data: Concert;
    price: number | null;
    currency: string | null;
    observedAt: Date | null;
    disabledAt: Date | null;
  }>(
    `SELECT e.data,t.price_min::float AS price,t.currency,t.observed_at AS "observedAt",t.disabled_at AS "disabledAt"
     FROM events e LEFT JOIN ticket_sources t ON t.event_id=e.id
       AND t.provider=e.data->>'provider' AND t.external_id=e.data->>'externalId' WHERE e.id=$1`,
    [id],
  );
  if (!row) return null;
  if (row.data.provider === 'sample') return row.data;
  return {
    ...row.data,
    price: row.observedAt && !row.disabledAt ? row.price : null,
    currency: row.currency ?? null,
    priceObservedAt: row.observedAt ? new Date(row.observedAt).toISOString() : null,
  };
}

export async function saveTrip(user: User, payload: unknown, now = new Date()) {
  // Strict identifiers only. Extra client quote/URL/score fields are rejected, not persisted.
  const input = saveTripSchema.parse(payload);
  const event = await tripEvent(input.eventId);
  if (!event || (event.provider === 'sample') !== (user.mode === 'sample'))
    throw new HttpError(404, 'Concert not found in this mode.');
  if (eventPlanStatus(event, now) !== 'active')
    throw new HttpError(422, 'Cannot save an inactive concert plan.');
  const options = await generateTripOptions(event, user, undefined, now);
  const option = options.find((value) => value.id === input.tripOptionId);
  if (!option) throw new HttpError(422, 'This option is no longer current. Check again.');
  const reference = (component: TripOption['transport'] | TripOption['accommodation']) =>
    component ? { id: component.id, provider: component.provider } : null;
  const intent = savedTripIntentSchema.parse({
    version: 1,
    transport: reference(option.transport),
    accommodation: reference(option.accommodation),
  });
  const saved = await query(
    `INSERT INTO saved_trips(id,user_id,event_id,trip_option_id,origin_city,destination_city,event_date,trip_data)
    SELECT $1,$2,e.id,$4,$5,$6,$7,$8 FROM events e WHERE e.id=$3
      AND e.sample=$9 AND e.data->>'status' NOT IN ('cancelled','postponed')
      AND e.data->>'date'=$7 AND e.data->>'city'=$6 AND e.data->>'venue'=$10
    ON CONFLICT(user_id,event_id,trip_option_id)
    DO UPDATE SET trip_data=EXCLUDED.trip_data, origin_city=EXCLUDED.origin_city,
      destination_city=EXCLUDED.destination_city,event_date=EXCLUDED.event_date,updated_at=NOW() RETURNING id`,
    [
      randomUUID(),
      user.id,
      event.id,
      option.id,
      option.originCity,
      event.city,
      event.date,
      JSON.stringify(intent),
      user.mode === 'sample',
      event.venue,
    ],
  );
  if (!saved.length) throw new HttpError(422, 'This concert changed. Check again before saving.');
  return event;
}

export async function revalidateSavedTrip(
  row: StoredTrip,
  event: Concert | null,
  user: User,
  now = new Date(),
  providers?: TripProviders,
  liveLookups = true,
): Promise<SavedTrip> {
  const safeText = (value: string) => (typeof value === 'string' ? value.slice(0, 300) : '');
  const origin = safeText(row.originCity);
  const placeholder: Concert = event ?? {
    id: row.eventId,
    artistIds: [],
    artist: '',
    title: '',
    venue: '',
    city: safeText(row.destinationCity),
    country: '',
    date: z.iso.date().safeParse(row.eventDate).success ? row.eventDate : '',
    localTime: null,
    timezone: null,
    status: 'unknown',
    price: null,
    currency: null,
    saleAt: null,
    provider: 'sample',
    externalId: '',
    url: null,
    fetchedAt: now.toISOString(),
    image: '',
    genre: '',
  };
  const mode = tripProviderMode(placeholder, user);
  let trip = emptyTrip(placeholder, origin, mode, now);
  const intent = savedTripIntentSchema.safeParse(row.tripData);
  let revalidationStatus: SavedTrip['revalidationStatus'] = intent.success
    ? 'unavailable'
    : 'legacy';
  if (!event) trip.planStatus = 'event_missing';
  else if ((event.provider === 'sample') !== (user.mode === 'sample'))
    trip.planStatus = 'mode_changed';
  else if (event.date !== row.eventDate || event.city !== row.destinationCity)
    trip.planStatus = 'event_changed';
  else if (trip.planStatus === 'active' && intent.success && mode === 'live' && !liveLookups)
    // Background reads never spend live provider quota; the Trips page checks on demand.
    revalidationStatus = 'unchecked';
  else if (trip.planStatus === 'active' && intent.success) {
    const options = await generateTripOptions(event, user, providers, now, origin);
    const ref = intent.data;
    const matches = (
      component: TripOption['transport'] | TripOption['accommodation'],
      selected: typeof ref.transport,
    ) =>
      selected === null
        ? component === null
        : component?.id === selected.id && component.provider === selected.provider;
    const current = options.find(
      (option) =>
        matches(option.transport, ref.transport) &&
        matches(option.accommodation, ref.accommodation),
    );
    if (current) {
      trip = { ...current, label: null };
      revalidationStatus = current.transport && current.accommodation ? 'current' : 'unavailable';
    } else if (options.length) {
      // A failed stay must not erase a still-current selected journey, or vice versa.
      // Never substitute a different offer for the saved reference.
      const transport =
        options.find((option) => ref.transport && matches(option.transport, ref.transport))
          ?.transport ?? null;
      const accommodation =
        options.find(
          (option) => ref.accommodation && matches(option.accommodation, ref.accommodation),
        )?.accommodation ?? null;
      const { total, currency } = calculateTotalCost(
        trip.ticketPrice,
        trip.ticketCurrency,
        transport?.priceComplete ? transport.price : null,
        transport?.currency ?? null,
        accommodation?.priceComplete ? accommodation.price : null,
        accommodation?.currency ?? null,
      );
      const musicFit = options[0].scores.musicFit;
      const costScore = calculateCostScore(total, user.preferences.budget);
      const convenienceScore =
        transport && accommodation ? calculateConvenienceScore(transport, accommodation) : null;
      trip = {
        ...trip,
        transport,
        accommodation,
        transportState: transport
          ? 'ready'
          : options[0].transportState === 'ready'
            ? 'unavailable'
            : options[0].transportState,
        accommodationState: accommodation
          ? 'ready'
          : options[0].accommodationState === 'ready'
            ? 'unavailable'
            : options[0].accommodationState,
        estimatedTotal: total,
        totalCurrency: currency,
        scores: {
          musicFit,
          costScore,
          convenienceScore,
          overallScore:
            convenienceScore === null
              ? null
              : calculateOverallScore(musicFit, convenienceScore, costScore),
        },
      };
    }
  }
  // Old snapshots are untrusted, even when their timestamp looks fresh. Never resurrect their quotes/URLs/scores.
  if (!intent.success || trip.planStatus !== 'active') {
    trip = {
      ...trip,
      transport: null,
      accommodation: null,
      transportState: 'unavailable',
      accommodationState: 'unavailable',
      ticketPrice: null,
      ticketCurrency: null,
      ticketPriceState: 'unavailable',
      estimatedTotal: null,
      totalCurrency: null,
      label: null,
      scores: { ...trip.scores, convenienceScore: null, overallScore: null },
    };
  }
  return {
    ...row,
    originCity: origin,
    destinationCity: trip.destinationCity,
    eventDate: trip.eventDate,
    tripData: trip,
    revalidationStatus,
  };
}

/** Live lookups per request are capped; the rest stay 'unchecked' rather than waiting minutes. */
export const MAX_LIVE_REVALIDATIONS = 3;
export async function savedTripsForUser(
  user: User,
  now = new Date(),
  { liveLookups = true }: { liveLookups?: boolean } = {},
): Promise<SavedTrip[]> {
  const rows = await query<StoredTrip>(
    `SELECT id,user_id AS "userId",event_id AS "eventId",trip_option_id AS "tripOptionId",
    origin_city AS "originCity",destination_city AS "destinationCity",event_date AS "eventDate",
    trip_data AS "tripData",created_at AS "createdAt",updated_at AS "updatedAt"
    FROM saved_trips WHERE user_id=$1 ORDER BY created_at DESC`,
    [user.id],
  );
  const own = rows.filter((row) => row.userId === user.id);
  return Promise.all(
    own.map(async (row, index) =>
      revalidateSavedTrip(
        row,
        await tripEvent(row.eventId),
        user,
        now,
        undefined,
        liveLookups && index < MAX_LIVE_REVALIDATIONS,
      ),
    ),
  );
}
