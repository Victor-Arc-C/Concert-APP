export type Artist = {
  id: string;
  name: string;
  genre: string;
  color: string;
  initials: string;
  image?: string;
  providerId?: string;
};
export type Preferences = {
  home: string;
  scope: 'city' | 'country' | 'europe';
  maxHours: number | null;
  radiusKm?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  budget: number | null;
  notifications: 'off' | 'critical' | 'important' | 'everything';
  analytics: boolean;
};
export type Intent = {
  artistId: string;
  cities: string[];
  maxPrice: number | null;
  tickets: number;
};
export type Affinity = { artistId: string; favorite: boolean; hidden: boolean };
export type Concert = {
  id: string;
  artistIds: string[];
  artist: string;
  title: string;
  venue: string;
  city: string;
  country: string;
  date: string;
  localTime: string | null;
  timezone: string | null;
  status: 'onsale' | 'offsale' | 'cancelled' | 'postponed' | 'unknown';
  price: number | null;
  currency: string | null;
  saleAt: string | null;
  provider: 'sample' | 'ticketmaster';
  externalId: string;
  url: string | null;
  fetchedAt: string;
  image: string;
  genre: string;
};
export type Feedback = { eventId: string; action: 'saved' | 'dismissed' | 'clicked' };
export type RankedConcert = Concert & {
  score: number;
  reasons: string[];
  tier: string;
  saved: boolean;
};
export type Alert = {
  id: string;
  event_id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};
export type User = {
  id: string;
  name: string;
  email: string;
  mode: 'sample' | 'live';
  onboarded: boolean;
  preferences: Preferences;
};
export type AppData = {
  user: User | null;
  artists: Artist[];
  affinities: Affinity[];
  intents: Intent[];
  events: RankedConcert[];
  allEvents: RankedConcert[];
  saved: RankedConcert[];
  alerts: Alert[];
  spotifyConnected: boolean;
  spotifyAvailable: boolean;
  liveAvailable: boolean;
  automaticChecks: boolean;
  artistChecks: { artistId: string; checkedAt: string | null; message: string | null }[];
  providerMessage: string | null;
};
export type TravelQuote = {
  provider: string;
  origin: string;
  destination: string;
  departureAt: string;
  returnAt: string;
  durationMinutes: number;
  price: number;
  currency: string;
  fetchedAt: string;
  expiresAt: string;
  url: string;
};
export type AccommodationQuote = {
  provider: string;
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  currency: string;
  fetchedAt: string;
  expiresAt: string;
  url: string;
};
export interface TravelProvider {
  search(origin: string, event: Concert): Promise<TravelQuote[]>;
}
export interface AccommodationProvider {
  search(event: Concert, guests: number): Promise<AccommodationQuote[]>;
}
