import { z } from 'zod';
import type { Concert } from './types';

export const travelModes = ['TRAIN', 'BUS', 'FLIGHT', 'FERRY'] as const;
export type TravelMode = (typeof travelModes)[number];
export type PlanningFailure =
  | 'unconfigured'
  | 'sample'
  | 'inactive'
  | 'event_date'
  | 'past'
  | 'locations'
  | 'same_city'
  | 'dates'
  | 'invalid_search'
  | 'redirect';

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function knownLocation(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 2 &&
    value.trim().length <= 120 &&
    /\p{L}/u.test(value) &&
    !/[\p{Cc}\p{Cf}]/u.test(value) &&
    !/^(unknown|tba|tbd|n\/a|inconnu|à confirmer)$/i.test(value.trim())
  );
}

const location = z.string().trim().refine(knownLocation);
const date = z.string().refine(validDate);
export const travelSearchSchema = z
  .object({
    departure: location,
    destination: location,
    departureDate: date,
    returnDate: z.union([date, z.literal('')]).optional(),
    travelMode: z.enum(travelModes).optional(),
    locale: z.enum(['en', 'fr']).default('en'),
  })
  .strict();
export type TravelSearch = z.infer<typeof travelSearchSchema>;

// Concert.date is the provider's local calendar date, never a UTC timestamp.
export function planningToday(timezone: string | null, now = new Date()) {
  try {
    if (timezone)
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
  } catch {
    /* Unknown zone: only reject dates that are past everywhere. */
  }
  return new Date(now.getTime() - 12 * 3600000).toISOString().slice(0, 10);
}

export function eventPlanningFailure(event: Concert, now = new Date()): PlanningFailure | null {
  if (event.provider === 'sample') return 'sample';
  if (['cancelled', 'postponed'].includes(event.status)) return 'inactive';
  if (!validDate(event.date)) return 'event_date';
  if (event.date < planningToday(event.timezone, now)) return 'past';
  return null;
}

export function sameLocation(a: string, b: string) {
  const key = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  return !!key(a) && key(a) === key(b);
}

export function searchFailure(search: TravelSearch, today: string): PlanningFailure | null {
  if (!knownLocation(search.departure) || !knownLocation(search.destination)) return 'locations';
  if (sameLocation(search.departure, search.destination)) return 'same_city';
  if (
    !validDate(search.departureDate) ||
    search.departureDate < today ||
    (search.returnDate &&
      (!validDate(search.returnDate) || search.returnDate < search.departureDate))
  )
    return 'dates';
  return null;
}

export type TravelPlanning = {
  provider: 'omio';
  reason: PlanningFailure | null;
  today: string;
  defaults: TravelSearch;
};
export type TravelSearchResult =
  { url: string; reason?: never } | { reason: PlanningFailure; url?: never };

// Search providers produce external search links, not quotes or bookable inventory.
export interface TravelSearchProvider {
  id: 'omio';
  configured(): boolean;
  buildLink(search: TravelSearch): string | null;
}

/** Defence in depth before browser navigation. No arbitrary outbound URL is accepted. */
export function safeOmioRedirect(value: string) {
  try {
    const outer = new URL(value);
    if (
      outer.origin !== 'https://omio.sjv.io' ||
      outer.username ||
      outer.password ||
      outer.hash ||
      !/^\/c\/[1-9]\d{0,19}\/4057579\/7385$/.test(outer.pathname) ||
      [...outer.searchParams.keys()].join(',') !== 'u'
    )
      return false;
    const inner = new URL(outer.searchParams.get('u') ?? '');
    if (
      inner.origin !== 'https://www.omio.com' ||
      inner.username ||
      inner.password ||
      inner.hash ||
      inner.pathname !== '/links/626fa8a9-f982-43d0-ace9-9a13f6b14612'
    )
      return false;
    const allowed = [
      'departurePosTerm',
      'arrivalPosTerm',
      'departureDate',
      'returnDate',
      'travelMode',
      'locale',
      'currency',
    ];
    const keys = [...inner.searchParams.keys()];
    if (keys.some((key) => !allowed.includes(key)) || new Set(keys).size !== keys.length)
      return false;
    const parsed = travelSearchSchema.safeParse({
      departure: inner.searchParams.get('departurePosTerm'),
      destination: inner.searchParams.get('arrivalPosTerm'),
      departureDate: inner.searchParams.get('departureDate'),
      returnDate: inner.searchParams.get('returnDate') ?? undefined,
      travelMode: inner.searchParams.get('travelMode') ?? undefined,
      locale: inner.searchParams.get('locale') ?? undefined,
    });
    return (
      parsed.success &&
      !searchFailure(parsed.data, '0000-01-01') &&
      (!inner.searchParams.has('currency') || inner.searchParams.get('currency') === 'EUR')
    );
  } catch {
    return false;
  }
}
