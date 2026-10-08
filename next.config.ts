import type { NextConfig } from 'next';
export const spotifyImageHosts = ['https://i.scdn.co'];
// Artist photos: Spotify for imported artists, Ticketmaster for artists found in its catalogue.
export const artistImageHosts = [...spotifyImageHosts, 'https://s1.ticketm.net'];
// Travelpayouts Drive, required by Travelpayouts to validate the site. Loaded on the public
// home page only (no account data there); the app keeps its strict policy.
export const travelpayoutsDriveHosts = ['https://emrld.ltd', 'https://*.emrld.ltd'];
export function contentSecurityPolicy(extra: string[] = []) {
  const hosts = extra.length ? ` ${extra.join(' ')}` : '';
  return `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'${hosts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: ${artistImageHosts.join(' ')}${hosts}; font-src 'self'; connect-src 'self'${hosts}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
}
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
            value: contentSecurityPolicy(),
          },
        ],
      },
      {
        // Exactly the home page (later rules override earlier ones for the same header).
        source: '/',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy(travelpayoutsDriveHosts),
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
