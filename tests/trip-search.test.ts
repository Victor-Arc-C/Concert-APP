import { describe, expect, it } from 'vitest';
import {
  directionsUrl,
  hotelSearchUrl,
  withinSncfTimetableWindow,
} from '../src/domain/trip-search';
import type { AccommodationOption } from '../src/domain/trip-types';

describe('external trip searches', () => {
  it('preserves accented hotel names, actual stay dates and guest count', () => {
    const stay = {
      name: 'Enzo Hôtels Diane & Spa',
      city: 'Amnéville',
      checkIn: '2027-01-20T15:00:00Z',
      checkOut: '2027-01-22T11:00:00Z',
      guests: 2,
    } as AccommodationOption;
    const url = new URL(hotelSearchUrl('Other city', '2027-01-01', stay));
    expect(url.origin).toBe('https://www.booking.com');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ss: 'Enzo Hôtels Diane & Spa, Amnéville',
      checkin: '2027-01-20',
      checkout: '2027-01-22',
      group_adults: '2',
      no_rooms: '1',
      group_children: '0',
    });
  });

  it('searches the destination for one night across month and year boundaries', () => {
    const url = new URL(hotelSearchUrl('Lyon', '2026-12-31'));
    expect(url.searchParams.get('ss')).toBe('Lyon');
    expect(url.searchParams.get('checkout')).toBe('2027-01-01');
  });

  it('wraps the search in the CJ deep link when Booking affiliation is configured', () => {
    const affiliate = 'https://www.dpbolvw.net/click-101898922-15734710';
    const url = new URL(hotelSearchUrl('Saint-Étienne & co', '2026-12-31', null, affiliate));
    expect(`${url.origin}${url.pathname}`).toBe(affiliate);
    expect(url.searchParams.get('sid')).toBe('showbound-hotel');
    const landing = new URL(url.searchParams.get('url')!);
    expect(landing.origin).toBe('https://www.booking.com');
    expect(landing.searchParams.get('ss')).toBe('Saint-Étienne & co');
    expect(landing.searchParams.get('checkout')).toBe('2027-01-01');
    expect(hotelSearchUrl('Lyon', '2026-12-31', null, null)).toMatch(
      /^https:\/\/www\.booking\.com\//,
    );
  });

  it('routes to the venue, with correctly encoded origin and transport mode', () => {
    const url = new URL(directionsUrl('Paris & suburbs', 'Amnéville', 'GALAXIE', 'transit'));
    expect(url.origin).toBe('https://www.google.com');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      api: '1',
      origin: 'Paris & suburbs',
      destination: 'GALAXIE, Amnéville',
      travelmode: 'transit',
    });
  });
});

describe('SNCF overnight timetable window', () => {
  it('requires both outbound and return within N+23', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    expect(withinSncfTimetableWindow('2026-10-29', now)).toBe(true);
    expect(withinSncfTimetableWindow('2026-10-30', now)).toBe(false);
    expect(withinSncfTimetableWindow('2027-01-20', now)).toBe(false);
    expect(withinSncfTimetableWindow('2026-10-06', now)).toBe(false);
    expect(withinSncfTimetableWindow('bad-date', now)).toBe(false);
  });

  it('uses the Paris calendar day, including midnight and DST boundaries', () => {
    const now = new Date('2026-10-06T22:30:00Z');
    expect(withinSncfTimetableWindow('2026-10-29', now)).toBe(true);
    expect(withinSncfTimetableWindow('2026-10-30', now)).toBe(false);
  });
});
