'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Compass } from 'lucide-react';
import type { Concert } from '@/domain/types';
import {
  knownLocation,
  safeOmioRedirect,
  travelModes,
  type TravelPlanning,
  type TravelSearch,
  type TravelSearchResult,
} from '@/domain/travel-planning';
import { useI18n } from '@/i18n/client';
import { api } from './context';
import { Modal } from './ui';

export function TravelPlanner({ event }: { event: Concert }) {
  const { t, locale } = useI18n();
  const copy = t.travelPlanning;
  const [open, setOpen] = useState(false);
  const [planning, setPlanning] = useState<TravelPlanning | null>(null);
  const [search, setSearch] = useState<TravelSearch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const submitting = useRef(false);

  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!open && generation.current > 0) trigger.current?.focus();
  }, [open]);

  async function load() {
    const current = ++generation.current;
    setOpen(true);
    setPlanning(null);
    setSearch(null);
    setError('');
    setBusy(true);
    try {
      const result = await api<TravelPlanning>('travel/planning/open', { eventId: event.id });
      if (current !== generation.current) return;
      setPlanning(result);
      setSearch({ ...result.defaults, locale });
    } catch {
      if (current === generation.current) setError(copy.networkError);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  function close() {
    generation.current++;
    submitting.current = false;
    setOpen(false);
    setBusy(false);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!search || submitting.current) return;
    const current = generation.current;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api<TravelSearchResult>('travel/planning/search', {
        eventId: event.id,
        search: { ...search, locale },
      });
      if (current !== generation.current) return;
      if (result.reason) setError(copy.failures[result.reason]);
      else if (result.url && safeOmioRedirect(result.url)) window.location.assign(result.url);
      else setError(copy.failures.redirect);
    } catch {
      if (current === generation.current) setError(copy.networkError);
    } finally {
      if (current === generation.current) {
        submitting.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <>
      <button ref={trigger} type="button" className="button secondary full" onClick={load}>
        <Compass size={17} aria-hidden="true" />
        {copy.button}
      </button>
      {open && (
        <Modal
          title={knownLocation(event.city) ? copy.title(event.city) : copy.button}
          onClose={close}
        >
          {busy && !planning && <p role="status">{t.common.loading}</p>}
          {planning?.reason && (
            <p className="form-error" role="status">
              {copy.failures[planning.reason]}
            </p>
          )}
          {planning && search && !planning.reason && (
            <>
              <p className="intro" id="travel-date-note">
                {copy.dateNote(event.date, event.timezone ?? copy.unknownZone)}
              </p>
              <form onSubmit={submit} aria-busy={busy}>
                <label>
                  {copy.departure}
                  <input
                    name="departure"
                    required
                    minLength={2}
                    maxLength={120}
                    value={search.departure}
                    onChange={(e) => setSearch({ ...search, departure: e.target.value })}
                  />
                </label>
                <label>
                  {copy.destination}
                  <input
                    name="destination"
                    required
                    minLength={2}
                    maxLength={120}
                    value={search.destination}
                    aria-describedby="travel-destination-note"
                    onChange={(e) => setSearch({ ...search, destination: e.target.value })}
                  />
                </label>
                <p id="travel-destination-note" className="fineprint">
                  {copy.destinationNote}
                </p>
                <div className="two-fields">
                  <label>
                    {copy.departureDate}
                    <input
                      name="departureDate"
                      type="date"
                      required
                      min={planning.today}
                      aria-describedby="travel-date-note"
                      value={search.departureDate}
                      onChange={(e) => setSearch({ ...search, departureDate: e.target.value })}
                    />
                  </label>
                  <label>
                    {copy.returnDate}
                    <input
                      name="returnDate"
                      type="date"
                      min={search.departureDate || planning.today}
                      value={search.returnDate ?? ''}
                      onChange={(e) => setSearch({ ...search, returnDate: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  {copy.travelMode}
                  <select
                    name="travelMode"
                    value={search.travelMode ?? ''}
                    onChange={(e) =>
                      setSearch({
                        ...search,
                        travelMode: (e.target.value as TravelSearch['travelMode']) || undefined,
                      })
                    }
                  >
                    <option value="">{copy.allModes}</option>
                    {travelModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {copy.modes[mode]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="fineprint">{copy.disclosure}</p>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="button primary full" disabled={busy}>
                  {busy ? t.common.oneMoment : copy.continue}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </button>
              </form>
            </>
          )}
          {!planning && error && (
            <>
              <p className="form-error" role="alert">
                {error}
              </p>
              <button type="button" className="button secondary" onClick={load}>
                {t.common.tryAgain}
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
