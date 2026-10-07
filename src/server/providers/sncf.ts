import type {
  Coordinates,
  TransportMode,
  TransportOption,
  TransportProvider,
  TripSearchContext,
} from '../../domain/trip-types';
import { providerJson } from './http';
import { rateLimit } from '../security';
import { QuoteCache } from './quote-cache';

// SNCF open API (Navitia engine): real train/coach timetables in France and nearby Europe.
// It has no fares, seat inventory or checkout, so results are schedule-only (price null,
// availability 'unknown') and point to SNCF Connect for prices. Docs: https://numerique.sncf.com/startup/api/
const API = 'https://api.sncf.com/v1/coverage/sncf/journeys';
const COVERAGE_TIMEZONE = 'Europe/Paris';
export const SNCF_BOOKING_URL = 'https://www.sncf-connect.com/';

type NavitiaSection = {
  type?: string;
  display_informations?: { commercial_mode?: string; physical_mode?: string; network?: string };
};
type NavitiaJourney = {
  departure_date_time?: string;
  arrival_date_time?: string;
  duration?: number;
  nb_transfers?: number;
  sections?: NavitiaSection[];
};

/** "+01:00" style offset of a time zone at a given instant. */
export function zoneOffset(timeZone: string, instant: number): string {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(new Date(instant))
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-]\d{2}):?(\d{2})?/.exec(name);
  return match ? `${match[1]}:${match[2] ?? '00'}` : '+00:00';
}
function offsetMinutes(offset: string) {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(':').map(Number);
  return sign * (hours * 60 + minutes);
}
/** Instant (ms) of a wall-clock time in a time zone. */
export function wallToInstant(date: string, time: string, timeZone: string): number {
  const asUtc = Date.parse(`${date}T${time}Z`);
  const first = asUtc - offsetMinutes(zoneOffset(timeZone, asUtc)) * 60000;
  return asUtc - offsetMinutes(zoneOffset(timeZone, first)) * 60000;
}
/** Navitia "YYYYMMDDTHHMMSS" wall time ↔ ISO with the coverage offset. */
export function navitiaToIso(value: string, timeZone = COVERAGE_TIMEZONE): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`,
    time = `${match[4]}:${match[5]}:${match[6]}`;
  const instant = wallToInstant(date, time, timeZone);
  return `${date}T${time}${zoneOffset(timeZone, instant)}`;
}
export function instantToNavitia(instant: number, timeZone = COVERAGE_TIMEZONE): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function modeOf(sections: NavitiaSection[]): TransportMode {
  const physical = sections
    .map((section) => section.display_informations?.physical_mode?.toLowerCase() ?? '')
    .join(' ');
  return /\b(autocar|coach|bus)\b/.test(physical) && !/train|rail|tgv/.test(physical)
    ? 'bus'
    : 'train';
}

const cache = new QuoteCache<NavitiaJourney[]>();
const nextDay = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
/** Latest acceptable arrival: 30 minutes before the show starts. */
export const ARRIVAL_MARGIN_MS = 30 * 60000;

export class SncfTransportProvider implements TransportProvider {
  kind = 'live' as const;
  sourceIds = ['sncf'];
  bookingHosts = ['www.sncf-connect.com'];
  name = 'SNCF timetable';
  constructor(
    private apiKey: string,
    private fetcher: typeof fetch = fetch,
  ) {}

  private async journeys(
    from: Coordinates,
    to: Coordinates,
    datetime: string,
    represents: 'arrival' | 'departure',
    now: Date,
  ): Promise<{ at: number; value: NavitiaJourney[] }> {
    const url = new URL(API);
    url.searchParams.set('from', `${from.longitude};${from.latitude}`);
    url.searchParams.set('to', `${to.longitude};${to.latitude}`);
    url.searchParams.set('datetime', datetime);
    url.searchParams.set('datetime_represents', represents);
    url.searchParams.set('count', '3');
    const key = url.toString();
    const hit = cache.get(key, now.getTime());
    if (hit) return hit;
    // The free token allows 5,000 requests a day; keep a margin for retries.
    await rateLimit('sncf-api-day', 4500, 86400);
    const data = (await providerJson(
      key,
      { headers: { Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}` } },
      this.fetcher,
    )) as { journeys?: NavitiaJourney[] };
    const value = (data.journeys ?? []).filter((journey) =>
      (journey.sections ?? []).some((section) => section.type === 'public_transport'),
    );
    return cache.set(key, value, now.getTime());
  }

  async getOptions(
    origin: string,
    destinationCity: string,
    eventDate: string,
    eventLocalTime: string | null,
    now = new Date(),
    context?: TripSearchContext,
  ): Promise<TransportOption[]> {
    if (!context?.origin || !context.venue) return [];
    if (origin.trim().toLowerCase() === destinationCity.trim().toLowerCase()) return [];
    // Arrive one hour before the show (19:00 when the start time is unknown); come back the
    // next morning from 09:00. Times are the coverage's local time (Europe/Paris).
    const show = wallToInstant(
      eventDate,
      eventLocalTime && /^\d{2}:\d{2}(:\d{2})?$/.test(eventLocalTime)
        ? eventLocalTime.length === 5
          ? `${eventLocalTime}:00`
          : eventLocalTime
        : '20:00:00',
      context.eventTimezone || COVERAGE_TIMEZONE,
    );
    const [outbound, inbound] = await Promise.all([
      this.journeys(
        context.origin,
        context.venue,
        instantToNavitia(show - 60 * 60000),
        'arrival',
        now,
      ),
      this.journeys(
        context.venue,
        context.origin,
        instantToNavitia(wallToInstant(nextDay(eventDate), '09:00:00', COVERAGE_TIMEZONE)),
        'departure',
        now,
      ),
    ]);
    const back = inbound.value
      .map((journey) => navitiaToIso(journey.departure_date_time ?? ''))
      .filter((value): value is string => !!value)
      .sort()[0];
    if (!back) return [];
    // Stamp the time the timetable was actually fetched, never the cache read time.
    const observedAt = new Date(Math.min(outbound.at, inbound.at)).toISOString();
    const options: TransportOption[] = [];
    for (const journey of outbound.value) {
      const departureAt = navitiaToIso(journey.departure_date_time ?? '');
      const arrivalAt = navitiaToIso(journey.arrival_date_time ?? '');
      if (!departureAt || !arrivalAt || !journey.duration || journey.duration <= 0) continue;
      if (
        departureAt.slice(0, 10) !== eventDate ||
        Date.parse(arrivalAt) > show - ARRIVAL_MARGIN_MS
      )
        continue;
      const sections = (journey.sections ?? []).filter((s) => s.type === 'public_transport');
      const operators = [
        ...new Set(
          sections
            .map((s) => s.display_informations?.commercial_mode || s.display_informations?.network)
            .filter((value): value is string => !!value),
        ),
      ];
      options.push({
        kind: 'live',
        availability: 'unknown',
        priceComplete: false,
        id: `sncf:${journey.departure_date_time}:${journey.arrival_date_time}:${back}`,
        provider: 'sncf',
        mode: modeOf(sections),
        origin,
        destination: destinationCity,
        departureAt,
        returnAt: back,
        durationMinutes: Math.round(journey.duration / 60),
        changes: Math.max(0, journey.nb_transfers ?? sections.length - 1),
        price: null,
        currency: null,
        observedAt,
        expiresAt: null,
        bookingUrl: SNCF_BOOKING_URL,
        operator: operators.slice(0, 3).join(' + ') || 'SNCF',
      });
    }
    return [...new Map(options.map((option) => [option.id, option])).values()]
      .sort((a, b) => a.durationMinutes - b.durationMinutes)
      .slice(0, 3);
  }
}
