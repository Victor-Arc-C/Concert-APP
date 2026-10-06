'use client';
import { useEffect, useRef } from 'react';
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
  if (amount === null || !currency) return 'Price not listed';
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
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <div className="modal-heading">
        <h2>{title}</h2>
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
  return (
    <article ref={card} className={`concert-card ${featured ? 'featured' : ''}`}>
      <Link
        className="card-image-link"
        href={`/app/events/${event.id}`}
        aria-label={`View ${event.artist} in ${event.city}`}
      >
        <img
          src={event.image}
          alt=""
          className="concert-image"
          loading={featured ? 'eager' : 'lazy'}
        />
      </Link>
      <div className="image-shade" />
      <span className={`fit-pill ${featured || favorite ? 'warm' : ''}`}>
        <Sparkles size={13} />
        {event.tier === 'Must see'
          ? event.tier
          : favorite
            ? 'Favourite artist'
            : event.tier === 'A favourite, live'
              ? 'Artist you follow'
              : event.tier}
      </span>
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
        <Bookmark size={19} fill={event.saved ? 'currentColor' : 'none'} />
      </button>
      <div className="concert-content">
        <div className="concert-genre">{event.genre}</div>
        <h2>
          <Link href={`/app/events/${event.id}`}>{event.artist}</Link>
        </h2>
        <p className="concert-meta">
          <MapPin size={14} />
          {event.city}
          <span className="meta-separator" />
          {event.venue}
        </p>
        <div className="concert-bottom">
          <div>
            <strong>{dateLabel(event.date)}</strong>
            <span>
              {event.price !== null ? 'From ' : ''}
              {money(event.price, event.currency)}
              {event.provider === 'sample' ? ' · sample' : ''}
            </span>
          </div>
          <Link
            className={featured ? 'button light' : 'round-link'}
            href={`/app/events/${event.id}`}
          >
            {featured ? 'Explore this show' : <ArrowUpRight size={20} />}
            <span className="sr-only">{featured ? '' : `View ${event.artist}`}</span>
            {featured && <ArrowUpRight size={17} />}
          </Link>
        </div>
      </div>
    </article>
  );
}
