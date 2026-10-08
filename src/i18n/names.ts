import type { Locale } from './config';

/**
 * Display names for the catalogue's cities and genres. Stored values stay English (they are
 * identifiers in preferences and filters); only what people read changes language.
 */
const cities: Record<Locale, Record<string, string>> = {
  en: {},
  fr: { London: 'Londres', Brussels: 'Bruxelles', Barcelona: 'Barcelone' },
};
const genres: Record<Locale, Record<string, string>> = {
  en: {},
  fr: {
    Electronic: 'Électro',
    'Electronic / Pop': 'Électro / Pop',
    Alternative: 'Alternatif',
    'Psychedelic pop': 'Pop psychédélique',
    Latin: 'Latino',
    'Live music': 'Musique live',
    'Spotify artist': 'Artiste Spotify',
  },
};
export const cityName = (name: string, locale: Locale) => cities[locale][name] ?? name;
export const genreName = (name: string, locale: Locale) => genres[locale][name] ?? name;
