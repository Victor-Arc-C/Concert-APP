# MVP scope and launch metrics (CON-5)

This is the launch contract for the private Showbound pilot. Linear controls delivery order; the earlier product and technical plan remains background research. Scope below does not claim that every launch gate is implemented.

## Product test

Can a listener bring their artist preferences into Showbound, find a relevant upcoming concert, understand the recommendation, and continue to a trusted ticket seller?

## In scope

- Account sign-up, sign-in, sign-out and a persisted profile with home location, distance preferences and notification choices.
- Explicit artist selection and, only with provider permission, music-taste import. Import must offer review/confirmation and a manual fallback.
- Upcoming concerts from a permitted provider, normalized identities, duplicate protection and traceable source records.
- Artist affinity and geographic/date filtering, understandable recommendation reasons, a feed and concert detail pages.
- Saved concerts and lightweight in-app alerts with honest freshness and coverage information.
- Validated ticket-source links, measured outbound clicks and affiliate attribution only where agreements permit it.
- Consent-based measurement, error monitoring, account export/deletion and a private-beta release checklist.

## Out of scope

- Native ticket checkout, inventory holds, speculative purchases, resale or guaranteed tickets/presale access.
- Flight/hotel booking, combined travel checkout or complex trip packages.
- Paid subscriptions, sponsored ranking and post-MVP revenue experiments.
- Email/push delivery promises, unrestricted geographic coverage or complete price/inventory guarantees.
- Inferred Spotify fan scores or other preference processing beyond approved provider permissions.

Sample mode is a separate fictional demonstration and never evidence of concert demand. Live provider permissions and the README public-launch gates must be satisfied before a public launch.

## Primary journey

1. Create an account and choose whether to consent to optional measurement.
2. Import artist preferences through an approved connection, review the matches and confirm follows. If unavailable, search and select artists manually.
3. Set home location, distance and notification preferences; finish onboarding.
4. See upcoming live recommendations with artist, place, date and a reason. Empty/provider-error states explain the limitation and allow retry or preference changes.
5. Open a concert, inspect its source/freshness and save it or follow a valid ticket link. The seller handles availability, price confirmation and purchase.
6. Return to saved concerts and in-app alerts. Preferences, consent and account data remain under the user's control.

## Launch measurement contract

Report weekly UTC cohorts and a trailing seven-day interaction window. Include only consented accounts and live-mode events; exclude staff/test accounts and fictional inventory. Report cohort counts beside percentages, use `N/A` for zero denominators, and do not generalize an opt-in cohort to all users. Use a stable internal user ID and event ID, never email, names, credentials or listening history. Revoked consent/deleted accounts are excluded.

| Metric | Definition | Event names |
| --- | --- | --- |
| Activation | Percentage of eligible newly signed-up accounts that complete onboarding and see at least one live concert within seven days of signup. Denominator: consented new accounts with a full seven-day observation window. | `signup_completed`, `onboarding_completed`, `concert_impression` |
| Recommendation CTR | Distinct user/concert pairs opened after a feed impression in the window divided by distinct pairs impressed in the window. Count each pair once; require the open to follow the impression. | `concert_impression`, `concert_opened` |
| Concert-save rate | Distinct impressed user/concert pairs saved after an impression in the window divided by distinct impressed pairs. Repeated save toggles count once. | `concert_impression`, `concert_saved` |
| Ticket-link CTR | Distinct user/concert pairs with a successful validated outbound click after opening the detail divided by distinct pairs that opened a detail with an enabled ticket link in the window. A click is not a purchase. | `concert_opened` (with `ticketLinkAvailable`), `ticket_link_clicked` |
| Week-1 retention | Percentage of activated accounts with a meaningful live interaction on days 7–13 after activation. Denominator: activated accounts with all 14 days observable. Meaningful interactions are an open, save or ticket-link click; background refreshes do not count. | Activation events above, then `concert_opened`, `concert_saved`, `ticket_link_clicked` |

Required event envelope: server timestamp, internal user ID, mode, event name and concert ID where applicable. Activation occurs at the first qualifying impression after onboarding. Deduplicate repeated transmissions before aggregation. Classify manual versus provider-import onboarding separately; do not present manual selection as a tested OAuth import.

## Instrumentation follow-through

These are definitions, not measured results. CON-9 records consented onboarding, visible-card impressions, opens, saves and outbound clicks with server-validated concert context and ticket-link availability. See [the tracking contract](ANALYTICS.md). Signup occurs before consent, so activation's signup denominator remains unavailable; do not backfill it without a consent-compatible design. Merely listing an event name in the allowlist does not prove it is emitted. Publish only supported metrics; mark the rest unavailable until instrumented and verified.

The current 30-day analytics retention can support these windows if weekly reports run on time. Store only aggregate cohort results for longer comparisons, with small-cohort caution. Review pilot interviews and these five metrics before setting expansion targets; no invented benchmark or revenue claim is required to close CON-5.
