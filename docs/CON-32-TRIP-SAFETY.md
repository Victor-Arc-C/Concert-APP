# CON-32 — Trip provider modes and saved-plan revalidation

Base: current main `d473824` (including CON-31 research), checked 6 October 2026. This issue implements the safety gate before connecting transport or accommodation. No live provider, credential, affiliate program or booking integration is added.

## Audit before the change

- `src/server/trips.ts` selected `SampleTransportProvider` and `SampleAccommodationProvider` as unconditional defaults. Test, local, development and production callers, including users viewing live concerts, could receive fictional transport, hotels, prices and distances. Generation returned nothing when either component was missing.
- `src/server/api.ts` authenticated trip actions and scoped concerts to the user's sample/live mode, but `trips/save` accepted full client snapshots with `z.any()` transport/accommodation/scores. Nested event/provider identity, amounts, timestamps and checkout URLs were not verified against a current server selection.
- `trips/saved` and `src/server/data.ts` returned stored JSON directly. A cancelled/postponed concert was blocked during generation/save but not during saved-plan reads. Old quotes, arbitrary links and scores could survive indefinitely.
- `src/components/trips-screen.tsx` opened supplied transport/stay URLs without a server travel-link policy. Samples linked to generic real provider homepages. Neither planner nor saved cards expired their displayed travel quotes.
- `assignTripLabels` could award Best value to one high-scoring option and could rank incomplete/stale/mixed-currency candidates. Currency addition checked equality but did not enforce the documented format.
- Migration 7 stored snapshots and cascaded concert deletion into saved-plan deletion. User ownership/authentication, request body limits, origin checks and parameterized SQL already existed and are preserved.

## Explicit mode and missing components

`tripProviderMode` uses `APP_ENV`, the existing user mode and concert source. Samples require a sample-mode user (or sample guest), a sample concert and a test/local/development profile. **Production always denies sample travel/stays**, including an explicit sample user and accidentally injected sample adapters. The explicit `VERCEL_ENV=production` deployment signal also denies samples when `APP_ENV` is mistakenly local or omitted. A standalone production build with no explicit `APP_ENV` also denies samples; an explicit local/test build still supports development checks. Live users/concerts also deny samples outside production. No hostname inference is used.

Server-owned provider definitions declare source kind, recognized source IDs and exact checkout hosts. The live registry contains only providers whose server keys are configured (CON-43: SNCF timetables, LiteAPI hotels; see [TRAVEL_PROVIDERS.md](TRAVEL_PROVIDERS.md)). A fictional sample concert never receives live providers, in any mode. Sample checkout hosts are empty and sample booking URLs are null; sample options explicitly say `kind: sample` and `availability: sample`, never real availability.

Trip options have nullable transport/accommodation, separate `ready`, `unavailable`, `stale` or `invalid` component states, and a plan status. An active concert still generates a saveable plan when one or both providers are unavailable. A failed provider does not discard an available component. Ticket, transport and stay totals remain null unless all required prices are complete, finite, non-negative, current and in the same valid currency. Missing quotes do not create prices, availability, URLs or distances.

The provider interfaces remain neutral. Schema parsing validates dates/timestamps, prices/currencies, duration/transfers, stay dates/guests/distance and source identity, strips undeclared raw fields, and rejects invalid/mismatched observations. Provider failures produce an unavailable state without exposing errors to the user.

## Save identifiers, read current data

The save API now accepts only `{eventId, tripOptionId}`. Extra client quote/provider/URL/price/currency/score/user fields are rejected. The authenticated user controls ownership; the server checks the concert/mode/status, regenerates options and matches the selected internal option ID. A random, unrelated or obsolete selection is rejected. Internal hashed trip IDs identify the selected server combination; they are not external provider IDs.

Persisted `trip_data` is `{version: 1, transport: {id, provider} | null, accommodation: {id, provider} | null}`. Plan columns retain origin, destination, concert/date and the internal selection ID. No prices, availability, booking URLs, hotel names/distances, scores or provider payloads are persisted. An atomic conditional insert checks concert mode/status/date/city/venue again, preventing a save if those changed during generation.

Both the saved-trip API and app-state loader use `savedTripsForUser`. Reads:

1. Scope rows to the authenticated owner.
2. Re-read the concert and its exact current ticket source; never use the ticket price from old event/trip JSON. Disabled/missing ticket sources do not fall back to snapshot prices.
3. Suppress inventory for missing, cancelled, postponed, past, mode-changed or date/city-changed concerts.
4. Validate the versioned saved references, re-query the currently selected adapters and match provider/option IDs. Never substitute a different offer for the saved reference. Retain a still-current selected component if its counterpart fails.
5. Remove stale/unknown/expired availability and prices, sanitize links, recompute supported totals/scores, and suppress comparison labels on saved cards. An unavailable provider leaves the saved plan visible without a current quote.

Old snapshots are never trusted, even if their timestamp looks fresh. Legacy plans retain their identifying columns and a route back to the concert planner, with no old inventory or checkout action.

## Migration 8

The migration replaces pre-gate snapshot JSON with `{version: 0}`, preserving saved-plan rows and origin/destination/date/selection columns. It removes only the concert FK delete cascade so a missing concert can be represented explicitly as `event_missing`. The user ownership FK and account-deletion cascade remain intact. New saves still require a real, active concert in the server-side conditional insert.

This intentionally discards untrusted historical quote details; it does not delete accounts or reset the database. The existing single-writer migration procedure applies. Upgrade tests use an isolated version-7 database with malicious legacy quote data and verify snapshot removal, plan retention after concert deletion and plan deletion after account deletion. The user's local database was not opened or migrated during this work. See [database contract](DATABASE.md).

## Freshness, ranking and checkout

Travel observations require a valid non-future timestamp. A quote is usable for less than five minutes and only before its actual provider expiry, if supplied. Live availability must explicitly be `available`; unknown/unavailable is suppressed, with one exception: a transport timetable quote (`scheduleOnly`: no price, `availability: unknown`) is shown as a schedule and never priced, totalled or badged; accommodation never accepts it. Missing expiry stays absent. The five-minute cap is a conservative app ceiling, not provider permission or a guarantee; a future adapter must enforce stricter contract rules. Dynamic quotes are not stored. Adapters may reuse a provider answer for at most 60 seconds, keeping its original observation time. App-state polling never calls live providers: saved plans are revalidated when the Trips page opens (at most five per request, the rest marked `unchecked`).

Tickets retain the existing source-attributed 24-hour observation rule. A current starting ticket price is not a reservation or a guarantee of fees/availability. Production sample-concert trip plans do not borrow fictional ticket prices into live travel estimates.

The CON-29 music/cost/convenience calculations and 40% / 35% / 25% overall weights are preserved. Labels now require at least two comparable, complete, current candidates in the entire displayed set. Missing prices/components/distance, stale availability, different currencies, different stay/date/occupancy scope or sample/live mixing suppress every badge. The total must match the component sum. Ties do not invent a unique winner. No single-option Best value remains. Saved plans carry no comparative badge.

`safeTravelUrl` is centralized and applied server-side using the selected adapter's trusted exact hosts: HTTPS only; no credentials, custom ports, control characters, backslashes, foreign hosts or subdomain/lookalike assumptions. Unknown sources cannot authorize hosts. No future vendor whitelist is guessed; samples have no booking action. Adding a live adapter must include its approved exact checkout hosts and validate its documented redirect flow.

Planner and saved cards also expire already-open views, removing stale components/prices/badges/actions. The planner offers “Check again” and separate travel/stay unavailable states. Fictional sample inventory is clearly labeled. Missing totals/scores are shown as unavailable, and failures do not expose provider internals.

## Verification and limits

- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` passed.
- 151 unit tests across 21 files, including environment separation, injected sample denial in production, production deployment profile mismatches, missing components/ticket prices, malformed quotes, expiry, exact-host links, source recognition, duplicate offer identifiers, total overflow, outages, strict save payloads, ownership, unrelated/cancelled/postponed events, legacy/current/expired saved plans, partial saved revalidation, atomic write rejection and unsupported rankings.
- Two targeted Playwright flows passed against an isolated test-profile production build/database: compare/save/reopen the sample planner; and API snapshot rejection, CSRF/auth, account isolation and saved-plan suppression after switching modes.
- Local parallel full-suite runs intermittently timed out in an existing PGlite alerts setup hook. The suite passed with `npm test -- --maxWorkers=1`; no timeout setting or production behavior was weakened.

No genuine live travel/provider smoke test is claimed: none is configured or approved. A future live integration must extend the current single-guest/overnight request model, verify itinerary timing/returns and complete quote semantics, obtain licensed coordinates/content, enforce provider-specific retention/quotas and add real approved account tests. Revalidation currently queries each saved plan on reads; future integrations must account for those requests in their quota policy. Background refresh and booking are outside this issue.
