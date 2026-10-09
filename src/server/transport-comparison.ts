import { eventPlanningFailure } from '../domain/travel-planning';
import type { Concert } from '../domain/types';
import type { Coordinates, TransportComparison } from '../domain/trip-types';
import { airportCities, type AirportCity } from '../domain/airport-cities';
import { trainRoutes } from './providers/rail';
import { distanceKm } from './providers/liteapi';
import { omioRouteUrl } from './providers/omio';
import { cheapestFlight, landingDeadline } from './providers/travelpayouts';
import { reportError } from './monitoring';
import { tripSearchContext } from './trips';

/** From this distance a flight is worth showing. */
export const FLIGHT_FROM_KM = 500;
/** Up to this distance driving or a coach is realistic for a concert trip. */
export const ROAD_UNTIL_KM = 1000;
/** Airport cities further than this from the place are not "its" airport. */
const AIRPORT_REACH_KM = 120;
/** Land at least this long before the show (transfer, check-in, doors). */
const LANDING_MARGIN_HOURS = 3;

export function nearestAirportCity(point: Coordinates): AirportCity | null {
  let best: AirportCity | null = null,
    bestKm = Infinity;
  for (const city of airportCities) {
    const km = distanceKm(point, city);
    if (km < bestKm) [best, bestKm] = [city, km];
  }
  return bestKm <= AIRPORT_REACH_KM ? best : null;
}

/** Google Flights understands a plain-language query: route, day, one way. */
export function flightSearchUrl(from: AirportCity, to: AirportCity, date: string) {
  const q = `Flights from ${from.iata} to ${to.iata} on ${date} one way`;
  return `https://www.google.com/travel/flights?${new URLSearchParams({ q, hl: 'en', curr: 'EUR' })}`;
}

export function landBy(localTime: string | null | undefined) {
  const match = /^(\d{2}):(\d{2})/.exec(localTime ?? '');
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]) - LANDING_MARGIN_HOURS * 60;
  if (minutes < 6 * 60) return null; // an afternoon show: fly the day before
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${match[2]}`;
}

/** The realistic ways to reach a concert, each linked to a live search, by distance. */
export async function transportComparison(
  event: Concert,
  originCity: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<TransportComparison | null> {
  // Ineligible concerts never get real travel links, including the legacy itinerary surface.
  if (eventPlanningFailure(event, new Date(now))) return null;
  const context = await tripSearchContext(event, originCity);
  if (!context.origin || !context.venue) return null;
  const km = distanceKm(context.origin, context.venue);
  const homeAirport = nearestAirportCity(context.origin),
    venueAirport = nearestAirportCity(context.venue);
  const flies =
    km >= FLIGHT_FROM_KM && homeAirport && venueAirport && homeAirport.iata !== venueAirport.iata;
  let found: Awaited<ReturnType<typeof cheapestFlight>> = null;
  if (flies)
    try {
      found = await cheapestFlight(
        homeAirport.iata,
        venueAirport.iata,
        event.date,
        landingDeadline(event.date, event.localTime, event.timezone, LANDING_MARGIN_HOURS),
        fetcher,
        now,
      );
    } catch {
      // No fare is better than a wrong one: the live search link still works.
      reportError('provider_failed');
    }
  const flight =
    flies && homeAirport && venueAirport
      ? {
          from: homeAirport.name,
          to: venueAirport.name,
          searchUrl: flightSearchUrl(homeAirport, venueAirport, event.date),
          omioUrl: omioRouteUrl('vols', homeAirport.name, venueAirport.name, event.date),
          date: event.date,
          landBy: landBy(event.localTime),
          fare: found?.fare ?? null,
          fareOnTime: found?.onTime ?? null,
        }
      : null;

  let train: TransportComparison['train'] = null;
  if (km < ROAD_UNTIL_KM * 1.5) {
    try {
      const result = await trainRoutes(context.origin, context.venue, fetcher, now);
      train =
        result.status === 'served'
          ? {
              status: 'served',
              routes: result.routes.map((route) => ({
                ...route,
                bookingUrl: route.stationCity
                  ? omioRouteUrl('trains', originCity, route.stationCity, event.date)
                  : null,
              })),
            }
          : // Far away and no French train: don't show an empty train row next to the flight.
            flight
            ? null
            : result;
    } catch {
      reportError('provider_failed');
      train = {
        status: 'none',
        reason: 'Train routes are unavailable right now. Try again later.',
      };
    }
  }

  let road: TransportComparison['road'] = null;
  if (km < ROAD_UNTIL_KM) {
    // Offer the known station town as the coach destination when available.
    const town =
      (train?.status === 'served' && train.routes.find((r) => r.stationCity)?.stationCity) ||
      event.city;
    const coachUrl = omioRouteUrl('bus', originCity, town, event.date);
    road = { coachUrl, coachRoute: coachUrl ? `${originCity} → ${town}` : null };
  }

  return {
    origin: originCity,
    distanceKm: Math.round(km / 10) * 10,
    recommended:
      flight && km >= ROAD_UNTIL_KM
        ? 'flight'
        : train?.status === 'served'
          ? 'train'
          : flight
            ? 'flight'
            : 'road',
    flight,
    train,
    road,
  };
}
