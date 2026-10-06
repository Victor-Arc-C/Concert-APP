import { expect, it } from 'vitest';
import { displayPrice } from '../src/domain/pricing';
const now = new Date('2026-10-06T12:00:00Z');
it('shows only valid sourced and recent prices, preserving actual zero prices', () => {
  expect(displayPrice(70, 'EUR', 'ticketmaster', now, now)).toBe(70);
  expect(displayPrice(0, 'EUR', 'ticketmaster', now, now)).toBe(0);
  for (const value of [null, -1, NaN, Infinity])
    expect(displayPrice(value, 'EUR', 'ticketmaster', now, now)).toBeNull();
  for (const currency of [null, '', 'eu', 'INVALID'])
    expect(displayPrice(70, currency, 'ticketmaster', now, now)).toBeNull();
  expect(displayPrice(70, 'EUR', '', now, now)).toBeNull();
  for (const stamp of ['invalid', '2026-10-05T11:59:59Z', '2026-10-07T12:00:00Z'])
    expect(displayPrice(70, 'EUR', 'ticketmaster', stamp, now)).toBeNull();
  expect(displayPrice(70, 'EUR', 'ticketmaster', '2026-10-05T12:00:00Z', now)).toBe(70);
});
