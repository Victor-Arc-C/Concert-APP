'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BedDouble,
  Bookmark,
  Bus,
  ChevronLeft,
  Compass,
  ExternalLink,
  Plane,
  TrainFront,
  Ticket,
} from 'lucide-react';
import type { SavedTrip, TransportComparison, TripOption } from '@/domain/trip-types';

type FlightFare = NonNullable<NonNullable<TransportComparison['flight']>['fare']>;
import { currentTripView, scheduleOnly } from '@/domain/trip-safety';
import { tripSourceLabel } from '@/domain/trip-sources';
import { assignTripLabels, knownTripCost } from '@/domain/trip-scoring';
import { hotelSearchUrl, withinSncfTimetableWindow } from '@/domain/trip-search';
import { useI18n } from '@/i18n/client';
import { api, useApp } from './context';
import { GettingThere } from './getting-there';
import { gelFor } from './stage/gel';
import { useCue } from './stage/rig';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Building the night: a follow spot walks down the cue sheet (ticket, travel, bed) and leaves
 * each step lit. Runs again whenever another plan is chosen.
 */
function useCueSheet(key: string | null) {
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = sheet.current;
    if (!list || !key) return;
    const steps = [...list.querySelectorAll<HTMLElement>('.trip-step')];
    const follow = list.querySelector<HTMLElement>('.cue-follow');
    steps.forEach((step) => step.classList.remove('lit'));
    if (reduced() || !follow) {
      steps.forEach((step) => step.classList.add('lit'));
      return;
    }
    let cancelled = false;
    const animations: Animation[] = [];
    (async () => {
      for (const [n, step] of steps.entries()) {
        if (cancelled) return;
        follow.style.setProperty('--c', getComputedStyle(step).getPropertyValue('--c'));
        follow.style.height = `${step.offsetHeight}px`;
        const move = follow.animate(
          [
            {
              transform: `translateY(${n ? steps[n - 1].offsetTop : step.offsetTop - 30}px)`,
              opacity: n ? 1 : 0,
            },
            { transform: `translateY(${step.offsetTop}px)`, opacity: 1 },
          ],
          { duration: n ? 380 : 260, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'forwards' },
        );
        animations.push(move);
        await move.finished.catch(() => {});
        if (cancelled) return;
        step.classList.add('lit');
        await new Promise((resolve) => setTimeout(resolve, 160));
      }
      if (!cancelled)
        animations.push(
          follow.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards' }),
        );
    })();
    return () => {
      cancelled = true;
      animations.forEach((a) => a.cancel());
      steps.forEach((step) => step.classList.add('lit'));
    };
  }, [key]);
  return sheet;
}

export function TripPlanner({ eventId }: { eventId: string }) {
  const { data, act, busy } = useApp();
  const { t, f, s, city } = useI18n();
  useCue('trips');
  const [options, setOptions] = useState<TripOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [flightFare, setFlightFare] = useState<FlightFare | null>(null);
  const [comparison, setComparison] = useState<TransportComparison | null>(null);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const event = data?.allEvents.find((e) => e.id === eventId);
  const savedTrips = data?.savedTrips ?? [];

  useEffect(() => {
    let active = true;
    fetch(`/api/trips?eventId=${encodeURIComponent(eventId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(t.trips.loadFailed);
        return res.json();
      })
      .then((result) => {
        if (active) {
          const opts: TripOption[] = result.options || [];
          setOptions(opts);
          setClock(new Date());
          if (opts.length > 0) setSelectedOptionId(opts[0].id);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : t.trips.loadFailed);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [eventId, data?.user?.mode, revision, t.trips.loadFailed]);

  const visibleOptions = event
    ? assignTripLabels(
        options.map((option) => currentTripView(option, clock)),
        clock,
      )
    : [];
  const selectedTrip = visibleOptions.find((o) => o.id === selectedOptionId) || visibleOptions[0];
  const sheet = useCueSheet(!loading && !error && selectedTrip ? selectedTrip.id : null);

  if (!event) {
    return (
      <div className="trip-container">
        <Link href="/app" className="back-link">
          <ChevronLeft size={16} aria-hidden="true" /> {t.trips.back}
        </Link>
        <p>{t.trips.notFound}</p>
      </div>
    );
  }

  // A flight fare found for the concert day stands in for the transport price when the plan
  // itself has none (timetables carry no fare).
  const flightTransport =
    flightFare &&
    !(selectedTrip?.transport?.price != null && selectedTrip.transportState === 'ready')
      ? {
          transport: {
            price: flightFare.price,
            currency: flightFare.currency,
            priceComplete: true,
          },
          transportState: 'ready',
        }
      : {};
  const known = selectedTrip ? knownTripCost({ ...selectedTrip, ...flightTransport }) : null!;
  const travelExpired = selectedTrip?.transportState === 'stale';
  const stayExpired = selectedTrip?.accommodationState === 'stale';
  const externalSearchAllowed =
    event.provider !== 'sample' &&
    !['cancelled', 'postponed'].includes(event.status) &&
    event.date >= clock.toISOString().slice(0, 10);
  const origin = data?.user?.preferences.home ?? 'Paris';
  const atHome = origin.trim().toLowerCase() === event.city.trim().toLowerCase();
  // Far away, or no train at all: the SNCF timetable window is beside the point.
  const flightPlan = comparison?.recommended === 'flight' ? comparison.flight : null;
  const noTrain = !!comparison && (!comparison.train || comparison.train.status === 'none');
  const travelMessage = atHome
    ? t.trips.homeCityTravel
    : noTrain
      ? t.trips.compareAbove
      : !withinSncfTimetableWindow(event.date, clock)
        ? t.trips.sncfWindow
        : t.trips.noTimetable;
  const checkAgain = () => {
    setLoading(true);
    setError(null);
    setRevision((r) => r + 1);
  };
  const isSaved = savedTrips.some(
    (st) => st.eventId === event.id && st.tripOptionId === selectedTrip?.id,
  );
  const money = (amount: number | null | undefined, currency: string | null | undefined) =>
    f.money(amount, currency) ?? t.common.priceNotListed;
  const label = (value: string | null | undefined) =>
    value ? (t.trips.labels[value] ?? s(value)) : null;

  const handleSaveToggle = async () => {
    if (!selectedTrip) return;
    if (isSaved) {
      await act(
        'trips/delete',
        { eventId: event.id, tripOptionId: selectedTrip.id },
        t.trips.removedToast,
      );
    } else {
      await act(
        'trips/save',
        { eventId: event.id, tripOptionId: selectedTrip.id },
        t.trips.savedToast,
      );
    }
  };

  const nights = (checkIn: string, checkOut: string) =>
    Math.round((Date.parse(checkOut.slice(0, 10)) - Date.parse(checkIn.slice(0, 10))) / 86400000);

  return (
    <div className="trip-planner" style={{ '--gel': gelFor(event.artist) } as React.CSSProperties}>
      <header className="trip-head">
        <Link href={`/app/events/${event.id}`} className="back-link" transitionTypes={['nav-back']}>
          <ChevronLeft size={16} aria-hidden="true" /> {t.trips.backToDetail}
        </Link>
        <h1>{t.trips.title(event.artist, city(event.city))}</h1>
        <p className="trip-subtitle">
          <span className="trip-badge">{t.trips.badge}</span>
          <span>
            {event.venue} · {f.dateLong(event.date)} · {t.trips.fromHome(city(origin))}
          </span>
        </p>
        {selectedTrip?.mode === 'sample' && <p className="step-source">{t.trips.sampleTrip}</p>}
      </header>

      {externalSearchAllowed && !atHome && (
        <GettingThere
          eventId={event.id}
          origin={origin}
          city={event.city}
          venue={event.venue}
          timeZone={event.timezone}
          onFlightFare={setFlightFare}
          onComparison={setComparison}
        />
      )}

      {loading && (
        <div className="trip-loading" role="status">
          <span className="ring is-waiting" aria-hidden="true" />
          <p>{t.trips.loading}</p>
        </div>
      )}

      {error && !loading && (
        <div className="trip-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <p>{error}</p>
          <button className="button secondary compact" onClick={checkAgain}>
            {t.trips.checkAgain}
          </button>
        </div>
      )}

      {!loading && (error || options.length === 0) && externalSearchAllowed && (
        <div className="trip-empty">
          <h2>{t.trips.findTitle}</h2>
          <p>{travelMessage}</p>
          <a
            href={hotelSearchUrl(event.city, event.date, null, data.bookingAffiliateUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            {t.trips.searchHotels} <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      )}

      {!loading && !error && options.length === 0 && !externalSearchAllowed && (
        <div className="trip-empty">
          <p>
            {['cancelled', 'postponed'].includes(event.status)
              ? t.trips.suppressed
              : t.trips.noCombos}
          </p>
        </div>
      )}

      {!loading && !error && options.length > 0 && selectedTrip && (
        <div className="trip-layout">
          <div className="trip-options-selector">
            <span className="section-label" id="plans-label">
              {visibleOptions.length === 1 ? t.trips.availablePlan : t.trips.compare}
            </span>
            <div className="option-pill-group" role="group" aria-labelledby="plans-label">
              {visibleOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedOptionId(opt.id)}
                  aria-pressed={opt.id === selectedTrip.id}
                  className="option-pill"
                >
                  <div className="pill-top">
                    <span className="pill-mode">
                      {!opt.transport ? (
                        <Compass size={16} aria-hidden="true" />
                      ) : opt.transport.mode === 'train' ? (
                        <TrainFront size={16} aria-hidden="true" />
                      ) : opt.transport?.mode === 'flight' ? (
                        <Plane size={16} aria-hidden="true" />
                      ) : (
                        <Bus size={16} aria-hidden="true" />
                      )}
                      <span className="pill-label">
                        {opt.accommodation ? opt.accommodation.name : t.trips.concertPlan}
                      </span>
                    </span>
                    {opt.label && <span className="pill-tag">{label(opt.label)}</span>}
                  </div>
                  <div className="pill-bottom">
                    <strong>
                      {(() => {
                        const cost = knownTripCost(opt);
                        return cost.sum === null
                          ? t.trips.travelUnavailable
                          : cost.complete
                            ? money(cost.sum, cost.currency)
                            : t.trips.soFar(money(cost.sum, cost.currency));
                      })()}
                    </strong>
                    <small>{opt.transport && f.duration(opt.transport.durationMinutes)}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="trip-sheet">
            <div className="sheet-head">
              <div className="sheet-route">
                <span>
                  {selectedTrip.originCity === selectedTrip.destinationCity
                    ? t.trips.homeLabel(city(selectedTrip.destinationCity))
                    : `${city(selectedTrip.originCity)} → ${city(selectedTrip.destinationCity)}`}
                </span>
                <span>{f.dateLong(selectedTrip.eventDate)}</span>
                {selectedTrip.label && (
                  <span className="highlight-tag">{label(selectedTrip.label)}</span>
                )}
              </div>
              <button
                className="button secondary compact"
                disabled={busy || travelExpired || stayExpired}
                onClick={handleSaveToggle}
              >
                <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                {isSaved ? t.trips.tripSaved : t.trips.saveTrip}
              </button>
            </div>

            <div className="cue-sheet" ref={sheet}>
              <span className="cue-follow" aria-hidden="true" />
              <ol className="cue-steps">
                <li className="trip-step" style={{ '--c': 'var(--rose)' } as React.CSSProperties}>
                  <span>
                    <span className="step-icon">
                      <Ticket size={20} aria-hidden="true" />
                    </span>
                    <span className="step-q" aria-hidden="true">
                      Q1
                    </span>
                  </span>
                  <div className="step-content">
                    <div className="step-header">
                      <strong>{t.trips.ticket}</strong>
                      <span className="step-price">
                        {money(selectedTrip.ticketPrice, selectedTrip.ticketCurrency)}
                      </span>
                    </div>
                    <p className="step-details">
                      {event.venue} · {city(event.city)} · {f.time(event.localTime) ?? t.common.tba}
                    </p>
                    <span className="step-source">
                      {t.trips.source(
                        s(
                          selectedTrip.ticketProvider
                            ? tripSourceLabel(selectedTrip.ticketProvider)
                            : 'Ticketmaster',
                        ),
                      )}
                      {selectedTrip.ticketPrice === null &&
                        ` · ${selectedTrip.ticketPriceState === 'stale' ? t.trips.priceStale : t.trips.priceNotUpstream}`}
                    </span>
                  </div>
                </li>

                {selectedTrip.transport ? (
                  <li className="trip-step" style={{ '--c': 'var(--cyan)' } as React.CSSProperties}>
                    <span>
                      <span className="step-icon">
                        {selectedTrip.transport.mode === 'flight' ? (
                          <Plane size={20} aria-hidden="true" />
                        ) : selectedTrip.transport.mode === 'bus' ? (
                          <Bus size={20} aria-hidden="true" />
                        ) : (
                          <TrainFront size={20} aria-hidden="true" />
                        )}
                      </span>
                      <span className="step-q" aria-hidden="true">
                        Q2
                      </span>
                    </span>
                    <div className="step-content">
                      <div className="step-header">
                        <strong>{selectedTrip.transport.operator || t.trips.transport}</strong>
                        <span className="step-price">
                          {scheduleOnly(selectedTrip.transport)
                            ? t.trips.timetableOnly
                            : money(selectedTrip.transport.price, selectedTrip.transport.currency)}
                          {!selectedTrip.transport.priceComplete &&
                            !scheduleOnly(selectedTrip.transport) &&
                            ` · ${t.trips.partial}`}
                        </span>
                      </div>
                      <p className="step-details">
                        {t.trips.source(s(tripSourceLabel(selectedTrip.transport.provider)))} ·{' '}
                        {city(selectedTrip.originCity)}{' '}
                        <ArrowRight
                          size={13}
                          style={{ display: 'inline', verticalAlign: 'middle' }}
                          aria-hidden="true"
                        />{' '}
                        {city(selectedTrip.destinationCity)} ·{' '}
                        {f.duration(selectedTrip.transport.durationMinutes)} ·{' '}
                        {selectedTrip.transport.changes === 0
                          ? t.trips.direct
                          : t.trips.changes(selectedTrip.transport.changes)}
                      </p>
                      <span className="step-source">
                        {t.trips.departure(f.clock(selectedTrip.transport.departureAt))} ·{' '}
                        {t.trips.returnAt(f.clock(selectedTrip.transport.returnAt))}
                      </span>
                      {selectedTrip.transport.bookingUrl && (
                        <a
                          href={selectedTrip.transport.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                        >
                          {selectedTrip.transport.provider === 'sncf'
                            ? t.trips.sncfPrices
                            : t.trips.checkBooking}{' '}
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </li>
                ) : (
                  <li className="trip-step" style={{ '--c': 'var(--cyan)' } as React.CSSProperties}>
                    <span>
                      <span className="step-icon">
                        {flightFare || flightPlan ? (
                          <Plane size={20} aria-hidden="true" />
                        ) : (
                          <Compass size={20} aria-hidden="true" />
                        )}
                      </span>
                      <span className="step-q" aria-hidden="true">
                        Q2
                      </span>
                    </span>
                    {flightFare ? (
                      // The cheapest flight landing in time, from Getting there: the same fare the
                      // total adds, so this step never says "no transport" next to its price.
                      <div className="step-content">
                        <div className="step-header">
                          <strong>
                            {t.getThere.plane} ·{' '}
                            {[flightFare.airline, flightFare.flightNumber]
                              .filter(Boolean)
                              .join(' ')}
                          </strong>
                          <span className="step-price">
                            {money(flightFare.price, flightFare.currency)}
                          </span>
                        </div>
                        <p className="step-details">
                          {t.getThere.flightTimes(
                            flightFare.departureAt.slice(11, 16),
                            flightFare.arrivalAt
                              ? new Intl.DateTimeFormat('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: event.timezone || undefined,
                                }).format(new Date(flightFare.arrivalAt))
                              : null,
                            flightFare.transfers,
                          )}
                        </p>
                        <span className="step-source">
                          {flightFare.source === 'google'
                            ? t.getThere.fareSeenGoogle
                            : t.getThere.fareSeen}
                        </span>
                        <a
                          href={flightFare.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                        >
                          {flightFare.source === 'google'
                            ? t.getThere.bookFlightGoogle
                            : t.getThere.bookFlight}{' '}
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </div>
                    ) : flightPlan ? (
                      // Flying is the way, but no price was found for the day yet.
                      <div className="step-content">
                        <div className="step-header">
                          <strong>{t.getThere.plane}</strong>
                        </div>
                        <p className="step-details">
                          {t.getThere.flightNote(
                            city(flightPlan.from),
                            city(flightPlan.to),
                            f.dayMonth(flightPlan.date),
                            flightPlan.landBy,
                          )}
                        </p>
                        <span className="step-source">{t.trips.noFlightFare}</span>
                        <a
                          href={flightPlan.searchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                        >
                          {t.getThere.googleFlights} <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </div>
                    ) : (
                      <div className="step-content">
                        <div className="step-header">
                          <strong>{t.trips.transportOptions}</strong>
                        </div>
                        <p className="step-details">
                          {travelExpired ? t.trips.timetableExpired : travelMessage}
                        </p>
                      </div>
                    )}
                  </li>
                )}

                {selectedTrip.accommodation ? (
                  <li
                    className="trip-step"
                    style={{ '--c': 'var(--amber)' } as React.CSSProperties}
                  >
                    <span>
                      <span className="step-icon">
                        <BedDouble size={20} aria-hidden="true" />
                      </span>
                      <span className="step-q" aria-hidden="true">
                        Q3
                      </span>
                    </span>
                    <div className="step-content">
                      <div className="step-header">
                        <strong>{selectedTrip.accommodation.name}</strong>
                        <span className="step-price">
                          {money(
                            selectedTrip.accommodation.price,
                            selectedTrip.accommodation.currency,
                          )}
                          {!selectedTrip.accommodation.priceComplete &&
                            ` · ${t.trips.excludesTaxes}`}
                        </span>
                      </div>
                      <p className="step-details">
                        {t.trips.nights(
                          nights(
                            selectedTrip.accommodation.checkIn,
                            selectedTrip.accommodation.checkOut,
                          ),
                        )}{' '}
                        ·{' '}
                        {selectedTrip.accommodation.distanceKmToVenue === null
                          ? t.trips.distanceUnknown
                          : t.trips.kmFrom(
                              f.number(selectedTrip.accommodation.distanceKmToVenue),
                              event.venue,
                            )}
                        {selectedTrip.accommodation.board &&
                          ` · ${selectedTrip.accommodation.board}`}
                        {selectedTrip.accommodation.refundable === true &&
                          ` · ${t.trips.freeCancel}`}
                        {selectedTrip.accommodation.refundable === false &&
                          ` · ${t.trips.nonRefundable}`}
                      </p>
                      {selectedTrip.accommodation.verifiedAt && (
                        <span className="step-verified">
                          {t.trips.roomConfirmed(f.clock(selectedTrip.accommodation.verifiedAt))}
                        </span>
                      )}
                      <span className="step-source">
                        {t.trips.source(s(tripSourceLabel(selectedTrip.accommodation.provider)))} ·{' '}
                        {t.trips.checkIn(f.day(selectedTrip.accommodation.checkIn))}
                      </span>
                      {selectedTrip.accommodation.bookingUrl ? (
                        <a
                          href={selectedTrip.accommodation.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                        >
                          {t.trips.bookHotel} <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      ) : externalSearchAllowed ? (
                        <>
                          <a
                            href={hotelSearchUrl(
                              event.city,
                              event.date,
                              selectedTrip.accommodation,
                              data.bookingAffiliateUrl,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="external-link"
                          >
                            {t.trips.findHotel} <ExternalLink size={12} aria-hidden="true" />
                          </a>
                          <p className="trip-search-note">{t.trips.hotelNote}</p>
                        </>
                      ) : null}
                    </div>
                  </li>
                ) : (
                  <li
                    className="trip-step"
                    style={{ '--c': 'var(--amber)' } as React.CSSProperties}
                  >
                    <span>
                      <span className="step-icon">
                        <BedDouble size={20} aria-hidden="true" />
                      </span>
                      <span className="step-q" aria-hidden="true">
                        Q3
                      </span>
                    </span>
                    <div className="step-content">
                      <div className="step-header">
                        <strong>{t.trips.stayUnavailable}</strong>
                      </div>
                      <p className="step-details">
                        {stayExpired || selectedTrip.accommodationState === 'stale'
                          ? t.trips.priceStale
                          : t.trips.noHotelQuote}
                      </p>
                      {externalSearchAllowed && (
                        <a
                          href={hotelSearchUrl(
                            event.city,
                            event.date,
                            null,
                            data.bookingAffiliateUrl,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                        >
                          {t.trips.searchHotels} <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </li>
                )}
              </ol>
            </div>

            <button className="button secondary compact" onClick={checkAgain}>
              {t.trips.checkAgain}
            </button>
            <div className="trip-total">
              <span className="total-label">
                {known.complete ? t.trips.totalLabel : t.trips.knownSoFar}
              </span>
              <div className="total-price">
                {known.sum !== null ? money(known.sum, known.currency) : t.trips.noPriceYet}
              </div>
              <ul className="cost-parts">
                {known.parts.map((part) => (
                  <li key={part.kind} data-missing={part.price === null ? '' : undefined}>
                    <span>{t.trips.costPart[part.kind]}</span>
                    <strong>
                      {part.price !== null
                        ? money(part.price, known.currency ?? undefined) +
                          (part.partial ? ` ${t.trips.partialMark[part.kind]}` : '')
                        : t.trips.costMissing[part.kind]}
                    </strong>
                  </li>
                ))}
              </ul>
              <span className="total-fineprint">
                {selectedTrip.mode === 'sample' ? t.trips.sampleTotal : t.trips.notReservation}
              </span>
              <p className="trip-scores-line">
                <span>{t.trips.musicMatch(selectedTrip.scores.musicFit)}</span>
                <span>
                  {t.trips.convenience(
                    selectedTrip.scores.convenienceScore === null || travelExpired || stayExpired
                      ? t.trips.unavailable
                      : `${selectedTrip.scores.convenienceScore}/100`,
                  )}
                </span>
                <span>
                  {t.trips.value(
                    selectedTrip.estimatedTotal === null
                      ? t.trips.unavailable
                      : `${selectedTrip.scores.costScore}/100`,
                  )}
                </span>
                <span>
                  {t.trips.overall(
                    selectedTrip.scores.overallScore === null ||
                      selectedTrip.estimatedTotal === null ||
                      travelExpired ||
                      stayExpired
                      ? t.trips.unavailable
                      : `${selectedTrip.scores.overallScore}/100`,
                  )}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TripsList() {
  const { data, act, busy } = useApp();
  const { t, f, city } = useI18n();
  useCue('trips');
  // App state never re-queries live travel; this page checks saved plans once on open.
  const [checked, setChecked] = useState<SavedTrip[] | null>(null);
  const hasUnchecked = (data?.savedTrips ?? []).some((t) => t.revalidationStatus === 'unchecked');
  const checking = hasUnchecked && checked === null;
  useEffect(() => {
    if (!hasUnchecked) return;
    let active = true;
    api<{ savedTrips: SavedTrip[] }>('trips/saved')
      .then((result) => {
        if (active) setChecked(result.savedTrips);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [hasUnchecked]);
  // Re-checked rows, but only for plans that still exist (a removed trip disappears at once).
  const current = data?.savedTrips ?? [];
  const savedTrips = checked
    ? checked.filter((trip) => current.some((row) => row.id === trip.id))
    : current;
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="trips-page">
      <header className="page-head">
        <h1>{t.trips.listTitle}</h1>
        <p className="page-intro">{t.trips.listIntro}</p>
      </header>

      {savedTrips.length === 0 ? (
        <div className="empty">
          <span className="empty-light" aria-hidden="true" />
          <h2>{t.trips.emptyTitle}</h2>
          <p>{t.trips.emptyBody}</p>
          <div className="button-row">
            <Link href="/app" className="button primary">
              {t.trips.explore}
            </Link>
          </div>
        </div>
      ) : (
        <div className="saved-trips-grid">
          {savedTrips.map((saved) => {
            const trip = currentTripView(saved.tripData, clock);
            return (
              <article
                key={saved.id}
                className="saved-trip-card"
                style={{ '--gel': gelFor(trip.destinationVenue) } as React.CSSProperties}
              >
                <div className="saved-trip-top">
                  <div>
                    <span className="saved-trip-date">{f.dateWithDay(saved.eventDate)}</span>
                    <h3>{city(trip.destinationCity)}</h3>
                    <p>{trip.destinationVenue}</p>
                  </div>
                  {trip.label && (
                    <span className="pill-tag">{t.trips.labels[trip.label] ?? trip.label}</span>
                  )}
                </div>

                {trip.mode === 'sample' && <p className="step-source">{t.trips.sampleTripShort}</p>}
                {trip.planStatus !== 'active' && (
                  <p>{t.trips.inactive(t.trips.planStatus[trip.planStatus] ?? trip.planStatus)}</p>
                )}
                {saved.revalidationStatus === 'unchecked' && (
                  <p>{checking ? t.trips.checkingCurrent : t.trips.openToCheck}</p>
                )}
                {saved.revalidationStatus === 'legacy' && <p>{t.trips.legacy}</p>}
                <div className="saved-trip-metrics">
                  <div>
                    <small>{t.trips.travel}</small>
                    <span>
                      {trip.transport ? (
                        <>
                          {trip.transport.mode === 'flight' ? (
                            <Plane size={14} aria-hidden="true" />
                          ) : trip.transport.mode === 'bus' ? (
                            <Bus size={14} aria-hidden="true" />
                          ) : (
                            <TrainFront size={14} aria-hidden="true" />
                          )}{' '}
                          {f.duration(trip.transport.durationMinutes)}
                        </>
                      ) : (
                        t.trips.travelUnavailable
                      )}
                    </span>
                  </div>
                  <div>
                    <small>{t.trips.stay}</small>
                    <span>
                      {trip.accommodation
                        ? trip.accommodation.distanceKmToVenue != null
                          ? t.trips.kmToVenue(f.number(trip.accommodation.distanceKmToVenue))
                          : trip.accommodation.name
                        : t.trips.stayUnavailable}
                    </span>
                  </div>
                  <div>
                    <small>{t.trips.estimatedTotal}</small>
                    <strong>
                      {trip.estimatedTotal !== null
                        ? (f.money(trip.estimatedTotal, trip.totalCurrency) ??
                          t.common.priceNotListed)
                        : t.trips.noLongerCurrent}
                    </strong>
                  </div>
                </div>

                <div className="saved-trip-actions">
                  <Link
                    href={`/app/trips/${encodeURIComponent(trip.eventId)}`}
                    className="button secondary compact"
                  >
                    {t.trips.view}
                  </Link>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      act(
                        'trips/delete',
                        { eventId: saved.eventId, tripOptionId: saved.tripOptionId },
                        t.trips.removed,
                      )
                    }
                  >
                    {t.trips.remove}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
