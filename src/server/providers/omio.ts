// Omio affiliate links (Impact, "Omio Travel Partner Program"). The programme gives tracking
// links, not an API: Encore sends people to Omio's route page, where Omio shows live times
// and prices, and the booking is attributed through the Impact link.
import { env } from '../env';

const OMIO = 'https://www.omio.fr';

/** Omio's route slugs: lower case, no accents, words joined by "-" ("Saint-Étienne" → "saint-etienne"). */
export function omioSlug(city: string) {
  return city
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Route page on Omio for a mode, through the affiliate tracking link when configured.
 * Omio only has pages for towns with a station or coach stop, so callers pass the arrival
 * station's town, not the venue's.
 */
export function omioRouteUrl(
  mode: 'trains' | 'bus' | 'vols',
  from: string,
  to: string,
  affiliate = env().OMIO_AFFILIATE_URL ?? null,
) {
  const a = omioSlug(from),
    b = omioSlug(to);
  if (!a || !b || a === b) return null;
  const landing = `${OMIO}/${mode}/${a}/${b}`;
  if (!affiliate) return landing;
  const link = new URL(affiliate);
  link.searchParams.set('u', landing);
  // Non-personal attribution: which Encore surface and mode sent the booking.
  link.searchParams.set('subId1', 'encore-trip');
  link.searchParams.set('subId2', mode);
  return link.toString();
}
