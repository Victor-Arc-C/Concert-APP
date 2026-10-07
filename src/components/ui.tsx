'use client';
import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { AudioLines, X, MapPin, Bookmark, ArrowUpRight, Sparkles } from 'lucide-react';
import type { Artist, RankedConcert } from '@/domain/types';
import { api, useApp } from './context';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Encore home">
      <AudioLines strokeWidth={2.5} />
      <span>
        encore<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function Avatar({ artist, small = false }: { artist: Artist; small?: boolean }) {
  return (
    <span
      className={`artist-avatar ${small ? 'small' : ''}`}
      style={{ background: artist.color }}
      aria-hidden={artist.image ? undefined : true}
    >
      {artist.image ? <img src={artist.image} alt="" loading="lazy" /> : artist.initials}
    </span>
  );
}
export function dateLabel(date: string, long = false) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: long ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
export function money(amount: number | null, currency: string | null) {
  if (
    amount === null ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !currency ||
    !/^[A-Z]{3}$/.test(currency)
  )
    return 'Price not listed';
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return 'Price not listed';
  }
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose} aria-labelledby={titleId}>
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <AudioLines />
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
export function ConcertCard({
  event,
  featured = false,
  source = 'feed',
  trackImpression = false,
}: {
  event: RankedConcert;
  featured?: boolean;
  source?: 'feed' | 'search' | 'saved';
  trackImpression?: boolean;
}) {
  const { act, busy, data } = useApp();
  const card = useRef<HTMLElement>(null);
  const seen = useRef('');
  const userId = data.user?.id;
  const consent = data.user?.preferences.analytics;
  const favorite = data.affinities.some(
    (a) => a.favorite && !a.hidden && event.artistIds.includes(a.artistId),
  );
  useEffect(() => {
    const key = `${userId}:${event.id}`;
    if (!trackImpression || !consent || !userId || !card.current || seen.current === key) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.intersectionRatio < 0.5 ||
          document.visibilityState !== 'visible' ||
          seen.current === key
        )
          return;
        seen.current = key;
        void api('analytics', { name: 'concert_impression', eventId: event.id }).catch(() => {});
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [trackImpression, consent, userId, event.id]);
  const when = boardDate(event.date);
  const status = boardStatus(event);
  const via =
    event.tier === 'Must see'
      ? 'Must see'
      : favorite
        ? 'Favourite artist'
        : event.tier === 'A favourite, live'
          ? 'Artist you follow'
          : event.tier;
  return (
    <article ref={card} className={`concert-card board-row ${featured ? 'featured' : ''}`}>
      <Link
        className="card-image-link board-when"
        href={`/app/events/${event.id}`}
        aria-label={`View ${event.artist} in ${event.city}`}
      >
        <span className="board-weekday">{when.weekday}</span>
        <span className="board-day">{when.day}</span>
        <span className="board-month">{when.month}</span>
        <span className="board-time">{event.localTime ? event.localTime.slice(0, 5) : '--:--'}</span>
      </Link>
      <div className="board-what">
        <h2>
          <Link href={`/app/events/${event.id}`}>{event.artist}</Link>
        </h2>
        <p className="board-where">
          <MapPin size={14} aria-hidden="true" />
          <span>
            <strong>{event.city}</strong>
            <span className="meta-separator" aria-hidden="true" />
            {event.venue}
          </span>
        </p>
        <p className="board-via">
          <Sparkles size={13} aria-hidden="true" />
          {via}
        </p>
      </div>
      <div className="board-fare">
        <span className="board-price">
          {event.price !== null && <small>from</small>}
          {money(event.price, event.currency)}
        </span>
        <span className={`board-status ${status.tone}`}>{status.label}</span>
      </div>
      <button
        className={`save-button ${event.saved ? 'saved' : ''}`}
        disabled={busy}
        aria-label={`${event.saved ? 'Unsave' : 'Save'} ${event.artist} in ${event.city}`}
        aria-pressed={event.saved}
        onClick={() =>
          act(
            'feedback',
            { eventId: event.id, action: event.saved ? 'clear' : 'saved', source },
            event.saved ? 'Removed from saved concerts' : 'Concert saved',
          )
        }
      >
        <Bookmark size={18} fill={event.saved ? 'currentColor' : 'none'} />
      </button>
      {featured && (
        <Link className="button primary board-cta" href={`/app/events/${event.id}`}>
          Explore this show
          <ArrowUpRight size={17} />
        </Link>
      )}
    </article>
  );
}
/** Board-style date cells: weekday, day of month and month, read in UTC like dateLabel. */
export function boardDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(value).toUpperCase();
  return {
    weekday: part({ weekday: 'short' }),
    day: part({ day: '2-digit' }),
    month: part({ month: 'short' }),
  };
}
/** One honest status per row, the way a departures board shows on time / delayed / cancelled. */
export function boardStatus(event: RankedConcert): {
  label: string;
  tone: 'go' | 'wait' | 'stop' | 'quiet';
} {
  if (event.provider === 'sample') return { label: 'Sample', tone: 'quiet' };
  if (event.status === 'cancelled') return { label: 'Cancelled', tone: 'stop' };
  if (event.status === 'postponed') return { label: 'Postponed', tone: 'stop' };
  if (event.saleAt && Date.parse(event.saleAt) > Date.now()) return { label: 'Sale soon', tone: 'wait' };
  if (event.status === 'onsale') return { label: 'On sale', tone: 'go' };
  if (event.status === 'offsale') return { label: 'Off sale', tone: 'stop' };
  return { label: 'Check seller', tone: 'quiet' };
}
