// Renders the app icons (home screen, notifications) from one SVG. Run: node scripts/generate-icons.mjs
// The mark is a split-flap tile with a condensed E and the wordmark's amber dot.
import sharp from 'sharp';

const ink = '#0b0d12',
  amber = '#f1b66d',
  flapInk = '#191104';
// Drawn on a 512 grid; everything sits inside the central 80%, so icon-512 doubles as maskable.
const mark = (letter, tile, dot) => `
  <rect x="96" y="104" width="264" height="304" fill="${tile}"/>
  <path fill="${letter}" d="M156 152h144v44h-96v38h80v44h-80v38h96v44h-144z"/>
  <rect x="96" y="253" width="264" height="6" fill="${ink}"/>
  <rect x="378" y="364" width="44" height="44" fill="${dot}"/>`;
const svg = (size, { background = ink, letter = flapInk, tile = amber, dot = amber } = {}) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  ${background ? `<rect width="512" height="512" fill="${background}"/>` : ''}${mark(letter, tile, dot)}</svg>`);

const out = [
  ['public/icons/icon-192.png', 192, {}],
  ['public/icons/icon-512.png', 512, {}],
  ['src/app/apple-icon.png', 180, {}],
  ['src/app/icon.png', 64, {}],
];
for (const [file, size, options] of out) await sharp(svg(size, options)).png().toFile(file);
// Android status-bar badge: alpha only, so the letter is cut out of a white tile.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 512 512">
  <defs><mask id="m"><rect width="512" height="512" fill="#fff"/>
  <path fill="#000" d="M156 152h144v44h-96v38h80v44h-80v38h96v44h-144z"/></mask></defs>
  <g mask="url(#m)"><rect x="96" y="104" width="264" height="304" fill="#fff"/></g>
  <rect x="378" y="364" width="44" height="44" fill="#fff"/></svg>`;
await sharp(Buffer.from(badge)).png().toFile('public/icons/badge-96.png');
console.log('Icons written.');
