import type {
  AccommodationOption,
  AccommodationProvider,
  Coordinates,
  TripSearchContext,
} from '../../domain/trip-types';
import { providerJson } from './http';
import { rateLimit } from '../security';
import { QuoteCache } from './quote-cache';

// Nuitée LiteAPI: hotel catalog near the venue plus current bookable rates.
// Docs: https://docs.liteapi.travel/reference/post_hotels-rates and /reference/get_data-hotels
const API = 'https://api.liteapi.travel/v3.0';
const SEARCH_RADIUS_METERS = 3000;

type LiteHotel = { id?: string; name?: string; latitude?: number; longitude?: number };
type LiteMoney = { amount?: number; currency?: string };
type LiteRate = { retailRate?: { taxesAndFees?: { included?: boolean }[] | null } };
type LiteRoomType = { offerId?: string; offerRetailRate?: LiteMoney; rates?: LiteRate[] };
type LiteHotelRates = { hotelId?: string; roomTypes?: LiteRoomType[] };

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
        `/data/hotels?latitude=${venue.latitude}&longitude=${venue.longitude}&radius=${SEARCH_RADIUS_METERS}&limit=25`,
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
        }),
      },
      now,
    );
    const rates = ratesCall.value as { data?: LiteHotelRates[] };
    // The time LiteAPI actually answered, not the time a cached answer is read.
    const observedAt = new Date(ratesCall.at).toISOString();
    const options: AccommodationOption[] = [];
    for (const entry of rates.data ?? []) {
      const hotel = entry.hotelId ? hotels.get(entry.hotelId) : undefined;
      if (!hotel) continue;
      const cheapest = (entry.roomTypes ?? [])
        .filter(
          (room) =>
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
      // Without the real venue position (city-centre fallback) no venue distance is shown.
      const located =
        context?.venueExact &&
        typeof hotel.latitude === 'number' &&
        typeof hotel.longitude === 'number'
          ? Math.round(
              distanceKm(venue, { latitude: hotel.latitude, longitude: hotel.longitude }) * 10,
            ) / 10
          : null;
      // White-label deep link as documented by LiteAPI: occupancies is base64-encoded JSON.
      const params = new URLSearchParams({
        checkin: eventDate,
        checkout,
        occupancies: Buffer.from(JSON.stringify([{ adults: guests }])).toString('base64'),
      });
      options.push({
        kind: 'live',
        availability: 'available',
        priceComplete,
        id: `liteapi:${entry.hotelId}:${eventDate}`,
        provider: this.sourceIds[0],
        name: hotel.name!,
        city: destinationCity,
        checkIn: `${eventDate}T15:00:00Z`,
        checkOut: `${checkout}T11:00:00Z`,
        guests,
        price: cheapest.offerRetailRate!.amount!,
        currency: cheapest.offerRetailRate!.currency!,
        distanceKmToVenue: located,
        observedAt,
        expiresAt: null,
        bookingUrl: this.whitelabelUrl
          ? `${new URL(this.whitelabelUrl).origin}/hotels/${encodeURIComponent(entry.hotelId!)}?${params}`
          : null,
      });
    }
    // Cheapest complete quotes first, then the closest to the venue.
    return options
      .sort(
        (a, b) =>
          Number(b.priceComplete) - Number(a.priceComplete) ||
          a.price! - b.price! ||
          (a.distanceKmToVenue ?? 99) - (b.distanceKmToVenue ?? 99),
      )
      .slice(0, 3);
  }
}
