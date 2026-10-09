'use client';
import { safeTicketUrl } from '../domain/ticket-links';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState, ViewTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ArrowLeft,
  BedDouble,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  Clock,
  Compass,
  EyeOff,
  Heart,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  TrainFront,
  X,
} from 'lucide-react';
import type { Artist, Intent, Preferences } from '@/domain/types';
import { TravelPlanner } from './travel-planner';
import { CityOptions } from './city-options';
import { groupByArtist } from '@/domain/feed-groups';
import { useI18n } from '@/i18n/client';
import { useApp, api } from './context';
import { ArtistPhoto, Avatar, ConcertCard, Empty, Modal, photoName } from './ui';
import { PreferenceFields } from './onboarding';
import { gelFor } from './stage/gel';
import { useCue } from './stage/rig';

/** Alert bodies carry ISO dates; show them the way the reader writes dates. */
function useAlertText() {
  const { s, f, alertTitle } = useI18n();
  return {
    title: alertTitle,
    body: (body: string) => s(body).replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) => f.dateLong(iso)),
  };
}

export function Feed() {
  const { data, act, busy } = useApp();
  const { t, f, s, city, genre } = useI18n();
  const alertText = useAlertText();
  const [query, setQuery] = useState(''),
    [tab, setTab] = useState<'all' | 'local' | 'away'>('all'),
    [month, setMonth] = useState(''),
    [showAll, setShowAll] = useState(false),
    [pageSize, setPageSize] = useState(8),
    [edit, setEdit] = useState(false);
  useCue(tab === 'local' ? 'home' : tab === 'away' ? 'away' : 'all');
  const followed = data.artists.filter((a) =>
    data.affinities.some((f) => f.artistId === a.id && !f.hidden),
  );
  const home = data.user?.preferences.home ?? 'Paris';
  const searched = data.events.filter(
    (e) =>
      (!query ||
        `${e.artist} ${e.city} ${city(e.city)} ${e.venue}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!month || e.date.startsWith(month)),
  );
  const filtered = searched.filter(
    (e) => (tab !== 'local' || e.city === home) && (tab !== 'away' || e.city !== home),
  );
  const localCount = searched.filter((e) => e.city === home).length;
  // One card per artist (their soonest date), so a long tour never buries the next artist.
  // Their other dates follow in their own section. A search, or "Show all", lists every date.
  const groups = groupByArtist(filtered);
  const flat = showAll || !!query;
  const candidates = flat ? filtered : groups.map((g) => g.next);
  const unique = candidates.slice(0, pageSize);
  const laterDates = flat ? [] : groups.filter((g) => g.later.length > 0);
  const expanded = flat || !!month || tab !== 'all';
  const months = [...new Set(data.events.map((e) => e.date.slice(0, 7)))].sort();
  const scope = data.user?.preferences.scope ?? 'europe';
  const firstName = data.user ? data.user.name.split(' ')[0] : null;
  const alerts = expanded ? [] : data.alerts.filter((a) => !a.read_at).slice(0, 3);
  const cues = [
    { value: 'all' as const, label: t.feed.forYou, count: searched.length, color: 'var(--rose)' },
    {
      value: 'local' as const,
      label: t.feed.local(city(home)),
      count: localCount,
      color: 'var(--amber)',
    },
    {
      value: 'away' as const,
      label: t.feed.away,
      count: searched.length - localCount,
      color: 'var(--cyan)',
    },
  ];
  return (
    <>
      <header className="page-head">
        <h1>{t.feed.title}</h1>
        <p className="page-intro feed-intro">{t.feed.intro(firstName)}</p>
        <div className="page-actions">
          <button
            className="icon-button"
            onClick={() => setEdit(true)}
            aria-label={t.feed.preferences}
            title={t.feed.preferences}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      <p className="feed-meta">
        <span className="live-dot" data-sample={data.user?.mode === 'live' ? undefined : ''}>
          {data.user?.mode === 'live' ? t.feed.live : t.feed.sample}
        </span>
        <span>
          {scope === 'city'
            ? t.feed.scopeCity(city(home))
            : scope === 'country'
              ? t.feed.scopeCountry(city(home))
              : t.feed.scopeEurope(city(home))}
        </span>
      </p>
      <div className="feed-tools">
        <div className="cues" role="group" aria-label={t.feed.filters}>
          {cues.map((cue) => (
            <button
              key={cue.value}
              aria-pressed={tab === cue.value}
              style={{ '--c': cue.color } as React.CSSProperties}
              onClick={() => {
                setTab(cue.value);
                setPageSize(8);
              }}
            >
              <i aria-hidden="true" />
              {cue.label}
              <span>{cue.count}</span>
            </button>
          ))}
        </div>
        <div className="feed-search">
          <label className="search-field">
            <span className="vh">{t.feed.searchLabel}</span>
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPageSize(8);
              }}
              placeholder={t.feed.searchPlaceholder}
              aria-label={t.feed.searchLabel}
              enterKeyHint="search"
            />
          </label>
          <label className="month-field">
            <span className="vh">{t.feed.monthLabel}</span>
            <select
              aria-label={t.feed.monthLabel}
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPageSize(8);
              }}
            >
              <option value="">{t.feed.anyDate}</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {f.month(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="feed-layout">
        <section className="shortlist" aria-labelledby="shows-title">
          <div className="list-head">
            <h2 id="shows-title">
              {t.feed.matching(filtered.length)}
              <span className="list-mode">
                {' '}
                · {showAll ? t.feed.allDates : t.feed.onePerArtist}
              </span>
            </h2>
            {filtered.length > 0 && (
              <button
                className="text-button"
                aria-pressed={showAll}
                onClick={() => {
                  setShowAll(!showAll);
                  setPageSize(8);
                }}
              >
                {showAll ? t.feed.showShortlist : t.feed.showAll(filtered.length)}
              </button>
            )}
          </div>
          {unique.length === 0 ? (
            <Empty
              title={query || month || tab !== 'all' ? t.feed.emptyFiltered : t.feed.emptyNone}
            >
              <p>{data.user?.mode === 'live' ? s(data.providerMessage) : t.feed.emptyHint}</p>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => {
                    setQuery('');
                    setMonth('');
                    setTab('all');
                    setPageSize(8);
                  }}
                >
                  {t.feed.clearFilters}
                </button>
                <Link className="button primary" href="/app/artists">
                  {t.feed.chooseArtists}
                </Link>
                {data.user && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => act('feedback/reset', {}, t.feed.restored)}
                  >
                    {t.feed.restoreDismissed}
                  </button>
                )}
              </div>
            </Empty>
          ) : (
            <div className="acts">
              {/* New alerts sit after the first show, so the first screen opens on a lit card. */}
              {unique.map((e, index) => (
                <Fragment key={e.id}>
                  <ConcertCard
                    event={e}
                    index={index}
                    featured={!expanded && index === 0}
                    source={query ? 'search' : 'feed'}
                    trackImpression
                  />
                  {index === 0 && alerts.length > 0 && (
                    <div className="alert-strip">
                      {alerts.map((a) => (
                        <Link
                          key={a.id}
                          className="alert-ticket"
                          href={`/app/events/${a.event_id}`}
                          onClick={() => act('alerts/read', { id: a.id })}
                        >
                          <span className="alert-bulb" aria-hidden="true" />
                          <span>
                            <strong>{alertText.title(a.title)}</strong>
                            <small>{alertText.body(a.body)}</small>
                          </span>
                          <span className="chip">{t.feed.newBadge}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </Fragment>
              ))}
              {candidates.length > unique.length && (
                <button
                  className="button secondary"
                  onClick={() => setPageSize((size) => size + 8)}
                >
                  {t.feed.showMore}
                </button>
              )}
            </div>
          )}
          {laterDates.length > 0 && (
            <section className="more-dates" aria-labelledby="more-dates-title">
              <h2 id="more-dates-title">{t.feed.moreDates}</h2>
              <ul>
                {laterDates.map((group) => (
                  <li key={group.artistId}>
                    <h3>
                      <Link href={`/app/artists/${group.artistId}`}>{group.next.artist}</Link>
                      <small>{t.feed.laterCount(group.later.length)}</small>
                    </h3>
                    <ul className="date-chips">
                      {group.later.slice(0, 6).map((e) => (
                        <li key={e.id}>
                          <Link href={`/app/events/${e.id}`}>
                            <strong>{f.dateWithDay(e.date)}</strong>
                            <span>{city(e.city)}</span>
                          </Link>
                        </li>
                      ))}
                      {group.later.length > 6 && (
                        <li>
                          <Link href={`/app/artists/${group.artistId}`} className="more-link">
                            {t.feed.allTourDates}
                          </Link>
                        </li>
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
        {followed.length > 0 && (
          <aside className="lineup-panel" aria-labelledby="lineup-title">
            <h2 id="lineup-title">{t.feed.yourArtists}</h2>
            <p>{t.feed.yourArtistsNote}</p>
            <ul className="lineup-list">
              {followed.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link href={`/app/artists/${a.id}`}>
                    <Avatar artist={a} small />
                    <span>
                      <strong>{a.name}</strong>
                      <small>
                        {data.intents.some((i) => i.artistId === a.id)
                          ? t.feed.mustSeeNote
                          : genre(a.genre)}
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="text-button" href="/app/artists">
              {t.feed.fineTune} <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        )}
      </div>
      <section className="callout" aria-labelledby="must-see-title">
        <h2 id="must-see-title">{t.feed.mustSeeTitle}</h2>
        <p>{t.feed.mustSeeBody}</p>
        <Link href="/app/artists" className="button">
          <Heart size={17} aria-hidden="true" />
          {t.feed.mustSeeCta}
        </Link>
      </section>
      {edit && <PreferenceModal onClose={() => setEdit(false)} />}
    </>
  );
}

function PreferenceModal({ onClose }: { onClose: () => void }) {
  const { data, act, busy } = useApp();
  const { t, locale } = useI18n();
  const [prefs, setPrefs] = useState<Preferences>(
    data.user?.preferences ?? {
      home: 'Paris',
      scope: 'europe',
      maxHours: null,
      budget: null,
      notifications: 'important',
      analytics: false,
    },
  );
  return (
    <Modal title={t.prefs.modalTitle} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act('preferences', { ...prefs, locale }, t.prefs.savedTravel)) onClose();
        }}
      >
        <PreferenceFields value={prefs} onChange={setPrefs} />
        <button className="button primary full" disabled={busy}>
          {t.prefs.save}
        </button>
      </form>
    </Modal>
  );
}

export function IntentForm({ artist, onClose }: { artist: Artist; onClose: () => void }) {
  const { data, act, busy } = useApp();
  const { t, city } = useI18n();
  const existing = data.intents.find((i) => i.artistId === artist.id);
  const [intent, setIntent] = useState<Intent>(
    existing ?? {
      artistId: artist.id,
      cities: [data.user?.preferences.home ?? 'Paris'],
      maxPrice: null,
      tickets: 1,
    },
  );
  return (
    <Modal title={t.intent.title(artist.name)} onClose={onClose}>
      <p className="intro">{t.intent.intro}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act('intent', intent, t.intent.added)) onClose();
        }}
      >
        <fieldset>
          <legend>{t.intent.cities}</legend>
          <label>
            {t.intent.addCity}
            <select
              value=""
              disabled={intent.cities.length >= 9}
              onChange={(e) => {
                if (e.target.value)
                  setIntent({ ...intent, cities: [...intent.cities, e.target.value] });
              }}
            >
              <option value="">{t.intent.chooseCity}</option>
              <CityOptions excluded={intent.cities} />
            </select>
          </label>
          <div className="city-chips">
            {intent.cities.map((name) => {
              return (
                <button
                  type="button"
                  key={name}
                  aria-pressed={true}
                  className="city-chip"
                  onClick={() =>
                    setIntent({
                      ...intent,
                      cities: intent.cities.filter((n) => n !== name),
                    })
                  }
                >
                  {city(name)}
                  <X size={14} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="two-fields">
          <label>
            {t.intent.maxPrice}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              placeholder={t.intent.flexible}
              value={intent.maxPrice ?? ''}
              onChange={(e) =>
                setIntent({ ...intent, maxPrice: e.target.value ? Number(e.target.value) : null })
              }
            />
          </label>
          <label>
            {t.intent.tickets}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={8}
              required
              value={intent.tickets}
              onChange={(e) => setIntent({ ...intent, tickets: Number(e.target.value) })}
            />
          </label>
        </div>
        <button className="button primary full" disabled={busy || !intent.cities.length}>
          <Heart size={17} aria-hidden="true" />
          {t.intent.save}
        </button>
        {existing && (
          <button
            className="text-button danger full"
            type="button"
            onClick={async () => {
              if (await act('intent/delete', { artistId: artist.id }, t.intent.removed)) onClose();
            }}
          >
            {t.intent.remove}
          </button>
        )}
      </form>
    </Modal>
  );
}

export function EventDetail({ id }: { id: string }) {
  const { data, act, busy, toast } = useApp(),
    router = useRouter();
  const { t, f, s, city } = useI18n();
  useCue('all');
  const [intent, setIntent] = useState(false);
  const [outbound, setOutbound] = useState(false);
  const opened = useRef('');
  const event = data.allEvents.find((e) => e.id === id),
    artist = data.artists.find((a) => a.id === event?.artistIds[0]);
  useEffect(() => {
    if (data.user && event && opened.current !== event.id) {
      opened.current = event.id;
      void api('analytics', { name: 'concert_opened', eventId: event.id }).catch(() => {});
    }
  }, [data.user, event]);
  if (!event)
    return (
      <Empty title={t.detail.unavailable}>
        <Link className="button primary" href="/app">
          {t.detail.backToShortlist}
        </Link>
      </Empty>
    );
  const home = data.user?.preferences.home ?? 'Paris';
  const ticketDestination =
    event.url && safeTicketUrl(event.url) ? new URL(event.url).hostname : null;
  const tours = data.allEvents
    .filter((e) => e.artistIds.some((id) => event.artistIds.includes(id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.city.localeCompare(b.city));
  const inactive = ['cancelled', 'postponed'].includes(event.status);
  const time = f.time(event.localTime);
  const zone = event.timezone ?? 'Europe/Paris';
  async function ticket() {
    if (!data.user) {
      router.push('/signup');
      return;
    }
    setOutbound(true);
    try {
      const result = await api<{ url: string }>('outbound', { eventId: id });
      window.location.assign(result.url);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setOutbound(false);
    }
  }
  return (
    <>
      <Link className="back-link" href="/app" transitionTypes={['nav-back']}>
        <ArrowLeft size={16} aria-hidden="true" />
        {t.detail.backToShortlist}
      </Link>
      <header
        className="show-hero"
        style={{ '--gel': gelFor(event.artist) } as React.CSSProperties}
      >
        <ViewTransition name={photoName(event.id)} share="photo-morph" default="none">
          <ArtistPhoto name={event.artist} image={artist?.image} className="show-photo" />
        </ViewTransition>
        <div className="show-title">
          <h1>{event.artist}</h1>
          <p className="show-venue">
            {event.venue}, {city(event.city)}
          </p>
        </div>
        <dl className="show-facts">
          {home === event.city ? (
            <div>
              <dt>{t.detail.where}</dt>
              <dd>
                <MapPin size={16} aria-hidden="true" />
                {city(event.city)} · {t.common.homeCity}
              </dd>
            </div>
          ) : (
            <div>
              <dt>{t.detail.fromTo}</dt>
              <dd>
                <MapPin size={16} aria-hidden="true" />
                {city(home)} → {city(event.city)}
              </dd>
            </div>
          )}
          <div>
            <dt>{t.detail.why}</dt>
            <dd>
              <Sparkles size={16} aria-hidden="true" />
              {s(event.tier)}
            </dd>
          </div>
          <div>
            <dt>{t.detail.date}</dt>
            <dd>
              <CalendarDays size={16} aria-hidden="true" />
              {f.dateLong(event.date)}
            </dd>
          </div>
          <div>
            <dt>{t.detail.show}</dt>
            <dd>
              <Clock size={16} aria-hidden="true" />
              {time ? t.detail.localTime(time) : t.detail.timeTba}
            </dd>
          </div>
        </dl>
      </header>
      <div className="detail-layout">
        <div>
          <section className="panel" aria-labelledby="reasons-title">
            <h2 id="reasons-title">{t.detail.reasonsTitle}</h2>
            <ul className="reason-list">
              {event.reasons.map((r, i) => (
                <li key={r} style={{ '--i': i } as React.CSSProperties}>
                  <Check aria-hidden="true" />
                  {s(r)}
                </li>
              ))}
            </ul>
            <p className="fineprint">{t.detail.reasonsNote}</p>
            {artist && (
              <Link href={`/app/artists/${artist.id}`} className="text-button">
                {t.detail.explore(artist.name)} <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            )}
          </section>
          <section className="panel" aria-labelledby="tour-title">
            <h2 id="tour-title">{t.detail.otherDates}</h2>
            <p className="subtle">{t.detail.otherDatesNote}</p>
            <div
              className="tour-table"
              style={{ '--gel': gelFor(event.artist) } as React.CSSProperties}
            >
              <div className="tour-row tour-header">
                <span>{t.detail.cityAndDate}</span>
                <span>{t.detail.ticketFrom}</span>
                <span>{t.detail.tripTotal}</span>
              </div>
              {tours.map((tour) => (
                <Link
                  className={`tour-row ${tour.id === id ? 'current' : ''}`}
                  aria-current={tour.id === id ? 'page' : undefined}
                  key={tour.id}
                  href={`/app/events/${tour.id}`}
                >
                  <span>
                    <strong>{city(tour.city)}</strong>
                    <small>
                      {f.dateShort(tour.date)}
                      {tour.city === home ? ` · ${t.common.homeCity}` : ''}
                    </small>
                  </span>
                  <span>{f.money(tour.price, tour.currency) ?? t.common.priceNotListed}</span>
                  <span className="subtle">{t.common.unknown}</span>
                </Link>
              ))}
            </div>
            <div className="next-steps">
              <div>
                <TrainFront aria-hidden="true" />
                <strong>{t.detail.gettingThere}</strong>
                <span>
                  {t.detail.gettingThereNote}{' '}
                  {!inactive && (
                    <Link href={`/app/trips/${event.id}`} className="text-link">
                      {t.detail.planTrip}
                    </Link>
                  )}
                </span>
              </div>
              <div>
                <BedDouble aria-hidden="true" />
                <strong>{t.detail.stay}</strong>
                <span>
                  {t.detail.stayNote(event.venue)}{' '}
                  {!inactive && (
                    <Link href={`/app/trips/${event.id}`} className="text-link">
                      {t.detail.viewStays}
                    </Link>
                  )}
                </span>
              </div>
            </div>
            <p className="fineprint">{t.detail.nothingConfirmed}</p>
          </section>
        </div>
        <aside className="ticket-panel" aria-label={t.detail.ticketFrom}>
          <span className="ticket-label">
            {event.provider === 'sample' ? t.detail.samplePrice : t.detail.providerPrice}
          </span>
          <div className="ticket-price">
            {f.money(event.price, event.currency) ?? t.common.priceNotListed}
          </div>
          {event.provider !== 'sample' && event.price !== null && event.priceObservedAt && (
            <p className="fineprint">{t.detail.priceObserved(f.dateTime(event.priceObservedAt))}</p>
          )}
          {event.provider !== 'sample' && event.price === null && (
            <p className="fineprint">{t.detail.priceUnavailable}</p>
          )}
          <p className="ticket-status">
            <span
              className="status-light"
              data-tone={
                event.provider === 'sample'
                  ? undefined
                  : event.status === 'onsale'
                    ? 'go'
                    : inactive
                      ? 'stop'
                      : undefined
              }
              aria-hidden="true"
            />
            {event.provider === 'sample'
              ? t.detail.sampleEvent
              : event.status === 'onsale'
                ? t.detail.listedOnSale
                : (t.detail.statusWord[event.status] ?? t.detail.notConfirmed)}
          </p>
          {event.saleAt && <p>{t.detail.sale(f.dateTime(event.saleAt, zone), zone)}</p>}
          <button
            className="button primary full"
            onClick={ticket}
            disabled={outbound || !ticketDestination || event.provider === 'sample' || inactive}
          >
            <Ticket size={18} aria-hidden="true" />
            {event.provider === 'sample'
              ? t.detail.noRealTickets
              : ticketDestination
                ? t.detail.checkTickets(ticketDestination)
                : t.detail.ticketUnavailable}
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <button
            className="button secondary full"
            disabled={busy}
            onClick={() =>
              act(
                'feedback',
                { eventId: id, action: event.saved ? 'clear' : 'saved', source: 'detail' },
                event.saved ? t.card.removed : t.card.saved,
              )
            }
          >
            <Bookmark size={17} fill={event.saved ? 'currentColor' : 'none'} aria-hidden="true" />
            {event.saved ? t.detail.saved : t.detail.save}
          </button>
          <TravelPlanner key={event.id} event={event} />
          {!inactive && (
            <Link
              href={`/app/trips/${event.id}`}
              className="button secondary full"
              transitionTypes={['nav-forward']}
            >
              <Compass size={17} aria-hidden="true" />
              {t.detail.plan}
            </Link>
          )}
          {artist && (
            <button className="text-button full" onClick={() => setIntent(true)}>
              <Heart size={17} aria-hidden="true" />
              {t.detail.mustSee}
            </button>
          )}
          <p className="fineprint">
            {event.provider === 'sample' ? t.detail.sampleNote : t.detail.sourceNote}
          </p>
          <span className="freshness">
            {event.provider === 'sample'
              ? t.detail.sampleCreated(f.day(event.fetchedAt))
              : t.detail.lastChecked(f.day(event.fetchedAt))}
          </span>
          <button
            className="text-button dismiss"
            disabled={busy}
            onClick={async () => {
              if (
                await act(
                  'feedback',
                  { eventId: id, action: 'dismissed', source: 'detail' },
                  t.detail.dismissed,
                )
              )
                router.push('/app');
            }}
          >
            <X size={15} aria-hidden="true" />
            {t.detail.notForMe}
          </button>
        </aside>
      </div>
      {intent && artist && <IntentForm artist={artist} onClose={() => setIntent(false)} />}
    </>
  );
}

export function Artists() {
  const { data, act, busy, reload } = useApp();
  const { t, city } = useI18n();
  useCue('artists');
  const [intent, setIntent] = useState<Artist | null>(null),
    [search, setSearch] = useState(''),
    [results, setResults] = useState<Artist[]>([]),
    [searching, setSearching] = useState(false),
    [message, setMessage] = useState(''),
    [imported, setImported] = useState<{ id: string; name: string; url: string; image?: string }[]>(
      [],
    ),
    [spotifyChoice, setSpotifyChoice] = useState<{ id: string; name: string } | null>(null);
  const followed = data.artists.filter((a) =>
    data.affinities.some((f) => f.artistId === a.id && !f.hidden),
  );
  async function searchLive(e?: React.FormEvent, term = search) {
    e?.preventDefault();
    setSearching(true);
    setResults([]);
    setMessage('');
    try {
      const response = await api<{ artists: Artist[] }>(
        `artists/search?q=${encodeURIComponent(term)}`,
      );
      setResults(response.artists);
      if (!response.artists.length) setMessage(t.artists.noneFound);
      await reload();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSearching(false);
    }
  }
  return (
    <>
      <header className="page-head">
        <h1>{t.artists.title}</h1>
        <p className="page-intro">{t.artists.intro}</p>
        <div className="page-actions">
          <Link className="button primary compact" href="/onboarding">
            <Plus size={16} aria-hidden="true" />
            {t.artists.choose}
          </Link>
        </div>
      </header>
      <section className="panel" aria-labelledby="your-artists">
        <div className="panel-head">
          <h2 id="your-artists">
            {t.artists.yours} <span className="count">{followed.length}</span>
          </h2>
        </div>
        {followed.length > 0 && (
          <div className="artist-directory">
            {followed.map((a) => {
              const must = data.intents.find((i) => i.artistId === a.id);
              return (
                <article key={a.id} className="artist-tile">
                  <Link href={`/app/artists/${a.id}`}>
                    <Avatar artist={a} />
                    <h3>{a.name}</h3>
                    <p>
                      {a.providerId
                        ? t.artists.liveArtist
                        : a.spotifyBacked
                          ? t.artists.noLiveYet
                          : t.artists.sampleArtist}
                    </p>
                  </Link>
                  {data.user?.mode === 'live' && !a.providerId && (
                    <button
                      className="button small secondary"
                      disabled={searching || !data.liveAvailable}
                      onClick={() => {
                        setSpotifyChoice(null);
                        setSearch(a.name);
                        document
                          .getElementById('live-search')
                          ?.scrollIntoView({ behavior: 'smooth' });
                        void searchLive(undefined, a.name);
                      }}
                    >
                      {a.spotifyBacked ? t.artists.confirmLive : t.artists.findLive}
                    </button>
                  )}
                  <button
                    className={`button small ${must ? 'intent-active' : 'secondary'}`}
                    onClick={() => setIntent(a)}
                  >
                    <Heart size={14} fill={must ? 'currentColor' : 'none'} aria-hidden="true" />
                    {must ? t.artists.mustSee : t.artists.makeMustSee}
                  </button>
                  {must && (
                    <small>
                      {must.cities.map(city).join(', ')}
                      <br />
                      {t.artists.tickets(must.tickets)}
                      {must.maxPrice ? ` · ${t.artists.upTo(must.maxPrice)}` : ''}
                    </small>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {!followed.length && (
          <Empty title={t.artists.emptyTitle}>
            <p>{t.artists.emptyBody}</p>
            <div className="button-row">
              <Link className="button primary" href="/onboarding">
                {t.artists.choose}
              </Link>
            </div>
          </Empty>
        )}
      </section>
      {data.spotifyConnected && (
        <section className="panel spotify-import" aria-labelledby="spotify-title">
          <div className="panel-head">
            <div>
              <h2 id="spotify-title">{t.artists.spotifyTitle}</h2>
              <p className="subtle">{t.artists.spotifyBody}</p>
            </div>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  const result = await api<{
                    artists: { id: string; name: string; url: string; image?: string }[];
                  }>('spotify/artists');
                  setImported(result.artists);
                  setMessage('');
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : t.artists.spotifyFailed);
                }
              }}
            >
              {imported.length ? t.artists.refreshImported : t.artists.loadImported}
            </button>
          </div>
          {imported.length > 0 && (
            <div className="artist-directory">
              {imported.map((a) => (
                <article className="artist-tile" key={a.id}>
                  <a href={a.url} target="_blank" rel="noreferrer">
                    <ArtistPhoto name={a.name} image={a.image} className="artist-avatar" />
                    <h3>{a.name}</h3>
                    <p>{t.artists.importedFrom}</p>
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <section className="panel" id="live-search" aria-labelledby="live-title">
        <h2 id="live-title">{t.artists.liveTitle}</h2>
        <p className="subtle">{t.artists.liveBody}</p>
        <form className="live-search" onSubmit={(e) => void searchLive(e)}>
          <label className="search-field">
            <span className="vh">{t.artists.liveLabel}</span>
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              aria-label={t.artists.liveLabel}
              value={search}
              minLength={2}
              maxLength={100}
              required
              onChange={(e) => {
                setSearch(e.target.value);
                setSpotifyChoice(null);
              }}
              placeholder={t.artists.livePlaceholder}
              enterKeyHint="search"
            />
          </label>
          <button
            className="button secondary"
            disabled={searching || !data.user || !data.liveAvailable}
          >
            {searching ? t.artists.searching : t.artists.search}
          </button>
        </form>
        {!data.liveAvailable && <p className="fineprint">{t.artists.needsKey}</p>}
        {message && (
          <p className="inline-note" role="status">
            {message}
          </p>
        )}
        {spotifyChoice && <p>{t.artists.confirmFor(spotifyChoice.name)}</p>}
        {results.map((a) => (
          <div className="search-result" key={a.id}>
            <span>
              <Avatar artist={a} small />
              {a.name}
            </span>
            <button
              className="button small secondary"
              disabled={busy || (!spotifyChoice && followed.some((artist) => artist.id === a.id))}
              onClick={() =>
                act(
                  spotifyChoice ? 'spotify/confirm' : 'affinity',
                  spotifyChoice
                    ? { spotifyId: spotifyChoice.id, artistId: a.id }
                    : { artistId: a.id, favorite: false, hidden: false },
                  spotifyChoice ? t.artists.confirmed : t.artists.followed,
                )
              }
            >
              {spotifyChoice
                ? t.artists.confirm(a.name)
                : followed.some((artist) => artist.id === a.id)
                  ? t.artists.following
                  : t.artists.follow}
            </button>
          </div>
        ))}
      </section>
      {intent && <IntentForm artist={intent} onClose={() => setIntent(null)} />}
    </>
  );
}

export function ArtistDetail({ id }: { id: string }) {
  const { data, act, busy } = useApp();
  const { t, genre } = useI18n();
  useCue('artists');
  const [intent, setIntent] = useState(false);
  const artist = data.artists.find((a) => a.id === id);
  if (!artist)
    return (
      <Empty title={t.artistDetail.notFound}>
        <Link className="button primary" href="/app/artists">
          {t.artistDetail.back}
        </Link>
      </Empty>
    );
  const affinity = data.affinities.find((a) => a.artistId === id);
  const events = data.allEvents.filter((e) => e.artistIds.includes(id));
  return (
    <>
      <Link href="/app/artists" className="back-link" transitionTypes={['nav-back']}>
        <ArrowLeft size={16} aria-hidden="true" />
        {t.artistDetail.back}
      </Link>
      <header className="artist-hero">
        <ArtistPhoto name={artist.name} image={artist.image} />
        <div>
          <p className="subtle">{genre(artist.genre)}</p>
          <h1>{artist.name}</h1>
          <div className="button-row">
            <button className="button primary" onClick={() => setIntent(true)}>
              <Heart size={17} aria-hidden="true" />
              {t.artists.makeMustSee}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                act(
                  'affinity',
                  { artistId: id, favorite: !affinity?.favorite, hidden: false },
                  affinity?.favorite
                    ? t.artistDetail.favouriteRemoved
                    : t.artistDetail.favouriteAdded,
                )
              }
            >
              <Sparkles size={16} aria-hidden="true" />
              {affinity?.favorite ? t.artistDetail.favourite : t.artistDetail.markFavourite}
            </button>
          </div>
        </div>
      </header>
      <div className="list-head" style={{ marginTop: 26 }}>
        <h2>{t.artistDetail.chances}</h2>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            act(
              'affinity',
              { artistId: id, favorite: false, hidden: !affinity?.hidden },
              affinity?.hidden ? t.artistDetail.restored : t.artistDetail.hidden,
            )
          }
        >
          <EyeOff size={15} aria-hidden="true" />
          {affinity?.hidden ? t.artistDetail.restore : t.artistDetail.hide}
        </button>
      </div>
      {events.length ? (
        <div className="acts">
          {events.map((e, index) => (
            <ConcertCard event={e} key={e.id} index={index} />
          ))}
        </div>
      ) : (
        <Empty title={t.artistDetail.emptyTitle}>
          <p>{t.artistDetail.emptyBody}</p>
        </Empty>
      )}
      {intent && <IntentForm artist={artist} onClose={() => setIntent(false)} />}
    </>
  );
}

export function Saved() {
  const { data } = useApp();
  const { t } = useI18n();
  useCue('saved');
  return (
    <>
      <header className="page-head">
        <h1>{t.saved.title}</h1>
        <p className="page-intro">{t.saved.intro}</p>
        <div className="page-actions">
          <span className="chip">{t.saved.count(data.saved.length)}</span>
        </div>
      </header>
      {data.saved.length ? (
        <div className="acts" style={{ marginTop: 18 }}>
          {data.saved.map((e, index) => (
            <ConcertCard event={e} key={e.id} index={index} source="saved" />
          ))}
        </div>
      ) : (
        <Empty title={t.saved.emptyTitle}>
          <p>{t.saved.emptyBody}</p>
          <div className="button-row">
            <Link className="button primary" href="/app">
              {t.saved.explore}
            </Link>
          </div>
        </Empty>
      )}
    </>
  );
}

export function Inbox() {
  const { data, act } = useApp();
  const { t, f } = useI18n();
  const alertText = useAlertText();
  useCue('alerts');
  return (
    <>
      <header className="page-head">
        <h1>{t.inbox.title}</h1>
        <p className="page-intro">{t.inbox.intro}</p>
        <div className="page-actions">
          <Link href="/app/settings" className="button secondary compact">
            <Bell size={16} aria-hidden="true" />
            {t.inbox.preferences}
          </Link>
        </div>
      </header>
      {data.alerts.length ? (
        <div className="alert-list">
          {data.alerts.map((a) => (
            <article className={`alert-row ${!a.read_at ? 'unread' : ''}`} key={a.id}>
              <span className="alert-bulb" aria-hidden="true" />
              <div>
                <h2>{alertText.title(a.title)}</h2>
                <p>{alertText.body(a.body)}</p>
                <small>{f.day(a.created_at)}</small>
              </div>
              <Link
                href={`/app/events/${a.event_id}`}
                className="button small secondary"
                onClick={() => act('alerts/read', { id: a.id })}
              >
                {t.inbox.view} <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <Empty title={t.inbox.emptyTitle}>
          <p>
            {data.user?.preferences.notifications === 'off' ? t.inbox.emptyOff : t.inbox.emptyOn}
          </p>
          <div className="button-row">
            <Link href="/app/artists" className="button secondary">
              {t.inbox.chooseMustSee}
            </Link>
          </div>
        </Empty>
      )}
      <p className="fineprint" style={{ marginTop: 16 }}>
        {t.inbox.note}
      </p>
    </>
  );
}
