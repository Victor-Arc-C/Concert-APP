# Analytics and error monitoring (CON-9)

Events use lowercase `object_action` names. Product analytics stay in the existing PostgreSQL `analytics` table, require opt-in, and carry a server timestamp, internal user ID and explicit sample/live mode. No external analytics service or replay SDK is installed. Never use sample events as real demand evidence. The launch metric definitions are in [MVP_SCOPE.md](MVP_SCOPE.md).

| Event | Trigger | Properties |
| --- | --- | --- |
| `onboarding_completed` | Successful onboarding write after consent choice | mode; source (`manual`, `spotify`, `mixed` or `demo`) when sent by the client, so manual selection is never reported as a Spotify import |
| `spotify_connected` | Successful OAuth callback | mode |
| `concert_impression` | At least half a feed card intersects the viewport while the document is visible; once per mounted card/user | eventId, source, recommendationSource, provider, ticketLinkAvailable, mode |
| `concert_opened` | Detail view opens | same concert context |
| `concert_saved`, `concert_dismissed` | Successful feedback write | same concert context |
| `ticket_link_clicked` | Validated outbound endpoint succeeds | same concert context; does not imply purchase |
| `must_see_clicked` | Successful intent write | artistId, mode |
| `notification_enabled`, `notification_opened` | Successful preference/read update | mode; alertId for open |

`source` identifies the UI surface. `recommendationSource` is derived from stored affinity: favorite, followed or discovery; it is not a Spotify listening score. The server checks the concert exists in the account's current mode and derives ticket-link availability from its own data. The client endpoint accepts only impressions/opens and an event ID; it cannot forge OAuth, onboarding, save or ticket-click events or add arbitrary properties.

Counts may include repeat visits/remounts; aggregate distinct user/concert pairs as specified in CON-5. Impressions are a visibility signal, not proof someone read a card. Opt-out deletes stored analytics and suppresses further writes; account deletion cascades. Scheduled cleanup removes events after 30 days. Existing operational outbound-click records are distinct from optional analytics and are included in account export/deletion.

Signup happens before the existing onboarding consent choice, so a `signup_completed` analytics event is deliberately not backfilled. Activation's signup denominator is unavailable until a consent-compatible signup measurement decision is implemented; do not substitute onboarding counts. OAuth emission is wired but real Spotify validation remains blocked by CON-10. Recommendation CTR, save rate and ticket-link CTR can use the documented event semantics; retention needs a mature observation window.

## Operational errors

`src/server/monitoring.ts` writes one-line JSON to server stderr with only `level`, `service`, fixed `code` and UTC `time`. Codes cover unexpected API errors, provider failures, Next.js captured server errors, failed job accounts, scheduler failures and analytics writes. It intentionally accepts no raw error, stack, URL, headers, body, email or user identity. Product analytics consent does not govern these anonymous operational counters.

For a local check, run the app in a terminal and inspect JSON lines with `service: encore`. In deployment, collect stderr through the hosting platform, count by code/time and alert on sustained API/framework errors or scheduler failures. Retain operational logs according to the deployment policy; no hosted log service, alert routing or on-call integration is provisioned by this change. Next.js/platform access logs must be configured separately not to capture query strings or request bodies.

Verification: unit tests exercise consent suppression, server-derived source properties, non-fatal analytics failures and safe log fields. Browser/API tests verify onboarding/impression/open/save events, invalid event rejection, forged action/property rejection and deletion on opt-out. Provider/Spotify credentials are not needed for these tests.

## Beta feedback (CON-36)

Signed-in users can open **Send feedback** from the sidebar, the top bar or **Settings → Help shape the beta**. A message holds free text (max 2,000 characters), an optional 1–5 rating, the in-app screen path (no query string) and the account's sample/live mode. It is stored in the `beta_feedback` table of Showbound's own database; no third-party service is involved. It is not product analytics, so it does not depend on the analytics opt-in. It is included in **Export my data** and deleted with the account. Each user can send 5 messages per hour.

To read the latest feedback, run this in the Neon SQL editor (Neon console → your project → SQL Editor):

```sql
SELECT f.created_at, u.name, f.rating, f.screen, f.mode, f.message
FROM beta_feedback f
JOIN users u ON u.id = f.user_id
ORDER BY f.created_at DESC
LIMIT 50;
```

Average rating and volume per week:

```sql
SELECT date_trunc('week', created_at) AS week, COUNT(*) AS messages,
       ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(rating) AS rated
FROM beta_feedback
GROUP BY 1 ORDER BY 1 DESC;
```

## Weekly metrics report (CON-37)

`npm run metrics:weekly` prints the five [CON-5 launch metrics](MVP_SCOPE.md) for the last finished Monday–Sunday week (UTC). It needs Node 22.18 or later. It never applies migrations. On Neon it runs inside a `BEGIN READ ONLY` transaction. It never loads emails: staff/test exclusions are matched inside the database.

**Set up once**

1. In the Neon console, open the project, click **Connect** and copy the connection string. Safer option: create a read-only role in the Neon **SQL Editor** (roles created from the Console get admin rights) and use its connection string instead:

   ```sql
   CREATE ROLE metrics_reader LOGIN PASSWORD '<a long random password>';
   GRANT SELECT (id, email, created_at, preferences) ON users TO metrics_reader;
   GRANT SELECT ON analytics TO metrics_reader;
   ```

2. Paste it into `.env.local` as `METRICS_DATABASE_URL=...`. The file is git-ignored. The app ignores this variable, so your local app keeps using its own database.
3. Optional: list staff/test accounts in `METRICS_EXCLUDE`, comma-separated, for example `METRICS_EXCLUDE=victor@example.com,@encore.team`. Each entry is an exact email, a user ID or an `@domain`. `@example.test` (automated tests) is always excluded.

**Each week**

```sh
npm run metrics:weekly
```

Run it on **Monday or Tuesday**. Analytics are deleted after 30 days. If it runs later, week-1 retention shows `unavailable`, because part of its cohort's data is gone. Add `-- --week 2026-09-28` to report another finished week (any day of that week works). A week older than the 30-day retention shows every metric as `unavailable`, never a number computed from what is left.

Without `METRICS_DATABASE_URL`, the report reads the local PGlite database (`.data/encore`, or `LOCAL_DATABASE_PATH`). Stop `npm run dev` first: only one process may open that folder. Example output:

```text
Showbound: weekly beta metrics
Week: Mon, 28 Sept 2026 → Sun, 4 Oct 2026 (UTC)
Accounts counted: 12 consented · not consented: 3 · staff/test excluded: 2

Activation          unavailable  Not measured: signup happens before the consent choice (see docs/ANALYTICS.md).
Recommendation CTR        25.0%  6 of 24 concerts seen in the feed were then opened
Concert-save rate          8.3%  2 of 24 concerts seen in the feed were then saved
Ticket-link CTR             N/A  0 of 0 opened concerts with a ticket link got a ticket click (not a purchase)
Week-1 retention          50.0%  2 of 4 accounts activated Mon, 14 Sept 2026 – Sun, 20 Sept 2026 came back on days 7–13

• Small numbers: any count under 10 is an anecdote, not a trend. Read it with the interviews.
• Only consented accounts and live concerts are counted. This opt-in group may not represent all users.
```

**How each number is computed** (`src/domain/metrics.ts`, tested in `tests/metrics.test.ts`)

- Population: accounts that exist and currently have analytics consent, minus the exclusion list. Only events with `mode: live` count, and concert events from the `sample` provider never count. Deleted accounts and revoked consent have no events left (cascade/opt-out deletion).
- Pairs: every concert metric counts distinct user/concert pairs, so repeated impressions, opens, save toggles or retransmissions count once.
- Recommendation CTR / save rate: pairs with a `concert_impression` in the week; numerator = those pairs with a `concert_opened` / `concert_saved` in the week **after** the pair's first impression.
- Ticket-link CTR: pairs with a `concert_opened` carrying `ticketLinkAvailable: true` in the week; numerator = those with a `ticket_link_clicked` after that open. A click is not a purchase.
- Activation: always `unavailable`. Signup happens before the consent choice, so the denominator does not exist. It is never estimated from onboarding counts.
- Week-1 retention: an account is activated at its first live `concert_impression` after its live `onboarding_completed`, if that is within 7 days of account creation (`users.created_at`). The cohort is the accounts activated in the week that ended 14 days before the report week ends, so all 14 days are observable. Numerator: accounts with a live open, save or ticket click on days 7–13 after activation.
- `N/A` means the denominator is zero. `unavailable` means the number cannot be measured: activation always, and any window that reaches past the 30-day analytics retention. Counts are always shown next to percentages.

Saving a trip also records a `concert_opened` event (CON-29), but the trip planner is reached from the opened concert, so distinct pairs are not inflated.

## Omio travel planning

The four consent-aware server events `travel_planning_opened`, `travel_search_submitted`, `omio_redirect_clicked` and `travel_planning_failed` are documented in [OMIO.md](OMIO.md). Metadata includes the authorized concert ID and stored destination, provider, account mode and supported travel mode/fixed failure reason. User-entered locations, travel dates and redirect URLs are excluded. A redirect click is a handoff request, never a booking or conversion. Existing export, opt-out deletion and retention apply.
