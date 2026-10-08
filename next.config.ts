import type { NextConfig } from 'next';
export const spotifyImageHosts = ['https://i.scdn.co'];
// Artist photos: Spotify for imported artists, Ticketmaster for artists found in its catalogue.
export const artistImageHosts = [...spotifyImageHosts, 'https://s1.ticketm.net'];
const config: NextConfig = {
  devIndicators: false,
  logging: {
    incomingRequests: false,
    fetches: { fullUrl: false },
    serverFunctions: false,
    browserToTerminal: false,
  },
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: ${artistImageHosts.join(' ')}; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
      {
        // Browsers must always fetch the latest worker so a fix ships with the next deploy.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};
export default config;
