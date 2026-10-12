import { normalizeArtistName } from './normalization';
import { safeTicketUrl } from './ticket-links';

// Fnac Spectacles sessions from the Awin product feed (advertiser 12494). One feed row is one
// session: a show on one date in one venue. See docs/FNAC_SPECTACLES.md for the column mapping.
export const fnacFeedColumns = [
  'aw_deep_link',
  'merchant_product_id',
  'currency',
  'stock_quantity',
  'custom_5',
  'custom_7',
  'Tickets:primary_artist',
  'Tickets:event_date',
  'Tickets:venue_name',
  'Tickets:min_price',
  'Tickets:max_price',
];

export type FnacSession = {
  externalId: string;
  artist: string;
  date: string;
  /** Local start time as HH:MM, when the feed has one. */
  time: string | null;
  venue: string;
  country: string;
  url: string;
  /** Lowest listed tariff. Null unless the session is on sale: other states keep the link only. */
  price: number | null;
  priceMax: number | null;
  currency: string | null;
};

export type FnacTarget = {
  id: string;
  artists: string[];
  venue: string;
  city: string;
  country: string;
  date: string;
  localTime: string | null;
};

// Leading code of stock_quantity, e.g. "2 - AVAILABLE". Cancelled, off-sale, undeliverable and
// unknown sessions are not listings a fan can act on.
const onSale = '2';
const linkOnly = new Set(['6', '7']); // NO_AMOUNT, BEFORE_ONSALE

export function fnacSession(row: Record<string, string>): FnacSession | null {
  const externalId = row.merchant_product_id ?? '';
  const url = row.aw_deep_link ?? '';
  const artist = (row['Tickets:primary_artist'] ?? '').trim();
  const venue = (row['Tickets:venue_name'] ?? '').trim();
  const date = row['Tickets:event_date'] ?? '';
  const country = (row.custom_5 ?? '').toUpperCase();
  const state = (row.stock_quantity ?? '').trim().charAt(0);
  if (
    !/^\d+$/.test(externalId) ||
    !safeTicketUrl(url) ||
    !normalizeArtistName(artist) ||
    !venue ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^[A-Z]{2}$/.test(country) ||
    (state !== onSale && !linkOnly.has(state))
  )
    return null;
  const min = Number(row['Tickets:min_price']);
  const max = Number(row['Tickets:max_price']);
  const currency = row.currency ?? '';
  const priced =
    state === onSale &&
    row['Tickets:min_price'] !== '' &&
    Number.isFinite(min) &&
    min >= 0 &&
    /^[A-Z]{3}$/.test(currency);
  const time = row.custom_7 ?? '';
  return {
    externalId,
    artist,
    date,
    // Midnight is the feed's placeholder for "no time".
    time: /^\d{2}:\d{2}$/.test(time) && time !== '00:00' ? time : null,
    venue,
    country,
    url,
    price: priced ? min : null,
    priceMax: priced && Number.isFinite(max) && max >= min ? max : null,
    currency: priced ? currency : null,
  };
}

/**
 * Sessions and concerts are compared within one artist, date and country. Sellers join names
 * differently ("Bigflo & Oli", "Bigflo et Oli"): the joining word is ignored here only because a
 * match still needs the same date, country and venue.
 */
export function fnacKey(artist: string, date: string, country: string): string {
  const name = normalizeArtistName(artist.replace(/\s+(?:&|\+|et|and)\s+/giu, ' '));
  return `${name}|${date}|${country.toUpperCase()}`;
}

// Words that name a kind of venue, not a venue: sharing only these is not evidence.
const genericVenueWords = new Set([
  'arena',
  'arene',
  'arenes',
  'centre',
  'club',
  'concert',
  'concerts',
  'des',
  'espace',
  'expo',
  'grand',
  'grande',
  'hall',
  'halle',
  'les',
  'palais',
  'parc',
  'salle',
  'stade',
  'the',
  'theatre',
  'zenith',
]);
function placeWordsAll(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
function placeWords(value: string): Set<string> {
  return new Set(
    placeWordsAll(value).filter((word) => word.length >= 3 && !genericVenueWords.has(word)),
  );
}
// Reviewed renames, not a similarity rule: sellers switch to a venue's new name at different times.
const renamedVenues = [['Paris La Défense Arena', 'Plenitude Arena']];
function renamed(a: string, b: string): boolean {
  const compact = (value: string) => placeWordsAll(value).join('');
  return renamedVenues.some((names) => {
    const known = names.map(compact);
    return (
      known.some((name) => compact(a).includes(name)) &&
      known.some((name) => compact(b).includes(name))
    );
  });
}
function samePlace(target: FnacTarget, session: FnacSession): boolean {
  const sold = placeWords(session.venue);
  return (
    [...placeWords(target.venue), ...placeWords(target.city)].some((word) => sold.has(word)) ||
    renamed(target.venue, session.venue)
  );
}

/**
 * The one session that is this concert, among sessions already limited to its artist, date and
 * country. Sellers name venues differently, so a distinctive shared word (venue or city) is
 * required; two sessions in the same place need the exact start time. Anything else is left
 * unmatched: a missing price is better than another show's price.
 */
export function matchFnacSession(
  target: FnacTarget,
  sessions: FnacSession[],
): { session: FnacSession | null; ambiguous: boolean } {
  const near = sessions.filter((session) => samePlace(target, session));
  if (near.length <= 1) return { session: near[0] ?? null, ambiguous: false };
  const time = target.localTime?.slice(0, 5);
  const timed = near.filter((session) => session.time && session.time === time);
  return timed.length === 1
    ? { session: timed[0], ambiguous: false }
    : { session: null, ambiguous: true };
}
