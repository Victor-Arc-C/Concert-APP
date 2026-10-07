import type {
  AccommodationOption,
  AccommodationProvider,
  Coordinates,
  TripSearchContext,
} from '../../domain/trip-types';
import { ProviderError, providerJson } from './http';
import { rateLimit } from '../security';
import { QuoteCache } from './quote-cache';

// Nuitée LiteAPI: hotel catalog near the venue plus current bookable rates.
// Docs: https://docs.liteapi.travel/reference/post_hotels-rates and /reference/get_data-hotels
const API = 'https://api.liteapi.travel/v3.0';
const BOOK_API = 'https://book.liteapi.travel/v3.0';
// Wide enough to reach cheaper hotels a short ride away, not just the ones next to the venue.
const SEARCH_RADIUS_METERS = 10000;
const HOTELS_SEARCHED = 100;
/** Within this distance the venue is walkable; the closest affordable option is kept. */
const WALKING_KM = 1.5;
export const STAYS_SHOWN = 4;
/** A confirmed offer is reused for this long before it is checked again. */
const VERIFIED_MS = 10 * 60 * 1000;

type LiteHotel = { id?: string; name?: string; latitude?: number; longitude?: number };
type LiteMoney = { amount?: number; currency?: string };
type LiteRate = {
  boardName?: string;
  cancellationPolicies?: { refundableTag?: string };
  retailRate?: { taxesAndFees?: { included?: boolean }[] | null };
};
type LiteRoomType = { offerId?: string; offerRetailRate?: LiteMoney; rates?: LiteRate[] };
type LiteHotelRates = { hotelId?: string; roomTypes?: LiteRoomType[] };
type LitePrebook = { data?: { price?: number; currency?: string; offerId?: string } };
export type OfferCheck =
  | { status: 'available'; price: number; currency: string }
  | { status: 'unavailable' }
  | { status: 'unknown' };

const verified = new Map<string, { at: number; value: OfferCheck }>();
export function clearVerifiedOffers() {
  verified.clear();
}

/** Cheapest first, but always keep the cheapest walkable option and a mix of distances. */
export function pickStays<T extends { price: number; priceComplete: boolean; km: number | null }>(
  candidates: T[],
  count = STAYS_SHOWN,
): T[] {
  const sorted = [...candidates].sort(
    (a, b) =>
      Number(b.priceComplete) - Number(a.priceComplete) ||
      a.price - b.price ||
      (a.km ?? 99) - (b.km ?? 99),
  );
  const picked = sorted.slice(0, count - 1);
  const walkable = sorted.find((c) => !picked.includes(c) && c.km !== null && c.km <= WALKING_KM);
  const next = walkable ?? sorted.find((c) => !picked.includes(c));
  return next ? [...picked, next] : picked;
}

export function isSandboxKey(key: string) {
  return key.startsWith('sand_');
}
/** Production accepts only keys that identify themselves as production keys. */
export function isProductionKey(key: string) {
  return key.startsWith('prod_');
}
export function distanceKm(a: Coordinates, b: Coordinates) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
const nextDay = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

const cache = new QuoteCache<unknown>();

export class LiteApiAccommodationProvider implements AccommodationProvider {
  kind = 'live' as const;
  sourceIds: string[];
  bookingHosts: string[];
  name: string;
  private sandbox: boolean;
  constructor(
    private apiKey: string,
    private whitelabelUrl: string | null = null,
    private fetcher: typeof fetch = fetch,
  ) {
    this.sandbox = isSandboxKey(apiKey);
    this.sourceIds = [this.sandbox ? 'liteapi-sandbox' : 'liteapi'];
    this.name = this.sandbox ? 'LiteAPI sandbox (test prices)' : 'LiteAPI (Nuitée)';
    // Booking links only to the account's own configured white-label checkout host.
    this.bookingHosts = whitelabelUrl ? [new URL(whitelabelUrl).hostname] : [];
  }

  private async call(path: string, init: RequestInit, now: Date) {
    const key = `${path}|${init.body ?? ''}`;
    const hit = cache.get(key, now.getTime());
    if (hit) return hit;
    await rateLimit('liteapi-second', 4, 1);
    const value = await providerJson(
      `${API}${path}`,
      {
        ...init,
        headers: {
          'X-API-Key': this.apiKey,
          accept: 'application/json',
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
      },
      this.fetcher,
    );
    return cache.set(key, value, now.getTime());
  }

  async getOptions(
    destinationCity: string,
    _venue: string,
    eventDate: string,
    guests = 1,
    now = new Date(),
    context?: TripSearchContext,
  ): Promise<AccommodationOption[]> {
    const venue = context?.venue;
    if (!venue) return [];
    const checkout = nextDay(eventDate);
    const found = (
      await this.call(
        `/data/hotels?latitude=${venue.latitude}&longitude=${venue.longitude}&radius=${SEARCH_RADIUS_METERS}&limit=${HOTELS_SEARCHED}`,
        { method: 'GET' },
        now,
      )
    ).value as { data?: LiteHotel[] };
    const hotels = new Map(
      (found.data ?? [])
        .filter((hotel) => hotel.id && hotel.name)
        .map((hotel) => [hotel.id as string, hotel]),
    );
    if (!hotels.size) return [];
    const ratesCall = await this.call(
      '/hotels/rates',
      {
        method: 'POST',
        body: JSON.stringify({
          hotelIds: [...hotels.keys()],
          occupancies: [{ adults: guests }],
          currency: 'EUR',
          guestNationality: 'FR',
          checkin: eventDate,
          checkout,
          timeout: 6,
          // Rates come back sorted by price; the cheapest room per hotel is all we show.
          maxRatesPerHotel: 1,
        }),
      },
      now,
    );
    const rates = ratesCall.value as { data?: LiteHotelRates[] };
    // The time LiteAPI actually answered, not the time a cached answer is read.
    const observedAt = new Date(ratesCall.at).toISOString();
    type Candidate = {
      hotelId: string;
      offerId: string;
      name: string;
      price: number;
      currency: string;
      priceComplete: boolean;
      km: number | null;
      board: string | null;
      refundable: boolean | null;
    };
    const candidates: Candidate[] = [];
    for (const entry of rates.data ?? []) {
      const hotel = entry.hotelId ? hotels.get(entry.hotelId) : undefined;
      if (!hotel) continue;
      const cheapest = (entry.roomTypes ?? [])
        .filter(
          (room) =>
            typeof room.offerId === 'string' &&
            typeof room.offerRetailRate?.amount === 'number' &&
            room.offerRetailRate.amount > 0 &&
            /^[A-Z]{3}$/.test(room.offerRetailRate.currency ?? ''),
        )
        .sort((a, b) => a.offerRetailRate!.amount! - b.offerRetailRate!.amount!)[0];
      if (!cheapest) continue;
      // Taxes or fees marked "not included" are paid at the hotel: the quote is partial.
      const priceComplete = (cheapest.rates ?? []).every((rate) =>
        (rate.retailRate?.taxesAndFees ?? []).every((fee) => fee.included !== false),
      );
      const tags = (cheapest.rates ?? []).map((rate) => rate.cancellationPolicies?.refundableTag);
      // Without the real venue position (city-centre fallback) no venue distance is shown.
      const located =
        context?.venueExact &&
        typeof hotel.latitude === 'number' &&
        typeof hotel.longitude === 'number'
          ? Math.round(
              distanceKm(venue, { latitude: hotel.latitude, longitude: hotel.longitude }) * 10,
            ) / 10
          : null;
      candidates.push({
        hotelId: entry.hotelId!,
        offerId: cheapest.offerId!,
        name: hotel.name!,
        price: cheapest.offerRetailRate!.amount!,
        currency: cheapest.offerRetailRate!.currency!,
        priceComplete,
        km: located,
        board: cheapest.rates?.find((rate) => rate.boardName)?.boardName?.slice(0, 120) ?? null,
        refundable:
          tags.length && tags.every((tag) => tag === 'RFN')
            ? true
            : tags.some((tag) => tag === 'NRFN')
              ? false
              : null,
      });
    }
    // A search rate is not a promise: confirm each offer we show is still bookable (prebook,
    // no charge), and replace the ones that are gone, up to eight checks per plan.
    const shown: AccommodationOption[] = [];
    const tried = new Set<Candidate>();
    while (shown.length < STAYS_SHOWN && tried.size < 8) {
      const batch = pickStays(
        candidates.filter((c) => !tried.has(c)),
        Math.min(STAYS_SHOWN - shown.length, 8 - tried.size),
      );
      if (!batch.length) break;
      batch.forEach((c) => tried.add(c));
      const checks = await Promise.all(batch.map((c) => this.checkOffer(c.offerId, now)));
      batch.forEach((candidate, index) => {
        const check = checks[index];
        if (check.status !== 'available') return;
        // White-label deep link as documented by LiteAPI: occupancies is base64-encoded JSON.
        const params = new URLSearchParams({
          checkin: eventDate,
          checkout,
          occupancies: Buffer.from(JSON.stringify([{ adults: guests }])).toString('base64'),
        });
        shown.push({
          kind: 'live',
          availability: 'available',
          priceComplete: candidate.priceComplete,
          id: `liteapi:${candidate.hotelId}:${eventDate}`,
          provider: this.sourceIds[0],
          name: candidate.name,
          city: destinationCity,
          checkIn: `${eventDate}T15:00:00Z`,
          checkOut: `${checkout}T11:00:00Z`,
          guests,
          // The confirmed total replaces the search rate when the hotel repriced it.
          price: check.price,
          currency: check.currency,
          distanceKmToVenue: candidate.km,
          observedAt,
          expiresAt: null,
          board: candidate.board,
          refundable: candidate.refundable,
          verifiedAt: new Date(now).toISOString(),
          bookingUrl: this.whitelabelUrl
            ? `${new URL(this.whitelabelUrl).origin}/hotels/${encodeURIComponent(candidate.hotelId)}?${params}`
            : null,
        });
      });
    }
    return shown.sort(
      (a, b) =>
        Number(b.priceComplete) - Number(a.priceComplete) ||
        a.price! - b.price! ||
        (a.distanceKmToVenue ?? 99) - (b.distanceKmToVenue ?? 99),
    );
  }

  /** Live availability and final price for one offer (LiteAPI prebook: nothing is charged). */
  async checkOffer(offerId: string, now = new Date()): Promise<OfferCheck> {
    const hit = verified.get(offerId);
    if (hit && now.getTime() - hit.at < VERIFIED_MS) return hit.value;
    let value: OfferCheck;
    try {
      await rateLimit('liteapi-prebook', 8, 1);
      const result = (await providerJson(
        `${BOOK_API}/rates/prebook`,
        {
          method: 'POST',
          headers: {
            'X-API-Key': this.apiKey,
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ offerId, usePaymentSdk: false }),
        },
        this.fetcher,
      )) as LitePrebook;
      const price = result.data?.price;
      const currency = result.data?.currency;
      value =
        typeof price === 'number' && price > 0 && /^[A-Z]{3}$/.test(currency ?? '')
          ? { status: 'available', price, currency: currency! }
          : { status: 'unknown' };
    } catch (error) {
      // 4xx: the offer is gone or no longer valid ("outdated offerId" is a 408). Anything
      // else (timeouts, 5xx, our own rate limit) means we could not check: not shown either.
      const status = error instanceof ProviderError ? error.status : 0;
      value =
        status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 429
          ? { status: 'unavailable' }
          : { status: 'unknown' };
    }
    if (value.status !== 'unknown') {
      if (verified.size > 500) verified.delete(verified.keys().next().value as string);
      verified.set(offerId, { at: now.getTime(), value });
    }
    return value;
  }
}
