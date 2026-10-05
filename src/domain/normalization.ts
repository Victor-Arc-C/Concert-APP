import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Concert } from './types';
const text = z.string().optional();
export const tmEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.url().optional(),
  dates: z.object({
    start: z.object({
      localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      localTime: text,
      timeTBA: z.boolean().optional(),
      dateTBA: z.boolean().optional(),
      dateTBD: z.boolean().optional(),
    }),
    timezone: text,
    status: z.object({ code: text }).optional(),
  }),
  sales: z
    .object({
      public: z
        .object({
          startDateTime: text,
          startTBD: z.boolean().optional(),
          startTBA: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  priceRanges: z
    .array(z.object({ min: z.number().nonnegative(), currency: z.string() }))
    .optional(),
  _embedded: z
    .object({
      venues: z
        .array(
          z.object({
            name: text,
            city: z.object({ name: text }).optional(),
            country: z.object({ countryCode: text }).optional(),
          }),
        )
        .optional(),
      attractions: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    })
    .optional(),
});
export function normalizeTicketmaster(
  raw: unknown,
  artistId: string,
  attractionId: string,
  artistName: string,
  now = new Date(),
): Concert | null {
  const result = tmEventSchema.safeParse(raw);
  if (!result.success) return null;
  const e = result.data,
    venue = e._embedded?.venues?.[0];
  if (
    e.dates.start.dateTBA ||
    e.dates.start.dateTBD ||
    !e._embedded?.attractions?.some((a) => a.id === attractionId) ||
    !venue?.name ||
    !venue.city?.name ||
    !venue.country?.countryCode
  )
    return null;
  const price = e.priceRanges?.[0];
  const code = e.dates.status?.code;
  return {
    id: `tm-${e.id}`,
    artistIds: [artistId],
    artist: artistName,
    title: e.name,
    venue: venue.name,
    city: venue.city.name,
    country: venue.country.countryCode,
    date: e.dates.start.localDate,
    localTime: e.dates.start.timeTBA ? null : (e.dates.start.localTime ?? null),
    timezone: e.dates.timezone ?? null,
    status:
      code === 'onsale' || code === 'offsale' || code === 'cancelled' || code === 'postponed'
        ? code
        : 'unknown',
    price: price?.min ?? null,
    currency: price?.currency ?? null,
    saleAt:
      e.sales?.public?.startTBD || e.sales?.public?.startTBA
        ? null
        : (e.sales?.public?.startDateTime ?? null),
    provider: 'ticketmaster',
    externalId: e.id,
    url: e.url ? officialTicketUrl(e.url) : null,
    fetchedAt: now.toISOString(),
    image: '/images/stage.jpg',
    genre: 'Live music',
  };
}
export function fingerprint(e: Concert): string {
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  const exact = e.localTime
    ? `${[...e.artistIds].sort().join(',')}|${normalize(e.venue)}|${normalize(e.city)}|${e.country}|${e.date}|${e.localTime}`
    : `${e.provider}|${e.externalId}`;
  return createHash('sha256').update(exact).digest('hex');
}
export function safeTicketUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      [
        'ticketmaster.com',
        'ticketmaster.fr',
        'ticketmaster.co.uk',
        'ticketmaster.nl',
        'ticketmaster.de',
        'ticketmaster.es',
        'ticketmaster.it',
        'ticketmaster.be',
        'ticketmaster.ie',
        'ticketmaster.se',
        'ticketmaster.dk',
        'ticketmaster.no',
        'ticketmaster.ch',
        'ticketmaster.at',
        'ticketmaster.pl',
        'ticketweb.uk',
        'ticketweb.com',
        'universe.com',
      ].some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
    );
  } catch {
    return false;
  }
}

// Some regional listings wrap the seller URL in Ticketmaster's affiliate redirect.
// Extract only a validated official destination; never follow arbitrary redirects.
export function officialTicketUrl(value: string): string | null {
  if (safeTicketUrl(value)) return value;
  try {
    const wrapper = new URL(value);
    if (
      wrapper.protocol !== 'https:' ||
      wrapper.hostname !== 'ticketmaster.evyy.net' ||
      wrapper.username ||
      wrapper.password
    )
      return null;
    const destination = wrapper.searchParams.get('u');
    return destination && safeTicketUrl(destination) ? destination : null;
  } catch {
    return null;
  }
}
