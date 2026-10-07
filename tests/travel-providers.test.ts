import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { query } from '../src/server/db';
import { defaults } from '../src/domain/catalog';
import { currentQuote, scheduleOnly } from '../src/domain/trip-safety';
import { generateTripOptions, selectTripProviders, tripSearchContext } from '../src/server/trips';
import {
  navitiaToIso,
  SNCF_BOOKING_URL,
  SncfTransportProvider,
  wallToInstant,
} from '../src/server/providers/sncf';
import { LiteApiAccommodationProvider } from '../src/server/providers/liteapi';
import { parseEnvironment } from '../src/server/env';
import type { Concert } from '../src/domain/types';

// Deterministic fixtures only: no request ever leaves the test process.
const now = new Date('2026-11-01T10:00:00Z');
const lyonVenue = { latitude: 45.7656, longitude: 4.9822 }; // LDLC Arena, Décines
const paris = { latitude: 48.8566, longitude: 2.3522 };
const context = { origin: paris, venue: lyonVenue, eventTimezone: 'Europe/Paris' };
const event: Concert = {
  id: 'tm-ninho-lyon',
  artistIds: ['ninho'],
  artist: 'Ninho',
  title: 'Ninho',
  venue: 'LDLC Arena',
  city: 'Lyon',
  country: 'FR',
  date: '2026-11-07',
  localTime: '20:00:00',
  timezone: 'Europe/Paris',
  status: 'onsale',
  price: 49,
  currency: 'EUR',
  saleAt: null,
  provider: 'ticketmaster',
  externalId: 'Z1',
  url: 'https://www.ticketmaster.fr/fr/manifestation/ninho',
  fetchedAt: now.toISOString(),
  priceObservedAt: now.toISOString(),
  image: '',
  genre: 'Hip-hop',
};
const user = {
  id: 'u',
  name: 'Test',
  email: 'u@example.test',
  mode: 'live' as const,
  onboarded: true,
  preferences: defaults,
};
const pt = (commercial: string, physical = 'Train grande vitesse') => ({
  type: 'public_transport',
  display_informations: { commercial_mode: commercial, physical_mode: physical },
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

function sncfFetcher() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.searchParams.get('datetime_represents') === 'arrival')
      return json({
        journeys: [
          {
            departure_date_time: '20261107T140000',
            arrival_date_time: '20261107T160400',
            duration: 7440,
            nb_transfers: 0,
            sections: [{ type: 'street_network' }, pt('TGV INOUI')],
          },
          {
            departure_date_time: '20261107T120000',
            arrival_date_time: '20261107T170000',
            duration: 18000,
            nb_transfers: 1,
            sections: [pt('OUIGO'), { type: 'transfer' }, pt('TER', 'Train régional')],
          },
          // Arrives after the show starts: never proposed.
          {
            departure_date_time: '20261107T190000',
            arrival_date_time: '20261107T210000',
            duration: 7200,
            nb_transfers: 0,
            sections: [pt('TGV INOUI')],
          },
          // Walking only: not a public transport journey.
          {
            departure_date_time: '20261107T100000',
            arrival_date_time: '20261107T180000',
            duration: 28800,
            nb_transfers: 0,
            sections: [{ type: 'street_network' }],
          },
          // Coach.
          {
            departure_date_time: '20261107T080000',
            arrival_date_time: '20261107T150000',
            duration: 25200,
            nb_transfers: 0,
            sections: [pt('BlaBlaCar Bus', 'Autocar')],
          },
        ],
      });
    return json({
      journeys: [
        {
          departure_date_time: '20261108T100400',
          arrival_date_time: '20261108T120000',
          duration: 7000,
          nb_transfers: 0,
          sections: [pt('TGV INOUI')],
        },
        {
          departure_date_time: '20261108T093000',
          arrival_date_time: '20261108T113400',
          duration: 7440,
          nb_transfers: 0,
          sections: [pt('TGV INOUI')],
        },
      ],
    });
  });
}

beforeEach(() => {
  vi.mocked(query).mockReset();
  vi.mocked(query).mockImplementation(async (sql: string) => {
    if (sql.includes('rate_limits')) return [{ count: 1 }] as never[];
    if (sql.includes('event_provider_records'))
      return [{ location: { latitude: '45.7656', longitude: '4.9822' } }] as never[];
    return [] as never[];
  });
});

describe('SNCF timetable provider', () => {
  it('converts Navitia local times to ISO with the right Paris offset (winter and summer)', () => {
    expect(navitiaToIso('20261107T140000')).toBe('2026-11-07T14:00:00+01:00');
    expect(navitiaToIso('20270615T140000')).toBe('2027-06-15T14:00:00+02:00');
    expect(navitiaToIso('garbage')).toBeNull();
    expect(new Date(wallToInstant('2026-11-07', '20:00:00', 'Europe/Paris')).toISOString()).toBe(
      '2026-11-07T19:00:00.000Z',
    );
  });

  it('returns schedule-only train and coach journeys arriving before the show, never a price', async () => {
    const fetcher = sncfFetcher();
    const provider = new SncfTransportProvider('test-token', fetcher as unknown as typeof fetch);
    const options = await provider.getOptions(
      'Paris',
      'Lyon',
      '2026-11-07',
      '20:00:00',
      now,
      context,
    );
    expect(options.map((o) => [o.departureAt, o.mode, o.changes, o.operator])).toEqual([
      ['2026-11-07T14:00:00+01:00', 'train', 0, 'TGV INOUI'],
      ['2026-11-07T12:00:00+01:00', 'train', 1, 'OUIGO + TER'],
      ['2026-11-07T08:00:00+01:00', 'bus', 0, 'BlaBlaCar Bus'],
    ]);
    for (const option of options) {
      expect(option).toMatchObject({
        provider: 'sncf',
        kind: 'live',
        availability: 'unknown',
        price: null,
        currency: null,
        priceComplete: false,
        bookingUrl: SNCF_BOOKING_URL,
        // Earliest return the next morning.
        returnAt: '2026-11-08T09:30:00+01:00',
      });
      expect(scheduleOnly(option)).toBe(true);
      expect(currentQuote(option, now)).toBe(true);
    }
    // Arrive by 19:00 Paris time (one hour before a 20:00 show), as an arrival query.
    const outbound = new URL(String(fetcher.mock.calls[0][0]));
    expect(outbound.searchParams.get('datetime')).toBe('20261107T190000');
    expect(outbound.searchParams.get('from')).toBe('2.3522;48.8566');
    const headers = (fetcher.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('test-token:').toString('base64')}`);
  });

  it('reuses recent answers and stays empty without places or for a home-city show', async () => {
    const fetcher = sncfFetcher();
    const provider = new SncfTransportProvider('test-token', fetcher as unknown as typeof fetch);
    const later = new Date(now.getTime() + 60_000);
    await provider.getOptions('Paris', 'Lyon', '2026-11-14', '20:00:00', now, context);
    await provider.getOptions('Paris', 'Lyon', '2026-11-14', '20:00:00', later, context);
    expect(fetcher).toHaveBeenCalledTimes(2); // outbound + return, once
    expect(
      await provider.getOptions('Paris', 'Lyon', '2026-11-07', null, now, {
        origin: null,
        venue: lyonVenue,
      }),
    ).toEqual([]);
    expect(await provider.getOptions('Lyon', 'Lyon', '2026-11-07', null, now, context)).toEqual([]);
  });

  it('never invents a return: no return journey means no option', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      new URL(String(input)).searchParams.get('datetime_represents') === 'arrival'
        ? json({
            journeys: [
              {
                departure_date_time: '20261121T140000',
                arrival_date_time: '20261121T160000',
                duration: 7200,
                nb_transfers: 0,
                sections: [pt('TGV INOUI')],
              },
            ],
          })
        : json({ journeys: [] }),
    );
    const provider = new SncfTransportProvider('t', fetcher as unknown as typeof fetch);
    expect(
      await provider.getOptions('Paris', 'Lyon', '2026-11-21', '20:00:00', now, context),
    ).toEqual([]);
  });
});

const bodies: unknown[] = [];
function liteFetcher(taxes: { included: boolean }[] = []) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/data/hotels'))
      return json({
        data: [
          { id: 'h1', name: 'Hôtel Arena', latitude: 45.7656, longitude: 4.9922 },
          { id: 'h2', name: 'Grand Hôtel Lyon', latitude: 45.7578, longitude: 4.832 },
          { id: 'h3', name: 'No Rates Hotel', latitude: 45.76, longitude: 4.9 },
        ],
      });
    bodies.push(JSON.parse(String(init?.body)));
    return json({
      data: [
        {
          hotelId: 'h1',
          roomTypes: [
            {
              offerId: 'o-expensive',
              offerRetailRate: { amount: 140, currency: 'EUR' },
              rates: [{ retailRate: { taxesAndFees: [] } }],
            },
            {
              offerId: 'o-cheap',
              offerRetailRate: { amount: 92.5, currency: 'EUR' },
              rates: [{ retailRate: { taxesAndFees: taxes } }],
            },
          ],
        },
        {
          hotelId: 'h2',
          roomTypes: [
            {
              offerId: 'o2',
              offerRetailRate: { amount: 118, currency: 'EUR' },
              rates: [{ retailRate: { taxesAndFees: [{ included: true }] } }],
            },
          ],
        },
        { hotelId: 'unknown-hotel', roomTypes: [] },
      ],
    });
  });
}

describe('LiteAPI hotel provider', () => {
  it('returns the cheapest current offer per hotel near the venue with distance and attribution', async () => {
    const fetcher = liteFetcher();
    const provider = new LiteApiAccommodationProvider(
      'prod_key',
      'https://stays.encore.test',
      fetcher as unknown as typeof fetch,
    );
    const options = await provider.getOptions('Lyon', 'LDLC Arena', '2026-11-07', 1, now, context);
    expect(options.map((o) => [o.name, o.price, o.priceComplete, o.distanceKmToVenue])).toEqual([
      ['Hôtel Arena', 92.5, true, 0.8],
      ['Grand Hôtel Lyon', 118, true, 11.7],
    ]);
    expect(options[0]).toMatchObject({
      provider: 'liteapi',
      kind: 'live',
      availability: 'available',
      currency: 'EUR',
      city: 'Lyon',
      bookingUrl:
        'https://stays.encore.test/hotels/h1?checkin=2026-11-07&checkout=2026-11-08&adults=1',
    });
    expect(provider.bookingHosts).toEqual(['stays.encore.test']);
    expect(bodies.at(-1)).toMatchObject({
      hotelIds: ['h1', 'h2', 'h3'],
      checkin: '2026-11-07',
      checkout: '2026-11-08',
      occupancies: [{ adults: 1 }],
      currency: 'EUR',
    });
    const headers = (fetcher.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('prod_key');
  });

  it('marks quotes with taxes paid at the hotel as partial and has no link without a white-label', async () => {
    const provider = new LiteApiAccommodationProvider(
      'sand_key',
      null,
      liteFetcher([{ included: false }]) as unknown as typeof fetch,
    );
    const options = await provider.getOptions('Lyon', 'LDLC Arena', '2026-11-28', 1, now, context);
    const arena = options.find((o) => o.name === 'Hôtel Arena')!;
    expect(arena.priceComplete).toBe(false);
    expect(arena.provider).toBe('liteapi-sandbox');
    expect(options.every((o) => o.bookingUrl === null)).toBe(true);
    expect(provider.bookingHosts).toEqual([]);
  });
});

describe('live provider registry', () => {
  const settings = (values: Record<string, string>) => parseEnvironment(values);
  it('registers nothing without credentials', () => {
    expect(selectTripProviders('live', settings({}))).toEqual({
      transport: undefined,
      accommodation: undefined,
    });
  });
  it('registers SNCF and LiteAPI from server credentials', () => {
    const providers = selectTripProviders(
      'live',
      settings({ SNCF_API_KEY: 'token', LITEAPI_API_KEY: 'prod_key' }),
    );
    expect(providers.transport?.sourceIds).toEqual(['sncf']);
    expect(providers.accommodation?.sourceIds).toEqual(['liteapi']);
  });
  it('never lets a production deployment use LiteAPI sandbox (test) prices', () => {
    const production = settings({
      APP_ENV: 'production',
      APP_URL: 'https://encore.test',
      DATABASE_URL: 'postgres://u:p@db.test/encore',
      LITEAPI_API_KEY: 'sand_key',
    });
    expect(selectTripProviders('live', production).accommodation).toBeUndefined();
    expect(
      selectTripProviders('live', settings({ LITEAPI_API_KEY: 'sand_key' })).accommodation
        ?.sourceIds,
    ).toEqual(['liteapi-sandbox']);
  });
  it('rejects live travel keys in the test profile and a non-HTTPS white-label', () => {
    expect(() => settings({ APP_ENV: 'test', SNCF_API_KEY: 'x' })).toThrow();
    expect(() => settings({ APP_ENV: 'test', LITEAPI_API_KEY: 'x' })).toThrow();
    expect(() => settings({ LITEAPI_WHITELABEL_URL: 'http://stays.encore.test' })).toThrow();
  });
});

describe('trip plans with live providers', () => {
  it('uses venue coordinates from the stored provider record, else the city centre', async () => {
    expect(await tripSearchContext(event, 'Paris')).toEqual(context);
    vi.mocked(query).mockResolvedValue([]);
    expect((await tripSearchContext(event, 'Nowhere')).origin).toBeNull();
    expect((await tripSearchContext(event, 'Paris')).venue).toEqual({
      latitude: 45.764,
      longitude: 4.8357,
    });
  });

  it('shows train timetables and hotel prices without inventing a total or a badge', async () => {
    const options = await generateTripOptions(
      event,
      user,
      {
        transport: new SncfTransportProvider('t', sncfFetcher() as unknown as typeof fetch),
        accommodation: new LiteApiAccommodationProvider(
          'prod_key',
          'https://stays.encore.test',
          liteFetcher() as unknown as typeof fetch,
        ),
      },
      now,
      'Paris',
    );
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.mode).toBe('live');
      expect(option.transportState).toBe('ready');
      expect(option.accommodationState).toBe('ready');
      expect(option.transport?.provider).toBe('sncf');
      expect(option.transport?.price).toBeNull();
      expect(option.accommodation?.price).toBeGreaterThan(0);
      // A timetable has no fare, so no complete total and no Cheapest/Fastest badge.
      expect(option.estimatedTotal).toBeNull();
      expect(option.label).toBeNull();
    }
    expect(options[0].transport?.bookingUrl).toBe(SNCF_BOOKING_URL);
    expect(options[0].accommodation?.bookingUrl).toContain('https://stays.encore.test/hotels/');
  });
});
