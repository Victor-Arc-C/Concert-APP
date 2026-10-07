import { expect, it, vi } from 'vitest';
vi.mock('../src/server/db', () => ({ query: vi.fn() }));
import { groupByCity, waitlistSchema } from '../src/server/marketing';
import { boardText, distanceKm, travelHint } from '../src/domain/marketing';
import { sampleEvents } from '../src/domain/sample';

const rows = sampleEvents().map((data) => ({ data, latitude: null, longitude: null }));

it('groups upcoming shows by city, busiest first, using catalog coordinates', () => {
  const cities = groupByCity(rows, 'sample');
  expect(cities[0].name).toBe('Paris');
  expect(cities.reduce((n, c) => n + c.total, 0)).toBe(rows.length);
});

it('never exposes fictional sample dates', () => {
  const gigs = groupByCity(rows, 'sample').flatMap((c) => c.gigs);
  expect(gigs.every((gig) => gig.date === null)).toBe(true);
  expect(groupByCity(rows, 'live')[0].gigs[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it('drops shows outside Europe or without coordinates', () => {
  const [{ data: first }] = rows;
  const away = [
    { data: { ...first, city: 'Chicago', country: 'US' }, latitude: 41.88, longitude: -87.63 },
    { data: { ...first, city: 'Nowhere', country: 'XX' }, latitude: null, longitude: null },
  ];
  expect(groupByCity(away, 'live')).toEqual([]);
});

it('gives a rough travel hint from great-circle distance', () => {
  const paris = { latitude: 48.8566, longitude: 2.3522 };
  const brussels = { latitude: 50.8503, longitude: 4.3517 };
  const berlin = { latitude: 52.52, longitude: 13.405 };
  expect(travelHint(distanceKm(paris, paris))).toBe('IN TOWN');
  expect(travelHint(distanceKm(paris, brussels))).toBe('TRAIN');
  expect(travelHint(distanceKm(paris, berlin))).toBe('FLIGHT');
});

it('normalises waitlist emails and only accepts catalog home cities', () => {
  expect(waitlistSchema.parse({ email: ' Fan@Example.TEST ', homeCity: 'Lyon' })).toEqual({
    email: 'fan@example.test',
    homeCity: 'Lyon',
  });
  expect(() => waitlistSchema.parse({ email: 'fan@example.test', homeCity: 'Atlantis' })).toThrow();
  expect(() => waitlistSchema.parse({ email: 'not-an-email' })).toThrow();
});

it('abbreviates names for the board without dangling connectors', () => {
  expect(boardText('King Gizzard & the Lizard Wizard', 14)).toBe('KING GIZZARD');
  expect(boardText('Esch-sur-Alzette', 10)).toBe('ESCH-SUR');
  expect(boardText('Clermont-Ferrand', 10)).toBe('CLERMONT');
  expect(boardText('Mönchengladbach', 10)).toBe('MÖNCHENGL.');
  expect(boardText('Fontaines D.C.', 14)).toBe('FONTAINES D.C.');
  expect(boardText('Florence + the Machine', 14)).toBe('FLORENCE');
});
