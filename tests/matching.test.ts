import { expect, it } from 'vitest';
import { rankEvents, cityDistanceKm } from '../src/domain/recommendations';
import { defaults } from '../src/domain/catalog';
import { sampleEvents } from '../src/domain/sample';
const now = new Date('2026-10-06T00:00:00Z');
const event = {
  ...sampleEvents(now)[0],
  id: 'canonical-event',
  artistIds: ['canonical-artist'],
  date: '2026-10-10',
};
const followed = [{ artistId: 'canonical-artist', favorite: false, hidden: false }];
it('matches canonical follows once, excludes similar names, hidden and unfollowed artists', () => {
  const other = { ...event, id: 'other-event', artistIds: ['ambiguous-artist'] };
  expect(
    rankEvents([event, event, other], followed, [], [], defaults, now).map((e) => e.id),
  ).toEqual(['canonical-event']);
  expect(rankEvents([event], [{ ...followed[0], hidden: true }], [], [], defaults, now)).toEqual(
    [],
  );
  expect(rankEvents([event], [], [], [], defaults, now)).toEqual([]);
  expect(rankEvents([], followed, [], [], defaults, now)).toEqual([]);
});
it('uses strongest explicit affinity independent of event artist order', () => {
  const affinities = [...followed, { artistId: 'favorite', favorite: true, hidden: false }];
  const results = rankEvents(
    [{ ...event, artistIds: ['canonical-artist', 'favorite'] }],
    affinities,
    [],
    [],
    defaults,
    now,
  );
  expect(results[0].reasons).toContain('One of your favourites');
});
it('ranks nearer and sooner shows with honest reasons and retains geography filtering', () => {
  const london = { ...event, id: 'london', city: 'London', country: 'GB' };
  const berlin = { ...event, id: 'berlin', city: 'Berlin', country: 'DE' };
  const later = { ...london, id: 'later', date: '2027-02-10' };
  const ranked = rankEvents([berlin, later, london], followed, [], [], defaults, now);
  expect(ranked[0].id).toBe('london');
  expect(ranked[0].reasons).toContain('Coming up within 30 days');
  expect(ranked[0].reasons.some((r) => r.includes('between city centres'))).toBe(true);
  expect(cityDistanceKm('Paris', 'Unknown', 'FR')).toBeNull();
  expect(rankEvents([london], followed, [], [], { ...defaults, scope: 'city' }, now)).toEqual([]);
});

it('applies inclusive date windows and radius to canonical matches without guessing unknown distances', () => {
  const paris = { ...event, city: 'Paris', country: 'FR' };
  const london = { ...event, id: 'london', city: 'London', country: 'GB' };
  const unknown = { ...event, id: 'unknown', city: 'Unknown', country: 'FR' };
  const prefs = { ...defaults, radiusKm: 100, dateFrom: event.date, dateTo: event.date };
  expect(
    rankEvents([paris, london, unknown], followed, [], [], prefs, now).map((e) => e.id),
  ).toEqual([event.id]);
  expect(rankEvents([paris], followed, [], [], { ...prefs, dateFrom: '2026-10-11' }, now)).toEqual(
    [],
  );
});
