/**
 * Lighting gels. Every artist keeps one colour, picked from their name, so the same artist is
 * lit the same way on every screen and every visit.
 */
export const GELS = ['#ff3d7f', '#1fb6ff', '#ffaa00', '#7be03a', '#a58bff', '#ff6a3d'] as const;
export type Gel = (typeof GELS)[number];

/**
 * The sample catalogue is lit by hand so neighbouring cards never share a colour; every other
 * artist gets a gel from an FNV-1a hash of the name.
 */
const FIXED: Record<string, Gel> = {
  'Fred again..': '#a58bff',
  'Billie Eilish': '#ff3d7f',
  'Charli xcx': '#ff6a3d',
  'Kendrick Lamar': '#1fb6ff',
  RAYE: '#ffaa00',
  'Tame Impala': '#7be03a',
  'The Weeknd': '#ff3d7f',
  SZA: '#1fb6ff',
  'Travis Scott': '#ff6a3d',
  'Bad Bunny': '#ffaa00',
  'Dua Lipa': '#a58bff',
  'Fontaines D.C.': '#7be03a',
};

export function gelFor(name: string): Gel {
  if (FIXED[name]) return FIXED[name];
  let hash = 0x811c9dc5;
  for (const char of name) hash = Math.imul(hash ^ char.codePointAt(0)!, 0x01000193) >>> 0;
  return GELS[hash % GELS.length];
}

const quiet = new Set(['de', 'the', 'and', 'of', 'et', 'la', 'le', 'les']);

/** Grapheme-safe initials: first and last word, or the first two letters of a single word. */
export function initials(name: string) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const letters = (word: string) => [...segmenter.segment(word)].map((s) => s.segment);
  const words = name
    .replace(/[&+!.,/()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !quiet.has(word.toLowerCase()));
  if (!words.length) return letters(name.trim()).slice(0, 2).join('').toUpperCase() || '?';
  if (words.length === 1) return letters(words[0]).slice(0, 2).join('').toUpperCase();
  return (letters(words[0])[0] + letters(words[words.length - 1])[0]).toUpperCase();
}
