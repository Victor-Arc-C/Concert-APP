import { expect, it } from 'vitest';
import { rankEvents } from '../src/domain/recommendations';
import { defaults } from '../src/domain/catalog';
import { sampleEvents } from '../src/domain/sample';
const now = new Date('2026-10-06T00:00:00Z');
const base = sampleEvents(now)[0];
const follow = { artistId: 'liked', favorite: true, hidden: false };
const events = [
  { ...base, id: 'exact', artistIds: ['liked'] },
  { ...base, id: 'similar', artistIds: ['new'], genre: 'Electronic' },
  { ...base, id: 'other', artistIds: ['other'], genre: 'Rock' },
];
it('never inserts other artists into the feed, even with the same genre or saved feedback', () => {
  const ranked = rankEvents(
    events,
    [follow],
    [],
    [{ eventId: 'similar', action: 'saved' }],
    defaults,
    now,
  );
  expect(ranked.map((e) => e.id)).toEqual(['exact']);
  expect(rankEvents([...events].reverse(), [follow], [], [], defaults, now)).toEqual(ranked);
});
it('leaves the feed empty without followed artists or eligible concerts', () => {
  expect(rankEvents(events, [], [], [], defaults, now)).toEqual([]);
  expect(rankEvents(events, [{ ...follow, hidden: true }], [], [], defaults, now)).toEqual([]);
  expect(
    rankEvents(events, [follow], [], [{ eventId: 'exact', action: 'dismissed' }], defaults, now),
  ).toEqual([]);
  expect(
    rankEvents(
      [{ ...events[0], country: 'US', city: 'New York' }],
      [follow],
      [],
      [],
      defaults,
      now,
    ),
  ).toEqual([]);
});
it('preserves saved concerts outside the feed without making them implicit follows', () => {
  const saved = rankEvents(
    events,
    [],
    [],
    [{ eventId: 'similar', action: 'saved' }],
    defaults,
    now,
    true,
  );
  expect(saved.filter((e) => e.saved).map((e) => e.id)).toEqual(['similar']);
});
