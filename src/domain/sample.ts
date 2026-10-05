import type { Concert } from './types';
const fixtures = [
  ['fred-again', 'Fred again..', 'Paris', 'FR', 'Accor Arena', 39, 79, 'Electronic', 'stage'],
  ['billie-eilish', 'Billie Eilish', 'Paris', 'FR', 'Accor Arena', 57, 95, 'Alternative', 'crowd'],
  [
    'kendrick-lamar',
    'Kendrick Lamar',
    'Amsterdam',
    'NL',
    'Ziggo Dome',
    49,
    89,
    'Hip-hop',
    'lights',
  ],
  ['raye', 'RAYE', 'London', 'GB', 'The O2', 68, 65, 'R&B / Soul', 'stage'],
  [
    'tame-impala',
    'Tame Impala',
    'Brussels',
    'BE',
    'Forest National',
    82,
    69,
    'Psychedelic pop',
    'lights',
  ],
  ['fred-again', 'Fred again..', 'Amsterdam', 'NL', 'Ziggo Dome', 43, 74, 'Electronic', 'stage'],
  ['fred-again', 'Fred again..', 'Berlin', 'DE', 'Velodrom', 47, 64, 'Electronic', 'stage'],
  ['the-weeknd', 'The Weeknd', 'Milan', 'IT', 'Unipol Forum', 90, null, 'R&B / Pop', 'crowd'],
  ['charli-xcx', 'Charli xcx', 'Paris', 'FR', 'Zénith Paris', 74, 59, 'Electronic / Pop', 'lights'],
] as const;
// Dates move with the local seed day so a newly opened demo always has upcoming opportunities.
export function sampleEvents(now = new Date()): Concert[] {
  return fixtures.map(([id, artist, city, country, venue, offset, price, genre, image], i) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset),
    );
    return {
      id: `sample-${i + 1}`,
      artistIds: [id],
      artist,
      title: `${artist} live`,
      city,
      country,
      venue,
      date: date.toISOString().slice(0, 10),
      localTime: '20:00:00',
      timezone: city === 'London' ? 'Europe/London' : 'Europe/Paris',
      status: 'onsale',
      price,
      currency: price === null ? null : 'EUR',
      saleAt: null,
      provider: 'sample',
      externalId: `sample-${i + 1}`,
      url: null,
      fetchedAt: now.toISOString(),
      image: `/images/${image}.jpg`,
      genre,
    };
  });
}
