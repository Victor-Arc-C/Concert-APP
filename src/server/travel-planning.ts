import {
  eventPlanningFailure,
  knownLocation,
  planningToday,
  searchFailure,
  travelSearchSchema,
  type PlanningFailure,
  type TravelPlanning,
  type TravelSearchProvider,
  type TravelSearchResult,
} from '../domain/travel-planning';
import type { Concert, User } from '../domain/types';
import { recordAnalytics } from './data';
import { omioProvider } from './providers/omio';

function metadata(event: Concert, provider: TravelSearchProvider, extra = {}) {
  // Only the stored concert destination. Never log user-entered cities, travel dates or URLs.
  return {
    eventId: event.id,
    destination: knownLocation(event.city) ? event.city : null,
    provider: provider.id,
    ...extra,
  };
}

export async function openTravelPlanning(
  event: Concert,
  user: User,
  provider = omioProvider,
  now = new Date(),
): Promise<TravelPlanning> {
  const reason =
    eventPlanningFailure(event, now) ?? (!provider.configured() ? 'unconfigured' : null);
  await recordAnalytics(user, 'travel_planning_opened', metadata(event, provider));
  if (reason)
    await recordAnalytics(user, 'travel_planning_failed', metadata(event, provider, { reason }));
  return {
    provider: provider.id,
    reason,
    // Origin timezone is not known from a free-text city. Do not reject a still-valid
    // departure day west of the venue; Omio resolves local departure times.
    today: planningToday(null, now),
    defaults: {
      departure: knownLocation(user.preferences.home) ? user.preferences.home : '',
      destination: knownLocation(event.city) ? event.city : '',
      departureDate: eventPlanningFailure(event, now) ? '' : event.date,
      returnDate: '',
      locale: user.preferences.locale ?? 'en',
    },
  };
}

export async function submitTravelSearch(
  event: Concert,
  user: User,
  input: unknown,
  provider = omioProvider,
  now = new Date(),
): Promise<TravelSearchResult> {
  const parsed = travelSearchSchema.safeParse(input);
  const props = metadata(event, provider, {
    travelMode: parsed.success ? (parsed.data.travelMode ?? 'ALL') : null,
  });
  await recordAnalytics(user, 'travel_search_submitted', props);
  async function failed(reason: PlanningFailure): Promise<TravelSearchResult> {
    await recordAnalytics(user, 'travel_planning_failed', { ...props, reason });
    return { reason };
  }
  const eventFailure = eventPlanningFailure(event, now);
  if (eventFailure) return failed(eventFailure);
  if (!provider.configured()) return failed('unconfigured');
  if (!parsed.success) return failed('invalid_search');
  const reason = searchFailure(parsed.data, planningToday(null, now));
  if (reason) return failed(reason);
  const url = provider.buildLink(parsed.data);
  if (!url) return failed('redirect');
  // The Continue click produced a validated handoff; this is not arrival or a conversion.
  await recordAnalytics(user, 'omio_redirect_clicked', props);
  return { url };
}
