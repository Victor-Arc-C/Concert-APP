export type TripRecommendationLabel = 'Best value' | 'Cheapest' | 'Fastest' | 'Easiest';

export type TransportMode = 'train' | 'flight' | 'bus';
export type TripProviderMode = 'sample' | 'live';
export type TripComponentState = 'ready' | 'unavailable' | 'stale' | 'invalid';
export type TripPlanStatus =
  | 'active'
  | 'cancelled'
  | 'postponed'
  | 'event_missing'
  | 'mode_changed'
  | 'event_changed'
  | 'past';
export type QuoteObservation = {
  kind: TripProviderMode;
  availability: 'sample' | 'available' | 'unavailable' | 'unknown';
  priceComplete: boolean;
  expiresAt?: string | null;
};
export type TripProviderDefinition = {
  kind: TripProviderMode;
  sourceIds: readonly string[];
  bookingHosts: readonly string[];
};

export type TransportOption = QuoteObservation & {
  id: string;
  provider: string;
  mode: TransportMode;
  origin: string;
  destination: string;
  departureAt: string;
  returnAt: string;
  durationMinutes: number;
  changes: number;
  price: number | null;
  currency: string | null;
  observedAt: string;
  bookingUrl: string | null;
  operator?: string;
};

export type AccommodationOption = QuoteObservation & {
  id: string;
  provider: string;
  name: string;
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  price: number | null;
  currency: string | null;
  distanceKmToVenue: number | null;
  observedAt: string;
  bookingUrl: string | null;
  /** Meal plan as the provider names it ("Room only", "Breakfast included"…). */
  board?: string | null;
  /** True for a refundable rate, false for non-refundable, null when not stated. */
  refundable?: boolean | null;
  /** When the provider last confirmed this exact offer is bookable (live prebook check). */
  verifiedAt?: string | null;
};

export type TripScores = {
  musicFit: number; // 0-100
  costScore: number; // 0-100 (higher = better value/lower cost)
  convenienceScore: number | null; // unknown when a component is missing
  overallScore: number | null; // 0-100
};

export type TripOption = {
  id: string;
  eventId: string;
  originCity: string;
  destinationCity: string;
  destinationVenue: string;
  eventDate: string;
  ticketPrice: number | null;
  ticketCurrency: string | null;
  ticketObservedAt: string | null;
  ticketProvider: string | null;
  mode: TripProviderMode;
  planStatus: TripPlanStatus;
  ticketPriceState: TripComponentState;
  transportState: TripComponentState;
  accommodationState: TripComponentState;
  transport: TransportOption | null;
  accommodation: AccommodationOption | null;
  estimatedTotal: number | null;
  totalCurrency: string | null;
  scores: TripScores;
  label: TripRecommendationLabel | null;
  reasons: string[];
  generatedAt: string;
};

export type SavedTrip = {
  id: string;
  userId: string;
  eventId: string;
  tripOptionId: string;
  originCity: string;
  destinationCity: string;
  eventDate: string;
  tripData: TripOption;
  createdAt: string;
  updatedAt: string;
  /** 'unchecked': live travel was not re-queried on this read (app-state polling). */
  revalidationStatus: 'current' | 'unavailable' | 'legacy' | 'unchecked';
};

export type Coordinates = { latitude: number; longitude: number };
/** Server-derived places for live searches: home city centre and the concert venue. */
export type TripSearchContext = {
  origin: Coordinates | null;
  venue: Coordinates | null;
  /** False when the venue position is only the city centre: no venue distance may be shown. */
  venueExact?: boolean;
  eventTimezone?: string | null;
};

export interface TransportProvider extends TripProviderDefinition {
  name: string;
  getOptions(
    origin: string,
    destinationCity: string,
    eventDate: string,
    eventLocalTime: string | null,
    now?: Date,
    context?: TripSearchContext,
  ): Promise<TransportOption[]>;
}

export interface AccommodationProvider extends TripProviderDefinition {
  name: string;
  getOptions(
    destinationCity: string,
    eventVenue: string,
    eventDate: string,
    guests?: number,
    now?: Date,
    context?: TripSearchContext,
  ): Promise<AccommodationOption[]>;
}

/** A long-distance train route to a station near the venue (which trains run, not a price). */
export type TrainRoute = {
  station: string;
  /** Town the station is in, used for route links ("Lyon Part Dieu" → "Lyon"). */
  stationCity: string | null;
  carriers: string[];
  /** Straight-line distance from the arrival station to the venue. */
  lastMileKm: number;
  /** Omio route page (live times and prices) through the affiliate link. */
  bookingUrl: string | null;
};
/**
 * Ways to reach a concert. No figure here is an estimate: prices come only from the seller's
 * live search behind each link. Modes appear by distance (far shows fly, near shows drive).
 */
export type TransportComparison = {
  origin: string;
  /** Straight-line distance home → venue, rounded to 10 km. */
  distanceKm: number;
  recommended: 'flight' | 'train' | 'road';
  flight: {
    from: string;
    to: string;
    /** Live flight search for the concert day (Google Flights). */
    searchUrl: string;
    /** Omio's route page through the affiliate link, when Omio has one. */
    omioUrl: string | null;
    date: string;
    /** Latest sensible landing time, local to the concert, when the show time is known. */
    landBy: string | null;
  } | null;
  train: { status: 'served'; routes: TrainRoute[] } | { status: 'none'; reason: string } | null;
  road: { coachUrl: string | null; coachRoute: string | null } | null;
};
