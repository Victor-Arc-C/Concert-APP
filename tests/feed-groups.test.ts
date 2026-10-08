import { expect, it } from 'vitest';
import { groupByArtist } from '../src/domain/feed-groups';

const show = (id: string, artist: string, date: string, localTime = '20:00:00') => ({
  id,
  artistIds: [artist],
  date,
  localTime,
});

it('keeps one card per artist in ranking order, with their soonest date and the rest after', () => {
  // Ranked order from the feed: a long Ninho tour first, L2B buried at the end.
  const events = [
    show('n3', 'ninho', '2027-03-03'),
    show('n1', 'ninho', '2027-02-25'),
    show('n2', 'ninho', '2027-02-26'),
    show('l2', 'l2b', '2027-03-06'),
    show('l1', 'l2b', '2027-03-05'),
    show('p1', 'plk', '2026-10-09'),
  ];
  const groups = groupByArtist(events);
  expect(groups.map((g) => [g.artistId, g.next.id])).toEqual([
    ['ninho', 'n1'],
    ['l2b', 'l1'],
    ['plk', 'p1'],
  ]);
  expect(groups[0].later.map((e) => e.id)).toEqual(['n2', 'n3']);
  expect(groups[2].later).toEqual([]);
});

it('orders two shows on the same day by start time', () => {
  const [group] = groupByArtist([
    show('late', 'plk', '2026-11-08', '21:00:00'),
    show('early', 'plk', '2026-11-08', '19:00:00'),
  ]);
  expect(group.next.id).toBe('early');
});
