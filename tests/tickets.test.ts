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
