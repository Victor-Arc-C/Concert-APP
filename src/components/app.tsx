'use client';
import { useCallback, useEffect, useState, ViewTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Bell, Bookmark, Compass, Heart, LogOut, MapPin, Route, Settings, X } from 'lucide-react';

import type { AppData } from '@/domain/types';
import { useI18n } from '@/i18n/client';
import { AppContext, api } from './context';
import { Brand } from './ui';
import { Stage } from './stage/rig';
import { Auth, Onboarding } from './onboarding';
import { Privacy } from './privacy';
import { Feed, EventDetail, Artists, ArtistDetail, Saved, Inbox } from './screens';
import { SettingsPage } from './settings';
import { TripPlanner, TripsList } from './trips-screen';
import { FeedbackButton } from './feedback';

export function ShowboundApp() {
  const { t } = useI18n();
  const [data, setData] = useState<AppData | null>(null),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const path = usePathname(),
    router = useRouter();
  const musicStatus = useSearchParams().get('music');
  const reload = useCallback(async () => {
    const result = await api<AppData>('state');
    setData(result);
    setFailure('');
  }, []);
  useEffect(() => {
    let active = true;
    api<AppData>('state')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (active) setFailure(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    if (!data?.user?.id || busy) return;
    let active = true;
    const update = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const result = await api<AppData>('state');
        if (active) setData(result);
      } catch {
        // Keep the current screen during a transient background refresh failure.
      }
    };
    const timer = setInterval(() => void update(), 60000);
    document.addEventListener('visibilitychange', update);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [data?.user?.id, busy]);
  async function act(endpoint: string, payload: unknown, message?: string) {
    if (!data?.user) {
      router.push('/signup');
      return false;
    }
    setBusy(true);
    try {
      await api(endpoint, payload);
      await reload();
      if (message) setNotice(message);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.common.somethingWrong);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (failure)
    return (
      <Stage initial="quiet" layout="full">
        <main className="failure">
          <Brand />
          <h1>{t.shell.failure}</h1>
          <p>{failure}</p>
          <button
            className="button primary"
            onClick={() => reload().catch((e) => setFailure(e.message))}
          >
            {t.common.tryAgain}
          </button>
        </main>
      </Stage>
    );
  if (!data)
    return (
      <Stage initial="quiet" layout="full">
        <main className="loading-page" aria-busy="true">
          <Brand />
          <span className="warmup" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <p>{t.shell.loading}</p>
        </main>
      </Stage>
    );
  const context = { data, reload, act, toast: setNotice, busy };
  const navigation = [
    { url: '/app', label: t.nav.forYou, short: t.nav.forYou, icon: Compass },
    { url: '/app/saved', label: t.nav.saved, short: t.nav.savedShort, icon: Bookmark },
    { url: '/app/trips', label: t.nav.trips, short: t.nav.trips, icon: Route },
    { url: '/app/artists', label: t.nav.artists, short: t.nav.artistsShort, icon: Heart },
    { url: '/app/alerts', label: t.nav.alerts, short: t.nav.alertsShort, icon: Bell },
  ];
  const current = (url: string) =>
    path === url ||
    (url === '/app/artists' && path.startsWith('/app/artists/')) ||
    (url === '/app/trips' && path.startsWith('/app/trips/'));
  const unread = data.alerts.some((a) => !a.read_at);
  const home = data.user?.preferences.home ?? 'Paris';
  const shell = path.startsWith('/app');
  let screen: React.ReactNode;
  if (path === '/login' || path === '/signup') screen = <Auth signup={path === '/signup'} />;
  else if (path === '/onboarding') screen = <Onboarding />;
  else if (path === '/privacy') screen = <Privacy />;
  else {
    const content =
      path === '/app' ? (
        <Feed />
      ) : path === '/app/saved' ? (
        <Saved />
      ) : path === '/app/trips' ? (
        <TripsList />
      ) : path.startsWith('/app/trips/') ? (
        <TripPlanner eventId={decodeURIComponent(path.split('/').pop()!)} />
      ) : path === '/app/artists' ? (
        <Artists />
      ) : path === '/app/alerts' ? (
        <Inbox />
      ) : path === '/app/settings' ? (
        <SettingsPage />
      ) : path.startsWith('/app/events/') ? (
        <EventDetail id={decodeURIComponent(path.split('/').pop()!)} />
      ) : path.startsWith('/app/artists/') ? (
        <ArtistDetail id={decodeURIComponent(path.split('/').pop()!)} />
      ) : (
        <div className="empty">
          <h1>{t.shell.notFound}</h1>
          <Link className="button primary" href="/app">
            {t.shell.backToConcerts}
          </Link>
        </div>
      );
    screen = (
      <div className="app-shell">
        <a href="#main" className="skip-link">
          {t.common.skip}
        </a>
        <aside className="sidebar">
          <Brand />
          <nav className="side-nav" aria-label={t.nav.main}>
            {navigation.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                className="side-link"
                aria-current={current(item.url) ? 'page' : undefined}
              >
                <item.icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
                {item.url === '/app/saved' && data.saved.length > 0 && (
                  <small>{data.saved.length}</small>
                )}
                {item.url === '/app/trips' && (data.savedTrips?.length ?? 0) > 0 && (
                  <small>{data.savedTrips!.length}</small>
                )}
                {item.url === '/app/alerts' && unread && (
                  <i className="notification-dot" aria-label={t.nav.unread} />
                )}
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            <FeedbackButton className="side-link" />
            <Link
              className="side-link"
              href="/app/settings"
              aria-current={path === '/app/settings' ? 'page' : undefined}
            >
              <Settings size={19} aria-hidden="true" />
              {t.nav.settings}
            </Link>
            {data.user ? (
              <button
                className="profile"
                aria-label={t.nav.signOut}
                disabled={busy}
                onClick={async () => {
                  if (await act('auth/logout', {})) router.push('/');
                }}
              >
                <span className="profile-avatar" aria-hidden="true">
                  {data.user.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{data.user.name}</strong>
                  <small>{t.nav.privateBeta}</small>
                </span>
                <LogOut size={16} aria-hidden="true" />
              </button>
            ) : (
              <Link href="/signup" className="button primary">
                {t.nav.createAccount}
              </Link>
            )}
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span className="mobile-brand">
              <Brand href="/app" />
            </span>
            <span className="topbar-spacer" />
            <span className="desktop-only">
              <FeedbackButton className="icon-button" label={false} />
            </span>
            <Link href="/app/settings" className="city-button" aria-label={t.nav.homeCity(home)}>
              <MapPin size={16} aria-hidden="true" />
              <span>{home}</span>
            </Link>
            <Link
              href="/app/alerts"
              className="icon-button"
              aria-label={unread ? `${t.nav.openAlerts}, ${t.nav.unread}` : t.nav.openAlerts}
            >
              <Bell size={19} aria-hidden="true" />
              {unread && <i className="notification-dot" />}
            </Link>
          </header>
          <main id="main" className="main">
            {!data.user && (
              <p className="banner">
                <span>{t.shell.sampleProfile}</span>
                <Link href="/signup">
                  {t.shell.findYourOwn} <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </p>
            )}
            {data.user?.mode === 'sample' && (
              <p className="banner">
                <span>{t.shell.sampleMode}</span>
                <Link href="/app/settings">{t.shell.dataSettings}</Link>
              </p>
            )}
            {musicStatus === 'denied' && (
              <p className="form-error" role="alert">
                {t.shell.spotifyDenied}
              </p>
            )}
            {musicStatus === 'failed' && (
              <p className="form-error" role="alert">
                {t.shell.spotifyFailed}
              </p>
            )}
            <ViewTransition key={path} enter="screen-swap" exit="screen-swap" default="none">
              <div className="screen">{content}</div>
            </ViewTransition>
            <footer className="app-footer">
              <span>{data.user?.mode === 'live' ? t.shell.footerLive : t.shell.footerSample}</span>
              <Link href="/privacy">{t.shell.privacy}</Link>
            </footer>
          </main>
        </div>
        <nav className="tabbar" aria-label={t.nav.mobile}>
          {navigation.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              aria-label={item.label}
              aria-current={current(item.url) ? 'page' : undefined}
            >
              <item.icon size={22} strokeWidth={current(item.url) ? 2.4 : 2} aria-hidden="true" />
              <span>{item.short}</span>
              {item.url === '/app/saved' && data.saved.length > 0 && (
                <span className="tab-count" aria-hidden="true">
                  {data.saved.length}
                </span>
              )}
              {item.url === '/app/alerts' && unread && <span className="tab-dot" aria-hidden="true" />}
            </Link>
          ))}
        </nav>
      </div>
    );
  }
  // One Stage for every state, so the rig powers on once and keeps its lights between screens.
  return (
    <Stage layout={shell ? 'app' : 'full'}>
      <AppContext.Provider value={context}>
        {screen}
        {notice && (
          <div className="toast" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} className="icon-button" aria-label={t.common.close}>
              <X size={16} />
            </button>
          </div>
        )}
      </AppContext.Provider>
    </Stage>
  );
}
