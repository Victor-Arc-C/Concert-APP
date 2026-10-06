'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Compass,
  TrainFront,
  BedDouble,
  Ticket,
  Sparkles,
  ArrowRight,
  Bookmark,
  ExternalLink,
  ChevronLeft,
  AlertCircle,
  Bus,
  Plane,
} from 'lucide-react';
import type { TripOption } from '@/domain/trip-types';
import { currentTripView } from '@/domain/trip-safety';
import { assignTripLabels } from '@/domain/trip-scoring';
import { useApp } from './context';
import { money, dateLabel } from './ui';

export function TripPlanner({ eventId }: { eventId: string }) {
  const { data, act, busy } = useApp();
  const [options, setOptions] = useState<TripOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
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
        if (!res.ok) throw new Error('Could not calculate trip options for this show.');
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
          setError(err instanceof Error ? err.message : 'Error generating trip.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [eventId, data?.user?.mode, revision]);

  if (!event) {
    return (
      <div className="trip-container">
        <Link href="/app" className="back-link">
          <ChevronLeft size={16} /> Back to concerts
        </Link>
        <p>Concert not found.</p>
      </div>
    );
  }

  const visibleOptions = assignTripLabels(
    options.map((option) => currentTripView(option, clock)),
    clock,
  );
  const selectedTrip = visibleOptions.find((o) => o.id === selectedOptionId) || visibleOptions[0];
  const travelExpired = selectedTrip?.transportState === 'stale';
  const stayExpired = selectedTrip?.accommodationState === 'stale';
  const checkAgain = () => {
    setLoading(true);
    setError(null);
    setRevision((r) => r + 1);
  };
  const isSaved = savedTrips.some(
    (st) => st.eventId === event.id && st.tripOptionId === selectedTrip?.id,
  );

  const handleSaveToggle = async () => {
    if (!selectedTrip) return;
    if (isSaved) {
      await act(
        'trips/delete',
        { eventId: event.id, tripOptionId: selectedTrip.id },
        'Trip plan removed from Trips',
      );
    } else {
      await act(
        'trips/save',
        { eventId: event.id, tripOptionId: selectedTrip.id },
        'Trip plan saved to Trips',
      );
    }
  };

  return (
    <div className="trip-planner">
      <div className="trip-header">
        <Link href={`/app/events/${event.id}`} className="back-link">
          <ChevronLeft size={16} /> Back to concert detail
        </Link>
        <div className="trip-title-row">
          <div>
            <span className="trip-badge">Trip Intelligence</span>
            {selectedTrip?.mode === 'sample' && (
              <p className="step-source">
                Sample trip — all travel, stays, prices and distances are fictional.
              </p>
            )}
            <h1>
              {event.artist} in {event.city}
            </h1>
            <p className="trip-subtitle">
              {event.venue} · {dateLabel(event.date, true)} · From{' '}
              {data?.user?.preferences.home ?? 'Paris'}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="trip-loading">
          <Sparkles className="spin-slow" size={24} />
          <p>Calculating route options, transport timings and venue stays…</p>
        </div>
      )}

      {error && !loading && (
        <div className="trip-error">
          <AlertCircle size={20} />
          <p>{error}</p>
          <button className="button secondary compact" onClick={checkAgain}>
            Check again
          </button>
        </div>
      )}

      {!loading && !error && options.length === 0 && (
        <div className="trip-empty">
          <p>
            {['cancelled', 'postponed'].includes(event.status)
              ? 'Trip recommendations are suppressed because this show is cancelled or postponed.'
              : 'No verified travel combinations found for your origin and this show.'}
          </p>
        </div>
      )}

      {!loading && !error && options.length > 0 && selectedTrip && (
        <div className="trip-layout">
          {/* Left / Top: Option selection selector pills */}
          <div className="trip-options-selector">
            <span className="section-label">Select itinerary</span>
            <div className="option-pill-group">
              {visibleOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedOptionId(opt.id)}
                  className={`option-pill ${opt.id === selectedTrip.id ? 'active' : ''}`}
                >
                  <div className="pill-top">
                    <span className="pill-mode">
                      {!opt.transport ? (
                        <Compass size={16} />
                      ) : opt.transport.mode === 'train' ? (
                        <TrainFront size={16} />
                      ) : opt.transport?.mode === 'flight' ? (
                        <Plane size={16} />
                      ) : (
                        <Bus size={16} />
                      )}
                      {opt.transport ? opt.transport.mode.toUpperCase() : 'CONCERT PLAN'}
                      {opt.accommodation ? ' + STAY' : ''}
                    </span>
                    {opt.label && <span className="pill-tag">{opt.label}</span>}
                  </div>
                  <div className="pill-bottom">
                    <strong>
                      {opt.estimatedTotal !== null
                        ? money(opt.estimatedTotal, opt.totalCurrency)
                        : 'Est. total pending'}
                    </strong>
                    <small>
                      {opt.transport && (
                        <>
                          {Math.floor(opt.transport.durationMinutes / 60)}h
                          {opt.transport.durationMinutes % 60 > 0
                            ? `${opt.transport.durationMinutes % 60}m`
                            : ''}
                        </>
                      )}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="trip-details-grid">
            {/* Main Itinerary summary card */}
            <div className="trip-breakdown-card">
              <div className="breakdown-header">
                <div>
                  <div className="match-tag">
                    <Sparkles size={14} />
                    <span>{selectedTrip.scores.musicFit}% music match</span>
                  </div>
                  {selectedTrip.label && (
                    <span className="highlight-tag">{selectedTrip.label}</span>
                  )}
                </div>
                <button
                  className="button secondary compact"
                  disabled={busy || travelExpired || stayExpired}
                  onClick={handleSaveToggle}
                >
                  <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} />
                  {isSaved ? 'Trip saved' : 'Save this trip'}
                </button>
              </div>

              {/* 3 Steps: Ticket, Travel, Stay */}
              <div className="trip-steps">
                {/* 1. Ticket Section */}
                <div className="trip-step">
                  <div className="step-icon">
                    <Ticket size={20} />
                  </div>
                  <div className="step-content">
                    <div className="step-header">
                      <strong>Concert Ticket</strong>
                      <span className="step-price">
                        {money(selectedTrip.ticketPrice, selectedTrip.ticketCurrency)}
                      </span>
                    </div>
                    <p className="step-details">
                      {event.venue} · {event.city} ·{' '}
                      {event.localTime ? event.localTime.slice(0, 5) : 'Time TBA'}
                    </p>
                    <span className="step-source">
                      Source:{' '}
                      {selectedTrip.ticketProvider ? selectedTrip.ticketProvider : 'Ticketmaster'}
                      {selectedTrip.ticketPrice === null &&
                        (selectedTrip.ticketPriceState === 'stale'
                          ? ' · Price no longer current'
                          : ' · Price not listed upstream')}
                    </span>
                  </div>
                </div>

                {/* 2. Transport Section */}
                {selectedTrip.transport ? (
                  <div className="trip-step">
                    <div className="step-icon">
                      {selectedTrip.transport.mode === 'flight' ? (
                        <Plane size={20} />
                      ) : selectedTrip.transport.mode === 'bus' ? (
                        <Bus size={20} />
                      ) : (
                        <TrainFront size={20} />
                      )}
                    </div>
                    <div className="step-content">
                      <div className="step-header">
                        <strong>{selectedTrip.transport.operator || 'Transport'}</strong>
                        <span className="step-price">
                          {money(selectedTrip.transport.price, selectedTrip.transport.currency)}
                          {!selectedTrip.transport.priceComplete && ' · Partial quote'}
                        </span>
                      </div>
                      <p className="step-details">
                        Source: {selectedTrip.transport.provider} · {selectedTrip.originCity}{' '}
                        <ArrowRight
                          size={13}
                          style={{ display: 'inline', verticalAlign: 'middle' }}
                        />{' '}
                        {selectedTrip.destinationCity} ·{' '}
                        {Math.floor(selectedTrip.transport.durationMinutes / 60)}h
                        {selectedTrip.transport.durationMinutes % 60 > 0
                          ? `${selectedTrip.transport.durationMinutes % 60}m`
                          : ''}{' '}
                        ·{' '}
                        {selectedTrip.transport.changes === 0
                          ? 'Direct'
                          : `${selectedTrip.transport.changes} change`}
                      </p>
                      <span className="step-source">
                        Departure:{' '}
                        {new Date(selectedTrip.transport.departureAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · Return:{' '}
                        {new Date(selectedTrip.transport.returnAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {selectedTrip.transport.bookingUrl && (
                        <a
                          href={selectedTrip.transport.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                        >
                          Check transport booking <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="trip-step">
                    <Compass size={20} />
                    <div className="step-content">
                      <strong>Travel options unavailable</strong>
                      <p>
                        {travelExpired || selectedTrip.transportState === 'stale'
                          ? 'Price no longer current'
                          : 'Check again when travel options are available.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Stay Section */}
                {selectedTrip.accommodation ? (
                  <div className="trip-step">
                    <div className="step-icon">
                      <BedDouble size={20} />
                    </div>
                    <div className="step-content">
                      <div className="step-header">
                        <strong>{selectedTrip.accommodation.name}</strong>
                        <span className="step-price">
                          {money(
                            selectedTrip.accommodation.price,
                            selectedTrip.accommodation.currency,
                          )}
                          {!selectedTrip.accommodation.priceComplete && ' · Partial quote'}
                        </span>
                      </div>
                      <p className="step-details">
                        {Math.round(
                          (Date.parse(selectedTrip.accommodation.checkOut.slice(0, 10)) -
                            Date.parse(selectedTrip.accommodation.checkIn.slice(0, 10))) /
                            86400000,
                        )}{' '}
                        night ·{' '}
                        {selectedTrip.accommodation.distanceKmToVenue === null
                          ? 'Distance unavailable'
                          : `${selectedTrip.accommodation.distanceKmToVenue} km from ${event.venue}`}
                      </p>
                      <span className="step-source">
                        Source: {selectedTrip.accommodation.provider} · Check-in:{' '}
                        {new Date(selectedTrip.accommodation.checkIn).toLocaleDateString('en-GB')}
                      </span>
                      {selectedTrip.accommodation.bookingUrl && (
                        <a
                          href={selectedTrip.accommodation.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                        >
                          Check accommodation booking <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="trip-step">
                    <BedDouble size={20} />
                    <div className="step-content">
                      <strong>Stay options unavailable</strong>
                      <p>
                        {stayExpired || selectedTrip.accommodationState === 'stale'
                          ? 'Price no longer current'
                          : 'Check again when stay options are available.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button className="button secondary compact" onClick={checkAgain}>
                Check again
              </button>
              {/* Total & Verdict Footer */}
              <div className="trip-footer">
                <div className="trip-total-section">
                  <span className="total-label">Estimated trip total</span>
                  <div className="total-price">
                    {selectedTrip.estimatedTotal !== null
                      ? money(selectedTrip.estimatedTotal, selectedTrip.totalCurrency)
                      : 'Total unavailable — components missing or no longer current'}
                  </div>
                  <span className="total-fineprint">
                    {selectedTrip.mode === 'sample'
                      ? 'Fictional sample itinerary. No booking or availability is offered.'
                      : 'A saved plan is not a reservation. Check current prices and availability with the provider.'}
                  </span>
                </div>
                <div className="trip-scores-bar">
                  <div className="score-item">
                    <small>Convenience</small>
                    <strong>
                      {selectedTrip.scores.convenienceScore === null || travelExpired || stayExpired
                        ? 'Unavailable'
                        : `${selectedTrip.scores.convenienceScore}/100`}
                    </strong>
                  </div>
                  <div className="score-item">
                    <small>Trip Value</small>
                    <strong>
                      {selectedTrip.estimatedTotal === null
                        ? 'Unavailable'
                        : `${selectedTrip.scores.costScore}/100`}
                    </strong>
                  </div>
                  <div className="score-item">
                    <small>Overall</small>
                    <strong className="overall-highlight">
                      {selectedTrip.scores.overallScore === null || travelExpired || stayExpired
                        ? 'Unavailable'
                        : `${selectedTrip.scores.overallScore}/100`}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TripsList() {
  const { data, act, busy } = useApp();
  const savedTrips = data?.savedTrips ?? [];
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="trips-page">
      <div className="page-heading">
        <div>
          <p className="greeting">Your planned journeys</p>
          <h1>Trips</h1>
          <p>Your saved concert itineraries with tickets, transport and stays.</p>
        </div>
      </div>

      {savedTrips.length === 0 ? (
        <div className="empty">
          <Compass size={40} />
          <h2>No saved trips yet.</h2>
          <p>
            When viewing any concert outside your routine, click “Plan this trip” to calculate the
            best transport and stays.
          </p>
          <Link href="/app" className="button primary">
            Explore concerts
          </Link>
        </div>
      ) : (
        <div className="saved-trips-grid">
          {savedTrips.map((saved) => {
            const trip = currentTripView(saved.tripData, clock);
            return (
              <div key={saved.id} className="saved-trip-card">
                <div className="saved-trip-top">
                  <div>
                    <span className="saved-trip-date">{dateLabel(saved.eventDate)}</span>
                    <h3>{trip.destinationCity}</h3>
                    <p>{trip.destinationVenue}</p>
                  </div>
                  {trip.label && <span className="pill-tag">{trip.label}</span>}
                </div>

                {trip.mode === 'sample' && <p className="step-source">Fictional sample trip</p>}
                {trip.planStatus !== 'active' && (
                  <p>Plan inactive: {trip.planStatus.replaceAll('_', ' ')}</p>
                )}
                {saved.revalidationStatus === 'legacy' && (
                  <p>Saved plan retained. Previous quote removed; check again.</p>
                )}
                <div className="saved-trip-metrics">
                  <div>
                    <small>Travel</small>
                    <span>
                      {trip.transport && (
                        <>
                          {trip.transport.mode === 'flight' ? '✈️ ' : '🚆 '}
                          {Math.floor(trip.transport.durationMinutes / 60)}h
                          {trip.transport.durationMinutes % 60 > 0
                            ? `${trip.transport.durationMinutes % 60}m`
                            : ''}
                        </>
                      )}
                      {!trip.transport && 'Travel options unavailable'}
                    </span>
                  </div>
                  <div>
                    <small>Stay</small>
                    <span>
                      {trip.accommodation?.distanceKmToVenue != null
                        ? `${trip.accommodation.distanceKmToVenue}km to venue`
                        : 'Stay options unavailable'}
                    </span>
                  </div>
                  <div>
                    <small>Estimated total</small>
                    <strong>
                      {trip.estimatedTotal !== null
                        ? money(trip.estimatedTotal, trip.totalCurrency)
                        : 'Price no longer current / unavailable'}
                    </strong>
                  </div>
                </div>

                <div className="saved-trip-actions">
                  <Link
                    href={`/app/trips/${encodeURIComponent(trip.eventId)}`}
                    className="button secondary compact"
                  >
                    View itinerary
                  </Link>
                  <button
                    className="text-button compact"
                    disabled={busy}
                    onClick={() =>
                      act(
                        'trips/delete',
                        { eventId: saved.eventId, tripOptionId: saved.tripOptionId },
                        'Trip plan removed',
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
