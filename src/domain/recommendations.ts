import { cities } from './catalog';
import type {
  Affinity,
  Artist,
  Concert,
  Feedback,
  Intent,
  Preferences,
  RankedConcert,
} from './types';
export const europe = new Set([
  'FR',
  'GB',
  'NL',
  'BE',
  'DE',
  'ES',
  'IT',
  'PT',
  'AT',
  'CH',
  'IE',
  'SE',
  'NO',
  'DK',
  'FI',
  'PL',
  'CZ',
  'HU',
  'GR',
  'RO',
  'HR',
  'LU',
  'SK',
  'SI',
  'EE',
  'LV',
  'LT',
  'BG',
  'IS',
  'MT',
  'CY',
]);
// Approximate city-centre distance, never a travel-time or venue-distance claim.
export function cityDistanceKm(home: string, destination: string, country: string): number | null {
  const a = cities.find((c) => c.name.toLowerCase() === home.toLowerCase());
  const b = cities.find(
    (c) => c.name.toLowerCase() === destination.toLowerCase() && c.country === country,
  );
  if (!a || !b) return null;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function rankEvents(
  events: Concert[],
  affinities: Affinity[],
  intents: Intent[],
  feedback: Feedback[],
  prefs: Preferences,
  now = new Date(),
  includeExcluded = false,
  discoveryArtists?: Artist[],
): RankedConcert[] {
  const homeCountry = cities.find((c) => c.name === prefs.home)?.country;
  return [...new Map(events.map((event) => [event.id, event])).values()]
    .flatMap((event) => {
      const matched = affinities.filter((a) => event.artistIds.includes(a.artistId) && !a.hidden);
      const affinity = matched.find((a) => a.favorite) ?? matched[0];
      const hidden =
        !affinity && affinities.some((a) => a.hidden && event.artistIds.includes(a.artistId));
      const action = feedback.find((f) => f.eventId === event.id)?.action;
      const local =
        event.city.toLowerCase() === prefs.home.toLowerCase() && event.country === homeCountry;
      const distance = cityDistanceKm(prefs.home, event.city, event.country);
      const inRadius = prefs.radiusKm == null || (distance !== null && distance <= prefs.radiusKm);
      const inDates =
        (!prefs.dateFrom || event.date >= prefs.dateFrom) &&
        (!prefs.dateTo || event.date <= prefs.dateTo);
      const allowed =
        prefs.scope === 'city'
          ? local
          : prefs.scope === 'country'
            ? event.country === homeCountry
            : europe.has(event.country);
      const inBudget = !(
        prefs.budget !== null &&
        event.price !== null &&
        event.currency === 'EUR' &&
        event.price > prefs.budget
      );
      if (
        !includeExcluded &&
        ((!affinity && !discoveryArtists) ||
          hidden ||
          action === 'dismissed' ||
          !allowed ||
          !inRadius ||
          !inDates ||
          !inBudget ||
          event.date < now.toISOString().slice(0, 10) ||
          ['cancelled', 'postponed'].includes(event.status))
      )
        return [];
      const intent = intents.find((i) => matched.some((a) => a.artistId === i.artistId));
      const must =
        !!intent &&
        intent.cities.includes(event.city) &&
        !(
          intent.maxPrice !== null &&
          event.currency === 'EUR' &&
          event.price !== null &&
          event.price > intent.maxPrice
        );
      let score = affinity ? 45 : 0;
      const reasons = affinity
        ? ['You follow this artist']
        : [action === 'saved' ? 'In your saved concerts' : 'Explore this artist’s concerts'];
      if (!affinity && discoveryArtists) {
        const genres = (value: string) =>
          value
            .toLowerCase()
            .split('/')
            .map((s) => s.trim())
            .filter((s) => s && s !== 'live music');
        const likedGenres = new Set(
          discoveryArtists
            .filter((a) => affinities.some((f) => f.artistId === a.id && !f.hidden))
            .flatMap((a) => genres(a.genre)),
        );
        const similar = genres(event.genre).some((genre) => likedGenres.has(genre));
        if (similar) {
          score += 12;
          reasons[0] = 'Shares a genre with artists you follow';
        } else reasons[0] = 'Discover a concert in your chosen region';
      }
      if (must || affinity?.favorite) {
        score += 25;
        reasons[0] = must ? 'On your must-see list' : 'One of your favourites';
      }
      if (action === 'saved') {
        score += 10;
        reasons.push('You saved this show');
      }
      if (action === 'clicked') score += 5;
      if (local) {
        score += 15;
        reasons.push(`In your home city, ${prefs.home}`);
      } else {
        score += event.country === homeCountry ? 8 : 3;
        reasons.push(
          allowed ? 'Within your chosen travel region' : 'Outside your chosen travel region',
        );
      }
      if (
        event.price !== null &&
        event.currency === 'EUR' &&
        prefs.budget !== null &&
        event.price <= prefs.budget
      ) {
        score += 5;
        reasons.push('Ticket range starts within your budget; trip total unknown');
      }
      if (!local && distance !== null) {
        score += 5 * Math.max(0, 1 - distance / 1500);
        reasons.push(`About ${Math.round(distance)} km between city centres`);
      }
      const days = Math.max(0, (Date.parse(event.date + 'T00:00:00Z') - now.getTime()) / 86400000);
      score += 5 * Math.max(0, 1 - days / 180);
      if (days <= 30 && event.date >= now.toISOString().slice(0, 10))
        reasons.push('Coming up within 30 days');
      if (!local && prefs.maxHours !== null) reasons.push('Travel time still needs checking');
      return [
        {
          ...event,
          score: Math.min(affinity ? 100 : 40, score),
          reasons,
          tier: !affinity
            ? 'Discover'
            : must
              ? 'Must see'
              : affinity.favorite
                ? 'A favourite, live'
                : 'Artist you follow',
          saved: action === 'saved',
        },
      ];
    })
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function comparableTotal(
  ticket: number | null,
  travel: number | null,
  stay: number | null,
): number | null {
  return ticket === null || travel === null || stay === null ? null : ticket + travel + stay;
}
