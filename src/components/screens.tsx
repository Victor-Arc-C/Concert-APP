'use client';
import { safeTicketUrl } from '../domain/ticket-links';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Heart,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  TrainFront,
  BedDouble,
  Bookmark,
  X,
  Bell,
  Music2,
  Plus,
  EyeOff,
} from 'lucide-react';
import type { Artist, Intent, Preferences } from '@/domain/types';
import { cities } from '@/domain/catalog';
import { useApp, api } from './context';
import { Avatar, ConcertCard, Empty, Modal, dateLabel, money } from './ui';
import { PreferenceFields } from './onboarding';
export function Feed() {
  const { data, act, busy } = useApp();
  const [query, setQuery] = useState(''),
    [tab, setTab] = useState('all'),
    [month, setMonth] = useState(''),
    [showAll, setShowAll] = useState(false),
    [pageSize, setPageSize] = useState(8),
    [edit, setEdit] = useState(false);
  const followed = data.artists.filter((a) =>
    data.affinities.some((f) => f.artistId === a.id && !f.hidden),
  );
  const home = data.user?.preferences.home ?? 'Paris';
  const filtered = data.events.filter(
    (e) =>
      (!query || `${e.artist} ${e.city} ${e.venue}`.toLowerCase().includes(query.toLowerCase())) &&
      (tab !== 'local' || e.city === home) &&
      (tab !== 'away' || e.city !== home) &&
      (!month || e.date.startsWith(month)),
  );
  // One opportunity per artist in discovery; full tour stays available in the artist/detail views.
  const seen = new Set<string>();
  const shortlist = filtered
    .filter((e) => {
      if (seen.has(e.artistIds[0])) return false;
      seen.add(e.artistIds[0]);
      return true;
    })
    .slice(0, 8);
  const expanded = showAll || !!query || !!month || tab !== 'all';
  const candidates = expanded ? filtered : shortlist;
  const unique = candidates.slice(0, pageSize);
  const months = [...new Set(data.events.map((e) => e.date.slice(0, 7)))].sort();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">
            {data.user
              ? `Made for you, ${data.user.name.split(' ')[0]}`
              : 'Your personal concert shortlist'}
            <span className="greeting-line" />
          </p>
          <h1>Your next great night.</h1>
          <p>The artists you love. The shows worth being there for.</p>
        </div>
        <button className="button secondary compact" onClick={() => setEdit(true)}>
          <SlidersHorizontal size={16} />
          Your preferences
        </button>
      </div>
      <div className="feed-context">
        <span className="context-live">
          <span />
          {data.user?.mode === 'live' ? 'Live discovery' : 'Sample discovery'}
        </span>
        <span>
          <MapPin size={13} />
          {home}{' '}
          {data.user?.preferences.scope === 'city'
            ? 'only'
            : data.user?.preferences.scope === 'country'
              ? 'and your country'
              : '& a little further'}
        </span>
        <span>
          {filtered.length} matching dates · {showAll ? 'all dates' : 'one pick per artist'}
        </span>
      </div>
      {unique.length > 0 && !showAll && !query && !month && tab === 'all' && (
        <div className="spotlight-layout">
          <ConcertCard event={unique[0]} featured trackImpression />
          <aside className="taste-panel">
            <div className="section-heading">
              <h2>Your kind of live.</h2>
              <Music2 size={18} />
            </div>
            <p>Your shortlist starts with the artists you care about.</p>
            <div className="taste-list">
              {followed.slice(0, 4).map((a) => (
                <Link href={`/app/artists/${a.id}`} className="taste-artist" key={a.id}>
                  <Avatar artist={a} small />
                  <div>
                    <strong>{a.name}</strong>
                    <span>
                      {data.intents.some((i) => i.artistId === a.id)
                        ? 'On your must-see list'
                        : a.genre}
                    </span>
                  </div>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            </div>
            <Link className="taste-link" href="/app/artists">
              Fine-tune your artists <ArrowUpRight size={16} />
            </Link>
            <div className="taste-note">
              <Sparkles size={15} />
              <span>
                Every pick has a reason.
                <br />
                Every choice makes it more yours.
              </span>
            </div>
          </aside>
        </div>
      )}
      <section className="shortlist">
        <div className="section-heading">
          <h2>
            {query
              ? 'Search your shortlist'
              : unique.length > 1
                ? 'More nights to look forward to'
                : 'Your shortlist'}
          </h2>
          <button
            className="text-button"
            aria-pressed={showAll}
            onClick={() => {
              setShowAll(!showAll);
              setPageSize(8);
            }}
          >
            {showAll ? 'Show shortlist' : `Show all ${filtered.length} matching dates`}
          </button>
        </div>
        <div className="feed-controls">
          <div className="filter-tabs" role="group" aria-label="Concert location">
            {[
              ['all', 'For you'],
              ['local', 'Close to home'],
              ['away', 'Worth the trip'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={tab === value ? 'selected' : ''}
                aria-pressed={tab === value}
                onClick={() => {
                  setTab(value);
                  setPageSize(8);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="filter-tools">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPageSize(8);
                }}
                placeholder="Find an artist or city"
                aria-label="Search your concerts"
              />
            </label>
            <label className="date-filter">
              <CalendarDays size={16} />
              <select
                aria-label="Filter by month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPageSize(8);
                }}
              >
                <option value="">Any date</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {new Intl.DateTimeFormat('en-GB', {
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }).format(new Date(`${m}-01T12:00:00Z`))}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
        </div>
        {unique.length === 0 ? (
          <Empty
            title={
              query || month || tab !== 'all'
                ? 'No shows match these filters.'
                : 'Your next show hasn’t found you yet.'
            }
          >
            <p>
              {data.user?.mode === 'live'
                ? data.providerMessage
                : 'Try a different city, follow another artist or restore dismissed shows.'}
            </p>
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
                Clear filters
              </button>
              <Link className="button primary" href="/app/artists">
                Choose artists
              </Link>
              {data.user && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => act('feedback/reset', {}, 'Dismissed shows restored')}
                >
                  Restore dismissed shows
                </button>
              )}
            </div>
          </Empty>
        ) : (
          <div className="concert-grid">
            {(showAll || query || month || tab !== 'all' ? unique : unique.slice(1)).map((e) => (
              <ConcertCard
                key={e.id}
                event={e}
                source={query ? 'search' : 'feed'}
                trackImpression
              />
            ))}
          </div>
        )}
        {candidates.length > unique.length && (
          <button className="button secondary" onClick={() => setPageSize((size) => size + 8)}>
            Show more concerts
          </button>
        )}
      </section>
      <div className="quiet-banner">
        <div className="quiet-icon">
          <Bell size={19} />
        </div>
        <div>
          <h3>Some artists are non-negotiable.</h3>
          <p>Add them to your must-see list. Keep their next show on your radar.</p>
        </div>
        <Link href="/app/artists" className="text-button">
          Make your list <ArrowUpRight size={17} />
        </Link>
      </div>
      {edit && <PreferenceModal onClose={() => setEdit(false)} />}
    </>
  );
}
function PreferenceModal({ onClose }: { onClose: () => void }) {
  const { data, act, busy } = useApp();
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
    <Modal title="Follow the music your way" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act('preferences', prefs, 'Travel preferences saved')) onClose();
        }}
      >
        <PreferenceFields value={prefs} onChange={setPrefs} />
        <button className="button primary full" disabled={busy}>
          Save preferences
        </button>
      </form>
    </Modal>
  );
}
export function IntentForm({ artist, onClose }: { artist: Artist; onClose: () => void }) {
  const { data, act, busy } = useApp();
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
    <Modal title={`Make ${artist.name} a must-see`} onClose={onClose}>
      <p className="intro">
        Tell us what would make this show work for you. This records your interest; it does not
        reserve tickets.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act('intent', intent, 'Added to your must-see list')) onClose();
        }}
      >
        <fieldset>
          <legend>Cities you’d go to</legend>
          <div className="city-chips">
            {cities.map((c) => (
              <button
                type="button"
                key={c.name}
                aria-pressed={intent.cities.includes(c.name)}
                className={`city-chip ${intent.cities.includes(c.name) ? 'selected' : ''}`}
                onClick={() =>
                  setIntent({
                    ...intent,
                    cities: intent.cities.includes(c.name)
                      ? intent.cities.filter((n) => n !== c.name)
                      : [...intent.cities, c.name],
                  })
                }
              >
                {c.name}
                {intent.cities.includes(c.name) && <Check size={13} />}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="two-fields">
          <label>
            Maximum per ticket (€)
            <input
              type="number"
              min={1}
              max={10000}
              placeholder="Flexible"
              value={intent.maxPrice ?? ''}
              onChange={(e) =>
                setIntent({ ...intent, maxPrice: e.target.value ? Number(e.target.value) : null })
              }
            />
          </label>
          <label>
            Number of tickets
            <input
              type="number"
              min={1}
              max={8}
              required
              value={intent.tickets}
              onChange={(e) => setIntent({ ...intent, tickets: Number(e.target.value) })}
            />
          </label>
        </div>
        <button className="button primary full" disabled={busy || !intent.cities.length}>
          <Heart size={17} />
          Save must-see preferences
        </button>
        {existing && (
          <button
            className="text-button danger full"
            type="button"
            onClick={async () => {
              if (
                await act('intent/delete', { artistId: artist.id }, 'Must-see preference removed')
              )
                onClose();
            }}
          >
            Remove from must-see list
          </button>
        )}
      </form>
    </Modal>
  );
}
export function EventDetail({ id }: { id: string }) {
  const { data, act, busy, toast } = useApp(),
    router = useRouter();
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
      <Empty title="This concert isn’t available in your current mode.">
        <Link href="/app">Back to your shortlist</Link>
      </Empty>
    );
  const ticketDestination =
    event.url && safeTicketUrl(event.url) ? new URL(event.url).hostname : null;
  const tours = data.allEvents
    .filter((e) => e.artistIds.some((id) => event.artistIds.includes(id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.city.localeCompare(b.city));
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
      <Link className="back-link" href="/app">
        <ArrowLeft size={16} />
        Your shortlist
      </Link>
      <div className="detail-hero">
        <img src={event.image} alt="" />
        <div className="detail-shade" />
        <div className="detail-hero-content">
          <span className="fit-pill warm inline">
            <Sparkles size={14} />
            {event.tier}
          </span>
          <h1>{event.artist}</h1>
          <p>
            {event.venue}, {event.city}
          </p>
          <div>
            <span>
              <CalendarDays size={17} />
              {dateLabel(event.date, true)}
            </span>
            <span>
              <MapPin size={17} />
              {event.localTime
                ? `${event.localTime.slice(0, 5)} venue local time`
                : 'Time to be announced'}
            </span>
          </div>
        </div>
      </div>
      <div className="detail-layout">
        <div>
          <section className="detail-section">
            <h2>A show with your name on it.</h2>
            <ul className="reason-list">
              {event.reasons.map((r) => (
                <li key={r}>
                  <Check size={16} />
                  {r}
                </li>
              ))}
            </ul>
            <p className="fineprint">
              A relevance ranking based on your choices, not a prediction of whether you’ll enjoy
              the show.
            </p>
            {artist && (
              <Link href={`/app/artists/${artist.id}`} className="text-button">
                Explore {artist.name} <ArrowUpRight size={16} />
              </Link>
            )}
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <h2>Same artist. Other possibilities.</h2>
              <TrainFront size={19} />
            </div>
            <p className="intro">
              Compare ticket starting prices. Travel and accommodation still need checking.
            </p>
            <div className="tour-table">
              <div className="tour-row tour-header">
                <span>City & date</span>
                <span>Ticket from</span>
                <span>Trip total</span>
              </div>
              {tours.map((t) => (
                <Link
                  className={`tour-row ${t.id === id ? 'current' : ''}`}
                  key={t.id}
                  href={`/app/events/${t.id}`}
                >
                  <span>
                    <strong>{t.city}</strong>
                    <small>
                      {dateLabel(t.date)}
                      {t.city === data.user?.preferences.home ? ' · home city' : ''}
                    </small>
                  </span>
                  <span>{money(t.price, t.currency)}</span>
                  <span className="subtle">Unknown</span>
                </Link>
              ))}
            </div>
            <div className="travel-placeholders">
              <div>
                <TrainFront />
                <strong>Getting there</strong>
                <span>No live transport quotes connected.</span>
              </div>
              <div>
                <BedDouble />
                <strong>A place to stay</strong>
                <span>No live accommodation quotes connected.</span>
              </div>
            </div>
            <p className="fineprint">
              No journey time, hotel availability or total price is confirmed. Check these before
              buying a ticket.
            </p>
          </section>
        </div>
        <aside className="ticket-panel">
          <span className="subtle">
            {event.provider === 'sample' ? 'Fictional sample price' : 'Provider price range'}
          </span>
          <div className="ticket-price">{money(event.price, event.currency)}</div>
          {event.provider !== 'sample' && event.price === null && (
            <p className="fineprint">
              A current verified price is unavailable for this show. Check official tickets for
              current prices and availability.
            </p>
          )}
          <p className="ticket-status">
            <span className={event.status === 'onsale' ? 'status-dot' : ''} />
            {event.provider === 'sample'
              ? 'Sample event'
              : event.status === 'onsale'
                ? 'Listed as on sale'
                : event.status === 'unknown'
                  ? 'Availability not confirmed'
                  : event.status}
          </p>
          {event.saleAt && (
            <p>
              Sale:{' '}
              {new Intl.DateTimeFormat('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: event.timezone ?? 'Europe/Paris',
              }).format(new Date(event.saleAt))}{' '}
              ({event.timezone ?? 'Europe/Paris'})
            </p>
          )}
          <button
            className="button primary full"
            onClick={ticket}
            disabled={
              outbound ||
              !ticketDestination ||
              event.provider === 'sample' ||
              ['cancelled', 'postponed'].includes(event.status)
            }
          >
            <Ticket size={18} />
            {event.provider === 'sample'
              ? 'No real tickets in sample mode'
              : ticketDestination
                ? `Check tickets on ${ticketDestination}`
                : 'Ticket link unavailable'}
            <ArrowUpRight size={16} />
          </button>
          <button
            className="button secondary full"
            disabled={busy}
            onClick={() =>
              act(
                'feedback',
                { eventId: id, action: event.saved ? 'clear' : 'saved', source: 'detail' },
                event.saved ? 'Removed from saved concerts' : 'Concert saved',
              )
            }
          >
            <Bookmark size={17} fill={event.saved ? 'currentColor' : 'none'} />
            {event.saved ? 'Saved to your shows' : 'Save this show'}
          </button>
          {artist && (
            <button className="text-button full" onClick={() => setIntent(true)}>
              <Heart size={17} />I need to see this artist
            </button>
          )}
          <p className="fineprint">
            {event.provider === 'sample'
              ? 'All details on this page are fictional. Generic concert photography.'
              : 'Source: Ticketmaster. Prices and availability can change; fees may apply. No affiliate commission is active.'}
          </p>
          <span className="freshness">
            {event.provider === 'sample' ? 'Sample created' : 'Last checked'}{' '}
            {new Date(event.fetchedAt).toLocaleDateString('en-GB')}
          </span>
          <button
            className="text-button dismiss"
            disabled={busy}
            onClick={async () => {
              if (
                await act(
                  'feedback',
                  { eventId: id, action: 'dismissed', source: 'detail' },
                  'Show dismissed',
                )
              )
                router.push('/app');
            }}
          >
            <X size={15} />
            Not for me
          </button>
        </aside>
      </div>
      {intent && artist && <IntentForm artist={artist} onClose={() => setIntent(false)} />}
    </>
  );
}
export function Artists() {
  const { data, act, busy, reload } = useApp();
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
      if (!response.artists.length) setMessage('No artists found. Try the full artist name.');
      await reload();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSearching(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">Your music, your rules</p>
          <h1>Keep your favourites close.</h1>
          <p>Follow an artist. Make the ones you can’t miss a must-see.</p>
        </div>
      </div>
      <section className="detail-section">
        <div className="section-heading">
          <h2>
            Your artists <span className="count">{followed.length}</span>
          </h2>
          <Link className="text-button" href="/onboarding">
            <Plus size={16} />
            Choose artists
          </Link>
        </div>
        <div className="artist-directory">
          {followed.map((a) => {
            const must = data.intents.find((i) => i.artistId === a.id);
            return (
              <article key={a.id} className="artist-tile">
                <Link href={`/app/artists/${a.id}`}>
                  <Avatar artist={a} />
                  <h3>{a.name}</h3>
                  <p>{a.providerId ? 'Live artist' : 'Sample artist'}</p>
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
                    Find live artist
                  </button>
                )}
                <button
                  className={`button small ${must ? 'intent-active' : 'secondary'}`}
                  onClick={() => setIntent(a)}
                >
                  <Heart size={14} fill={must ? 'currentColor' : 'none'} />
                  {must ? 'Must see' : 'Make a must-see'}
                </button>
                {must && (
                  <small>
                    {must.cities.join(', ')}
                    <br />
                    {must.tickets} ticket{must.tickets > 1 ? 's' : ''}
                    {must.maxPrice ? ` · up to €${must.maxPrice} each` : ''}
                  </small>
                )}
              </article>
            );
          })}
        </div>
        {!followed.length && (
          <Empty title="Who’s on your list?">
            <p>Choose your favourite artists to start finding shows.</p>
            <Link href="/onboarding">Choose artists</Link>
          </Empty>
        )}
      </section>
      {data.spotifyConnected && (
        <section className="settings-section spotify-import" aria-label="Spotify artists">
          <div className="section-heading">
            <div>
              <h2>Spotify artists</h2>
              <p>Connected. Choose imported artists without leaving your Artists experience.</p>
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
                  setMessage(
                    e instanceof Error ? e.message : 'Spotify artists could not be loaded.',
                  );
                }
              }}
            >
              {imported.length ? 'Refresh imported artists' : 'Load imported artists'}
            </button>
          </div>
          {imported.length > 0 && (
            <div className="artist-directory">
              {imported.map((a) => (
                <article className="artist-tile" key={a.id}>
                  <a href={a.url} target="_blank" rel="noreferrer">
                    <span className="artist-avatar" style={{ background: '#3f6b56' }}>
                      {a.image ? <img src={a.image} alt="" loading="lazy" /> : a.name.slice(0, 2)}
                    </span>
                    <h3>{a.name}</h3>
                    <p>Imported from Spotify</p>
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <section className="settings-section" id="live-search">
        <h2>Find an artist in the live catalogue</h2>
        <p>
          Search Ticketmaster and choose the exact artist. This avoids mixing up artists with the
          same name.
        </p>
        <form className="live-search" onSubmit={(e) => void searchLive(e)}>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search live artists"
              value={search}
              minLength={2}
              maxLength={100}
              required
              onChange={(e) => {
                setSearch(e.target.value);
                setSpotifyChoice(null);
              }}
              placeholder="Artist name"
            />
          </label>
          <button
            className="button secondary"
            disabled={searching || !data.user || !data.liveAvailable}
          >
            {searching ? 'Searching…' : 'Search artists'}
          </button>
        </form>
        {!data.liveAvailable && (
          <p className="fineprint">
            Live search requires a Ticketmaster API key. The sample artist catalogue works without
            one.
          </p>
        )}
        {message && (
          <p className="inline-note" role="status">
            {message}
          </p>
        )}
        {spotifyChoice && (
          <p>
            Confirm which live artist matches {spotifyChoice.name} on Spotify. This saves your
            choice and follows the artist.
          </p>
        )}
        {results.map((a) => (
          <div className="search-result" key={a.id}>
            <span>{a.name}</span>
            <button
              className="button small secondary"
              disabled={busy || (!spotifyChoice && followed.some((artist) => artist.id === a.id))}
              onClick={() =>
                act(
                  spotifyChoice ? 'spotify/confirm' : 'affinity',
                  spotifyChoice
                    ? { spotifyId: spotifyChoice.id, artistId: a.id }
                    : { artistId: a.id, favorite: false, hidden: false },
                  spotifyChoice ? 'Spotify artist confirmed and followed' : 'Artist followed',
                )
              }
            >
              {spotifyChoice
                ? `Confirm ${a.name}`
                : followed.some((artist) => artist.id === a.id)
                  ? 'Following'
                  : 'Follow artist'}
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
  const [intent, setIntent] = useState(false);
  const artist = data.artists.find((a) => a.id === id);
  if (!artist)
    return (
      <Empty title="Artist not found">
        <Link href="/app/artists">Back to your artists</Link>
      </Empty>
    );
  const affinity = data.affinities.find((a) => a.artistId === id);
  const events = data.allEvents.filter((e) => e.artistIds.includes(id));
  return (
    <>
      <Link href="/app/artists" className="back-link">
        <ArrowLeft size={16} />
        Your artists
      </Link>
      <div className="artist-detail-heading">
        <Avatar artist={artist} />
        <div>
          <p className="subtle">{artist.genre}</p>
          <h1>{artist.name}</h1>
          <div className="button-row">
            <button className="button primary" onClick={() => setIntent(true)}>
              <Heart size={17} />
              Make a must-see
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                act(
                  'affinity',
                  { artistId: id, favorite: !affinity?.favorite, hidden: false },
                  affinity?.favorite ? 'Favourite removed' : 'Marked as a favourite',
                )
              }
            >
              <Sparkles size={16} />
              {affinity?.favorite ? 'Favourite' : 'Mark favourite'}
            </button>
          </div>
        </div>
      </div>
      <div className="section-heading">
        <h2>Chances to be there</h2>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            act(
              'affinity',
              { artistId: id, favorite: false, hidden: !affinity?.hidden },
              affinity?.hidden ? 'Artist restored' : 'Artist hidden from your feed',
            )
          }
        >
          <EyeOff size={15} />
          {affinity?.hidden ? 'Restore artist' : 'Hide from feed'}
        </button>
      </div>
      {events.length ? (
        <div className="concert-grid">
          {events.map((e) => (
            <ConcertCard event={e} key={e.id} />
          ))}
        </div>
      ) : (
        <Empty title="No upcoming shows in this catalogue.">
          <p>
            Your must-see preference can be saved before a tour exists. Live coverage depends on
            connected providers.
          </p>
        </Empty>
      )}
      {intent && <IntentForm artist={artist} onClose={() => setIntent(false)} />}
    </>
  );
}
export function Saved() {
  const { data } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">From maybe to being there</p>
          <h1>Nights to keep.</h1>
          <p>Your saved shows, all in one place.</p>
        </div>
        <span className="count large">{data.saved.length} saved</span>
      </div>
      {data.saved.length ? (
        <div className="concert-grid saved-grid">
          {data.saved.map((e) => (
            <ConcertCard event={e} key={e.id} source="saved" />
          ))}
        </div>
      ) : (
        <Empty title="Leave room for a great night.">
          <p>Tap the bookmark on a show to keep it here.</p>
          <Link className="button primary" href="/app">
            Explore your concerts
          </Link>
        </Empty>
      )}
    </>
  );
}
export function Inbox() {
  const { data, act } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">Just the things that matter</p>
          <h1>Your concert radar.</h1>
          <p>In-app updates for your artists and saved plans.</p>
        </div>
        <Link href="/app/settings" className="button secondary">
          <Bell size={16} />
          Alert preferences
        </Link>
      </div>
      {data.alerts.length ? (
        <div className="alert-list">
          {data.alerts.map((a) => (
            <article className={`alert-row ${!a.read_at ? 'unread' : ''}`} key={a.id}>
              <span className="alert-icon">
                <Bell size={20} />
              </span>
              <div>
                <h2>{a.title}</h2>
                <p>{a.body}</p>
                <small>{new Date(a.created_at).toLocaleDateString('en-GB')}</small>
              </div>
              <Link
                href={`/app/events/${a.event_id}`}
                className="button small secondary"
                onClick={() => act('alerts/read', { id: a.id })}
              >
                View show <ArrowUpRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Quiet for now.">
          <p>
            {data.user?.preferences.notifications === 'off'
              ? 'Your alerts are turned off. You can change that in settings.'
              : 'Add a must-see artist or choose “Everything” in alert preferences. New matches appear here when you open Encore or the scheduler runs.'}
          </p>
          <Link href="/app/artists" className="button secondary">
            Choose must-see artists
          </Link>
        </Empty>
      )}
      <p className="fineprint">
        Alerts are in-app only. Email, push delivery and continuous availability monitoring are not
        enabled.
      </p>
    </>
  );
}
