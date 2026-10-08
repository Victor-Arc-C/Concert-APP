import { expect, it } from 'vitest';
import { cities, defaults } from '../src/domain/catalog';
import { frenchCities } from '../src/domain/french-cities';
import { cityDistanceKm, rankEvents } from '../src/domain/recommendations';
import { preferencesSchema, intentSchema } from '../src/domain/validation';
import { sampleEvents } from '../src/domain/sample';
import { tripSearchContext } from '../src/server/trips';

it('supports at least three departure cities in each of the 18 French regions', () => {
  const regions = [
    '01',
    '02',
    '03',
    '04',
    '06',
    '11',
    '24',
    '27',
    '28',
    '32',
    '44',
    '52',
    '53',
    '75',
    '76',
    '84',
    '93',
    '94',
  ];
  for (const region of regions) {
    const origins = frenchCities.filter((c) => c.regionCode === region);
    expect(origins.length, region).toBeGreaterThanOrEqual(3);
    for (const origin of origins) {
      expect(preferencesSchema.safeParse({ ...defaults, home: origin.name }).success).toBe(true);
      expect(cityDistanceKm(origin.name, 'Paris', 'FR')).not.toBeNull();
    }
  }
  expect(new Set(cities.map((c) => c.name)).size).toBe(cities.length);
  expect(preferencesSchema.safeParse({ ...defaults, home: 'London' }).success).toBe(true);
});

it('shows Paris to a fan in Limoges, respecting their travel scope and optional radius', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const event = sampleEvents(now)[0];
  const follows = [{ artistId: event.artistIds[0], favorite: false, hidden: false }];
  const prefs = { ...defaults, home: 'Limoges', scope: 'country' as const };
  const rank = (preferences = prefs) => rankEvents([event], follows, [], [], preferences, now);
  expect(rank().map((e) => e.city)).toEqual(['Paris']);
  expect(rank({ ...prefs, radiusKm: 500 })).toHaveLength(1);
  expect(rank({ ...prefs, radiusKm: 100 })).toEqual([]);
  expect(rankEvents([event], follows, [], [], { ...prefs, scope: 'city' }, now)).toEqual([]);
  expect(cityDistanceKm('Limoges', 'Paris', 'FR')).toBeGreaterThan(300);
  expect(cityDistanceKm('Limoges', 'Paris', 'FR')).toBeLessThan(400);
  expect(
    intentSchema.safeParse({
      artistId: event.artistIds[0],
      cities: ['Paris', 'Limoges'],
      maxPrice: null,
      tickets: 1,
    }).success,
  ).toBe(true);
});

it('passes provincial departure coordinates through to trip planning', async () => {
  const event = sampleEvents()[0];
  const context = await tripSearchContext(event, 'Limoges');
  expect(context.origin).toEqual({ latitude: 45.8263, longitude: 1.2605 });
  expect(context.venue).not.toBeNull();
  expect(context.venueExact).toBe(false);
});
