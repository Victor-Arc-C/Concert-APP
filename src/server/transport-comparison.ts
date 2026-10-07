import type { Concert } from '../domain/types';
import type { TransportComparison } from '../domain/trip-types';
import { carComparison, trainComparison } from './providers/fares';
import { reportError } from './monitoring';
import { tripSearchContext } from './trips';

const coach: TransportComparison['coach'] = {
  status: 'unpriced',
  reason: "Coach operators don't publish fares Encore can show yet.",
};

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
  return {
    origin: originCity,
    train:
      train.status === 'fulfilled'
        ? train.value
        : { status: 'unpriced', reason: 'SNCF fares are unavailable right now. Try again later.' },
    car:
      car.status === 'fulfilled'
        ? car.value
        : { status: 'unavailable', reason: 'Fuel prices are unavailable right now.' },
    coach,
  };
}
