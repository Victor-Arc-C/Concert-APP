import { cities } from './catalog';
import type { Affinity, Concert, Feedback, Intent, Preferences, RankedConcert } from './types';
const europe = new Set([
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
export function rankEvents(
  events: Concert[],
  affinities: Affinity[],
  intents: Intent[],
  feedback: Feedback[],
  prefs: Preferences,
  now = new Date(),
  includeExcluded = false,
): RankedConcert[] {
  const homeCountry = cities.find((c) => c.name === prefs.home)?.country;
  return events
    .flatMap((event) => {
      const affinity = affinities.find((a) => event.artistIds.includes(a.artistId) && !a.hidden);
      const action = feedback.find((f) => f.eventId === event.id)?.action;
      const local = event.city.toLowerCase() === prefs.home.toLowerCase();
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
        (!affinity ||
          action === 'dismissed' ||
          !allowed ||
          !inBudget ||
          event.date < now.toISOString().slice(0, 10) ||
          ['cancelled', 'postponed'].includes(event.status))
      )
        return [];
      const intent = intents.find((i) => event.artistIds.includes(i.artistId));
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
      if (!local && prefs.maxHours !== null) reasons.push('Travel time still needs checking');
      return [
        {
          ...event,
          score: Math.min(100, score),
          reasons,
          tier: must ? 'Must see' : score >= 70 ? 'A favourite, live' : 'Worth a listen',
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
