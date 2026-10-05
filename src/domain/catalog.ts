import type { Artist, Preferences } from './types';
export const cities = [
  { name: 'Paris', country: 'FR' },
  { name: 'Lyon', country: 'FR' },
  { name: 'London', country: 'GB' },
  { name: 'Amsterdam', country: 'NL' },
  { name: 'Brussels', country: 'BE' },
  { name: 'Berlin', country: 'DE' },
  { name: 'Barcelona', country: 'ES' },
  { name: 'Madrid', country: 'ES' },
  { name: 'Milan', country: 'IT' },
];
export const artists: Artist[] = [
  { id: 'fred-again', name: 'Fred again..', genre: 'Electronic', color: '#BA8269', initials: 'fa' },
  {
    id: 'billie-eilish',
    name: 'Billie Eilish',
    genre: 'Alternative',
    color: '#738691',
    initials: 'be',
  },
  {
    id: 'kendrick-lamar',
    name: 'Kendrick Lamar',
    genre: 'Hip-hop',
    color: '#A28258',
    initials: 'kl',
  },
  { id: 'raye', name: 'RAYE', genre: 'R&B / Soul', color: '#867496', initials: 'R' },
  {
    id: 'tame-impala',
    name: 'Tame Impala',
    genre: 'Psychedelic pop',
    color: '#608D80',
    initials: 'ti',
  },
  { id: 'the-weeknd', name: 'The Weeknd', genre: 'R&B / Pop', color: '#A66E78', initials: 'tw' },
  {
    id: 'charli-xcx',
    name: 'Charli xcx',
    genre: 'Electronic / Pop',
    color: '#7C9472',
    initials: 'cx',
  },
  { id: 'sza', name: 'SZA', genre: 'R&B / Soul', color: '#887B64', initials: 'S' },
  { id: 'travis-scott', name: 'Travis Scott', genre: 'Hip-hop', color: '#A27964', initials: 'ts' },
  { id: 'bad-bunny', name: 'Bad Bunny', genre: 'Latin', color: '#8A91A1', initials: 'bb' },
  { id: 'dua-lipa', name: 'Dua Lipa', genre: 'Pop', color: '#98687F', initials: 'dl' },
  {
    id: 'fontaines-dc',
    name: 'Fontaines D.C.',
    genre: 'Alternative',
    color: '#647C98',
    initials: 'fd',
  },
];
export const defaults: Preferences = {
  home: 'Paris',
  scope: 'europe',
  maxHours: null,
  budget: null,
  notifications: 'important',
  analytics: false,
};
