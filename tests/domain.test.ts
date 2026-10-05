import { describe, expect, it } from 'vitest';
import { rankEvents, comparableTotal } from '../src/domain/recommendations';
import {
  compareEventIdentity,
  fingerprint,
  normalizeArtistName,
  normalizeTicketmaster,
  safeTicketUrl,
} from '../src/domain/normalization';
import { sampleEvents } from '../src/domain/sample';
import { defaults } from '../src/domain/catalog';
import { intentSchema, preferencesSchema } from '../src/domain/validation';
const now = new Date('2026-10-04T12:00:00Z');
const events = sampleEvents(now);
const affinity = [
  { artistId: 'fred-again', favorite: true, hidden: false },
  { artistId: 'raye', favorite: false, hidden: false },
];
describe('recommendations', () => {
  it('favours explicit favourites and home city while grouping by canonical artist', () => {
    const result = rankEvents(events, affinity, [], [], defaults, now);
    expect(result[0].city).toBe('Paris');
    expect(result[0].artistIds).toContain('fred-again');
    expect(result.every((e) => e.artist === 'Fred again..' || e.artist === 'RAYE')).toBe(true);
    expect(result[0].reasons).toContain('One of your favourites');
  });
  it('excludes dismissed, hidden, past and cancelled shows', () => {
    const result = rankEvents(
      [{ ...events[0], status: 'cancelled' }, { ...events[5], date: '2020-01-01' }, events[6]],
      affinity,
      [],
      [{ eventId: events[6].id, action: 'dismissed' }],
      defaults,
      now,
    );
    expect(result).toEqual([]);
    expect(
      rankEvents(
        events,
        affinity.map((a) => ({ ...a, hidden: true })),
        [],
        [],
        defaults,
        now,
      ),
    ).toEqual([]);
  });
  it('enforces city, country and known EUR budget limits without treating unknown as free', () => {
    expect(
      rankEvents(events, affinity, [], [], { ...defaults, scope: 'city' }, now).every(
        (e) => e.city === 'Paris',
      ),
    ).toBe(true);
    expect(
      rankEvents(events, affinity, [], [], { ...defaults, scope: 'country' }, now).every(
        (e) => e.country === 'FR',
      ),
    ).toBe(true);
    expect(rankEvents(events, affinity, [], [], { ...defaults, budget: 60 }, now)).toEqual([]);
    expect(comparableTotal(75, null, 50)).toBeNull();
    expect(comparableTotal(75, 40, 50)).toBe(165);
  });
  it('must-see and saved feedback improve relevance but scores never become probabilities', () => {
    const base = rankEvents(events, affinity, [], [], defaults, now).find(
      (e) => e.artist === 'RAYE',
    )!;
    const changed = rankEvents(
      events,
      affinity,
      [{ artistId: 'raye', cities: ['London'], maxPrice: 90, tickets: 2 }],
      [{ eventId: base.id, action: 'saved' }],
      defaults,
      now,
    ).find((e) => e.id === base.id)!;
    expect(changed.score).toBeGreaterThan(base.score);
    expect(changed.tier).toBe('Must see');
    expect(changed.score).toBeLessThanOrEqual(100);
  });
  it('respects must-see city and price constraints', () => {
    const result = rankEvents(
      events,
      affinity,
      [{ artistId: 'fred-again', cities: ['Berlin'], maxPrice: 65, tickets: 2 }],
      [],
      defaults,
      now,
    );
    expect(result.find((e) => e.city === 'Berlin')?.tier).toBe('Must see');
    expect(result.find((e) => e.city === 'Paris')?.tier).not.toBe('Must see');
  });
  it('flags uncertain duration instead of inventing a journey time', () => {
    expect(
      rankEvents(events, affinity, [], [], { ...defaults, maxHours: 3 }, now).find(
        (e) => e.city === 'London',
      )?.reasons,
    ).toContain('Travel time still needs checking');
  });
});
const raw = {
  id: 'tm1',
  name: 'Real concert',
  url: 'https://www.ticketmaster.fr/event/123',
  dates: { start: { localDate: '2027-01-10', localTime: '20:00:00' }, status: { code: 'onsale' } },
  _embedded: {
    venues: [{ name: 'Accor Arena', city: { name: 'Paris' }, country: { countryCode: 'FR' } }],
    attractions: [{ id: 'attr1', name: 'Artist' }],
  },
};
describe('normalisation and deduplication', () => {
  it('keeps missing prices and sale times unknown', () => {
    const result = normalizeTicketmaster(raw, 'canonical', 'attr1', 'Artist', now)!;
    expect(result.price).toBeNull();
    expect(result.saleAt).toBeNull();
    expect(result.status).toBe('onsale');
  });
  it('rejects ambiguous artist mapping and malformed provider responses', () => {
    expect(normalizeTicketmaster(raw, 'canonical', 'wrong', 'Artist')).toBeNull();
    expect(normalizeTicketmaster({ foo: 'bar' }, 'a', 'b', 'C')).toBeNull();
  });
  it('ignores time-TBA values and excludes unknown dates', () => {
    expect(
      normalizeTicketmaster(
        { ...raw, dates: { start: { ...raw.dates.start, timeTBA: true } } },
        'a',
        'attr1',
        'A',
      )?.localTime,
    ).toBeNull();
    expect(
      normalizeTicketmaster(
        { ...raw, dates: { start: { ...raw.dates.start, dateTBD: true } } },
        'a',
        'attr1',
        'A',
      ),
    ).toBeNull();
  });
  it('normalizes common artist-name punctuation, case and accents deterministically', () => {
    expect(normalizeArtistName('Fred Again..')).toBe(normalizeArtistName('FRED AGAIN'));
    expect(normalizeArtistName('Beyoncé')).toBe(normalizeArtistName('beyonce'));
    expect(normalizeArtistName('Simon & Garfunkel')).toBe(normalizeArtistName('Simon and Garfunkel'));
  });
  it('compares event identity by canonical artist, venue, city, date and time', () => {
    const a = events[0];
    expect(compareEventIdentity(a, { ...a, venue: 'ACCOR-ARENA' })).toBe('same');
    expect(compareEventIdentity(a, { ...a, localTime: '23:59:00' })).toBe('different');
    expect(compareEventIdentity(a, { ...a, localTime: null })).toBe('ambiguous');
    expect(compareEventIdentity(a, { ...a, artistIds: ['different'] })).toBe('different');
  });
  it('merges exact identities but preserves distinct performances and unknown times', () => {
    const a = events[0];
    expect(fingerprint({ ...a, venue: 'ACCOR ARENA' })).toBe(fingerprint(a));
    expect(fingerprint({ ...a, localTime: '22:00:00' })).not.toBe(fingerprint(a));
    expect(fingerprint({ ...a, localTime: null, externalId: 'different' })).not.toBe(
      fingerprint({ ...a, localTime: null }),
    );
    expect(fingerprint({ ...a, artistIds: ['different'] })).not.toBe(fingerprint(a));
  });
  it('blocks deceptive domains, credential URLs and non-HTTPS ticket links', () => {
    for (const url of [
      'javascript:alert(1)',
      'https://ticketmaster.com.evil.example/x',
      'https://evil.example/?ticketmaster.com',
      'https://user@ticketmaster.com/x',
      'http://ticketmaster.fr/x',
    ])
      expect(safeTicketUrl(url)).toBe(false);
    expect(safeTicketUrl('https://www.ticketmaster.fr/event/123')).toBe(true);
  });
});
describe('must-see input', () => {
  it('validates ticket count, nonempty cities and price bounds', () => {
    const valid = { artistId: 'a', cities: ['Paris'], maxPrice: 150, tickets: 2 };
    expect(intentSchema.safeParse(valid).success).toBe(true);
    for (const bad of [
      { ...valid, tickets: 0 },
      { ...valid, cities: [] },
      { ...valid, maxPrice: -1 },
      { ...valid, tickets: 1.5 },
    ])
      expect(intentSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects unsupported home cities and negative budgets', () => {
    expect(preferencesSchema.safeParse({ ...defaults, home: 'Unknown' }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...defaults, budget: -5 }).success).toBe(false);
  });
  it('accepts legacy profiles and validates an optional radius in kilometres', () => {
    const legacy = { ...defaults };
    delete legacy.radiusKm;
    expect(preferencesSchema.parse(legacy).radiusKm).toBeNull();
    expect(preferencesSchema.parse({ ...defaults, radiusKm: 250 }).radiusKm).toBe(250);
    for (const radiusKm of [0, -1, 1.5, 5001, '250'])
      expect(preferencesSchema.safeParse({ ...defaults, radiusKm }).success).toBe(false);
  });
});
it('puts a home-city date ahead of earlier overseas dates for the same artist', () => {
  const base = events[0];
  const dates = [
    { ...base, id: 'away', city: 'London', country: 'GB', date: '2027-06-01' },
    { ...base, id: 'home', city: 'Paris', country: 'FR', date: '2027-06-12' },
  ];
  const follows = base.artistIds.map((artistId) => ({ artistId, favorite: false, hidden: false }));
  expect(rankEvents(dates, follows, [], [], { ...defaults, home: 'Paris' }, now)[0].id).toBe(
    'home',
  );
  expect(
    rankEvents(dates, follows, [], [], { ...defaults, home: 'Paris', scope: 'city' }, now).map(
      (e) => e.id,
    ),
  ).toEqual(['home']);
});
it('extracts official French seller destinations while rejecting unsafe redirect targets', () => {
  const seller =
    'https://www.ticketmaster.fr/fr/manifestation/tame-impala-billet/idmanif/670632/idseance/4400640';
  const wrapped = `https://ticketmaster.evyy.net/c/example?u=${encodeURIComponent(seller)}`;
  expect(normalizeTicketmaster({ ...raw, url: wrapped }, 'canonical', 'attr1', 'Artist')?.url).toBe(
    seller,
  );
  for (const url of [
    'https://ticketmaster.evyy.net/c/example?u=https%3A%2F%2Fevil.example',
    'https://ticketmaster.evyy.net.evil.example/?u=' + encodeURIComponent(seller),
    'https://user@ticketmaster.evyy.net/?u=' + encodeURIComponent(seller),
    'https://ticketmaster.evyy.net/?u=http%3A%2F%2Fwww.ticketmaster.fr',
  ])
    expect(normalizeTicketmaster({ ...raw, url }, 'canonical', 'attr1', 'Artist')?.url).toBeNull();
});
it('preserves a supplied price without inventing one for missing ranges', () => {
  expect(
    normalizeTicketmaster(
      { ...raw, priceRanges: [{ min: 79.5, currency: 'EUR' }] },
      'canonical',
      'attr1',
      'Artist',
    )?.price,
  ).toBe(79.5);
});
