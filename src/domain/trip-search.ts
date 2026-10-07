import type { AccommodationOption } from './trip-types';

const DAY_MS = 86400000;
export const SNCF_TIMETABLE_DAYS = 23;

export function followingDay(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

// SNCF's published window is -1/N/+23. Both legs of the overnight plan must fit.
// https://numerique.sncf.com/faq/api/
export function withinSncfTimetableWindow(eventDate: string, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const lastDay = Date.parse(`${today}T00:00:00Z`) + SNCF_TIMETABLE_DAYS * DAY_MS;
  const outbound = Date.parse(`${eventDate}T00:00:00Z`);
  return Number.isFinite(outbound) && outbound >= Date.parse(today) && outbound + DAY_MS <= lastDay;
}

// These are external searches, never inventory, quotes, or confirmed availability.
export function directionsUrl(
  origin: string,
  city: string,
  venue: string,
  mode: 'transit' | 'driving',
) {
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination: `${venue}, ${city}`,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

export function hotelSearchUrl(city: string, eventDate: string, stay?: AccommodationOption | null) {
  const params = new URLSearchParams({
    ss: stay ? `${stay.name}, ${stay.city}` : city,
    checkin: stay?.checkIn.slice(0, 10) ?? eventDate,
    checkout: stay?.checkOut.slice(0, 10) ?? followingDay(eventDate),
    group_adults: String(stay?.guests ?? 1),
    no_rooms: '1',
    group_children: '0',
  });
  return `https://www.booking.com/searchresults.html?${params}`;
}
