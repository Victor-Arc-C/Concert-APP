// Render the approved Showbound SVG sources. Run: node scripts/generate-icons.mjs
// Keep source geometry in public/brand so regeneration cannot revive the old identity.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const renders = [
  ['showbound-app-icon.svg', 'public/icons/icon-192.png', 192],
  ['showbound-app-icon.svg', 'public/icons/icon-512.png', 512],
  ['showbound-app-icon.svg', 'src/app/apple-icon.png', 180],
  ['showbound-symbol.svg', 'src/app/icon.png', 64],
  ['showbound-app-icon-maskable.svg', 'public/icons/icon-maskable-512.png', 512],
  ['showbound-badge.svg', 'public/icons/badge-96.png', 96],
  ['showbound-app-icon.svg', 'public/brand/showbound-app-icon-1024.png', 1024],
];

for (const [source, destination, size] of renders) {
  // High density: the symbol and badge are drawn on a ~26-unit grid and must stay crisp when scaled up.
  await sharp(fileURLToPath(new URL(`public/brand/${source}`, root)), { density: 600 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(fileURLToPath(new URL(destination, root)));
}

await sharp(fileURLToPath(new URL('public/brand/showbound-logo.svg', root)), { density: 600 })
  .resize({ width: 1200 })
  .png()
  .toFile(fileURLToPath(new URL('public/brand/showbound-logo-1200.png', root)));

console.log('Showbound icons and logo written from public/brand SVG sources.');
