import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { TicketmasterProvider } from '../src/server/providers/ticketmaster';

const internationalId = 'K8vZ917KBrV';
const frenchId = 'K8vZ917pPdf';
const db = vi.mocked(query);
const artist = {
  id: 'followed-artist',
  providerId: internationalId,
  name: 'Bigflo & Oli',
  genre: 'Music',
  color: '#000',
  initials: 'bo',
};

function event(id: string, attractionIds: string[], country = 'FR') {
  return {
    id,
    name: 'A concert',
    dates: { start: { localDate: '2027-02-10', localTime: '20:00:00' } },
    ...(country === 'GB' ? { priceRanges: [{ min: 32, currency: 'GBP' }] } : {}),
    _embedded: {
      attractions: attractionIds.map((id) => ({ id, name: 'Bigflo & Oli' })),
      venues: [
        {
          name: country === 'GB' ? 'London venue' : 'French venue',
          city: { name: country === 'GB' ? 'London' : 'Paris' },
          country: { countryCode: country },
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('TICKETMASTER_API_KEY', 'test-key');
  db.mockImplementation(async (sql) =>
    sql.includes('INSERT INTO rate_limits') ? [{ count: 1 }] : [],
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  db.mockReset();
});

async function collect(selected = artist) {
  const pending = new TicketmasterProvider().events(selected);
  await vi.runAllTimersAsync();
  return pending;
}

it.each([internationalId, frenchId])(
  'retrieves both reviewed regions from an existing follow of %s',
  async (providerId) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const id = new URL(String(input)).searchParams.get('attractionId')!;
      return new Response(
        JSON.stringify({
          _embedded: {
            events: [
              event(
                id === internationalId ? 'uk-show' : 'fr-show',
                [id],
                id === internationalId ? 'GB' : 'FR',
              ),
            ],
          },
          page: { totalPages: 1 },
        }),
      );
    });
    const results = await collect({ ...artist, providerId });
    expect(results.map(({ event }) => event.country).sort()).toEqual(['FR', 'GB']);
    expect(results.every(({ event }) => event.artistIds.includes(artist.id))).toBe(true);
    expect(results.find(({ event }) => event.country === 'GB')?.event).toMatchObject({
      price: 32,
      currency: 'GBP',
    });
    expect(results.find(({ event }) => event.country === 'FR')?.event).toMatchObject({
      price: null,
      currency: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url] of fetcher.mock.calls) {
      expect(new URL(String(url)).searchParams.get('locale')).toBe('*');
      expect(new URL(String(url)).searchParams.has('countryCode')).toBe(false);
    }
  },
);

it('deduplicates overlapping listings by exact provider event ID', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const id = new URL(String(input)).searchParams.get('attractionId')!;
    return new Response(
      JSON.stringify({
        _embedded: {
          events: [event('same-show', [internationalId, frenchId]), event(`only-${id}`, [id])],
        },
      }),
    );
  });
  const results = await collect();
  expect(results).toHaveLength(3);
  expect(results.filter(({ event }) => event.externalId === 'same-show')).toHaveLength(1);
});

it('keeps the latest exact-source observation when a repeated listing loses its price', async () => {
  const first = event('same-show', [internationalId, frenchId], 'GB');
  const later = { ...first, priceRanges: undefined };
  const fetcher = vi.spyOn(globalThis, 'fetch');
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { events: [first] } })));
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { events: [later] } })));
  const results = await collect();
  expect(results).toHaveLength(1);
  expect(results[0].event).toMatchObject({
    externalId: 'same-show',
    country: 'GB',
    price: null,
    currency: null,
  });
});

it('reads only mappings attached to the followed canonical artist and does not infer homonyms', async () => {
  db.mockImplementation(async (sql, params) => {
    if (sql.includes('FROM artist_provider_records')) {
      expect(params).toEqual(['ticketmaster', artist.id]);
      return [{ external_id: 'selected' }, { external_id: 'mapped-regional-record' }];
    }
    return sql.includes('INSERT INTO rate_limits') ? [{ count: 1 }] : [];
  });
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const id = new URL(String(input)).searchParams.get('attractionId')!;
    return new Response(JSON.stringify({ _embedded: { events: [event(`show-${id}`, [id])] } }));
  });
  await collect({ ...artist, providerId: 'selected' });
  expect(
    fetcher.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('attractionId')),
  ).toEqual(['selected', 'mapped-regional-record']);
});

it('gives each linked record a first page before spending a shared five-request paging budget', async () => {
  db.mockImplementation(async (sql) =>
    sql.includes('FROM artist_provider_records')
      ? [{ external_id: 'second' }]
      : sql.includes('INSERT INTO rate_limits')
        ? [{ count: 1 }]
        : [],
  );
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    const id = url.searchParams.get('attractionId')!;
    return new Response(
      JSON.stringify({
        _embedded: { events: [event(`${id}-${url.searchParams.get('page')}`, [id])] },
        page: { totalPages: 10 },
      }),
    );
  });
  const results = await collect({ ...artist, providerId: 'first' });
  expect(results).toHaveLength(5);
  expect(
    fetcher.mock.calls.map(([input]) => {
      const url = new URL(String(input));
      return `${url.searchParams.get('attractionId')}:${url.searchParams.get('page')}`;
    }),
  ).toEqual(['first:0', 'second:0', 'first:1', 'second:1', 'first:2']);
});

it('reports an excessive linked-record set before making provider requests', async () => {
  db.mockResolvedValue(
    ['one', 'two', 'three', 'four', 'five', 'six'].map((external_id) => ({ external_id })),
  );
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await expect(
    new TicketmasterProvider().events({ ...artist, providerId: 'one' }),
  ).rejects.toMatchObject({ status: 422 });
  expect(fetcher).not.toHaveBeenCalled();
});
