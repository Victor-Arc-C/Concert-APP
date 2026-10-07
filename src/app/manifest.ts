import type { MetadataRoute } from 'next';

// Makes Encore installable ("Add to Home Screen"). On iPhone, Web Push only works once installed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/app',
    name: 'Encore',
    short_name: 'Encore',
    description: 'Concerts by the artists you follow, and how to get there.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0d12',
    theme_color: '#0b0d12',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
