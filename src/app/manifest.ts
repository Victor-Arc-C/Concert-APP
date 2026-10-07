import type { MetadataRoute } from 'next';

// Makes Showbound installable ("Add to Home Screen"). On iPhone, Web Push only works once installed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/app',
    name: 'Showbound',
    short_name: 'Showbound',
    description: 'Concerts by the artists you follow, and how to get there.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#efeafb',
    theme_color: '#e4dcf8',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
