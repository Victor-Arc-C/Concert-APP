'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Check, ChevronLeft, Music2, Search } from 'lucide-react';
import { api, useApp } from './context';
import { ArtistPhoto, Brand, LanguageSwitch } from './ui';
import { Finder, type FinderArtist } from './finder';
import { gelFor } from './stage/gel';
import { useCue } from './stage/rig';
import { cities, defaults } from '@/domain/catalog';
import type { Artist, Preferences } from '@/domain/types';
import { onboardingSource } from '@/domain/onboarding';
import { useI18n } from '@/i18n/client';

export function Auth({ signup }: { signup: boolean }) {
  const { reload, data } = useApp(),
    router = useRouter();
  const { t } = useI18n();
  useCue(signup ? 'saved' : 'all');
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
      setError(e instanceof Error ? e.message : t.common.somethingWrong);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-art" aria-hidden="true">
        <h2>{t.auth.artTitle}</h2>
        <p>{t.auth.artBody}</p>
      </aside>
      <main className="auth-main">
        <div className="auth-top">
          <Brand />
          <LanguageSwitch />
        </div>
        <Link href="/" className="back-link">
          <ChevronLeft size={16} aria-hidden="true" />
          {t.auth.backHome}
        </Link>
        <div className="auth-form">
          <h1>{signup ? t.auth.signupTitle : t.auth.loginTitle}</h1>
          <p>{signup ? t.auth.signupIntro : t.auth.loginIntro}</p>
          <form onSubmit={submit}>
            {signup && (
              <label>
                {t.auth.name}
                <input
                  name="name"
                  autoComplete="given-name"
                  maxLength={60}
                  required
                  placeholder={t.auth.namePlaceholder}
                />
              </label>
            )}
            <label>
              {t.auth.email}
              <input
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              {t.auth.password}
              <input
                name="password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                minLength={12}
                maxLength={128}
                required
                placeholder={signup ? t.auth.passwordNew : t.auth.passwordCurrent}
              />
            </label>
            {signup && data.inviteRequired && (
              <label>
                {t.auth.invite}
                <input
                  name="inviteCode"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={64}
                  required
                  placeholder={t.auth.invitePlaceholder}
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={pending}>
              {pending ? t.common.oneMoment : signup ? t.auth.create : t.auth.signIn}
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </form>
          {signup ? (
            <p className="fineprint">
              {t.auth.signupNote} <Link href="/privacy">{t.auth.privacyLink}</Link>
            </p>
          ) : (
            <p className="fineprint">{t.auth.noRecovery}</p>
          )}
          <p className="auth-switch">
            {signup ? t.auth.haveAccount : t.auth.newHere}{' '}
            <Link href={signup ? '/login' : '/signup'}>
              {signup ? t.auth.signIn : t.auth.createLink}
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
  const { t, city } = useI18n();
  return (
    <div className="preference-fields">
      <label>
        {t.prefs.homeCity}
        <select value={value.home} onChange={(e) => onChange({ ...value, home: e.target.value })}>
          {cities.map((c) => (
            <option key={c.name} value={c.name}>
              {city(c.name)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.prefs.scope}
        <select
          value={value.scope}
          onChange={(e) => onChange({ ...value, scope: e.target.value as Preferences['scope'] })}
        >
          <option value="city">{t.prefs.scopeCity}</option>
          <option value="country">{t.prefs.scopeCountry}</option>
          <option value="europe">{t.prefs.scopeEurope}</option>
        </select>
      </label>
      <label>
        {t.prefs.radius}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={5000}
          step={1}
          value={value.radiusKm ?? ''}
          onChange={(e) =>
            onChange({ ...value, radiusKm: e.target.value ? Number(e.target.value) : null })
          }
          placeholder={t.prefs.noLimit}
        />
        <small>{t.prefs.radiusHint}</small>
      </label>
      <label>
        {t.prefs.dateFrom}
        <input
          type="date"
          value={value.dateFrom ?? ''}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value || null })}
        />
      </label>
      <label>
        {t.prefs.dateTo}
        <input
          type="date"
          min={value.dateFrom ?? undefined}
          value={value.dateTo ?? ''}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value || null })}
        />
      </label>
      <label>
        {t.prefs.maxTravel}
        <select
          value={value.maxHours ?? ''}
          onChange={(e) =>
            onChange({ ...value, maxHours: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">{t.prefs.flexible}</option>
          <option value="1">{t.prefs.oneHour}</option>
          <option value="3">{t.prefs.threeHours}</option>
          <option value="8">{t.prefs.weekend}</option>
        </select>
        <small>{t.prefs.travelHint}</small>
      </label>
      <label>
        {t.prefs.budget}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={10000}
          value={value.budget ?? ''}
          onChange={(e) =>
            onChange({ ...value, budget: e.target.value ? Number(e.target.value) : null })
          }
          placeholder={t.prefs.noLimit}
        />
        <small>{t.prefs.budgetHint}</small>
      </label>
    </div>
  );
}

type Imported = {
  id: string;
  name: string;
  url: string;
  image?: string;
  artistId?: string;
  mapping?: 'provider' | 'name' | 'spotify' | 'ambiguous' | 'none';
};

function Choice({
  name,
  image,
  note,
  selected,
  onClick,
  disabled,
  title,
}: {
  name: string;
  image?: string;
  note: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`artist-choice ${selected ? 'selected' : ''}`}
      style={{ '--gel': gelFor(name) } as React.CSSProperties}
      aria-pressed={selected}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={title}
      onClick={onClick}
    >
      <ArtistPhoto name={name} image={image} />
      <strong>{name}</strong>
      <span>{note}</span>
      <span className="pick-mark" aria-hidden="true">
        <Check size={15} strokeWidth={3} />
      </span>
    </button>
  );
}

export function Onboarding() {
  const { data, toast, reload } = useApp(),
    router = useRouter(),
    searchParams = useSearchParams();
  const { t, locale, city, genre } = useI18n();
  const musicStatus = searchParams.get('music');
  const [step, setStep] = useState(musicStatus ? 2 : 1),
    [selected, setSelected] = useState<string[]>([]),
    [prefs, setPrefs] = useState<Preferences>(data.user?.preferences ?? defaults),
    [manualSearch, setManualSearch] = useState(''),
    [spotifyArtists, setSpotifyArtists] = useState<Imported[]>([]),
    [spotifyLoaded, setSpotifyLoaded] = useState(false),
    [spotifyMessage, setSpotifyMessage] = useState(''),
    // Demo (fictional sample concerts) is opt-in whenever live concerts are available.
    [demo, setDemo] = useState(!data.liveAvailable),
    [liveQuery, setLiveQuery] = useState(''),
    [liveResults, setLiveResults] = useState<Artist[]>([]),
    [livePicked, setLivePicked] = useState<Record<string, Artist>>({}),
    [liveSearching, setLiveSearching] = useState(false),
    [liveMessage, setLiveMessage] = useState(''),
    [liveFailed, setLiveFailed] = useState(false),
    [finding, setFinding] = useState(false);
  useCue(step === 1 ? 'home' : 'artists');
  const goToFeed = useCallback(() => router.push('/app'), [router]);
  const closeFinder = useCallback(() => setFinding(false), []);
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
      if (!result.artists.length) setLiveMessage(t.onboarding.noneFound);
    } catch (error) {
      setLiveResults([]);
      setLiveFailed(true);
      setLiveMessage(error instanceof Error ? error.message : t.onboarding.searchUnavailable);
    } finally {
      setLiveSearching(false);
    }
  }
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  function toggleLive(artist: Artist) {
    setLivePicked((current) => ({ ...current, [artist.id]: artist }));
    toggle(artist.id);
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
      void api<{ artists: Imported[] }>('spotify/artists')
        .then((result) => setSpotifyArtists(result.artists))
        .catch((error) =>
          setSpotifyMessage(error instanceof Error ? error.message : t.artists.spotifyFailed),
        )
        .finally(() => setSpotifyLoaded(true));
    }
  }, [musicStatus, t.artists.spotifyFailed]);
  if (!data.user)
    return (
      <main className="failure">
        <Brand />
        <h1>{t.onboarding.makeYours}</h1>
        <Link className="button primary" href="/signup">
          {t.auth.createLink}
        </Link>
      </main>
    );
  /** Everything the loader needs to show the chosen artists, whichever list they came from. */
  function finderArtists(): FinderArtist[] {
    return selected.map((id) => {
      const known = data.artists.find((a) => a.id === id) ?? livePicked[id];
      const imported = spotifyArtists.find((a) => a.artistId === id);
      return {
        id,
        name: known?.name ?? imported?.name ?? id,
        image: known?.image ?? imported?.image,
        live: !demo && Boolean(known?.providerId),
      };
    });
  }
  return (
    <div className="onboarding">
      <header className="onboarding-top">
        <Brand href="/app" />
        <LanguageSwitch />
      </header>
      <main className="onboarding-main">
        <div className="step-track" aria-hidden="true">
          <i className="complete" />
          <i className={step === 2 ? 'complete' : ''} />
        </div>
        <p className="step-count">{t.onboarding.step(step)}</p>
        <div key={step} className="onboarding-step">
          <h1>{step === 1 ? t.onboarding.whereTitle : t.onboarding.whoTitle}</h1>
          <p className="intro">
            {step === 1
              ? t.onboarding.whereIntro
              : demo
                ? t.onboarding.whoIntroDemo
                : t.onboarding.whoIntroLive}
          </p>
          {step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(2);
                window.scrollTo({ top: 0 });
              }}
            >
              <PreferenceFields value={prefs} onChange={setPrefs} />
              <p className="inline-note">{t.onboarding.spotifyOptional}</p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                />
                <span>{t.onboarding.analytics}</span>
              </label>
              <div className="onboarding-bottom">
                <span>{t.onboarding.locationStep}</span>
                <button className="button primary">
                  {t.onboarding.chooseArtists} <ArrowUpRight size={17} aria-hidden="true" />
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="connect-box">
                <Music2 aria-hidden="true" />
                <div>
                  <strong>{t.onboarding.connectTitle}</strong>
                  <p>{t.onboarding.connectBody}</p>
                </div>
                {data.spotifyAvailable && (
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        const r = await api<{ url: string }>('spotify/connect', {
                          returnTo: 'onboarding',
                        });
                        window.location.assign(r.url);
                      } catch (e) {
                        toast(e instanceof Error ? e.message : t.onboarding.connectFailed);
                      }
                    }}
                  >
                    {t.onboarding.connect}
                  </button>
                )}
              </div>
              {(spotifyMessage || musicStatus === 'denied' || musicStatus === 'failed') && (
                <p className="inline-note" role="status">
                  {spotifyMessage ||
                    (musicStatus === 'denied'
                      ? t.onboarding.spotifyCancelled
                      : t.onboarding.spotifyError)}
                </p>
              )}
              {musicStatus === 'connected' && !spotifyLoaded && !spotifyMessage && (
                <p className="inline-note" role="status">
                  {t.onboarding.spotifyLoading}
                </p>
              )}
              {musicStatus === 'connected' &&
                spotifyLoaded &&
                !spotifyArtists.length &&
                !spotifyMessage && (
                  <p className="inline-note" role="status">
                    {t.onboarding.spotifyNone}
                  </p>
                )}
              {spotifyArtists.length > 0 && (
                <section className="spotify-import" aria-labelledby="from-spotify">
                  <h2 id="from-spotify">{t.onboarding.fromSpotify}</h2>
                  <p>{t.onboarding.fromSpotifyBody}</p>
                  <div className="artist-picker">
                    {spotifyArtists.map((imported) => {
                      const match = imported.artistId
                        ? data.artists.find((artist) => artist.id === imported.artistId)
                        : undefined;
                      const artistId = imported.artistId;
                      return (
                        <Choice
                          key={imported.id}
                          name={imported.name}
                          image={imported.image}
                          note={match?.providerId ? t.onboarding.available : t.onboarding.noLiveYet}
                          selected={Boolean(artistId && selected.includes(artistId))}
                          disabled={!artistId}
                          title={artistId ? undefined : t.onboarding.cantImport}
                          onClick={() => artistId && toggle(artistId)}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
              {demo ? (
                <>
                  {data.liveAvailable ? (
                    <div className="inline-note">
                      {t.onboarding.demoMode}{' '}
                      <button className="text-button" type="button" onClick={() => switchMode(false)}>
                        {t.onboarding.searchReal}
                      </button>
                    </div>
                  ) : (
                    <div className="inline-note">{t.onboarding.liveUnavailable}</div>
                  )}
                  <label className="search-field onboarding-search">
                    <span className="vh">{t.onboarding.chooseManually}</span>
                    <Search size={17} aria-hidden="true" />
                    <input
                      type="search"
                      aria-label={t.onboarding.manualLabel}
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      placeholder={t.onboarding.manualPlaceholder}
                    />
                  </label>
                  <div className="artist-picker">
                    {data.artists
                      .filter(
                        (a) =>
                          !a.providerId &&
                          a.name.toLowerCase().includes(manualSearch.toLowerCase()),
                      )
                      .map((a) => (
                        <Choice
                          key={a.id}
                          name={a.name}
                          image={a.image}
                          note={genre(a.genre)}
                          selected={selected.includes(a.id)}
                          onClick={() => toggle(a.id)}
                        />
                      ))}
                  </div>
                </>
              ) : (
                <section className="live-onboarding" aria-label={t.onboarding.liveSection}>
                  <form
                    className="onboarding-live-search"
                    onSubmit={(e) => void searchLiveArtists(e)}
                  >
                    <label className="search-field onboarding-search">
                      <span>{t.onboarding.realLabel}</span>
                      <input
                        type="search"
                        aria-label={t.onboarding.realLabel}
                        value={liveQuery}
                        onChange={(e) => setLiveQuery(e.target.value)}
                        maxLength={100}
                        placeholder={t.onboarding.realPlaceholder}
                        enterKeyHint="search"
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={liveSearching || liveQuery.trim().length < 2}
                    >
                      {liveSearching ? t.onboarding.searching : t.onboarding.search}
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
                            {t.common.tryAgain}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {liveChoices.length > 0 && (
                    <div className="artist-picker">
                      {liveChoices.map((artist) => (
                        <Choice
                          key={artist.id}
                          name={artist.name}
                          image={artist.image}
                          note={t.onboarding.liveCatalogue}
                          selected={selected.includes(artist.id)}
                          onClick={() => toggleLive(artist)}
                        />
                      ))}
                    </div>
                  )}
                  <button className="text-button" type="button" onClick={() => switchMode(true)}>
                    {t.onboarding.tryDemo}
                  </button>
                </section>
              )}
              <form
                className="bar-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (selected.length) setFinding(true);
                }}
              >
                <div className="onboarding-bottom">
                  <button
                    className="text-button"
                    type="button"
                    aria-label={t.onboarding.back}
                    onClick={() => setStep(1)}
                  >
                    <ChevronLeft size={17} aria-hidden="true" />
                    <span className="back-text">{t.onboarding.back}</span>
                  </button>
                  <span aria-live="polite">{selected.length ? t.onboarding.selected(selected.length) : ''}</span>
                  <button className="button primary" disabled={finding || !selected.length}>
                    {t.onboarding.find} <ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
      {finding && (
        <Finder
          artists={finderArtists()}
          city={city(prefs.home)}
          submit={async () => {
            await api('onboarding', {
              artistIds: selected,
              preferences: { ...prefs, locale },
              mode: demo ? 'sample' : 'live',
              source: onboardingSource(selected, spotifyIds, demo),
            });
            await reload();
          }}
          onReady={goToFeed}
          onCancel={closeFinder}
        />
      )}
    </div>
  );
}
