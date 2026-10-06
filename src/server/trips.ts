import type { Concert, User } from '../domain/types';

import type {
  AccommodationProvider,
  TransportProvider,
  TripOption,
} from '../domain/trip-types';
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

const defaultTransportProvider: TransportProvider = new SampleTransportProvider();
const defaultAccommodationProvider: AccommodationProvider = new SampleAccommodationProvider();

/**
 * Generates trip options for a specific concert.
 * Respects CON-20/CON-27:
 * - Cancelled/postponed concerts return no trip options.
 * - Missing ticket prices do not block trip generation, but estimatedTotal remains null if ticket price is absent.
 * - Source freshness and exact provider attribution are preserved.
 */
export async function generateTripOptions(
  event: Concert,
  user: User | null,
  transportProvider: TransportProvider = defaultTransportProvider,
  accommodationProvider: AccommodationProvider = defaultAccommodationProvider,
  now = new Date(),
): Promise<TripOption[]> {
  // Cancelled/postponed events suppress trip recommendations
  if (['cancelled', 'postponed'].includes(event.status)) {
    return [];
  }

  const originCity = user?.preferences.home || 'Paris';
  const destinationCity = event.city;
  const destinationVenue = event.venue;
  const eventDate = event.date;

  // Retrieve user affinities/intents if logged in
  let affinities: { artistId: string; favorite: boolean; hidden: boolean }[] = [];
  let intents: { artistId: string; cities: string[] }[] = [];

  if (user) {
    const affRows = await query<{ artist_id: string; favorite: boolean; hidden: boolean }>(
      'SELECT artist_id, favorite, hidden FROM affinities WHERE user_id=$1',
      [user.id],
    );
    affinities = affRows.map((r) => ({
      artistId: r.artist_id,
      favorite: r.favorite,
      hidden: r.hidden,
    }));

    const intRows = await query<{ artist_id: string; data: { cities: string[] } }>(
      'SELECT artist_id, data FROM intents WHERE user_id=$1',
      [user.id],
    );
    intents = intRows.map((r) => ({
      artistId: r.artist_id,
      cities: r.data?.cities || [],
    }));
  }

  const musicFit = calculateMusicFit(event.artistIds, affinities, intents);

  // Fetch transport and accommodation options
  const [transports, stays] = await Promise.all([
    transportProvider.getOptions(originCity, destinationCity, eventDate, event.localTime, now),
    accommodationProvider.getOptions(destinationCity, destinationVenue, eventDate, 1, now),
  ]);

  if (transports.length === 0 || stays.length === 0) {
    return [];
  }

  // Generate pairing combinations (e.g. direct train + close hotel, or alternative transport + budget hotel)
  const candidateTrips: TripOption[] = [];

  // Pair 1: primary transport + stay 1
  // Pair 2: secondary transport (if available) + stay 2 (or stay 1)
  // We keep it to 2-3 focused, high quality options
  for (let i = 0; i < transports.length; i++) {
    const transport = transports[i];
    const stay = stays[Math.min(i, stays.length - 1)];

    const { total, currency } = calculateTotalCost(
      event.price,
      event.currency,
      transport.price,
      transport.currency,
      stay.price,
      stay.currency,
    );

    const costScore = calculateCostScore(total, user?.preferences.budget);
    const convenienceScore = calculateConvenienceScore(transport, stay);
    const overallScore = calculateOverallScore(musicFit, convenienceScore, costScore);

    const reasons: string[] = [];
    if (musicFit >= 90) reasons.push('High music match for your taste');
    if (convenienceScore >= 80) reasons.push('Fast, high-convenience itinerary');
    if (total !== null && user?.preferences.budget && total <= user.preferences.budget) {
      reasons.push('Fits within your travel budget');
    }
    if (event.price === null) {
      reasons.push('Ticket price pending official confirmation');
    }

    candidateTrips.push({
      id: `trip-${event.id}-${transport.mode}-${stay.id}`,
      eventId: event.id,
      originCity,
      destinationCity,
      destinationVenue,
      eventDate,
      ticketPrice: event.price,
      ticketCurrency: event.currency,
      ticketObservedAt: event.priceObservedAt || event.fetchedAt,
      ticketProvider: event.provider,
      transport,
      accommodation: stay,
      estimatedTotal: total,
      totalCurrency: currency,
      scores: {
        musicFit,
        costScore,
        convenienceScore,
        overallScore,
      },
      label: null,
      reasons,
      generatedAt: now.toISOString(),
    });
  }

  return assignTripLabels(candidateTrips);
}
