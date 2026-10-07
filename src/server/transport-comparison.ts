import type { Concert } from '../domain/types';
import type { TransportComparison } from '../domain/trip-types';
import { carComparison, trainComparison } from './providers/fares';
import { omioRouteUrl } from './providers/omio';
import { reportError } from './monitoring';
import { tripSearchContext } from './trips';

/** Price every way to get to the concert that has a real, published source. */
export async function transportComparison(
  event: Concert,
  originCity: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<TransportComparison | null> {
  // Fictional, cancelled or postponed concerts never get real fares.
  if (event.provider === 'sample' || ['cancelled', 'postponed'].includes(event.status)) return null;
  const context = await tripSearchContext(event, originCity);
  if (!context.origin || !context.venue) return null;
  const [train, car] = await Promise.allSettled([
    trainComparison(context.origin, context.venue, fetcher, now),
    carComparison(context.origin, context.venue, fetcher, now),
  ]);
  if (train.status === 'rejected' || car.status === 'rejected') reportError('provider_failed');
  const trainValue: TransportComparison['train'] =
    train.status === 'fulfilled'
      ? train.value
      : { status: 'unpriced', reason: 'SNCF fares are unavailable right now. Try again later.' };
  if (trainValue.status === 'priced')
    trainValue.fares = trainValue.fares.map((fare) => ({
      ...fare,
      bookingUrl: fare.stationCity ? omioRouteUrl('trains', originCity, fare.stationCity) : null,
    }));
  // Coaches stop in the same towns as the trains; small towns have no Omio route page.
  const coachTown =
    (trainValue.status === 'priced' && trainValue.fares.find((f) => f.stationCity)?.stationCity) ||
    event.city;
  const coachUrl = omioRouteUrl('bus', originCity, coachTown);
  return {
    origin: originCity,
    train: trainValue,
    car:
      car.status === 'fulfilled'
        ? car.value
        : { status: 'unavailable', reason: 'Fuel prices are unavailable right now.' },
    coach: {
      status: 'unpriced',
      reason: 'Coach fares change with every departure; Omio compares them live.',
      bookingUrl: coachUrl,
      route: coachUrl ? `${originCity} → ${coachTown}` : null,
    },
  };
}
