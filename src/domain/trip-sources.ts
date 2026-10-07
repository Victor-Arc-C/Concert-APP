// Human-readable attribution for trip quote sources (server ids from provider adapters).
const labels: Record<string, string> = {
  sncf: 'SNCF timetable',
  liteapi: 'LiteAPI (Nuitée)',
  'liteapi-sandbox': 'LiteAPI sandbox — test prices, not bookable',
};
export function tripSourceLabel(provider: string) {
  return labels[provider] ?? provider;
}
