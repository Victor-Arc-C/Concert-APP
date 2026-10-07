import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { formatters } from '../src/i18n/format';
import { resolveLocale } from '../src/i18n/config';
import { translate, translateAlertTitle } from '../src/i18n/server-text';
import { cityName, genreName } from '../src/i18n/names';

/** Every leaf of a dictionary, with functions called with sample arguments. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    const args = Array.from({ length: value.length }, (_, i) => (i === 0 ? 2 : 'X'));
    return leaves((value as (...a: unknown[]) => unknown)(...args), `${path}()`);
  }
  if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, `${path}[${i}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key));
  return [];
}

describe('dictionaries', () => {
  it('have the same keys in English and French, none empty', () => {
    const english = leaves(en);
    const french = new Map(leaves(fr));
    expect(english.length).toBeGreaterThan(400);
    for (const [path] of english) expect(french.has(path), path).toBe(true);
    for (const [path, text] of french) expect(text.trim(), path).not.toBe('');
  });
  it('keep French free of untranslated English sentences', () => {
    // Brand names, provider names and labels identical in both languages are allowed.
    const same = new Set(['Showbound', 'Trip Intelligence', 'Flexible', 'Direct', 'Train', 'Date', 'Transport', 'Site', '© 2026 Showbound', 'English', 'Français', 'Concerts', 'Pop', 'Hip-hop']);
    const english = new Map(leaves(en));
    const leftovers = leaves(fr).filter(
      ([path, text]) => english.get(path) === text && text.includes(' ') && !same.has(text),
    );
    expect(leftovers.filter(([, text]) => !/^(Email|E-mail)$/.test(text))).toEqual([]);
  });
  it('never use em dashes in interface copy', () => {
    for (const [path, text] of [...leaves(en), ...leaves(fr)]) expect(text, path).not.toContain('—');
  });
});

describe('formats', () => {
  it('format dates, prices and plurals per language, and never invent a price', () => {
    const e = formatters('en');
    const f = formatters('fr');
    expect(e.dateShort('2026-11-14')).toBe('14 Nov');
    expect(f.dateLong('2026-11-14')).toBe('14 novembre 2026');
    expect(e.dayMonth('2027-01-20')).toBe('20 January');
    expect(f.dayParts('2026-11-14')).toEqual({ weekday: 'sam', day: '14', month: 'nov' });
    expect(e.money(79.5, 'EUR')).toBe('€79.50');
    expect(f.money(79.5, 'EUR')?.replace(/\s/g, ' ')).toBe('79,50 €');
    for (const bad of [null, undefined, -1, NaN]) expect(e.money(bad as number, 'EUR')).toBeNull();
    expect(e.money(10, null)).toBeNull();
    expect(e.duration(200)).toBe('3h20');
    expect(e.duration(45)).toBe('45 min');
    expect(e.time('20:00:00')).toBe('20:00');
    expect(e.time(null)).toBeNull();
  });
  it('fall back to English for unknown or missing languages', () => {
    expect(resolveLocale('fr')).toBe('fr');
    expect(resolveLocale('de')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});

describe('server text', () => {
  it('translates recommendation reasons, provider notes and errors, joined or alone', () => {
    expect(translate('In your home city, Paris', 'fr')).toBe('Dans ta ville, Paris');
    expect(translate('About 430 km between city centres', 'fr')).toBe(
      'Environ 430 km entre les centres-villes',
    );
    expect(translate('Email or password is incorrect.', 'fr')).toBe('E-mail ou mot de passe incorrect.');
    expect(
      translate(
        'Concert listings are up to date. Coverage is limited to Ticketmaster. 2 sample artists were skipped.',
        'fr',
      ),
    ).toBe(
      'Les concerts sont à jour. La couverture se limite à Ticketmaster. 2 artistes de démo ignorés.',
    );
    expect(translate('Email or password is incorrect.', 'en')).toBe('Email or password is incorrect.');
  });
  it('keeps unknown provider wording rather than guessing', () => {
    expect(translate('Upstream said no.', 'fr')).toBe('Upstream said no.');
  });
  it('translates alert titles and bodies without touching artist names', () => {
    expect(translateAlertTitle('Fred again.. in London', 'fr')).toBe('Fred again.. à Londres');
    expect(translateAlertTitle('Live in Paris in Lyon', 'fr')).toBe('Live in Paris à Lyon');
    expect(translateAlertTitle('RAYE: sale within 24 hours', 'fr')).toBe(
      'RAYE : vente dans moins de 24 h',
    );
    expect(
      translate(
        'Sample event. Accor Arena, 2026-11-15. A new opportunity for an artist you follow.',
        'fr',
      ),
    ).toBe('Concert fictif. Accor Arena, 2026-11-15. Une nouvelle date pour un artiste que tu suis.');
  });
  it('names catalogue cities and genres in French only for display', () => {
    expect(cityName('London', 'fr')).toBe('Londres');
    expect(cityName('London', 'en')).toBe('London');
    expect(cityName('Paris', 'fr')).toBe('Paris');
    expect(genreName('Electronic', 'fr')).toBe('Électro');
  });
});
