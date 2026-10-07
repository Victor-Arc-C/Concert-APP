'use client';
import { useEffect, useState } from 'react';
import { BellRing, Share, SquarePlus } from 'lucide-react';
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
            throw new Error(
              'This browser could not register for notifications. Your alerts stay in the inbox.',
            );
          }));
      await api('push/subscribe', subscription.toJSON());
      setStatus('on');
      toast('Notifications are on for this device');
    } catch (e) {
      toast((e as Error).message || 'Notifications could not be turned on.');
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
      toast('Notifications are off for this device');
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
      toast('Test sent. It should arrive in a few seconds.');
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
        <BellRing size={18} />
        On this device
      </h3>
      {status === 'ios-install' ? (
        <>
          <p>
            To get notifications on iPhone, add Encore to your home screen, then open it from there:
          </p>
          <ol className="install-steps">
            <li>
              Tap <Share size={16} aria-label="Share" /> Share in Safari.
            </li>
            <li>
              Choose <SquarePlus size={16} aria-hidden /> <strong>Add to Home Screen</strong>.
            </li>
            <li>Open Encore from the new icon and come back to this page.</li>
          </ol>
        </>
      ) : status === 'unsupported' ? (
        <p>This browser cannot receive notifications. Your alerts stay in the in-app inbox.</p>
      ) : status === 'denied' ? (
        <p>
          Notifications are blocked for Encore. Allow them in your browser or phone settings, then
          reload this page.
        </p>
      ) : status === 'on' ? (
        <>
          <p>New alerts are sent to this device after each concert check.</p>
          <div className="button-row">
            <button type="button" className="button secondary" disabled={working} onClick={test}>
              Send a test
            </button>
            <button type="button" className="button secondary" disabled={working} onClick={disable}>
              Turn off on this device
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Get your alerts as notifications, even when Encore is closed.</p>
          <button type="button" className="button primary" disabled={working} onClick={enable}>
            {working ? 'Turning on…' : 'Turn on notifications'}
          </button>
        </>
      )}
    </div>
  );
}
