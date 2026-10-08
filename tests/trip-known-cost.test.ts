import { expect, it } from 'vitest';
import { knownTripCost } from '../src/domain/trip-scoring';

const stay = { price: 145.37, currency: 'EUR', priceComplete: true };
const base = {
  ticketPrice: null,
  ticketCurrency: null,
  ticketPriceState: 'unavailable',
  transport: null,
  transportState: 'unavailable',
  accommodation: stay,
  accommodationState: 'ready',
};

it('adds the prices we have and lists the missing ones instead of hiding the total', () => {
  expect(knownTripCost(base)).toEqual({
    sum: 145.37,
    currency: 'EUR',
    complete: false,
    parts: [
      { kind: 'ticket', price: null, partial: false },
      { kind: 'transport', price: null, partial: false },
      { kind: 'stay', price: 145.37, partial: false },
    ],
  });
});

it('is the whole trip only when every part is priced, current and complete', () => {
  const all = {
    ...base,
    ticketPrice: 59,
    ticketCurrency: 'EUR',
    ticketPriceState: 'ready',
    transport: { price: 63, currency: 'EUR', priceComplete: true },
    transportState: 'ready',
  };
  expect(knownTripCost(all)).toMatchObject({ sum: 267.37, complete: true });
  // Hotel taxes paid on site: still a sum, but not the whole trip.
  expect(knownTripCost({ ...all, accommodation: { ...stay, priceComplete: false } })).toMatchObject(
    { sum: 267.37, complete: false },
  );
});

it('never adds an expired quote or different currencies', () => {
  expect(knownTripCost({ ...base, accommodationState: 'stale' }).sum).toBeNull();
  expect(
    knownTripCost({
      ...base,
      ticketPrice: 50,
      ticketCurrency: 'GBP',
      ticketPriceState: 'ready',
    }),
  ).toMatchObject({ sum: null, currency: null });
});
