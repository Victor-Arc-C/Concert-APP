'use client';
import { useEffect, useId, useRef, useState, ViewTransition } from 'react';
import Link from 'next/link';
import { Bookmark, Heart, Sparkles, X } from 'lucide-react';
import type { Artist, RankedConcert } from '@/domain/types';
import { useI18n } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import { api, useApp, useOptionalApp } from './context';
import { gelFor, initials } from './stage/gel';
import { useStage } from './stage/rig';

/** The Showbound mark: a moving head, its beam, and the performer in the light. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 26" aria-hidden="true" className={className}>
      <rect x="8" y="1.5" width="10" height="7" rx="2.5" fill="#15122b" />
      <path className="brand-beam" d="M10 8.5 L4 22 H22 L16 8.5 Z" fill="#ff3d7f" />
      <circle cx="13" cy="21" r="3.2" fill="#15122b" />
    </svg>
  );
}

export function Brand({ href = '/' }: { href?: string }) {
  const { t } = useI18n();
  return (
    <Link href={href} className="brand" aria-label={t.common.home}>
      <Mark />
      <span aria-hidden="true">showbound</span>
    </Link>
  );
}

/**
 * An artist photo lit by the artist's gel. Missing or broken photos fall back to the artist's
 * initials on the same gel, so a missing image still looks intentional.
 */
export function ArtistPhoto({
  name,
  image,
  className = '',
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const missing = !image || failed;
  return (
    <span
      className={`photo ${missing ? 'is-missing' : ''} ${className}`}
      style={{ '--gel': gelFor(name) } as React.CSSProperties}
    >
      {image && (
        <img src={image} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
      <span className="photo-fallback" aria-hidden="true">
        {initials(name)}
      </span>
    </span>
  );
}

export function Avatar({ artist, small = false }: { artist: Artist; small?: boolean }) {
  return (
    <ArtistPhoto
      name={artist.name}
      image={artist.image}
      className={`artist-avatar ${small ? 'small' : ''}`}
    />
  );
}

/** View-transition names must be CSS identifiers; provider ids can contain anything. */
export const photoName = (eventId: string) => `photo-${eventId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

export function LanguageSwitch() {
  const { t, locale, setLocale } = useI18n();
  const app = useOptionalApp();
  function choose(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    // Remember it on the account too, so notifications arrive in the same language.
    const user = app?.data.user;
    if (user) void api('preferences', { ...user.preferences, locale: next }).catch(() => {});
  }
  return (
    <div className="language-switch" role="group" aria-label={t.common.language}>
      {(['en', 'fr'] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          aria-label={t.common.languages[code]}
          onClick={() => choose(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
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
  const { t } = useI18n();
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
        <button className="icon-button" onClick={onClose} aria-label={t.common.closeDialog}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-light" aria-hidden="true" />
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}

type Tone = 'go' | 'wait' | 'stop' | 'quiet';
/** One honest status per show. */
export function statusOf(event: RankedConcert): {
  key: 'cancelled' | 'postponed' | 'saleSoon' | 'onsale' | 'offsale' | 'check';
  tone: Tone;
} {
  if (event.status === 'cancelled') return { key: 'cancelled', tone: 'stop' };
  if (event.status === 'postponed') return { key: 'postponed', tone: 'stop' };
  if (event.saleAt && Date.parse(event.saleAt) > Date.now())
    return { key: 'saleSoon', tone: 'wait' };
  if (event.status === 'onsale') return { key: 'onsale', tone: 'go' };
  if (event.status === 'offsale') return { key: 'offsale', tone: 'stop' };
  return { key: 'check', tone: 'quiet' };
}

export function ConcertCard({
  event,
  featured = false,
  source = 'feed',
  trackImpression = false,
  index = 0,
}: {
  event: RankedConcert;
  featured?: boolean;
  source?: 'feed' | 'search' | 'saved';
  trackImpression?: boolean;
  index?: number;
}) {
  const { act, busy, data } = useApp();
  const { t, f, city } = useI18n();
  const stage = useStage();
  const place = city(event.city);
  const card = useRef<HTMLElement>(null);
  const seen = useRef('');
  const userId = data.user?.id;
  const consent = data.user?.preferences.analytics;
  const artist = data.artists.find((a) => a.id === event.artistIds[0]);
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
  const day = f.dayParts(event.date);
  const time = f.time(event.localTime);
  const price = f.money(event.price, event.currency);
  const status = statusOf(event);
  const off = event.status === 'cancelled' || event.status === 'postponed';
  const special =
    event.tier === 'Must see' ? t.card.tiers['Must see'] : favorite ? t.card.favourite : null;
  async function toggle() {
    const saving = !event.saved;
    const done = await act(
      'feedback',
      { eventId: event.id, action: saving ? 'saved' : 'clear', source },
      saving ? t.card.spotlight : t.card.removed,
    );
    if (done && saving) stage.spot(card.current);
  }
  return (
    <article
      ref={card}
      className={`concert-card ${featured ? 'is-next' : ''} ${event.saved ? 'is-saved' : ''} ${off ? 'is-off' : ''} ${event.artist.length > 32 ? 'is-long' : ''}`}
      style={{ '--gel': gelFor(event.artist), '--i': index } as React.CSSProperties}
    >
      <Link
        className="card-image-link"
        href={`/app/events/${event.id}`}
        aria-label={t.card.view(event.artist, place)}
        transitionTypes={['nav-forward']}
      >
        <ViewTransition name={photoName(event.id)} share="photo-morph" default="none">
          <ArtistPhoto name={event.artist} image={artist?.image} />
        </ViewTransition>
        <span className="act-date" aria-hidden="true">
          <b>{day.day}</b>
          <small>{day.month}</small>
        </span>
      </Link>
      <div className="act-body">
        {special && (
          <span className="act-tier">
            {event.tier === 'Must see' ? (
              <Heart size={12} fill="currentColor" />
            ) : (
              <Sparkles size={12} />
            )}
            {special}
          </span>
        )}
        <h2>
          <Link href={`/app/events/${event.id}`} transitionTypes={['nav-forward']}>
            {event.artist}
          </Link>
        </h2>
        <p className="act-when">
          {f.dateWithDay(event.date)}
          {time ? ` · ${time}` : ''}
        </p>
        <p className="act-where">
          {event.venue}, {place}
        </p>
        <div className="act-row">
          {off ? null : price ? (
            <span className="chip">{t.common.fromCapital(price)}</span>
          ) : (
            <span className="chip quiet">{t.common.priceNotListed}</span>
          )}
          <span className="chip" data-tone={status.tone}>
            {status.tone !== 'stop' && status.tone !== 'quiet' && <i aria-hidden="true" />}
            {t.card.status[status.key]}
          </span>
          <button
            className="save-button"
            disabled={busy}
            aria-label={(event.saved ? t.card.unsave : t.card.save)(event.artist, place)}
            data-on={event.saved || undefined}
            onClick={toggle}
          >
            <Bookmark
              size={17}
              strokeWidth={2.4}
              fill={event.saved ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
            <span aria-hidden="true">{event.saved ? t.card.savedShort : t.card.saveShort}</span>
          </button>
        </div>
        {event.provider === 'sample' && featured && (
          <small className="board-sample">{t.card.sampleTag}</small>
        )}
      </div>
    </article>
  );
}
