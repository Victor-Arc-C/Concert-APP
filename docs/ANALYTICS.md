# Analytics and error monitoring (CON-9)

Events use lowercase `object_action` names. Product analytics stay in the existing PostgreSQL `analytics` table, require opt-in, and carry a server timestamp, internal user ID and explicit sample/live mode. No external analytics service or replay SDK is installed. Never use sample events as real demand evidence. The launch metric definitions are in [MVP_SCOPE.md](MVP_SCOPE.md).

| Event | Trigger | Properties |
| --- | --- | --- |
| `onboarding_completed` | Successful onboarding write after consent choice | mode |
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
