# Push notifications and the installable app

Showbound is an installable web app (PWA). On iPhone, users add it to the home screen from Safari
(Share → Add to Home Screen); on Android and desktop, browsers offer to install it. Once
installed on iPhone (iOS 16.4+), or in any modern desktop browser, a user can turn on
notifications in **Settings → A little less noise → On this device**.

## What is sent, and when

- The scheduled concert check (`/api/jobs`, see `vercel.json`) evaluates alerts as before, then
  pushes **only the alerts created by that run**, for live accounts, if they are still unread.
  Alerts created while the user had Showbound open are not pushed: they were already on screen.
- The user's alert level (Off / Critical / Important / Everything) applies unchanged: push only
  delivers what the inbox would show.
- At most three alerts are pushed individually per run; anything beyond is folded into one
  "N more concerts for you" notification that opens the inbox.
- Sample (fictional) events are never pushed.
- Tapping a notification opens the concert in Showbound. The service worker only opens same-origin
  paths.
- **Delay:** pushes go out when the scheduled check runs. On Vercel Hobby that is once a day
  (05:00 UTC), so this is not yet a sale-opening alarm. A more frequent schedule needs Vercel Pro
  or an external scheduler calling `/api/jobs` with `CRON_SECRET`.

## Configuration

```
npx web-push generate-vapid-keys
```

Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in Vercel (Production and Preview), and optionally
`VAPID_SUBJECT` (`mailto:` or `https://`; defaults to `PRIVACY_CONTACT_EMAIL`, then `APP_URL`).
Without both keys, the settings panel stays hidden and alerts remain in-app only.
Rotating the key pair invalidates every existing device subscription; users must turn
notifications on again.

## Data and safety

- One row per device in `push_subscriptions` (migration 11): the endpoint, its encryption keys,
  creation and last-delivery time. Deleted with the account, when the user turns notifications
  off, or when the push service reports the device gone (HTTP 404/410). Ten devices per account
  at most.
- The server only accepts endpoints on the browser vendors' push services (Apple, Google,
  Mozilla, Microsoft) over HTTPS, so a client cannot make the server call an arbitrary URL.
- Endpoints are never logged and are not included in the data export (only device count and
  dates are), because they identify a device to the vendor.
- `POST /api/push/test` sends a test notification to the user's own devices (5 per hour).

## Regenerating the icons

`node scripts/generate-icons.mjs` renders the home-screen icons (`public/icons/`,
`src/app/apple-icon.png`, `src/app/icon.png`) and the Android notification badge from one SVG.
