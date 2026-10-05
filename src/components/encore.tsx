'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Compass,
  Bookmark,
  Heart,
  Bell,
  Settings,
  MapPin,
  ChevronDown,
  ArrowUpRight,
  AudioLines,
  X,
  LogOut,
} from 'lucide-react';
import type { AppData } from '@/domain/types';
import { AppContext, api } from './context';
import { Brand } from './ui';
import { Landing, Auth, Onboarding, Privacy } from './onboarding';
import { Feed, EventDetail, Artists, ArtistDetail, Saved, Inbox } from './screens';
import { SettingsPage } from './settings';
const navigation = [
  { url: '/app', label: 'For you', icon: Compass },
  { url: '/app/saved', label: 'Saved shows', icon: Bookmark },
  { url: '/app/artists', label: 'Your artists', icon: Heart },
  { url: '/app/alerts', label: 'Your alerts', icon: Bell },
];
export function Encore() {
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
      setNotice(error instanceof Error ? error.message : 'Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (failure)
    return (
      <main className="failure">
        <Brand />
        <h1>We couldn’t load your concerts.</h1>
        <p>{failure}</p>
        <button
          className="button primary"
          onClick={() => reload().catch((e) => setFailure(e.message))}
        >
          Try again
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="loading-page">
        <Brand />
        <div className="loading-wave">
          <AudioLines />
        </div>
        <p>Finding your next great night…</p>
      </main>
    );
  const context = { data, reload, act, toast: setNotice, busy };
  let screen: React.ReactNode;
  if (path === '/') screen = <Landing />;
  else if (path === '/login' || path === '/signup') screen = <Auth signup={path === '/signup'} />;
  else if (path === '/onboarding') screen = <Onboarding />;
  else if (path === '/privacy') screen = <Privacy />;
  else {
    const content =
      path === '/app' ? (
        <Feed />
      ) : path === '/app/saved' ? (
        <Saved />
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
          <h1>Page not found</h1>
          <Link href="/app">Back to your concerts</Link>
        </div>
      );
    screen = (
      <div className="app-shell">
        <a href="#main" className="skip-link">
          Skip to concerts
        </a>
        <aside className="sidebar">
          <Brand />
          <div className="nav-label">Your live music, closer.</div>
          <nav aria-label="Main navigation">
            {navigation.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                className={`nav-item ${path === item.url || (item.url === '/app/artists' && path.startsWith('/app/artists/')) ? 'active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                {item.url === '/app/saved' && data.saved.length > 0 && (
                  <small>{data.saved.length}</small>
                )}
                {item.url === '/app/alerts' && data.alerts.some((a) => !a.read_at) && (
                  <i className="notification-dot" />
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <AudioLines />
            <p>
              Less searching.
              <br />
              More being there.
            </p>
            <Link href="/app/artists">
              Make it yours <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="sidebar-bottom">
            <Link
              className={`nav-item ${path === '/app/settings' ? 'active' : ''}`}
              href="/app/settings"
            >
              <Settings size={19} />
              Settings
            </Link>
            {data.user ? (
              <button
                className="profile"
                onClick={async () => {
                  if (await act('auth/logout', {})) {
                    router.push('/');
                  }
                }}
              >
                <span className="profile-avatar">{data.user.name.slice(0, 1)}</span>
                <span>
                  <strong>{data.user.name}</strong>
                  <small>Encore early access</small>
                </span>
                <LogOut size={16} />
              </button>
            ) : (
              <Link href="/signup" className="button primary">
                Create your account
              </Link>
            )}
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="mobile-brand">
              <Brand />
            </div>
            <span className="topbar-title">A little closer to the music.</span>
            <div className="topbar-actions">
              <Link href="/app/settings" className="location-button">
                <MapPin size={15} />
                {data.user?.preferences.home ?? 'Paris'}
                <ChevronDown size={14} />
              </Link>
              <Link href="/app/alerts" className="icon-button" aria-label="Open alerts">
                <Bell size={18} />
                {data.alerts.some((a) => !a.read_at) && <i className="notification-dot" />}
              </Link>
            </div>
          </header>
          <main id="main" className="main-content">
            {!data.user && (
              <div className="preview-banner">
                <span>Sample profile. Concerts, dates and prices are fictional.</span>
                <Link href="/signup">
                  Find your own concerts <ArrowUpRight size={14} />
                </Link>
              </div>
            )}
            {data.user?.mode === 'sample' && (
              <div className="preview-banner">
                <span>Sample mode. Concerts, dates and prices are fictional.</span>
                <Link href="/app/settings">Data settings</Link>
              </div>
            )}
            {musicStatus === 'denied' && (
              <p className="form-error" role="alert">
                Spotify access was declined. You can reconnect or choose artists manually.
              </p>
            )}
            {musicStatus === 'failed' && (
              <p className="form-error" role="alert">
                The Spotify connection could not be verified. Start a new connection from settings.
              </p>
            )}
            {content}
            <footer className="app-footer">
              <span>
                {data.user?.mode === 'live'
                  ? 'Listings from Ticketmaster. Check the seller before travelling.'
                  : 'Sample concerts and prices. No real ticket inventory.'}
              </span>
              <Link href="/privacy">Privacy & sources</Link>
            </footer>
          </main>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              aria-label={item.label}
              className={path === item.url ? 'active' : ''}
            >
              <item.icon size={21} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    );
  }
  return (
    <AppContext.Provider value={context}>
      {screen}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            onClick={() => setNotice('')}
            className="icon-button"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
