import { expect, it } from 'vitest';
import { rankEvents } from '../src/domain/recommendations';
import { defaults } from '../src/domain/catalog';
import { sampleEvents } from '../src/domain/sample';
const now = new Date('2026-10-06T00:00:00Z');
const base = sampleEvents(now)[0];
const artist = { id: 'liked', name: 'Liked', genre: 'Electronic', color: '#000', initials: 'L' };
const follow = { artistId: 'liked', favorite: true, hidden: false };
const events = [
  { ...base, id: 'exact', artistIds: ['liked'] },
  { ...base, id: 'similar', artistIds: ['new'], genre: 'Electronic' },
  { ...base, id: 'other', artistIds: ['other'], genre: 'Rock' },
];
it('keeps exact favourites ahead of deterministic explained discovery', () => {
  const ranked = rankEvents(events, [follow], [], [], defaults, now, false, [artist]);
  expect(ranked.map((e) => e.id)).toEqual(['exact', 'similar', 'other']);
  expect(ranked[1].tier).toBe('Discover');
  expect(ranked[1].reasons).toContain('Shares a genre with artists you follow');
  expect(
    rankEvents([...events].reverse(), [follow], [], [], defaults, now, false, [artist]),
  ).toEqual(ranked);
});
it('provides honest cold-start content while respecting hides, dismissals and geography', () => {
  expect(rankEvents(events, [], [], [], defaults, now, false, [])).toHaveLength(3);
  const result = rankEvents(
    events,
    [{ ...follow, hidden: true }],
    [],
    [{ eventId: 'similar', action: 'dismissed' }],
    defaults,
    now,
    false,
    [artist],
  );
  expect(result.map((e) => e.id)).toEqual(['other']);
  expect(result[0].reasons[0]).toBe('Discover a concert in your chosen region');
  expect(
    rankEvents(
      [{ ...base, country: 'US', city: 'New York' }],
      [],
      [],
      [],
      defaults,
      now,
      false,
      [],
    ),
  ).toEqual([]);
});
