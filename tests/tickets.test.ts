import { expect, it, vi, afterEach } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { selectTicketSource, ticketSources } from '../src/server/tickets';
import { sampleEvents } from '../src/domain/sample';
const event = { ...sampleEvents()[0], provider: 'ticketmaster' as const };
const source = {
  provider: 'ticketmaster',
  externalId: 'one',
  url: 'https://www.ticketmaster.fr/event/one',
  price: null,
  currency: null,
  observedAt: new Date(),
  disabledAt: null,
};
afterEach(() => vi.mocked(query).mockReset());
it('returns multiple fresh approved sources and selects exact source without altering URLs', async () => {
  vi.mocked(query).mockResolvedValue([
    source,
    { ...source, externalId: 'two', url: 'https://www.ticketmaster.nl/event/two' },
  ]);
  expect(await ticketSources(event)).toHaveLength(2);
  expect(
    (await selectTicketSource(event, { provider: 'ticketmaster', externalId: 'two' })).url,
  ).toBe('https://www.ticketmaster.nl/event/two');
  await expect(
    selectTicketSource(event, { provider: 'ticketmaster', externalId: 'forged' }),
  ).rejects.toMatchObject({ status: 422 });
});
it('blocks disabled stale unsafe cancelled and sample sources without snapshot fallback', async () => {
  vi.mocked(query).mockResolvedValue([
    { ...source, disabledAt: new Date() },
    { ...source, observedAt: new Date(0) },
    { ...source, url: 'https://evil.example/tickets' },
  ]);
  expect(await ticketSources(event)).toEqual([]);
  await expect(selectTicketSource(event)).rejects.toMatchObject({ status: 422 });
  expect(await ticketSources({ ...event, status: 'cancelled' })).toEqual([]);
  expect(await ticketSources({ ...event, provider: 'sample' })).toEqual([]);
});
it('keeps link availability independent of invalid/stale prices and preserves each source currency', async () => {
  const now = new Date();
  vi.mocked(query).mockResolvedValue([
    { ...source, price: 70, currency: 'EUR', observedAt: now },
    { ...source, externalId: 'two', price: 90, currency: 'GBP', observedAt: now },
    {
      ...source,
      externalId: 'stale-price',
      price: 1,
      currency: 'EUR',
      observedAt: new Date(now.getTime() - 2 * 86400000),
    },
    { ...source, externalId: 'negative', price: -1, currency: 'EUR', observedAt: now },
    { ...source, externalId: 'bad-currency', price: 1, currency: 'bad', observedAt: now },
    {
      ...source,
      externalId: 'future',
      price: 1,
      currency: 'EUR',
      observedAt: new Date(now.getTime() + 3600000),
    },
  ]);
  const rows = await ticketSources(event, now);
  expect(rows.map((row) => row.price)).toEqual([70, 90, null, null, null, null]);
  expect(rows.map((row) => row.currency).slice(0, 2)).toEqual(['EUR', 'GBP']);
  expect(await ticketSources({ ...event, status: 'postponed' }, now)).toEqual([]);
});
