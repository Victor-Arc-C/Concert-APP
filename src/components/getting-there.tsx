'use client';
import { useEffect, useState } from 'react';
import { Bus, CarFront, ExternalLink, MapPin, TrainFront } from 'lucide-react';
import type { FareBand, TransportComparison } from '@/domain/trip-types';
import { directionsUrl } from '@/domain/trip-search';
import { api } from './context';

const euros = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: value % 1 ? 2 : 0,
  }).format(value);
const band = (fare: FareBand) =>
  fare.min === fare.max ? euros(fare.min) : `${euros(fare.min)}–${euros(fare.max)}`;
const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** Every way to get to the show, priced from published sources, side by side. */
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

  const train = comparison?.train,
    car = comparison?.car;
  // One Omio link per arrival town (two carriers to Metz share one route page).
  const omioRoutes =
    train?.status === 'priced'
      ? [
          ...new Map(
            train.fares
              .filter((fare) => fare.bookingUrl && fare.stationCity)
              .map((fare) => [
                fare.stationCity,
                { city: fare.stationCity!, url: fare.bookingUrl! },
              ]),
          ).values(),
        ]
      : [];
  const cheapestTrain =
    train?.status === 'priced'
      ? Math.min(...train.fares.map((fare) => fare.standard?.min ?? Infinity))
      : Infinity;
  return (
    <section className="getting-there" aria-labelledby="getting-there-title">
      <div className="getting-there-head">
        <h2 id="getting-there-title">Getting there</h2>
        <span>
          {origin} → {city} · one way, per person
        </span>
      </div>
      {state === 'loading' && <p className="getting-there-status">Checking published fares…</p>}
      {state === 'failed' && (
        <p className="getting-there-status">
          Fares could not be loaded. The links below still open each seller.
        </p>
      )}
      <ul className="mode-list">
        <li className="mode-row">
          <span className="mode-icon" aria-hidden>
            <TrainFront size={20} />
          </span>
          <div className="mode-body">
            <div className="mode-head">
              <strong>Train</strong>
              {Number.isFinite(cheapestTrain) && (
                <span className="mode-price">from {euros(cheapestTrain)}</span>
              )}
            </div>
            {train?.status === 'priced' ? (
              <>
                <table className="fare-table">
                  <thead>
                    <tr>
                      <th scope="col">Train</th>
                      <th scope="col">Standard</th>
                      <th scope="col">Avantage card</th>
                    </tr>
                  </thead>
                  <tbody>
                    {train.fares.map((fare) => (
                      <tr key={`${fare.carrier}-${fare.station}`}>
                        <th scope="row">
                          {fare.carrier}
                          <small>
                            to {fare.station} · {fare.lastMileKm} km from the venue
                          </small>
                        </th>
                        <td>{fare.standard ? band(fare.standard) : '—'}</td>
                        <td>{fare.avantage ? band(fare.avantage) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mode-note">
                  Price range SNCF publishes for this route, 2nd class. The exact fare depends on
                  the date and how full the train is.
                  {train.dataUpdatedAt && ` Fare table updated ${monthYear(train.dataUpdatedAt)}.`}
                </p>
              </>
            ) : (
              train && <p className="mode-note">{train.reason}</p>
            )}
            <div className="mode-links">
              {omioRoutes.map((route) => (
                <a
                  key={route.url}
                  href={route.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  Times and tickets {origin} → {route.city} on Omio <ExternalLink size={12} />
                </a>
              ))}
              <a
                href="https://www.sncf-connect.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                Exact fares on SNCF Connect <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </li>
        <li className="mode-row">
          <span className="mode-icon" aria-hidden>
            <CarFront size={20} />
          </span>
          <div className="mode-body">
            <div className="mode-head">
              <strong>Car</strong>
              {car?.status === 'estimated' && (
                <span className="mode-price">≈ {euros(car.fuelCost)} fuel</span>
              )}
            </div>
            {car?.status === 'estimated' ? (
              <p className="mode-note">
                About {car.roadKm} km, {car.litres} L at {car.consumptionPer100Km} L/100 km and{' '}
                {euros(car.pricePerLitre)}/L (today&apos;s national E10 average). Tolls and parking
                not included. Split it if you drive together.
              </p>
            ) : (
              car && <p className="mode-note">{car.reason}</p>
            )}
            <a
              href={directionsUrl(origin, city, venue, 'driving')}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Driving route and tolls <ExternalLink size={12} />
            </a>
          </div>
        </li>
        <li className="mode-row">
          <span className="mode-icon" aria-hidden>
            <Bus size={20} />
          </span>
          <div className="mode-body">
            <div className="mode-head">
              <strong>Coach</strong>
              <span className="mode-price muted">Live fares on Omio</span>
            </div>
            <p className="mode-note">
              {comparison?.coach.reason ??
                'Coach fares change with every departure; Omio compares them live.'}
            </p>
            {comparison?.coach.bookingUrl ? (
              <a
                href={comparison.coach.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                Coaches {comparison.coach.route} on Omio <ExternalLink size={12} />
              </a>
            ) : (
              <a
                href="https://www.flixbus.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                Fares on FlixBus <ExternalLink size={12} />
              </a>
            )}
          </div>
        </li>
        <li className="mode-row">
          <span className="mode-icon" aria-hidden>
            <MapPin size={20} />
          </span>
          <div className="mode-body">
            <div className="mode-head">
              <strong>To the venue</strong>
            </div>
            <a
              href={directionsUrl(origin, city, venue, 'transit')}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Public transport to {venue} <ExternalLink size={12} />
            </a>
          </div>
        </li>
      </ul>
      {comparison && (
        <p className="getting-there-sources">
          Sources: SNCF Voyageurs open data (ODbL), French government fuel price feed.
        </p>
      )}
    </section>
  );
}
