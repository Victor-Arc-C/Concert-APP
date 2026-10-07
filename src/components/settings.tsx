'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Download, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useApp, api } from './context';
import { Empty, Modal } from './ui';
import { PreferenceFields } from './onboarding';
import { FeedbackButton } from './feedback';
import { PushSettings } from './push';
import type { Preferences } from '@/domain/types';
export function SettingsPage() {
  const { data } = useApp();
  if (!data.user)
    return (
      <Empty title="Make Encore yours.">
        <p>Create an account to save travel and notification preferences.</p>
        <Link href="/signup" className="button primary">
          Create account
        </Link>
      </Empty>
    );
  return <SettingsForm key={data.user.id} initial={data.user.preferences} />;
}
function SettingsForm({ initial }: { initial: Preferences }) {
  const { data, act, busy, toast, reload } = useApp(),
    router = useRouter();
  const [prefs, setPrefs] = useState(initial),
    [confirmDelete, setConfirmDelete] = useState(false),
    [password, setPassword] = useState(''),
    [syncing, setSyncing] = useState(false),
    [syncMessage, setSyncMessage] = useState('');
  async function sync() {
    setSyncing(true);
    try {
      const result = await api<{ count: number; message: string }>('sync', {});
      setSyncMessage(result.message);
      await reload();
    } catch (e) {
      setSyncMessage((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your way to be there.</h1>
          <p>Your travel plans, your alerts, your data.</p>
        </div>
      </div>
      <div className="settings-layout">
        <div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await act('preferences', prefs, 'Your preferences are saved');
            }}
          >
            <section className="settings-section">
              <h2>Where the music takes you</h2>
              <PreferenceFields value={prefs} onChange={setPrefs} />
            </section>
            <section className="settings-section">
              <h2>
                <Bell size={20} />A little less noise
              </h2>
              <p>
                Choose which alerts you get. They always appear in your inbox, and as notifications
                on devices where you turn them on.
              </p>
              <div className="radio-options">
                {[
                  ['off', 'Off', 'No new alerts.'],
                  ['critical', 'Critical only', 'Verified ticket sale times within 24 hours.'],
                  [
                    'important',
                    'Important',
                    'Home-city shows, favourites, must-see artists and sale reminders.',
                  ],
                  ['everything', 'Everything', 'All relevant new concerts and sale reminders.'],
                ].map(([value, title, description]) => (
                  <label key={value} htmlFor={`notification-${value}`}>
                    <input
                      id={`notification-${value}`}
                      type="radio"
                      name="notifications"
                      value={value}
                      checked={prefs.notifications === value}
                      onChange={() =>
                        setPrefs({ ...prefs, notifications: value as Preferences['notifications'] })
                      }
                    />
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                  </label>
                ))}
              </div>
              <PushSettings />
            </section>
            <section className="settings-section">
              <h2>
                <ShieldCheck size={20} />
                Your data stays yours
              </h2>
              <label className="checkbox-label" htmlFor="analytics-consent">
                <input
                  id="analytics-consent"
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                />
                <span>
                  <strong>Share product usage to improve Encore</strong>
                  <small>
                    Optional. Records in-app actions for up to 30 days. Turning this off and saving
                    deletes existing analytics.
                  </small>
                </span>
              </label>
              <p className="fineprint">
                Your explicit choices power your recommendations. We don’t sell personal listening
                profiles.
              </p>
            </section>
            <button className="button primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save preferences'}
            </button>
          </form>
          <section className="settings-section">
            <h2>Manage your account</h2>
            <div className="button-row">
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  if (await act('auth/logout', {})) router.push('/');
                }}
              >
                Sign out
              </button>
              <a href="/api/export" download="encore-data.json" className="button secondary">
                <Download size={16} />
                Export my data
              </a>
              <button
                className="button secondary"
                onClick={() => act('feedback/reset', {}, 'Dismissed concerts restored')}
              >
                Restore dismissed shows
              </button>
              <button className="text-button danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} />
                Delete account
              </button>
            </div>
          </section>
        </div>
        <aside>
          <section className="settings-section connection-panel">
            <h2>Your music connection</h2>
            <p>
              {data.spotifyConnected
                ? 'Spotify is connected. Choose artists from your imported list.'
                : data.spotifyAvailable
                  ? 'Spotify is available for approved pilot accounts.'
                  : 'Spotify is awaiting provider approval for this pilot. Manual artist selection is ready to use.'}
            </p>
            {data.spotifyConnected ? (
              <>
                <Link href="/app/artists" className="button secondary full">
                  Choose Spotify artists
                </Link>
                <button
                  className="text-button full"
                  onClick={() =>
                    act('spotify/disconnect', {}, 'Spotify disconnected; tokens removed')
                  }
                >
                  Disconnect Spotify
                </button>
              </>
            ) : null}
            <button
              className="button secondary full"
              disabled={!data.spotifyAvailable}
              onClick={async () => {
                try {
                  const r = await api<{ url: string }>('spotify/connect', {
                    returnTo: 'artists',
                  });
                  window.location.assign(r.url);
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              {data.spotifyAvailable
                ? data.spotifyConnected
                  ? 'Reconnect Spotify'
                  : 'Connect Spotify'
                : 'Connection not enabled'}
            </button>
            <Link href="/app/artists" className="text-button">
              Manage artists manually
            </Link>
          </section>
          <section className="settings-section connection-panel">
            <h2>Concert data</h2>
            <p>{data.providerMessage}</p>
            <label>
              Experience
              <select
                value={data.user?.mode}
                disabled={busy}
                onChange={(e) => act('mode', { mode: e.target.value }, 'Concert mode changed')}
              >
                <option value="sample">Sample concerts (fictional)</option>
                <option value="live">Live Ticketmaster listings</option>
              </select>
            </label>
            {data.user?.mode === 'live' && (
              <>
                <button
                  className="button secondary full"
                  disabled={syncing || !data.liveAvailable}
                  onClick={sync}
                >
                  <RefreshCw size={15} />
                  {syncing ? 'Checking your artists…' : 'Refresh live concerts'}
                </button>
                <Link href="/app/artists#live-search" className="button secondary full">
                  Find live artists
                </Link>
                <p className="fineprint">
                  {data.automaticChecks
                    ? 'Automatic checks are on while Encore is running on this computer. New artists are checked within five minutes; existing artists about once an hour. Alerts appear in Your alerts.'
                    : 'Automatic local checks are off. Use Refresh, or configure a scheduled check.'}
                </p>
                {data.artistChecks.map((check) => (
                  <p className="fineprint" key={check.artistId}>
                    <strong>{data.artists.find((a) => a.id === check.artistId)?.name}</strong>
                    {' · '}
                    {check.message
                      ? `Last attempt failed. ${check.message}`
                      : check.checkedAt
                        ? `Checked ${new Date(check.checkedAt).toLocaleString('en-GB')}`
                        : 'Waiting for first check'}
                  </p>
                ))}
                <p className="fineprint">
                  Follow artists from live search first. Refresh is cached for an hour; listings are
                  not real-time inventory.
                </p>
                {syncMessage && (
                  <p className="inline-note" role="status">
                    {syncMessage}
                  </p>
                )}
              </>
            )}
          </section>
          <section className="settings-section connection-panel">
            <h2>Help shape the beta</h2>
            <p>
              Something confusing, missing or broken? Send it straight to the Encore team. Your
              feedback is part of your data export and is deleted with your account.
            </p>
            <FeedbackButton className="button secondary full" />
          </section>
          <Link href="/privacy" className="text-button">
            Read the privacy notice
          </Link>
        </aside>
      </div>
      {confirmDelete && (
        <Modal title="Delete your Encore account?" onClose={() => setConfirmDelete(false)}>
          <p>
            This permanently deletes your preferences, saved concerts, alerts, music connection,
            analytics, beta feedback and account from the active database.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act('account/delete', { password }, 'Account and personal data deleted'))
                router.push('/');
            }}
          >
            <label>
              Confirm your current password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="button destructive full" disabled={busy}>
              Delete my account permanently
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
