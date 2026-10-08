'use client';
import { useEffect, useState } from 'react';
import { BellRing, Share, SquarePlus } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { api, useApp } from './context';

type Status = 'checking' | 'unconfigured' | 'ios-install' | 'unsupported' | 'denied' | 'off' | 'on';

function keyBytes(base64url: string) {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
function isIos() {
  // iPadOS reports itself as a Mac; touch points tell them apart.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
function installed() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
async function registration() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
}

/** Push notifications for this device, with the iPhone "Add to Home Screen" step when needed. */
export function PushSettings() {
  const { data, toast } = useApp();
  const { t } = useI18n();
  const publicKey = data.pushPublicKey ?? null;
  const [status, setStatus] = useState<Status>('checking'),
    [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function detect(): Promise<Status> {
      if (!publicKey) return 'unconfigured';
      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      // Safari on iPhone only exposes Web Push to apps added to the home screen (iOS 16.4+).
      if (isIos() && !installed()) return 'ios-install';
      if (!supported) return 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      const subscription = await (await registration()).pushManager.getSubscription();
      return subscription ? 'on' : 'off';
    }
    detect()
      .catch(() => 'unsupported' as const)
      .then((next) => {
        if (!cancelled) setStatus(next);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setWorking(true);
    try {
      // Must run straight from the tap: iOS refuses permission prompts outside a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const worker = await registration();
      await navigator.serviceWorker.ready;
      const existing = await worker.pushManager.getSubscription();
      const subscription =
        existing ??
        (await worker.pushManager
          .subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
          .catch(() => {
            // Browser wording ("Registration failed - …") is not useful to show as-is.
            throw new Error(t.push.registerFailed);
          }));
      await api('push/subscribe', subscription.toJSON());
      setStatus('on');
      toast(t.push.onToast);
    } catch (e) {
      toast((e as Error).message || t.push.failed);
    } finally {
      setWorking(false);
    }
  }
  async function disable() {
    setWorking(true);
    try {
      const subscription = await (await registration()).pushManager.getSubscription();
      if (subscription) {
        await api('push/unsubscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setStatus('off');
      toast(t.push.offToast);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function test() {
    setWorking(true);
    try {
      await api('push/test', {});
      toast(t.push.testToast);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  if (status === 'checking' || status === 'unconfigured') return null;
  return (
    <div className="push-settings" aria-live="polite">
      <h3>
        <BellRing size={18} aria-hidden="true" />
        {t.push.title}
      </h3>
      {status === 'ios-install' ? (
        <>
          <p>{t.push.iosIntro}</p>
          <ol className="install-steps">
            <li>
              {t.push.iosTap} <Share size={16} aria-hidden /> {t.push.iosShare} {t.push.iosInSafari}
            </li>
            <li>
              <SquarePlus size={16} aria-hidden /> <strong>{t.push.iosStep2}</strong>
            </li>
            <li>{t.push.iosStep3}</li>
          </ol>
        </>
      ) : status === 'unsupported' ? (
        <p>{t.push.unsupported}</p>
      ) : status === 'denied' ? (
        <p>{t.push.denied}</p>
      ) : status === 'on' ? (
        <>
          <p>{t.push.on}</p>
          <div className="button-row">
            <button type="button" className="button secondary" disabled={working} onClick={test}>
              {t.push.test}
            </button>
            <button type="button" className="button secondary" disabled={working} onClick={disable}>
              {t.push.turnOff}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{t.push.offIntro}</p>
          <button type="button" className="button primary" disabled={working} onClick={enable}>
            {working ? t.push.turningOn : t.push.turnOn}
          </button>
        </>
      )}
    </div>
  );
}
