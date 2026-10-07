'use client';
import { useEffect, useState } from 'react';
import { Bus, CarFront, ExternalLink, MapPin, Plane, TrainFront } from 'lucide-react';
import type { TransportComparison } from '@/domain/trip-types';
import { directionsUrl } from '@/domain/trip-search';
import { api } from './context';

const day = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="external-link">
      {children} <ExternalLink size={12} />
    </a>
  );
}

/**
 * The realistic ways to reach the show, best first. Encore shows no estimated price: each link
 * opens the seller's live search, where the real fares are.
 */
export function GettingThere({
  eventId,
  origin,
  city,
  venue,
}: {
  eventId: string;
  origin: string;
  city: string;
  venue: string;
}) {
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
        setState('ready');
      })
      .catch(() => active && setState('failed'));
    return () => {
      active = false;
    };
  }, [eventId]);

  const flight = comparison?.flight ?? null,
    train = comparison?.train ?? null,
    road = comparison?.road ?? null;
  // Without an answer, still offer the searches that work for any distance.
  const showRoad = comparison ? !!road : state === 'failed';
  const best = (mode: TransportComparison['recommended']) =>
    comparison?.recommended === mode && <span className="mode-tag">Best way</span>;

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
              <strong>Plane</strong>
              {best('flight')}
            </div>
            <p className="mode-note">
              {flight.from} → {flight.to} on {day(flight.date)}.
              {flight.landBy
                ? ` Pick a flight landing by ${flight.landBy} local time to make the show, or fly the day before.`
                : ' Fly the day before if the show starts early.'}
            </p>
            <div className="mode-links">
              <Link href={flight.searchUrl}>Live flight prices on Google Flights</Link>
              {flight.omioUrl && <Link href={flight.omioUrl}>Compare flights on Omio</Link>}
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
              <strong>Train</strong>
              {best('train')}
            </div>
            {train.status === 'served' ? (
              <>
                <ul className="route-list">
                  {train.routes.map((route) => (
                    <li key={route.station}>
                      <span>
                        {route.carriers.join(', ')} to <strong>{route.station}</strong>
                      </span>
                      <small>{route.lastMileKm} km from the venue</small>
                      {route.bookingUrl && route.stationCity && (
                        <Link href={route.bookingUrl}>
                          Live times and prices {origin} → {route.stationCity} on Omio
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                <Link href="https://www.sncf-connect.com/">Or book on SNCF Connect</Link>
              </>
            ) : (
              <p className="mode-note">{train.reason}</p>
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
              <strong>Car</strong>
              {best('road')}
            </div>
            <Link href={directionsUrl(origin, city, venue, 'driving')}>
              Driving time, route and tolls on Google Maps
            </Link>
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
                <strong>Coach</strong>
              </div>
              <Link href={road.coachUrl}>
                Live coach times and prices {road.coachRoute} on Omio
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
            <strong>To the venue</strong>
          </div>
          <Link href={directionsUrl(origin, city, venue, 'transit')}>
            Public transport to {venue}
          </Link>
        </div>
      </>
    ),
  });

  return (
    <section className="getting-there" aria-labelledby="getting-there-title">
      <div className="getting-there-head">
        <h2 id="getting-there-title">Getting there</h2>
        <span>
          {origin} → {city}
          {comparison && ` · ${comparison.distanceKm.toLocaleString('en-GB')} km`}
        </span>
      </div>
      {state === 'loading' && <p className="getting-there-status">Finding the best ways there…</p>}
      {state === 'failed' && (
        <p className="getting-there-status">
          Routes could not be loaded. The links below still open each live search.
        </p>
      )}
      <ul className="mode-list">
        {rows
          .sort((a, b) => a.order - b.order)
          .map((row) => (
            <li key={row.mode} className="mode-row" data-mode={row.mode}>
              {row.node}
            </li>
          ))}
      </ul>
      <p className="getting-there-sources">
        Prices come from each seller&apos;s live search; Encore never estimates them. Train routes:
        SNCF Voyageurs open data (ODbL).
      </p>
    </section>
  );
}
