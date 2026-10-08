// Human-readable attribution for trip quote sources (server ids from provider adapters).
const labels: Record<string, string> = {
  sncf: 'SNCF timetable',
  ticketmaster: 'Ticketmaster',
  liteapi: 'LiteAPI (Nuitée)',
  'liteapi-sandbox': 'LiteAPI sandbox: test prices, not bookable',
};
export function tripSourceLabel(provider: string) {
  // Sample providers (sample, sample-euro-rail, sample-stays…) are all the fictional catalogue.
  if (provider === 'sample' || provider.startsWith('sample-')) return 'Fictional sample';
  return labels[provider] ?? provider;
}
