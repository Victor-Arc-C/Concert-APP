'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import {
  ArrowUpRight,
  Check,
  AudioLines,
  MapPin,
  Bell,
  Heart,
  ChevronLeft,
  Music2,
} from 'lucide-react';
import { api, useApp } from './context';
import { Avatar, Brand } from './ui';
import { cities, defaults } from '@/domain/catalog';
import type { Artist, Preferences } from '@/domain/types';
import { onboardingSource } from '@/domain/onboarding';
export function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <nav>
          <Link href="/app">Explore the sample</Link>
          <Link href="/login">Sign in</Link>
          <Link className="button small primary" href="/signup">
            Find your next show <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <img src="/images/stage.jpg" alt="A crowd beneath the lights of a concert stage" />
          <div className="landing-shade" />
          <div className="landing-copy">
            <span className="live-caption">
              <span /> For the nights you’ll talk about for years.
            </span>
            <h1>
              Your favourite music.
              <br />
              Your next great night.
            </h1>
            <p>
              The artists you love are going places.
              <br />
              Find your chance to be there.
            </p>
            <div className="landing-cta">
              <Link className="button primary" href="/signup">
                Find my concerts <ArrowUpRight size={18} />
              </Link>
              <Link className="button glass" href="/app">
                Try the sample experience
              </Link>
            </div>
            <span className="landing-footnote">
              Choose your artists. Set your city. Follow the music.
            </span>
          </div>
          <div className="hero-caption">
            <AudioLines size={17} /> A personal shortlist. A world of live music.
          </div>
        </section>
        <section className="landing-intro">
          <div>
            <span className="subtle">Made for the way you listen</span>
            <h2>
              Some shows are worth
              <br />
              leaving town for.
            </h2>
          </div>
          <div className="landing-benefits">
            <div>
              <Heart />
              <h3>Your artists first</h3>
              <p>A few shows you care about, with a clear reason for every recommendation.</p>
            </div>
            <div>
              <MapPin />
              <h3>Here. Or a little further.</h3>
              <p>Keep it local or look across Europe. You decide how far the music takes you.</p>
            </div>
            <div>
              <Bell />
              <h3>Keep the important ones close</h3>
              <p>
                Save a show or add an artist to your must-see list. Your plans stay in one place.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <p>Early-access pilot. Sample listings are fictional.</p>
        <Link href="/privacy">Privacy & sources</Link>
      </footer>
    </div>
  );
}
export function Auth({ signup }: { signup: boolean }) {
  const { reload, data } = useApp(),
    router = useRouter();
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await api(signup ? 'auth/signup' : 'auth/login', {
        name: signup ? form.get('name') : undefined,
        email: form.get('email'),
        password: form.get('password'),
        inviteCode: signup && data.inviteRequired ? form.get('inviteCode') : undefined,
      });
      await reload();
      router.push(signup ? '/onboarding' : '/app');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-art">
        <Brand />
        <div className="auth-board" aria-hidden="true">
          {['Departures', 'Your artists', 'Every city', 'Tonight'].map((word) => (
            <span key={word}>{word}</span>
          ))}
        </div>
        <div>
          <h2>
            Be there
            <br />
            when it happens.
          </h2>
          <p>Every show worth the trip, from the artists you choose.</p>
        </div>
      </aside>
      <main className="auth-main">
        <Link href="/" className="back-link">
          <ChevronLeft size={16} />
          Back to Encore
        </Link>
        <div className="auth-form">
          <h1>{signup ? 'Good music. Better plans.' : 'Welcome back.'}</h1>
          <p>
            {signup
              ? 'Create an account and start with the artists you love.'
              : 'Your next great night is waiting.'}
          </p>
          <form onSubmit={submit}>
            {signup && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="given-name"
                  maxLength={60}
                  required
                  placeholder="How should we call you?"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                minLength={12}
                maxLength={128}
                required
                placeholder={signup ? 'At least 12 characters' : 'Your password'}
              />
            </label>
            {signup && data.inviteRequired && (
              <label>
                Invite code
                <input
                  name="inviteCode"
                  autoComplete="off"
                  maxLength={64}
                  required
                  placeholder="From your beta invitation"
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={pending}>
              {pending ? 'One moment…' : signup ? 'Create account' : 'Sign in'}
              <ArrowUpRight size={17} />
            </button>
          </form>
          {signup ? (
            <p className="fineprint">
              This is a closed pilot with local accounts. Read how we handle your data in our{' '}
              <Link href="/privacy">privacy notice</Link>. No payment required.
            </p>
          ) : (
            <p className="fineprint">Password recovery is not available in this closed pilot.</p>
          )}
          <p className="auth-switch">
            {signup ? 'Already part of the crowd?' : 'New to Encore?'}{' '}
            <Link href={signup ? '/login' : '/signup'}>
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
export function PreferenceFields({
  value,
  onChange,
}: {
  value: Preferences;
  onChange: (value: Preferences) => void;
}) {
  return (
    <div className="preference-fields">
      <label>
        Home city
        <select value={value.home} onChange={(e) => onChange({ ...value, home: e.target.value })}>
          {cities.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
      </label>
      <label>
        Where would you go?
        <select
          value={value.scope}
          onChange={(e) => onChange({ ...value, scope: e.target.value as Preferences['scope'] })}
        >
          <option value="city">My city only</option>
          <option value="country">Anywhere in my country</option>
          <option value="europe">Across Europe</option>
        </select>
      </label>
      <label>
        Preferred radius (km), optional
        <input
          type="number"
          min={1}
          max={5000}
          step={1}
          value={value.radiusKm ?? ''}
          onChange={(e) =>
            onChange({ ...value, radiusKm: e.target.value ? Number(e.target.value) : null })
          }
          placeholder="No limit set"
        />
        <small>
          Approximate city-centre distance. With a radius set, shows with unknown distance are
          excluded.
        </small>
      </label>
      <label>
        Concerts from
        <input
          type="date"
          value={value.dateFrom ?? ''}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value || null })}
        />
      </label>
      <label>
        Concerts until
        <input
          type="date"
          min={value.dateFrom ?? undefined}
          value={value.dateTo ?? ''}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value || null })}
        />
      </label>
      <label>
        Maximum travel time
        <select
          value={value.maxHours ?? ''}
          onChange={(e) =>
            onChange({ ...value, maxHours: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">Flexible</option>
          <option value="1">1 hour</option>
          <option value="3">3 hours</option>
          <option value="8">A weekend trip</option>
        </select>
        <small>We’ll flag unverified travel times.</small>
      </label>
      <label>
        Total budget (€), optional
        <input
          type="number"
          min={1}
          max={10000}
          value={value.budget ?? ''}
          onChange={(e) =>
            onChange({ ...value, budget: e.target.value ? Number(e.target.value) : null })
          }
          placeholder="No limit set"
        />
        <small>Tickets, travel and a place to stay.</small>
      </label>
    </div>
  );
}
export function Onboarding() {
  const { data, act, busy, toast } = useApp(),
    router = useRouter(),
    searchParams = useSearchParams();
  const musicStatus = searchParams.get('music');
  const [step, setStep] = useState(musicStatus ? 2 : 1),
    [selected, setSelected] = useState<string[]>([]),
    [prefs, setPrefs] = useState<Preferences>(data.user?.preferences ?? defaults),
    [manualSearch, setManualSearch] = useState(''),
    [spotifyArtists, setSpotifyArtists] = useState<
      {
        id: string;
        name: string;
        url: string;
        image?: string;
        artistId?: string;
        mapping?: 'provider' | 'name' | 'spotify' | 'ambiguous' | 'none';
      }[]
    >([]),
    [spotifyLoaded, setSpotifyLoaded] = useState(false),
    [spotifyMessage, setSpotifyMessage] = useState(''),
    // Demo (fictional sample concerts) is opt-in whenever live concerts are available.
    [demo, setDemo] = useState(!data.liveAvailable),
    [liveQuery, setLiveQuery] = useState(''),
    [liveResults, setLiveResults] = useState<Artist[]>([]),
    [livePicked, setLivePicked] = useState<Record<string, Artist>>({}),
    [liveSearching, setLiveSearching] = useState(false),
    [liveMessage, setLiveMessage] = useState(''),
    [liveFailed, setLiveFailed] = useState(false);
  async function searchLiveArtists(event?: React.FormEvent) {
    event?.preventDefault();
    const term = liveQuery.trim();
    if (term.length < 2) return;
    setLiveSearching(true);
    setLiveMessage('');
    setLiveFailed(false);
    try {
      const result = await api<{ artists: Artist[] }>(
        `artists/search?q=${encodeURIComponent(term)}`,
      );
      setLiveResults(result.artists);
      if (!result.artists.length)
        setLiveMessage('No artists found. Try the full artist name or another spelling.');
    } catch (error) {
      setLiveResults([]);
      setLiveFailed(true);
      setLiveMessage(
        error instanceof Error ? error.message : 'Live artist search is unavailable right now.',
      );
    } finally {
      setLiveSearching(false);
    }
  }
  function toggleLive(artist: Artist) {
    setLivePicked((current) => ({ ...current, [artist.id]: artist }));
    setSelected((current) =>
      current.includes(artist.id)
        ? current.filter((id) => id !== artist.id)
        : [...current, artist.id],
    );
  }
  function switchMode(nextDemo: boolean) {
    // Sample and live follows stay separate: switching clears the current picks.
    setDemo(nextDemo);
    setSelected([]);
  }
  const spotifyIds = spotifyArtists.flatMap((a) => (a.artistId ? [a.artistId] : []));
  const liveChoices = [
    ...selected.flatMap((id) => (livePicked[id] ? [livePicked[id]] : [])),
    ...liveResults.filter((a) => !selected.includes(a.id)),
  ];
  useEffect(() => {
    if (musicStatus === 'connected') {
      void api<{ artists: typeof spotifyArtists }>('spotify/artists')
        .then((result) => setSpotifyArtists(result.artists))
        .catch((error) =>
          setSpotifyMessage(
            error instanceof Error ? error.message : 'Spotify artists could not be loaded.',
          ),
        )
        .finally(() => setSpotifyLoaded(true));
    }
  }, [musicStatus]);
  if (!data.user)
    return (
      <main className="failure">
        <Brand />
        <h1>Let’s make this yours.</h1>
        <Link className="button primary" href="/signup">
          Create an account
        </Link>
      </main>
    );
  return (
    <div className="onboarding">
      <header>
        <Brand />
        <span>Step {step} of 2</span>
      </header>
      <main>
        <div className="step-track">
          <i className="complete" />
          <i className={step === 2 ? 'complete' : ''} />
        </div>
        <h1>{step === 1 ? 'Where should the music take you?' : 'Who would you love to see?'}</h1>
        <p className="intro">
          {step === 1
            ? 'Start close to home, or leave room for a weekend away.'
            : demo
              ? 'Pick a few favourites from the demo catalogue. You can change these any time.'
              : 'Search for the artists you love. Spotify is optional, and you can change these any time.'}
        </p>
        {step === 1 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep(2);
            }}
          >
            <PreferenceFields value={prefs} onChange={setPrefs} />
            <div className="inline-note">
              Spotify is optional. You can change these preferences any time.
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={prefs.analytics}
                onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
              />
              <span>Help improve Encore with optional in-app usage events.</span>
            </label>
            <div className="onboarding-bottom">
              <span>Location and preferences</span>
              <button className="button primary">
                Choose artists <ArrowUpRight size={17} />
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="connect-box">
              <Music2 />
              <div>
                <strong>Bring your music with you</strong>
                <p>Connect Spotify to import artists, or choose manually below.</p>
              </div>
              {data.spotifyAvailable && (
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      const r = await api<{ url: string }>('spotify/connect', {
                        returnTo: 'onboarding',
                      });
                      window.location.assign(r.url);
                    } catch (e) {
                      toast(e instanceof Error ? e.message : 'Spotify could not be connected.');
                    }
                  }}
                >
                  Connect Spotify
                </button>
              )}
            </div>
            {(spotifyMessage || musicStatus === 'denied' || musicStatus === 'failed') && (
              <p className="inline-note" role="status">
                {spotifyMessage ||
                  (musicStatus === 'denied'
                    ? 'Spotify connection was cancelled. You can choose artists manually.'
                    : 'Spotify could not be connected. You can choose artists manually.')}
              </p>
            )}
            {musicStatus === 'connected' && !spotifyLoaded && !spotifyMessage && (
              <p className="inline-note" role="status">
                Loading your Spotify artists…
              </p>
            )}
            {musicStatus === 'connected' &&
              spotifyLoaded &&
              !spotifyArtists.length &&
              !spotifyMessage && (
                <p className="inline-note" role="status">
                  No Spotify artists were imported. Choose manually below.
                </p>
              )}
            {spotifyArtists.length > 0 && (
              <section className="spotify-import" aria-label="Imported Spotify artists">
                <h2>From Spotify</h2>
                <p>Select any imported artist to add it to your favourites.</p>
                <div className="artist-picker">
                  {spotifyArtists.map((imported) => {
                    const match = imported.artistId
                      ? data.artists.find((artist) => artist.id === imported.artistId)
                      : undefined;
                    const artistId = imported.artistId;
                    const isSelected = Boolean(artistId && selected.includes(artistId));
                    const selectable = Boolean(artistId);
                    return (
                      <button
                        key={imported.id}
                        className={`artist-choice ${isSelected ? 'selected' : ''}`}
                        disabled={!selectable}
                        onClick={() => {
                          if (!artistId) {
                            return;
                          }
                          setSelected((current) =>
                            isSelected
                              ? current.filter((id) => id !== artistId)
                              : [...current, artistId],
                          );
                        }}
                        aria-pressed={isSelected}
                        aria-disabled={!selectable}
                        title={artistId ? undefined : 'This Spotify artist could not be imported'}
                      >
                        <Avatar
                          artist={{
                            id: imported.id,
                            name: imported.name,
                            genre: 'Spotify artist',
                            color: '#3f6b56',
                            initials: imported.name.slice(0, 2),
                            image: imported.image,
                          }}
                        />
                        <strong>{imported.name}</strong>
                        <span>
                          {match?.providerId ? 'Available to choose' : 'No live concerts found yet'}
                        </span>
                        <i>{isSelected ? <Check size={14} /> : null}</i>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            {demo ? (
              <>
                {data.liveAvailable ? (
                  <div className="inline-note">
                    Demo mode: concerts, dates and prices are fictional.{' '}
                    <button className="text-button" type="button" onClick={() => switchMode(false)}>
                      Search real artists instead
                    </button>
                  </div>
                ) : (
                  <div className="inline-note">
                    Live concerts aren’t available right now, so you can explore the demo with
                    fictional concerts.
                  </div>
                )}
                <label className="search-field onboarding-search">
                  <span>Choose manually</span>
                  <input
                    aria-label="Search artists to choose manually"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    placeholder="Search artists"
                  />
                </label>
                <div className="artist-picker">
                  {data.artists
                    .filter(
                      (a) =>
                        !a.providerId && a.name.toLowerCase().includes(manualSearch.toLowerCase()),
                    )
                    .map((a) => (
                      <button
                        key={a.id}
                        className={`artist-choice ${selected.includes(a.id) ? 'selected' : ''}`}
                        onClick={() =>
                          setSelected((s) =>
                            s.includes(a.id) ? s.filter((id) => id !== a.id) : [...s, a.id],
                          )
                        }
                        aria-pressed={selected.includes(a.id)}
                      >
                        <Avatar artist={a} />
                        <strong>{a.name}</strong>
                        <span>{a.genre}</span>
                        <i>{selected.includes(a.id) ? <Check size={14} /> : null}</i>
                      </button>
                    ))}
                </div>
              </>
            ) : (
              <section className="live-onboarding" aria-label="Live artist search">
                <form
                  className="onboarding-live-search"
                  onSubmit={(e) => void searchLiveArtists(e)}
                >
                  <label className="search-field onboarding-search">
                    <span>Search real artists</span>
                    <input
                      aria-label="Search real artists"
                      value={liveQuery}
                      onChange={(e) => setLiveQuery(e.target.value)}
                      maxLength={100}
                      placeholder="Artist name, e.g. Angèle"
                    />
                  </label>
                  <button
                    className="button secondary"
                    disabled={liveSearching || liveQuery.trim().length < 2}
                  >
                    {liveSearching ? 'Searching…' : 'Search'}
                  </button>
                </form>
                {liveMessage && (
                  <div className={liveFailed ? 'form-error' : 'inline-note'} role="status">
                    {liveMessage}
                    {liveFailed && (
                      <>
                        {' '}
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void searchLiveArtists()}
                        >
                          Try again
                        </button>
                      </>
                    )}
                  </div>
                )}
                {liveChoices.length > 0 && (
                  <div className="artist-picker">
                    {liveChoices.map((artist) => (
                      <button
                        key={artist.id}
                        type="button"
                        className={`artist-choice ${selected.includes(artist.id) ? 'selected' : ''}`}
                        onClick={() => toggleLive(artist)}
                        aria-pressed={selected.includes(artist.id)}
                      >
                        <Avatar artist={artist} />
                        <strong>{artist.name}</strong>
                        <span>Live catalogue</span>
                        <i>{selected.includes(artist.id) ? <Check size={14} /> : null}</i>
                      </button>
                    ))}
                  </div>
                )}
                <button className="text-button" type="button" onClick={() => switchMode(true)}>
                  Just exploring? Try the demo with fictional concerts
                </button>
              </section>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await act('onboarding', {
                    artistIds: selected,
                    preferences: prefs,
                    mode: demo ? 'sample' : 'live',
                    source: onboardingSource(selected, spotifyIds, demo),
                  })
                )
                  router.push('/app');
              }}
            >
              <div className="onboarding-bottom">
                <button className="text-button" type="button" onClick={() => setStep(1)}>
                  <ChevronLeft size={17} />
                  Back to preferences
                </button>
                <button className="button primary" disabled={busy || !selected.length}>
                  {busy ? (demo ? 'One moment…' : 'Connecting live concerts…') : 'Find my concerts'}{' '}
                  <ArrowUpRight size={17} />
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
export function Privacy() {
  const { data } = useApp();
  const contact = data.privacyContact;
  return (
    <div className="document-page">
      <Brand />
      <h1>Privacy and beta terms</h1>
      <p>
        Encore is a free, invite-only pilot. This page explains what we store, why, where and for
        how long, and the rules of the beta. Sample concerts and prices are fictional.
      </p>
      <h2>Who is responsible</h2>
      {contact?.controller && contact.email ? (
        <p>
          The data controller is {contact.controller}. For any privacy question or request, write to{' '}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>.
        </p>
      ) : (
        <p className="inline-note" role="note">
          The controller identity and privacy contact are not configured on this deployment yet.
        </p>
      )}
      <h2>What we store</h2>
      <ul>
        <li>Your account: email, name and a hashed password.</li>
        <li>
          Your settings: home city, distance, dates, ticket budget, notification and consent
          choices.
        </li>
        <li>
          Artists you follow or mark as must-see, concerts you save or dismiss, ticket links you
          open, your in-app alerts and the trip plans you save.
        </li>
        <li>Feedback you choose to send, with the screen you sent it from.</li>
        <li>Optional usage analytics, only if you turn them on.</li>
        <li>If you connect Spotify: encrypted access tokens and the artists you confirm.</li>
        <li>Sign-in sessions (7 days) and pending music-connection attempts.</li>
        <li>
          For security: rate-limit counters keyed by a hash of your email or account ID, and error
          logs that contain no personal data. Our hosting provider also keeps standard request logs
          (such as IP address and browser) under its own retention policy.
        </li>
      </ul>
      <h2>Why (legal basis)</h2>
      <p>
        Your account, settings, artists, saves, alerts, trips and ticket-link records are needed to
        provide the service you signed up for (contract). Usage analytics and the Spotify connection
        rely on your consent, which you can withdraw in settings at any time. Beta feedback,
        security counters and error logs rely on our legitimate interest in running and improving a
        safe pilot. We do not sell personal data or listening profiles.
      </p>
      <h2>Where</h2>
      <p>
        The app is hosted by Vercel and the database by Neon (managed PostgreSQL). At the time of
        writing, Encore&apos;s application servers run in the United States, so your data may be
        processed outside the European Union, under these providers&apos; data processing terms. Ask
        us if you want the current regions or the transfer safeguards.
      </p>
      <h2>How long</h2>
      <ul>
        <li>
          Account data, settings, artists, must-see choices, saves, ticket-link records, alerts,
          trips and feedback: until you delete your account.
        </li>
        <li>Sign-in sessions: 7 days.</li>
        <li>Usage analytics: 30 days, or immediately when you turn them off.</li>
        <li>Security rate-limit counters: 2 to 3 days.</li>
        <li>
          Deleted data can remain in the database provider&apos;s backups until they expire under
          its restore window.
        </li>
      </ul>
      <h2>Your rights</h2>
      <p>
        You can see and download your data (Settings → Export my data), correct it (Settings),
        withdraw consent (Settings), and delete your account and its data (Settings → Delete
        account). Deletion removes account-linked records from the active database immediately. You
        can also contact us for access, correction, deletion, restriction or objection, and you have
        the right to complain to the CNIL (
        <a href="https://www.cnil.fr" rel="noreferrer">
          cnil.fr
        </a>
        ).
      </p>
      <h2>Spotify</h2>
      <p>
        The connector is only active for approved pilot accounts. It requests top-artist access,
        shows artist names for you to choose, and stores encrypted access tokens. We do not keep
        Spotify listening metrics. Disconnecting removes tokens and pending connection attempts. You
        may also revoke Encore in your Spotify account.
      </p>
      <h2>Beta terms</h2>
      <ul>
        <li>The pilot is free, may change or stop at any time, and comes without any guarantee.</li>
        <li>
          Listings, dates and prices come from third parties and may be incomplete or out of date.
          Always check the seller before buying or travelling.
        </li>
        <li>
          Encore sells no tickets and books no travel. Any purchase is between you and the seller.
        </li>
        <li>Your invite code is personal to your group. Please do not share it publicly.</li>
      </ul>
      <h2>Listings and sources</h2>
      <p>
        Live event data comes from Ticketmaster when configured. Listed price ranges are indicative
        and may exclude fees. Availability is confirmed by the seller. No affiliate commission is
        active in this pilot. Travel and hotels are not quoted or booked.
      </p>
      <h2>Photography</h2>
      <p>
        Generic concert atmosphere from{' '}
        <a href="https://unsplash.com" target="_blank" rel="noreferrer">
          Unsplash
        </a>
        , used under the{' '}
        <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">
          Unsplash licence
        </a>
        . These images do not depict the named sample events or imply artist endorsement.
      </p>
      <Link className="button secondary" href="/app">
        Back to concerts
      </Link>
    </div>
  );
}
