import { cities } from './catalog';

/** Public, account-free snapshot of upcoming shows for the marketing page. */
export type PublicGig = { artist: string; venue: string; date: string | null };
export type PublicCity = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  gigs: PublicGig[];
  total: number;
};
export type PublicGigs = {
  /** `sample` means no live listings exist yet and the fictional fixtures are shown instead. */
  mode: 'live' | 'sample';
  cities: PublicCity[];
  stats: { shows: number; artists: number; cities: number; countries: number };
  /** Only exposed once the list is big enough to be worth showing. */
  waitlist: number | null;
};

export const homeCities = cities.map((city) => city.name);
export const WAITLIST_PUBLIC_THRESHOLD = 100;

/** Rough Europe frame: the product only covers European travel today. */
export function inEurope(latitude: number, longitude: number) {
  return latitude >= 34 && latitude <= 72 && longitude >= -25 && longitude <= 45;
}

export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(h)));
}

/** A hint, not a quote: the trip planner owns real options and prices. */
export function travelHint(km: number): 'IN TOWN' | 'TRAIN' | 'FLIGHT' {
  if (km < 40) return 'IN TOWN';
  return km <= 700 ? 'TRAIN' : 'FLIGHT';
}

/**
 * Fit a name into a fixed number of board cells the way a departure board abbreviates: break at
 * a space or hyphen when that keeps at least half the width, never end on a dangling connector
 * ("KING GIZZARD &"), and mark a hard cut with a full stop.
 */
export function boardText(text: string, width: number) {
  const upper = text.toUpperCase().trim();
  if (upper.length <= width) return upper;
  const head = upper.slice(0, width + 1);
  const breakAt = Math.max(head.lastIndexOf(' '), head.lastIndexOf('-'));
  const cut = breakAt >= width / 2 ? upper.slice(0, breakAt) : `${upper.slice(0, width - 1)}.`;
  // Repeat: dropping "THE" can expose a "+" ("FLORENCE + THE" -> "FLORENCE").
  let tidy = cut,
    previous = '';
  while (tidy !== previous) {
    previous = tidy;
    tidy = tidy.replace(/[\s&+\-,/:]+$/u, '').replace(/\s(&|\+|THE|AND|DE|LA)$/u, '');
  }
  return tidy;
}
