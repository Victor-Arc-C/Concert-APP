# Omio travel planning

Showbound offers **Plan your trip** on concert details. The existing modal/sheet, controls and English/French translations let users review and edit departure city, destination, departure date, optional return date and transport preference. The existing full itinerary remains accessible separately.

This is an external search handoff, not live inventory. No Omio API, feed, price estimate, booking confirmation or commission calculation is used.

## Configuration

Server-side variables (never `NEXT_PUBLIC_`):

| Variable | Value |
| --- | --- |
| `OMIO_PARTNER_ID` | Your real numeric Impact publisher/partner account ID |
| `OMIO_ENABLED` | Exactly `true`, only after confirming active Omio programme approval |

Both are needed. Missing, malformed or disabled configuration produces an explicit unavailable state and no Omio URL. Nothing falls back to an untracked link. Variables are intentionally blank/disabled in `.env.example` and the production template. Put real values in hosting secrets or ignored `.env.local`; redeploy/restart after changing them.

Sign into the approved Impact account associated with Showbound, open the account's profile/account details and obtain its publisher/partner account ID. Confirm the Omio Travel Partner Program is active, then enter that ID in Omio's official **Redirect link** configurator: [Omio Affiliate Tools](https://www.omio.com/affiliate/search-widget). The partner ID occupies the segment after `/c/`; it is not the ad ID, campaign ID, website verification token or an API key. If unclear, have Omio affiliate support confirm the identifier. A syntactically valid number does not prove entitlement or activation.

**Migration:** `OMIO_AFFILIATE_URL` is no longer read. Existing installations must configure the two variables above. Do not copy an ID from test fixtures. The old Omio route-page slug construction and unattributed fallback were removed; existing itinerary Omio links also use the dated search template when configured.

## Official URL and validation

Template verified against the official configurator on 9 October 2026:

```text
https://omio.sjv.io/c/{partner_id}/4057579/7385?u={encoded_omio_url}
https://www.omio.com/links/626fa8a9-f982-43d0-ace9-9a13f6b14612
```

The inner URL uses `departurePosTerm`, `arrivalPosTerm`, `departureDate`, optional `returnDate` and `travelMode`, plus the UI `locale` (`en`/`fr`) and `currency=EUR`. Supported modes are `TRAIN`, `BUS`, `FLIGHT`, `FERRY`; leaving the preference blank omits `travelMode`. `URLSearchParams` encodes each location first, then the complete destination URL as the outer `u`. Do not manually pre-encode values or encode the entire browser href again. No user identifier, email or analytics sub-ID enters the URL.

Before enabling production:

1. Confirm the actual Impact account and programme approval, set real configuration in preview, and use a real upcoming concert in live mode.
2. Open the planner, check/edit the route and dates, and inspect the search response in browser developer tools. Decode `u` once with `new URL(link).searchParams.get('u')`, then parse that result with `new URL(...)`; verify cities with accents/ampersands, dates and mode survive exactly.
3. Compare the path/campaign with the official configurator for your own account. Continue once and verify the **actual final Omio page** resolves the intended places, date, mode and optional return. Omio can require clarification for ambiguous locations and may not serve the route.
4. Check the click in Impact using its available reporting/diagnostics. Browser arrival alone does not verify affiliate attribution, a commission or conversion. Do not create a booking solely to simulate success.
5. Disable `OMIO_ENABLED` if the template stops resolving or the programme is paused. Existing non-Omio concert and itinerary features continue working.

Automated tests use a synthetic ID and intercept outbound navigation before it reaches Impact. They verify URL construction and the browser handoff, not Omio's live landing page or your account's attribution. Those account-dependent checks remain a release gate for activation.

## Data, dates and privacy

- Saved home location is used only when present. No Paris fallback. Destination starts from the stored concert city; unknown values remain blank. Users can edit both. Omio resolves free text; Showbound does not claim geocoding or transport coverage.
- `Concert.date` is already a provider-local `YYYY-MM-DD`; no UTC conversion is applied. Concert eligibility uses today in the event’s IANA timezone. With an invalid/missing zone, only dates already past everywhere (UTC−12) are rejected, and the UI identifies the unconfirmed timezone. Departure cities have no verified timezone, so travel-date minimums also use UTC−12; a date still current west of the venue is not incorrectly rejected. Omio must resolve the actual local times.
- The concert day is an explicit suggestion, not a guaranteed suitable travel day. Return starts empty. Users must check origin-local departures, destination-local arrivals and enough time before the show. No station timezone or departure timezone is guessed.
- Invalid dates, past calendar dates, cancelled/postponed events and sample concerts cannot generate handoffs. Equivalent departure/destination names are rejected with local-transport guidance. Unknown aliases cannot be equated without a geocoder.
- Requests use authenticated, same-origin, rate-limited POST endpoints and authorize concert sample/live mode against the database. Locations/dates are never put in Showbound request query strings. No arbitrary redirect URL is accepted. The server and browser validate fixed HTTPS hosts and nested URL shape.
- Existing opt-in analytics storage, opt-out deletion, export, account deletion and 30-day retention apply. The server records only concert ID, stored concert destination, provider, sample/live mode, supported travel mode and fixed failure code. User-entered origin/destination, dates and full URLs are not logged.

| Event | Meaning |
| --- | --- |
| `travel_planning_opened` | User opens the planner; concert authorization succeeded |
| `travel_search_submitted` | Server received a search submission for an authorized concert |
| `omio_redirect_clicked` | Continue produced a validated handoff URL; not evidence of arrival, booking or attribution |
| `travel_planning_failed` | Server found disabled configuration, ineligible event or invalid search/link |

Network failures and browser-native form validation are displayed locally; they cannot reliably be recorded by an unreachable server. Existing itinerary direct links do not emit these planner funnel events.

## Architecture and widget decision

- `src/domain/travel-planning.ts`: shared search contract, calendar validation, failure codes and redirect validation.
- `src/server/providers/omio.ts`: official URL construction and fail-closed activation.
- `src/server/travel-planning.ts`: defaults, event eligibility, privacy-safe analytics and provider orchestration.
- `src/server/api.ts`: existing authentication/origin/rate-limit boundary, using `travel/planning/open` and `travel/planning/search`.
- `src/components/travel-planner.tsx`: existing native modal, editable form, retries and validated navigation.

The official widget was evaluated against the configurator. It loads external JavaScript and CSS and duplicates the native editable form. Dynamic links satisfy this concert-specific flow without external scripts, widget lifecycle handling, new dependencies or CSP changes. No widget is installed.

`TravelSearchProvider` is deliberately a small link-provider interface, separate from `TravelProvider` inventory/quote adapters. If Omio reopens an approved API, implement a separate official inventory adapter with timeout, availability, freshness and price semantics after obtaining access. Do not turn these external searches or non-real-time feeds into apparent quotes. The UI/validation can be reused; API entitlement and attribution must be reverified.

## Local verification

```sh
npm run typecheck
npm run lint
npm test -- --maxWorkers=1
npm run build
# Start an isolated test database on an unused port (no live provider credentials):
APP_ENV=test APP_URL=http://127.0.0.1:3107 LOCAL_DATABASE_PATH=.data/omio-e2e npm start -- --port 3107
# In another terminal:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npm run test:e2e
```

Playwright covers Chromium and WebKit, mobile overflow, edited route/date values, external navigation interception, French locale, blank locations, disabled/error states and keyboard close/focus restoration. Unit/API tests cover nested encoding, tampered redirects, configuration, dates/timezones, same-city routes, authorization/origin checks, rate limiting and consent-aware analytics.
