// npm run audit:coverage-fr
// CON-38: compares publicly announced French concert dates (docs/coverage-audit-fr.public.json)
// with what the Ticketmaster Discovery API returns for the same artists, and writes
// docs/coverage-audit-fr.results.md. Needs TICKETMASTER_API_KEY in .env.local. Read-only:
// it calls the official API (no scraping) and never prints the key.
import { readFileSync, writeFileSync } from 'node:fs';

type Show = { date: string; city: string; venue: string };
type Artist = { name: string; genre: string; source: string; shows: Show[] };
type Dataset = { window: { from: string; to: string }; checkedOn: string; artists: Artist[] };
type TmEvent = { date: string; city: string; venue: string };

const API = 'https://app.ticketmaster.com/discovery/v2';
const key = process.env.TICKETMASTER_API_KEY;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

async function get(path: string, params: Record<string, string>) {
  const url = new URL(`${API}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set('apikey', key!);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    // The shared key allows 5 requests per second; stay well below it.
    await sleep(300);
    if (response.status === 429) {
      await sleep(2000);
      continue;
    }
    if (!response.ok) throw new Error(`Ticketmaster answered ${response.status} on ${path}`);
    return (await response.json()) as Record<string, unknown>;
  }
  throw new Error(`Ticketmaster kept rate-limiting ${path}`);
}

/** All French events of every attraction whose name matches exactly (accents and case ignored). */
async function ticketmasterShows(name: string, window: Dataset['window']) {
  const found = await get('/attractions.json', { keyword: name, locale: '*', size: '20' });
  const attractions = (
    (found._embedded as { attractions?: { id: string; name: string }[] })?.attractions ?? []
  ).filter((attraction) => normalize(attraction.name) === normalize(name));
  const events: TmEvent[] = [];
  for (const attraction of attractions) {
    const page = await get('/events.json', {
      attractionId: attraction.id,
      countryCode: 'FR',
      locale: '*',
      size: '200',
      startDateTime: `${window.from}T00:00:00Z`,
      endDateTime: `${window.to}T23:59:59Z`,
      sort: 'date,asc',
    });
    const list =
      (
        page._embedded as {
          events?: {
            dates?: { start?: { localDate?: string } };
            _embedded?: { venues?: { name?: string; city?: { name?: string } }[] };
          }[];
        }
      )?.events ?? [];
    for (const event of list) {
      const venue = event._embedded?.venues?.[0];
      if (event.dates?.start?.localDate)
        events.push({
          date: event.dates.start.localDate,
          city: venue?.city?.name ?? '',
          venue: venue?.name ?? '',
        });
    }
  }
  return { attractions: attractions.length, events };
}

async function main() {
  if (!key) throw new Error('Add TICKETMASTER_API_KEY to .env.local first (see README).');
  const data = JSON.parse(
    readFileSync(new URL('../docs/coverage-audit-fr.public.json', import.meta.url), 'utf8'),
  ) as Dataset;
  const rows: string[] = [];
  let announced = 0,
    covered = 0;
  for (const artist of data.artists) {
    const tm = await ticketmasterShows(artist.name, data.window);
    // One artist rarely plays two French shows on the same day, so the date identifies the show.
    const tmDates = new Set(tm.events.map((event) => event.date));
    const publicDates = new Set(artist.shows.map((show) => show.date));
    const hit = [...publicDates].filter((date) => tmDates.has(date)).length;
    const missing = artist.shows.filter((show) => !tmDates.has(show.date));
    const tmOnly = [...tmDates].filter((date) => !publicDates.has(date)).length;
    announced += publicDates.size;
    covered += hit;
    rows.push(
      `| ${artist.name} | ${artist.genre} | ${tm.attractions ? 'yes' : '**no**'} | ${publicDates.size} | ${hit} | ${publicDates.size ? `${Math.round((hit / publicDates.size) * 100)}%` : 'N/A'} | ${tmOnly} | ${missing
        .slice(0, 4)
        .map((show) => `${show.date} ${show.city}`)
        .join(', ')}${missing.length > 4 ? ` +${missing.length - 4}` : ''} |`,
    );
    console.error(`${artist.name}: ${hit}/${publicDates.size} announced dates on Ticketmaster`);
  }
  const total = announced ? Math.round((covered / announced) * 1000) / 10 : null;
  const report = [
    `# Ticketmaster coverage results (generated ${new Date().toISOString().slice(0, 10)})`,
    '',
    `Window ${data.window.from} → ${data.window.to}, France only, \`locale=*\`. Public dates checked on ${data.checkedOn}.`,
    '',
    `**Coverage: ${covered} of ${announced} announced dates (${total === null ? 'N/A' : `${total}%`}).**`,
    '',
    '| Artist | Genre | TM attraction | Announced | On TM | Coverage | TM-only dates | Missing (first 4) |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    'Matching rule: same artist and same local date. "TM-only dates" are Ticketmaster dates that the public list does not have (new dates, extra shows or packages); they do not change the coverage figure.',
    '',
  ].join('\n');
  writeFileSync(new URL('../docs/coverage-audit-fr.results.md', import.meta.url), report);
  console.log(report);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(`Coverage audit failed: ${message.replace(/apikey=[^&\s]+/gi, 'apikey=[hidden]')}`);
  process.exitCode = 1;
});
