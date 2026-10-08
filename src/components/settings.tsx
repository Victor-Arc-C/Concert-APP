'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Download, Languages, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useApp, api } from './context';
import { Empty, LanguageSwitch, Modal } from './ui';
import { PreferenceFields } from './onboarding';
import { FeedbackButton } from './feedback';
import { PushSettings } from './push';
import { useCue } from './stage/rig';
import type { Preferences } from '@/domain/types';

export function SettingsPage() {
  const { data } = useApp();
  const { t } = useI18n();
  useCue('quiet');
  if (!data.user)
    return (
      <Empty title={t.settings.signedOutTitle}>
        <p>{t.settings.signedOutBody}</p>
        <div className="button-row">
          <Link href="/signup" className="button primary">
            {t.settings.createAccount}
          </Link>
        </div>
      </Empty>
    );
  return <SettingsForm key={data.user.id} initial={data.user.preferences} />;
}

function SettingsForm({ initial }: { initial: Preferences }) {
  const { data, act, busy, toast, reload } = useApp(),
    router = useRouter();
  const { t, f, s, locale } = useI18n();
  const [prefs, setPrefs] = useState(initial),
    [confirmDelete, setConfirmDelete] = useState(false),
    [password, setPassword] = useState(''),
    [syncing, setSyncing] = useState(false),
    [syncMessage, setSyncMessage] = useState('');
  async function sync() {
    setSyncing(true);
    try {
      const result = await api<{ count: number; message: string }>('sync', {});
      setSyncMessage(s(result.message));
      await reload();
    } catch (e) {
      setSyncMessage((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }
  return (
    <>
      <header className="page-head">
        <h1>{t.settings.title}</h1>
        <p className="page-intro">{t.settings.intro}</p>
      </header>
      <div className="settings-layout">
        <div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await act('preferences', { ...prefs, locale }, t.prefs.saved);
            }}
          >
            <section className="panel settings-section" aria-labelledby="where-title">
              <h2 id="where-title">{t.settings.whereTitle}</h2>
              <PreferenceFields value={prefs} onChange={setPrefs} />
            </section>
            <section className="panel settings-section" aria-labelledby="alerts-title">
              <h2 id="alerts-title">
                <Bell size={20} aria-hidden="true" />
                {t.settings.alertsTitle}
              </h2>
              <p>{t.settings.alertsBody}</p>
              <div className="radio-options">
                {(['off', 'critical', 'important', 'everything'] as const).map((value) => {
                  const [title, description] = t.settings.notification[value];
                  return (
                    <label key={value} htmlFor={`notification-${value}`}>
                      <input
                        id={`notification-${value}`}
                        type="radio"
                        name="notifications"
                        value={value}
                        checked={prefs.notifications === value}
                        onChange={() => setPrefs({ ...prefs, notifications: value })}
                      />
                      <span>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
              <PushSettings />
            </section>
            <section className="panel settings-section" aria-labelledby="data-title">
              <h2 id="data-title">
                <ShieldCheck size={20} aria-hidden="true" />
                {t.settings.dataTitle}
              </h2>
              <label
                className="checkbox-label"
                htmlFor="analytics-consent"
                style={{ marginTop: 14 }}
              >
                <input
                  id="analytics-consent"
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                />
                <span>
                  <strong>{t.settings.analytics}</strong>
                  <small>{t.settings.analyticsHint}</small>
                </span>
              </label>
              <p className="fineprint" style={{ marginTop: 12 }}>
                {t.settings.dataNote}
              </p>
            </section>
            <div className="save-row">
              <button className="button primary" disabled={busy}>
                {busy ? t.prefs.saving : t.prefs.save}
              </button>
            </div>
          </form>
          <section className="panel settings-section" aria-labelledby="account-title">
            <h2 id="account-title">{t.settings.accountTitle}</h2>
            <div className="button-row" style={{ marginTop: 14 }}>
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  if (await act('auth/logout', {})) router.push('/');
                }}
              >
                {t.settings.signOut}
              </button>
              <a href="/api/export" download="showbound-data.json" className="button secondary">
                <Download size={16} aria-hidden="true" />
                {t.settings.export}
              </a>
              <button
                className="button secondary"
                onClick={() => act('feedback/reset', {}, t.settings.restored)}
              >
                {t.settings.restore}
              </button>
              <button className="text-button danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} aria-hidden="true" />
                {t.settings.deleteAccount}
              </button>
            </div>
          </section>
        </div>
        <aside>
          <section
            className="panel settings-section connection-panel"
            aria-labelledby="language-title"
          >
            <h2 id="language-title">
              <Languages size={20} aria-hidden="true" />
              {t.settings.languageTitle}
            </h2>
            <p>{t.settings.languageBody}</p>
            <LanguageSwitch />
          </section>
          <section
            className="panel settings-section connection-panel"
            aria-labelledby="music-title"
          >
            <h2 id="music-title">{t.settings.musicTitle}</h2>
            <p>
              {data.spotifyConnected
                ? t.settings.spotifyConnected
                : data.spotifyAvailable
                  ? t.settings.spotifyAvailable
                  : t.settings.spotifyPending}
            </p>
            {data.spotifyConnected ? (
              <>
                <Link href="/app/artists" className="button secondary full">
                  {t.settings.chooseSpotify}
                </Link>
                <button
                  className="text-button full"
                  onClick={() => act('spotify/disconnect', {}, t.settings.disconnected)}
                >
                  {t.settings.disconnect}
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
                  ? t.settings.reconnect
                  : t.settings.connect
                : t.settings.notEnabled}
            </button>
            <Link href="/app/artists" className="text-button">
              {t.settings.manual}
            </Link>
          </section>
          <section
            className="panel settings-section connection-panel"
            aria-labelledby="concert-data-title"
          >
            <h2 id="concert-data-title">{t.settings.dataSourceTitle}</h2>
            <p>{s(data.providerMessage)}</p>
            <label>
              {t.settings.experience}
              <select
                value={data.user?.mode}
                disabled={busy}
                onChange={(e) => act('mode', { mode: e.target.value }, t.settings.modeChanged)}
              >
                <option value="sample">{t.settings.sampleOption}</option>
                <option value="live">{t.settings.liveOption}</option>
              </select>
            </label>
            {data.user?.mode === 'live' && (
              <>
                <button
                  className="button secondary full"
                  disabled={syncing || !data.liveAvailable}
                  onClick={sync}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  {syncing ? t.settings.checking : t.settings.refresh}
                </button>
                <Link href="/app/artists#live-search" className="button secondary full">
                  {t.settings.findLive}
                </Link>
                <p className="fineprint">
                  {data.automaticChecks ? t.settings.autoOn : t.settings.autoOff}
                </p>
                {data.artistChecks.map((check) => (
                  <p className="fineprint" key={check.artistId}>
                    <strong>{data.artists.find((a) => a.id === check.artistId)?.name}</strong>
                    {' · '}
                    {check.message
                      ? t.settings.lastFailed(s(check.message))
                      : check.checkedAt
                        ? t.settings.checkedAt(f.dateTime(check.checkedAt))
                        : t.settings.waiting}
                  </p>
                ))}
                <p className="fineprint">{t.settings.refreshNote}</p>
                {syncMessage && (
                  <p className="inline-note" role="status">
                    {syncMessage}
                  </p>
                )}
              </>
            )}
          </section>
          <section className="panel settings-section connection-panel" aria-labelledby="beta-title">
            <h2 id="beta-title">{t.settings.feedbackTitle}</h2>
            <p>{t.settings.feedbackBody}</p>
            <FeedbackButton className="button secondary full" />
          </section>
          <p style={{ marginTop: 14 }}>
            <Link href="/privacy" className="text-button">
              {t.settings.privacy}
            </Link>
          </p>
        </aside>
      </div>
      {confirmDelete && (
        <Modal title={t.settings.deleteTitle} onClose={() => setConfirmDelete(false)}>
          <p>{t.settings.deleteBody}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act('account/delete', { password }, t.settings.deleted)) router.push('/');
            }}
          >
            <label>
              {t.settings.confirmPassword}
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="button destructive full" disabled={busy}>
              {t.settings.deleteForever}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
