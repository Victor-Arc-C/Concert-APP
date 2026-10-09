import { env } from '../env';
import {
  safeOmioRedirect,
  travelSearchSchema,
  type TravelSearch,
  type TravelSearchProvider,
} from '../../domain/travel-planning';

// Official Redirect link configurator, verified 2026-10-09:
// https://www.omio.com/affiliate/search-widget
const DESTINATION = 'https://www.omio.com/links/626fa8a9-f982-43d0-ace9-9a13f6b14612';
export function omioPartnerId() {
  const settings = env();
  if (settings.OMIO_ENABLED !== 'true') return null;
  const id = settings.OMIO_PARTNER_ID?.trim();
  return id && /^[1-9]\d{0,19}$/.test(id) ? id : null;
}

export function omioSearchUrl(search: TravelSearch, partnerId = omioPartnerId()) {
  const parsed = travelSearchSchema.safeParse(search);
  if (!partnerId || !/^[1-9]\d{0,19}$/.test(partnerId) || !parsed.success) return null;
  const input = parsed.data;
  const destination = new URL(DESTINATION);
  destination.searchParams.set('departurePosTerm', input.departure);
  destination.searchParams.set('arrivalPosTerm', input.destination);
  destination.searchParams.set('departureDate', input.departureDate);
  if (input.returnDate) destination.searchParams.set('returnDate', input.returnDate);
  if (input.travelMode) destination.searchParams.set('travelMode', input.travelMode);
  destination.searchParams.set('locale', input.locale);
  destination.searchParams.set('currency', 'EUR');
  // URLSearchParams encodes each location, then the entire nested URL exactly once.
  const affiliate = new URL(`https://omio.sjv.io/c/${partnerId}/4057579/7385`);
  affiliate.searchParams.set('u', destination.toString());
  const result = affiliate.toString();
  return safeOmioRedirect(result) ? result : null;
}

export const omioProvider: TravelSearchProvider = {
  id: 'omio',
  configured: () => omioPartnerId() !== null,
  buildLink: (search) => omioSearchUrl(search),
};

/** Existing itinerary links also use the documented, dated, tracked search. */
export function omioRouteUrl(
  mode: 'trains' | 'bus' | 'vols',
  from: string,
  to: string,
  date: string,
) {
  const modes = { trains: 'TRAIN', bus: 'BUS', vols: 'FLIGHT' } as const;
  return omioSearchUrl({
    departure: from,
    destination: to,
    departureDate: date,
    travelMode: modes[mode],
    locale: 'en',
  });
}
