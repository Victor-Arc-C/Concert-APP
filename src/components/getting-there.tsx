'use client';
import { useEffect, useState } from 'react';
import { Bus, CarFront, ExternalLink, MapPin, Plane, TrainFront } from 'lucide-react';
import type { TransportComparison } from '@/domain/trip-types';
import { directionsUrl } from '@/domain/trip-search';
import { useI18n } from '@/i18n/client';
import { api } from './context';

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="external-link">
      {children} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

/**
 * The realistic ways to reach the show, best first. Showbound shows no estimated price: each link
 * opens the seller's live search, where the real fares are.
 */
export function GettingThere({
  eventId,
  origin,
  city,
  venue,
  timeZone,
  onFlightFare,
  onComparison,
}: {
  eventId: string;
  origin: string;
  city: string;
  venue: string;
  /** The concert's timezone, to show the landing time as local time there. */
  timeZone?: string | null;
  /** Hands the flight fare to the trip total. */
  onFlightFare?: (fare: NonNullable<TransportComparison['flight']>['fare']) => void;
  /** Hands the whole comparison to the itinerary, so its transport step matches. */
  onComparison?: (comparison: TransportComparison | null) => void;
}) {
  const { t, f, s, city: place } = useI18n();
  const [comparison, setComparison] = useState<TransportComparison | null>(null),
    [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    let active = true;
    api<{ comparison: TransportComparison | null }>(
      `trips/compare?eventId=${encodeURIComponent(eventId)}`,
    )
      .then((result) => {
        if (!active) return;
        setComparison(result.comparison);
        onFlightFare?.(result.comparison?.flight?.fare ?? null);
        onComparison?.(result.comparison);
        setState('ready');
      })
      .catch(() => active && setState('failed'));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the callbacks are setters
  }, [eventId]);

  const flight = comparison?.flight ?? null,
    train = comparison?.train ?? null,
    road = comparison?.road ?? null,
    google = flight?.fare?.source === 'google';
  // Without an answer, still offer the searches that work for any distance.
  const showRoad = comparison ? !!road : state === 'failed';
  const best = (mode: TransportComparison['recommended']) =>
    comparison?.recommended === mode && <span className="mode-tag">{t.getThere.bestWay}</span>;

  const rows: { mode: string; order: number; node: React.ReactNode }[] = [];
  if (flight)
    rows.push({
      mode: 'flight',
      order: comparison?.recommended === 'flight' ? 0 : 2,
      node: (
        <>
          <span className="mode-icon" aria-hidden>
            <Plane size={20} />
          </span>
          <div className="mode-body">
            <div className="mode-head">
              <strong>{t.getThere.plane}</strong>
              {best('flight')}
              {flight.fare && (
                <span className="mode-price">{f.money(flight.fare.price, 'EUR')}</span>
              )}
            </div>
            {flight.fare && (
              <div className="fare-found">
                <p>
                  <strong>
                    {[flight.fare.airline, flight.fare.flightNumber].filter(Boolean).join(' ')}
                  </strong>{' '}
                  {t.getThere.flightTimes(
                    flight.fare.departureAt.slice(11, 16),
                    flight.fare.arrivalAt
                      ? new Intl.DateTimeFormat('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: timeZone || undefined,
                        }).format(new Date(flight.fare.arrivalAt))
                      : null,
                    flight.fare.transfers,
                  )}
                </p>
                <small>
                  {flight.fareOnTime === false || flight.fareOnTime === null
                    ? google
                      ? t.getThere.fareLandingUnknownGoogle
                      : t.getThere.fareLandingUnknown
                    : google
                      ? t.getThere.fareSeenGoogle
                      : t.getThere.fareSeen}
                </small>
                <Link href={flight.fare.bookingUrl}>
                  {google ? t.getThere.bookFlightGoogle : t.getThere.bookFlight}
                </Link>
              </div>
            )}
            <p className="mode-note">
              {t.getThere.flightNote(
                place(flight.from),
                place(flight.to),
                f.dayMonth(flight.date),
                flight.landBy,
              )}
            </p>
            <div className="mode-links">
              {!google && <Link href={flight.searchUrl}>{t.getThere.googleFlights}</Link>}
              {flight.omioUrl && <Link href={flight.omioUrl}>{t.getThere.omioFlights}</Link>}
            </div>
          </div>
        </>
      ),
    });
  if (train)
    rows.push({
      mode: 'train',
      order: comparison?.recommended === 'train' ? 0 : 1,
      node: (
        <>
          <span className="mode-icon" aria-hidden>
            <TrainFront size={20} />
          </span>
          <div className="mode-body">
            <div className="mode-head">
              <strong>{t.getThere.train}</strong>
              {best('train')}
            </div>
            {train.status !== 'none' ? (
              <>
                {train.status === 'connection' && (
                  <p className="mode-note">
                    {t.getThere.changeAt(place(origin), place(train.via))}
                  </p>
                )}
                <ul className="route-list">
                  {train.routes.map((route) => {
                    const [carriers, to] = t.getThere.routeTo(
                      route.carriers.join(', '),
                      route.station,
                    );
                    return (
                      <li key={route.station}>
                        <span>
                          {carriers}
                          {to}
                          <strong>{route.station}</strong>
                        </span>
                        <small>{t.getThere.fromVenue(f.number(route.lastMileKm))}</small>
                        {route.bookingUrl && route.stationCity && (
                          <Link href={route.bookingUrl}>
                            {t.getThere.omioTrain(place(origin), route.stationCity)}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Link href="https://www.sncf-connect.com/">{t.getThere.sncf}</Link>
              </>
            ) : (
              <p className="mode-note">{s(train.reason)}</p>
            )}
          </div>
        </>
      ),
    });
  if (showRoad) {
    rows.push({
      mode: 'car',
      order: comparison?.recommended === 'road' ? 0 : 3,
      node: (
        <>
          <span className="mode-icon" aria-hidden>
            <CarFront size={20} />
          </span>
          <div className="mode-body">
            <div className="mode-head">
              <strong>{t.getThere.car}</strong>
              {best('road')}
            </div>
            <Link href={directionsUrl(origin, city, venue, 'driving')}>{t.getThere.driving}</Link>
          </div>
        </>
      ),
    });
    if (road?.coachUrl)
      rows.push({
        mode: 'coach',
        order: 4,
        node: (
          <>
            <span className="mode-icon" aria-hidden>
              <Bus size={20} />
            </span>
            <div className="mode-body">
              <div className="mode-head">
                <strong>{t.getThere.coach}</strong>
              </div>
              <Link href={road.coachUrl}>
                {t.getThere.omioCoach(road.coachRoute ?? `${place(origin)} → ${place(city)}`)}
              </Link>
            </div>
          </>
        ),
      });
  }
  rows.push({
    mode: 'venue',
    order: 9,
    node: (
      <>
        <span className="mode-icon" aria-hidden>
          <MapPin size={20} />
        </span>
        <div className="mode-body">
          <div className="mode-head">
            <strong>{t.getThere.venue}</strong>
          </div>
          <Link href={directionsUrl(origin, city, venue, 'transit')}>
            {t.getThere.transit(venue)}
          </Link>
        </div>
      </>
    ),
  });

  return (
    <section className="getting-there" aria-labelledby="getting-there-title">
      <div className="getting-there-head">
        <h2 id="getting-there-title">{t.getThere.title}</h2>
        <span>
          {place(origin)} → {place(city)}
          {comparison && ` · ${f.number(comparison.distanceKm)} km`}
        </span>
      </div>
      {state === 'loading' && <p className="getting-there-status">{t.getThere.loading}</p>}
      {state === 'failed' && <p className="getting-there-status">{t.getThere.failed}</p>}
      <ul className="mode-list">
        {rows
          .sort((a, b) => a.order - b.order)
          .map((row, i) => (
            <li
              key={row.mode}
              className="mode-row"
              data-mode={row.mode}
              style={{ '--i': i } as React.CSSProperties}
            >
              {row.node}
            </li>
          ))}
      </ul>
      <p className="getting-there-sources">{t.getThere.sources}</p>
    </section>
  );
}
