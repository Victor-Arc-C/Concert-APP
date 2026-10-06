import { describe, expect, it } from 'vitest';
import {
  calculateMusicFit,
  calculateTotalCost,
  calculateCostScore,
  calculateConvenienceScore,
  calculateOverallScore,
  assignTripLabels,
} from '../src/domain/trip-scoring';
import type { TripOption, TransportOption, AccommodationOption } from '../src/domain/trip-types';

describe('Trip Intelligence scoring domain', () => {
  describe('calculateMusicFit', () => {
    it('rates favorites and must-sees higher than followed artists and discovery', () => {
      const affinities = [
        { artistId: 'fav-artist', favorite: true, hidden: false },
        { artistId: 'regular-artist', favorite: false, hidden: false },
      ];
      const intents = [{ artistId: 'fav-artist', cities: ['Paris'] }];

      expect(calculateMusicFit(['fav-artist'], affinities, intents)).toBe(98);
      expect(calculateMusicFit(['regular-artist'], affinities, [])).toBe(75);
      expect(calculateMusicFit(['unfollowed-artist'], affinities, [])).toBe(30);
    });

    it('honors concertScore directly when provided within 0-100', () => {
      expect(calculateMusicFit(['fav-artist'], [], [], 88)).toBe(88);
    });
  });

  describe('calculateTotalCost', () => {
    it('returns exact sum when all components have valid identical currency', () => {
      const result = calculateTotalCost(65, 'EUR', 45, 'EUR', 90, 'EUR');
      expect(result).toEqual({ total: 200, currency: 'EUR' });
    });

    it('never fabricates missing prices when any component is null', () => {
      expect(calculateTotalCost(null, null, 45, 'EUR', 90, 'EUR')).toEqual({
        total: null,
        currency: null,
      });
      expect(calculateTotalCost(65, 'EUR', null, 'EUR', 90, 'EUR')).toEqual({
        total: null,
        currency: null,
      });
      expect(calculateTotalCost(65, 'EUR', 45, 'EUR', null, null)).toEqual({
        total: null,
        currency: null,
      });
    });

    it('rejects cross-currency addition without supported conversion', () => {
      const result = calculateTotalCost(65, 'GBP', 45, 'EUR', 90, 'EUR');
      expect(result).toEqual({ total: null, currency: null });
    });

    it('rejects invalid or negative amounts', () => {
      expect(calculateTotalCost(-10, 'EUR', 45, 'EUR', 90, 'EUR')).toEqual({
        total: null,
        currency: null,
      });
      expect(calculateTotalCost(NaN, 'EUR', 45, 'EUR', 90, 'EUR')).toEqual({
        total: null,
        currency: null,
      });
    });
  });

  describe('calculateConvenienceScore', () => {
    const dummyTransport: TransportOption = {
      id: 't1',
      provider: 'test',
      kind: 'live',
      availability: 'available',
      priceComplete: true,
      mode: 'train',
      origin: 'Paris',
      destination: 'Lyon',
      departureAt: '2027-01-01T15:00:00Z',
      returnAt: '2027-01-02T10:00:00Z',
      durationMinutes: 120, // 2h
      changes: 0,
      price: 50,
      currency: 'EUR',
      observedAt: '2026-10-06T12:00:00Z',
      bookingUrl: null,
    };

    const dummyStay: AccommodationOption = {
      id: 's1',
      provider: 'test',
      kind: 'live',
      availability: 'available',
      priceComplete: true,
      name: 'Grand Hotel',
      city: 'Lyon',
      checkIn: '2027-01-01T14:00:00Z',
      checkOut: '2027-01-02T11:00:00Z',
      guests: 1,
      price: 80,
      currency: 'EUR',
      distanceKmToVenue: 1.0,
      observedAt: '2026-10-06T12:00:00Z',
      bookingUrl: null,
    };

    it('gives max score for direct, fast travel and close accommodation', () => {
      const score = calculateConvenienceScore(dummyTransport, dummyStay);
      expect(score).toBe(100);
    });

    it('penalizes travel changes, long duration and far accommodation', () => {
      const slowTransport: TransportOption = {
        ...dummyTransport,
        durationMinutes: 360, // 6h -> penalty
        changes: 2, // 2 changes -> -24
      };
      const farStay: AccommodationOption = {
        ...dummyStay,
        distanceKmToVenue: 6.0, // 4km beyond 2km -> -16
      };
      const score = calculateConvenienceScore(slowTransport, farStay);
      expect(score).toBeLessThan(60);
    });
  });

  describe('calculateCostScore', () => {
    it('returns neutral 50 when cost is unknown or invalid', () => {
      expect(calculateCostScore(null)).toBe(50);
      expect(calculateCostScore(-50)).toBe(50);
    });

    it('scores lower totals higher', () => {
      const cheap = calculateCostScore(120);
      const expensive = calculateCostScore(550);
      expect(cheap).toBeGreaterThan(expensive);
    });

    it('respects user budget thresholds when provided', () => {
      expect(calculateCostScore(80, 200)).toBe(95);
      expect(calculateCostScore(350, 200)).toBe(15);
    });
  });

  describe('calculateOverallScore', () => {
    it('combines music fit, convenience, and cost deterministically', () => {
      const score = calculateOverallScore(100, 100, 100);
      expect(score).toBe(100);

      const blended = calculateOverallScore(80, 70, 60);
      // 80*0.4 + 70*0.35 + 60*0.25 = 32 + 24.5 + 15 = 71.5 -> 72
      expect(blended).toBe(72);
    });
  });

  describe('assignTripLabels', () => {
    const makeTrip = (
      id: string,
      mode: 'train' | 'flight' | 'bus',
      duration: number,
      total: number | null,
      currency: string | null,
      overallScore: number,
      convenienceScore: number,
    ): TripOption => ({
      id,
      mode: 'live',
      planStatus: 'active',
      ticketPriceState: 'ready',
      transportState: 'ready',
      accommodationState: 'ready',
      eventId: 'ev-1',
      originCity: 'Paris',
      destinationCity: 'Brussels',
      destinationVenue: 'Forest National',
      eventDate: '2027-03-01',
      ticketPrice: total ? 50 : null,
      ticketCurrency: currency,
      ticketObservedAt: '2026-10-06T12:00:00Z',
      ticketProvider: 'ticketmaster',
      transport: {
        id: `t-${id}`,
        provider: 'test',
        kind: 'live',
        availability: 'available',
        priceComplete: true,
        mode,
        origin: 'Paris',
        destination: 'Brussels',
        departureAt: '2027-03-01T14:00:00Z',
        returnAt: '2027-03-02T11:00:00Z',
        durationMinutes: duration,
        changes: 0,
        price: total ? 30 : null,
        currency,
        observedAt: '2026-10-06T12:00:00Z',
        bookingUrl: null,
      },
      accommodation: {
        id: `s-${id}`,
        provider: 'test',
        kind: 'live',
        availability: 'available',
        priceComplete: true,
        name: 'Hotel',
        city: 'Brussels',
        checkIn: '2027-03-01T15:00:00Z',
        checkOut: '2027-03-02T11:00:00Z',
        guests: 1,
        price: total ? total - 80 : null,
        currency,
        distanceKmToVenue: 1.2,
        observedAt: '2026-10-06T12:00:00Z',
        bookingUrl: null,
      },
      estimatedTotal: total,
      totalCurrency: currency,
      scores: {
        musicFit: 90,
        costScore: 80,
        convenienceScore,
        overallScore,
      },
      label: null,
      reasons: [],
      generatedAt: '2026-10-06T12:00:00Z',
    });

    it('assigns Cheapest, Fastest and Best value when sufficient comparative data exists', () => {
      const opt1 = makeTrip('opt-train', 'train', 90, 180, 'EUR', 88, 95); // High score -> Best value
      const opt2 = makeTrip('opt-bus', 'bus', 240, 110, 'EUR', 75, 60); // Lowest total -> Cheapest
      const opt3 = makeTrip('opt-flight', 'flight', 65, 250, 'EUR', 72, 85); // Lowest duration -> Fastest

      const labeled = assignTripLabels([opt1, opt2, opt3], new Date('2026-10-06T12:01:00Z'));
      expect(labeled.find((o) => o.id === 'opt-train')?.label).toBe('Best value');
      expect(labeled.find((o) => o.id === 'opt-bus')?.label).toBe('Cheapest');
      expect(labeled.find((o) => o.id === 'opt-flight')?.label).toBe('Fastest');
    });

    it('never assigns Cheapest when prices are missing', () => {
      const opt1 = makeTrip('opt-train', 'train', 90, null, null, 85, 90);
      const opt2 = makeTrip('opt-bus', 'bus', 240, null, null, 65, 60);

      const labeled = assignTripLabels([opt1, opt2], new Date('2026-10-06T12:01:00Z'));
      expect(labeled.some((o) => o.label === 'Cheapest')).toBe(false);
    });

    it('handles single option without inventing superlatives', () => {
      const single = makeTrip('single', 'train', 90, 150, 'EUR', 80, 90);
      const labeled = assignTripLabels([single], new Date('2026-10-06T12:01:00Z'));
      expect(labeled[0].label).toBeNull();
    });
  });
});
