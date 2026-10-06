export type TripRecommendationLabel = 'Best value' | 'Cheapest' | 'Fastest' | 'Easiest';

export type TransportMode = 'train' | 'flight' | 'bus';

export type TransportOption = {
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

export type AccommodationOption = {
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
};

export type TripScores = {
  musicFit: number;       // 0-100
  costScore: number;      // 0-100 (higher = better value/lower cost)
  convenienceScore: number; // 0-100 (higher = easier/faster)
  overallScore: number;   // 0-100
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
  transport: TransportOption;
  accommodation: AccommodationOption;
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
};

export interface TransportProvider {
  name: string;
  getOptions(
    origin: string,
    destinationCity: string,
    eventDate: string,
    eventLocalTime: string | null,
    now?: Date,
  ): Promise<TransportOption[]>;
}

export interface AccommodationProvider {
  name: string;
  getOptions(
    destinationCity: string,
    eventVenue: string,
    eventDate: string,
    guests?: number,
    now?: Date,
  ): Promise<AccommodationOption[]>;
}
