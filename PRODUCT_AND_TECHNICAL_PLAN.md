# Encore — product and technical plan

Research date: 4 October 2026. Working name, not trademark-cleared. This is a founder-testable MVP, not a claim of production readiness. Provider access and commercial permissions are release gates.

## Product

**Pitch:** Find the next chance to see the artists you love, wherever you would actually go.

Start with Paris-based music fans who follow 5–30 artists and would take a European weekend trip for a favourite. Their problem is missed announcements and scattered decisions across cities, ticket sellers and travel sites. Test repeat discovery value before becoming a booking platform.

Journey: create account → select artists (or authorised Spotify connection) → set home city and travel boundaries → see a short ranked feed → understand a recommendation → save, dismiss or register must-see intent → inspect ticket source → receive in-app alerts.

### Critical change to the proposed strategy

Spotify-first is not a safe business foundation today. Development mode permits five authorised users, requires a Premium app owner, and is intended for personal/non-commercial experimentation. The July 2026 update raises the client-ID limit to 25 and shares quota across a developer's apps; it does not remove the user limit. Extended access has substantial eligibility requirements including an established entity and 250k MAUs. Spotify's policy restricts derived listenership metrics and user profiling. Do not interpret OAuth consent as commercial permission. Gate the connector until the exact use is approved; do not calculate fan scores from Spotify data. Imported artist names require explicit user selection. Manual favourites and first-party intent are the primary signals. [Access](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [July update](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates), [policy](https://developer.spotify.com/policy).

### MVP

- Runnable without external accounts: persistent PostgreSQL-compatible local database and clearly labelled fictional concert fixtures.
- Real local account registration/login, opaque sessions, onboarding, manual artist selection, travel preferences.
- Artist-first feed, search, date/location filtering, concert and artist views, saved concerts, dismissal, must-see artist intentions with city/budget/ticket count.
- Deterministic first-party recommendation reasons; scores are internal relevance points, never probabilities.
- Ticketmaster adapter enabled with server-side key; sample events never link to ticket checkout.
- Spotify OAuth code/PKCE/state, encrypted tokens, refresh and import implemented behind explicit approval and credentials. No assumption of commercial access.
- In-app notification preferences and idempotent alert evaluation. No pretend email delivery.
- Ticket outbound source validation and click attribution, opt-in product analytics, export and deletion.
- Tour comparison with unknown travel/accommodation amounts kept unknown. No invented fares or totals.

### Deferred

Push/SMS/email delivery, autonomous ticket purchase, inventory reservations, payment checkout, bundled trips, groups/social graph, ML, paid placements, premium paywalls, B2B analytics, speculative inventory scarcity. Password recovery and email verification are public-launch gates; this build is a closed founder pilot. No public deployment during this task.

## Competitive landscape

Facts below are restricted to publicly described capabilities. “Opportunity” is our inference, not a verified absence of competitors' capabilities. U = not established from reviewed public documentation. Verify with hands-on interviews before positioning.

| Competitor                      | Discovery / artist matching / alerts                                                        | Ticketing / presales / intent                                                         | Travel / social / model                                          | Strength and possible opening                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Spotify Live Events             | Listening-led discovery; artist/venue context and recommendations                           | Partner ticket links; fan presales exist in ecosystem                                 | Subscription/ad-supported music platform; full trip comparison U | Distribution and taste data already exist. Compete on explicit travel intent and decision quality, not “Spotify plus concerts.”     |
| Bandsintown                     | Followed/recommended artists, location/date/genre filters, alerts                           | Ticket links, artist/promoter tooling, promoted listings                              | Free fan discovery; promoter services; complete trip quote U     | Strong incumbent; explicit city-by-city decision workflow must earn its place.                                                      |
| Songkick                        | Artist tracking, concert search, calendar and notifications                                 | Links to ticket partners; paid API licensing                                          | Free fan product; social tracking; full trip quote U             | Mature artist-first discovery. We need better travel constraints and fewer irrelevant alerts.                                       |
| Ticketmaster                    | Broad event/attraction catalogue                                                            | Authoritative own-inventory ticketing, presales, availability via authorised products | Ticket sales/fees; discovery API is not checkout                 | Trustworthy sources, incomplete cross-seller coverage. Compare opportunities without claiming inventory.                            |
| DICE                            | Music-oriented discovery                                                                    | Mobile tickets and waiting list                                                       | Ticket fees; social functions vary; multi-city total U           | Strong purchase experience. Waiting list is not a novel moat. Need full hands-on validation; homepage blocked automated inspection. |
| Fever                           | Curated city experiences, concerts and festivals                                            | Own distribution/booking ecosystem                                                    | Broad leisure discovery; partner distribution model              | Less narrowly artist-intent-oriented in public positioning. Avoid competing as a generic city guide.                                |
| Resident Advisor                | Electronic music editorial and city/event discovery                                         | Tickets, resale queue and ticket notifications                                        | Scene/community orientation; ticketing/promoter tooling          | Strong electronic scene expertise. Do not claim better local coverage without measuring it.                                         |
| Apple Music / MusicKit          | Personal recommendations, recently played and Replay data available through documented APIs | Concert context varies by surface                                                     | Subscription; separate MusicKit permissions                      | Potential second taste input after validation; not implemented.                                                                     |
| Skyscanner / Omio / Booking.com | Travel search rather than artist matching                                                   | Flight/rail/bus/hotel partner bookings                                                | Referral/distribution business; deep expertise                   | Source travel only with approval. Our possible contribution is concert context, not cheaper fares.                                  |
| Emerging / converging           | Bandsintown now exposes “Ask Bandsintown”                                                   | Conversational search is already appearing in incumbents                              | AI interaction alone is not differentiation                      | No independently validated new entrant with all proposed features found in this short audit; absence is not evidence.               |

Sources: [Spotify events](https://newsroom.spotify.com/2025-10-20/live-music-venues-on-spotify/), [Bandsintown](https://www.bandsintown.com/), [Songkick](https://www.songkick.com/), [Ticketmaster](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/), [DICE waiting-list terms](https://support.dice.fm/article/764-mio-ticketing-terms-and-conditions-us), [Fever](https://feverup.com/en), [RA notifications](https://ra.co/news/79913), [MusicKit](https://developer.apple.com/musickit/).

### Feature-by-feature positioning

| Feature                                 | Established competition                                              | MVP decision / proposed test                                               |
| --------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Personalised discovery, artist matching | Spotify, Bandsintown, Songkick, DICE                                 | Explicit favourites first; ask users whether top 8 are worth opening.      |
| Proactive alerts                        | All major concert incumbents; RA has availability alerts             | In-app low-noise alerts; measure useful vs muted.                          |
| Multi-city tour comparison              | Individual artist tour lists widely exist                            | Compare the same artist against user travel boundaries.                    |
| Total-trip prices                       | Travel aggregators have component quotes                             | No total unless every component is current, dated and currency-consistent. |
| Travel/hotels                           | Omio, Skyscanner, Booking                                            | Interfaces only; no quote or reservation claims.                           |
| Ticket aggregation                      | Discovery incumbents / Ticketmaster ecosystem                        | One legitimate provider first; show coverage limitations.                  |
| Presales                                | Ticketing/artist ecosystems                                          | Reminders only for provider-sourced sale times; no eligibility claims.     |
| Fan intent / waiting lists              | DICE/RA and artist tracking incumbents                               | Persist pre-tour intent with price/cities; test if it predicts conversion. |
| Social                                  | Existing music and ticketing apps                                    | Deferred.                                                                  |
| Pricing / business model                | Free discovery with referrals/distribution; paid music subscriptions | Free closed pilot, no assumed affiliate rate or subscription willingness.  |

## APIs

“Unpublished/contract” means unknown, not free or unrestricted. Recheck terms before deployment. Never scrape around access restrictions.

| Provider               | Obtain / auth                                                                            | Limits, price and coverage                                                                                                                                                                                | Commercial / attribution / affiliate / reliability                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spotify                | OAuth code + PKCE; minimal top-artists scope and account identity                        | Five allowlisted users in dev; 429 Retry-After; exact quota not fixed publicly; endpoint availability differs by app age; global Spotify markets                                                          | Approval gate; retain minimal data, no derived listening profiles; Spotify links/attribution on imports; not an affiliate feed; revoked scope/403 handled.                                     |
| Apple Music            | MusicKit developer JWT + user token; library/recent/Replay                               | Apple developer setup; quotas and full costs require account verification; service-market coverage                                                                                                        | Terms/attribution review, no assumed cross-platform permission; deferred.                                                                                                                      |
| Ticketmaster Discovery | API key, attraction IDs, events, venues, public sale times, price ranges and source URLs | Docs say 5,000/day and 5/sec; FAQ says 2/sec. Use 2/sec, cap pages below 1,000 items, respect 429. Multi-market coverage is incomplete. No fee assumed beyond published access; commercial deal separate. | Public Discovery is not real-time inventory or checkout. Retain source mappings, provider attribution and fetched time; affiliate approval separate. Price range is indicative, fees may vary. |
| Bandsintown            | Artist app_id/API key; artist events                                                     | Ordinary key is for one artist; cross-artist access requires partnership; price/quota contractual                                                                                                         | Do not use an artist key for aggregator. Attribution/cache obligations per approved contract.                                                                                                  |
| Songkick               | Licensed key; artists/events/venues                                                      | Paid partnership; not accepting student/hobby API requests; quota/fee confirmed by agreement                                                                                                              | Public terms restrict competing use and retained copies (24h caching); unsuitable until negotiated rights cover this product.                                                                  |
| Artist/venue feeds     | Only opt-in feeds or explicit licence; external IDs when provided                        | Varies; no universal quota, pricing or coverage                                                                                                                                                           | Preserve provenance; retention set per source agreement. No prohibited scraping.                                                                                                               |
| Skyscanner             | Partner-approved flights APIs                                                            | Access, limits and commercial terms must be verified with partner team                                                                                                                                    | Referral potential, not guaranteed. Flight price TTL and recheck required. Deferred.                                                                                                           |
| Amadeus                | Client credentials; flight offers where eligible                                         | Test data not live; production access/pricing/coverage need confirmation (pricing page did not expose details in audit)                                                                                   | Do not treat test results as fares; ticket issuance distinct. Deferred.                                                                                                                        |
| Omio                   | Affiliate/deeplinks; API by partnership                                                  | Rail/bus/flight coverage varies; quota, API access and rate negotiated                                                                                                                                    | Commission contractual, never assumed. Deferred until approval.                                                                                                                                |
| Booking.com            | Managed Affiliate Partner, API key and affiliate ID                                      | Demand API access requires approved partner; rate/pricing contract-specific, broad accommodation coverage                                                                                                 | Availability/occupancy/dates mandatory; disclosure, provider-specific caching. Deferred.                                                                                                       |
| Mapbox                 | Access token; geocoding                                                                  | Usage-based; temporary/permanent storage differ; account-specific quotas                                                                                                                                  | Attribution required; no need in MVP: curated cities and country codes only.                                                                                                                   |
| Resend / Web Push      | Server API key / VAPID and user permission                                               | Plan-dependent quotas; email domain verification and push browser support                                                                                                                                 | Email consent/unsubscribe and delivery retries required; MVP uses local in-app inbox. No claimed delivery.                                                                                     |

Provider sources: [Spotify changes](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [TM API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/), [TM FAQ](https://developer.ticketmaster.com/support/faq/), [TM terms](https://developer.ticketmaster.com/support/terms-of-use/), [Bandsintown access](https://help.artists.bandsintown.com/en/articles/7053475-what-is-the-bandsintown-api), [Songkick access](https://www.songkick.com/developer), [Songkick terms](https://www.songkick.com/developer/api-terms-of-use), [Booking prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites), [Skyscanner access](https://www.partners.skyscanner.net/contact/travel-api), [Amadeus](https://developers.amadeus.com/), [Omio](https://www.omio.com/affiliate), [Mapbox storage](https://docs.mapbox.com/api/search/geocoding/), [Resend](https://resend.com/docs/api-reference/introduction).

## Monetization

Ranking is by plausible fit, not forecast revenue. Margin unknown until signed terms; do not invent rates.

| Priority / source                 | Stage                                    | Engineering / BD      | Trust risk                                                     | Margin and scale                                                          |
| --------------------------------- | ---------------------------------------- | --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1 Ticket affiliate                | After qualified outbound demand          | Low / medium          | Low with disclosure; no ranking bias                           | Contract-dependent; limited by conversion and inventory coverage          |
| 2 Accommodation affiliate         | After travel intent is proven            | Medium / medium       | Medium: fees, location and cancellation clarity                | Unknown; more booking value but cancellations matter                      |
| 3 Transport affiliate             | After useful coverage                    | High / high           | Medium: stale fares and hidden baggage costs                   | Unknown, often thin; contract must justify integration cost               |
| 4 Premium                         | Repeat retention proven                  | Medium / low          | High if useful alerts become artificially paywalled            | Subscription gross margin less support/API costs; price test before build |
| 5 Sponsored distribution          | Sufficient local audience                | Medium / high         | High; separate labelled placements, never modify organic score | Contract-dependent; sales cost scales with markets                        |
| 6 Demand intelligence             | Large opted-in first-party intent sample | High / high           | High; no identifiable data, no Spotify-derived profiling       | Unknown; re-identification risk and sample bias constrain value           |
| 7 Allocations / official presales | Real promoter partnerships               | High / very high      | High if guarantee implied                                      | Negotiated, operational exposure                                          |
| 8 Packages                        | Much later                               | Very high / very high | High; refund, insolvency and organiser duties                  | Net margins unknown; regulatory/support cost significant                  |

Unit model: eligible outbound clicks × partner conversion × net commission after refunds − acquisition − API/hosting − support. Log anonymous click IDs only with appropriate consent; conversion attribution requires signed postback agreement. A ticket click is not a sale. No affiliate links are active in sample mode.

## Architecture

Next.js App Router + React + strict TypeScript; one Node modular monolith. Plain CSS design tokens and Lucide icons, self-hosted fonts. This avoids introducing a component framework for twelve focused screens. PostgreSQL SQL schema with parameterized queries; PGlite provides a persistent PostgreSQL-compatible local pilot without Docker. Managed PostgreSQL via `DATABASE_URL` is the deployable path. PGlite must run in one process and cannot be used on ephemeral/serverless production storage.

No ORM is necessary for the small schema; versioned SQL migrations are explicit and shared between engines. Passwords use scrypt; random session tokens are hashed at rest, HttpOnly, SameSite=Lax (OAuth callback compatibility), Secure on HTTPS, expiry and server-side ownership checks. Replace or extend auth with verified email and recovery before public launch. Provider tokens use AES-256-GCM with a separate 32-byte key. OAuth uses PKCE plus per-session state and fixed callback origin.

```text
Browser → Next route handlers → domain scoring / preferences / alerts
                            → PostgreSQL (local PGlite or managed pg)
                            → provider adapters → Ticketmaster
                                                → approved Spotify
Scheduler → protected job endpoint → refresh + alert evaluation
Outbound click → stored offer lookup → allowlisted provider → ticket site
```

Data flow: explicit artist preferences → canonical artist IDs/provider mappings → cached provider events → exact conservative deduplication → user filters and scoring → top opportunities and explanations → first-party feedback → updated ranking. Do not hide failed imports behind sample data. Live mode with no key returns an actionable empty state.

Initial cost drivers: Node hosting and Postgres baseline, event refresh volume proportional to distinct artists (not users), OAuth sync volume, email volume, image delivery. Local sample cost is zero external services. No fixed cloud quote assumed. Cache per artist, throttle globally and make refresh explicit in closed pilot; schedule central ingestion before increasing pilot size.

## Database

Implemented names may use snake_case. Primary schema and migration live in `src/server/schema.ts`.

- User: UUID, unique normalized email, password hash, name, creation time, demo/live mode, onboarding state, preferences JSON (validated).
- Session: SHA-256 token hash, user FK cascade, expiry. RateLimit: hashed bucket, count/window.
- Artist: canonical ID, display name, unique provider mappings via ArtistProviderRecord. Never merge solely on artist name.
- UserArtistAffinity: user+artist PK, explicit favorite/hidden flags, first-party feedback, source. No inferred Spotify fan metric.
- Event: canonical ID, JSON normalized snapshot, demo flag, natural fingerprint. ArtistEvent relationship represented by normalized artistIds in snapshot for MVP; separate join table before multi-headliner ingestion grows.
- EventProviderRecord: provider+external ID unique, canonical event FK, raw JSON and fetch timestamp. Retention provider-specific; no permanent Spotify raw responses.
- TicketOffer: source provider, URL, currency/price range, observed time; embedded in normalized event for one-provider MVP. Split table for multi-provider inventory. TicketProvider configuration in integration module.
- Venue / City: normalized identifiers/names/country/timezone in event snapshot; city preference catalogue separate. Extract tables when multi-source venue reconciliation is introduced.
- SavedEvent and EventDismissal: mutually exclusive user/event feedback value in Feedback; timestamp. Preserve why/source for analytics.
- MustSeeIntent: user+artist unique, preferred cities, max ticket price, tickets wanted, created time. Distinct from any ticket reservation.
- TravelPreference / NotificationPreference: validated per-user JSON. Budget currency EUR, home city, scope, max travel time, notice tier.
- Alert: user/event/type key unique; scheduled/created/read timestamps; in-app channel first.
- MusicAccount: one Spotify account per user, encrypted access/refresh token and expiry, no client exposure.
- AnalyticsEvent: consent-gated event name, user FK cascade, bounded properties, timestamp; purge old rows.
- AffiliateClick: user FK cascade, event/offer/provider and generated click ID, timestamp; no purchase claim.
- TravelOption / AccommodationOption: typed provider-neutral quotes with dates, currency, fetched/expiry times; not persisted until actual provider integration exists.
- Future PurchaseAttribution, PresaleEligibility, TicketAllocation and privacy-thresholded DemandAggregate require explicit contracts and additional migrations.

Deliberate MVP denormalisation: immutable source snapshots and small validated preference objects reduce joins, while unique source IDs and ownership constraints preserve correctness. Extract entities only when multiple sources justify it.

### Deduplication

First match provider+external ID. Cross-source exact fingerprint requires all canonical artist IDs, normalised venue and city, and exact known local date/time. Unknown times remain source-specific; never merge two performances just because they share a date. Accent/case normalisation only for venue/city; fuzzy candidates go to later human review. Keep raw provider record independently. Upserts update moved dates without abandoning source identity. No automatic artist-name equivalence across providers.

## Recommendation engine

Hard eligibility: artist explicitly followed, not hidden, event upcoming, not dismissed, geography permitted. Cancelled/postponed events excluded from discovery (saved detail remains inspectable). Date-only records remain date-only. Travel-time and total-budget constraints cannot be proven without quotes: explain “travel time unverified” and “total unknown”; never assert fit.

Score: follow 45, favourite/must-see +25, saved +10, ticket-click +5; home-city +15, same-country +8, allowed Europe +3; known EUR ticket within budget +5, unknown neutral. Cap 100 and sort score descending, then date, then ID. Budget above threshold excludes known ticket cost exceeding total ceiling; prices in other currencies do not silently convert. No commission, sponsored status, fabricated scarcity, or Spotify-derived metric enters ranking. Display reasons and a qualitative fit tier, not “98% probability.” Dismiss removes this event; hide removes artist; saving changes future city opportunities modestly through explicit intent.

Available: user choices, first-party actions, geography, provider price ranges and sale times when returned. Requires user input: budget/travel constraints, attendance, favourites. Requires additional provider: travel time/cost, room availability, actual inventory. Future ML only after consent, sufficient labels and comparative evidence.

## Page map and visual plan

`/` landing; `/login`, `/signup`; `/onboarding`; `/app` feed; `/app/events/:id`; `/app/artists/:id`; `/app/saved`; `/app/artists` intentions/taste; `/app/alerts`; `/app/settings`; `/privacy`.

Custom **Afterglow** theme, selected by founder: midnight #101727, raised navy #1A2437, chalk #F2F4F8, slate #9AA8BD, amber #F1B66D, lavender #B5A6DC. Manrope for UI, Barlow Condensed for concert headlines. All text left aligned except compact onboarding. One cinematic photograph anchors a hero; quiet metadata and asymmetric editorial hierarchy around it. Generic venue photography is decorative, not a representation of a listed artist or event. Self-hosted local imagery; no remote user tracking pixels.

```text
Desktop: [small navigation rail] [greeting / travel preferences]
                                [featured opportunity     ][your artists]
                                [filters / a few concert cards          ]
Mobile:  [brand / inbox]
         [heading / preferences]
         [featured opportunity]
         [filters / single-column concerts]
         [bottom navigation]
```

Plan critique: a dashboard of identical cards would make discovery look like inventory. Use one large stage-led opportunity and a short secondary list instead. Drop arbitrary match percentages and decorative KPI counters. The amber accent supports primary action; do not use neon. Semantic focus, keyboard-operable controls, reduced motion, explicit sample labels, source freshness, responsive 360px layout, missing-price states and useful provider failure messages are required.

## Risks

| Risk                            | Severity / likelihood (hypotheses) | Mitigation / cheap validation                                                                                                                                           |
| ------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spotify already sufficient      | High / high                        | Interview 10 concert travellers; compare saved opportunities with Spotify over two weeks.                                                                               |
| Spotify access/policy           | Critical / high                    | Manual-first, disabled-by-default connector; written approval before commercial use.                                                                                    |
| Incomplete concert inventory    | High / high                        | Audit 20 artists across 5 cities against authorised public listings manually. Report missed events.                                                                     |
| Weak affiliate economics        | High / high                        | Get actual partner terms; model net revenue from measured clicks, no made-up rates.                                                                                     |
| Travel integration effort       | High / high                        | Quote interfaces only; test whether users open city comparisons before buying API access.                                                                               |
| Ticket integration restrictions | High / medium                      | Discovery links only; no bots, queue bypass or reserve claims.                                                                                                          |
| Another app fatigue             | High / high                        | Weekly return and unaided value question; stop if no repeat use.                                                                                                        |
| Notification fatigue            | High / high                        | Default important-only, deduplication, quiet in-app inbox, user off switch.                                                                                             |
| Cold start                      | Medium / high                      | Ask for 3–5 favourites; track skipped onboarding and no-match rate.                                                                                                     |
| Duplicate events                | High / medium                      | Source IDs plus conservative fingerprints; test multi-show same day.                                                                                                    |
| European fragmentation          | High / high                        | Start named cities/one provider, clearly state coverage; expansion via agreements.                                                                                      |
| Presale rights                  | High / high                        | Official links/reminders; negotiate before promising eligibility.                                                                                                       |
| Travel package regulation       | Critical / medium                  | Separate quote exploration only. Counsel checks France implementation and 2026 transition before any bundles.                                                           |
| Security / account recovery     | High / medium                      | Closed pilot, hashed sessions, scrypt, origin checks, validated input, deletion, test cross-user attacks; public launch requires recovery/verification/security review. |

Privacy: minimal account and explicit preferences, self-service disconnect/export/delete, no listening-profile resale. Explain retention and consent at collection. Delete expired sessions/OAuth attempts and old analytics; no third-party analytics SDK in MVP. EU lawful basis, controller identity, processors, hosting region, user rights contact and retention schedule must be finalised before collecting public users. This is an engineering assessment, not a legal opinion. [CNIL transparency](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence), [CNIL analytics](https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications).

Travel law is changing: the Commission's May 2026 announcement describes simplification including removal of linked travel arrangements, while existing pages still describe those duties. Check entry into force, national transposition and applicable date with counsel; do not treat announcement as immediate repeal. [2026 update](https://commission.europa.eu/news-and-media/news/package-travel-stronger-rights-travellers-and-simpler-rules-travel-industry-2026-05-28_en), [directive overview](https://commission.europa.eu/law/law-topic/consumer-protection-law/travel-and-timeshare-law/package-travel-directive_en).

## Validation and analytics

Consent-gated events: signup_started/completed, spotify_connected, onboarding_completed, concert_impression/opened/saved/dismissed, must_see_clicked, ticket_link_clicked, travel_option_clicked, hotel_option_clicked, notification_enabled/opened. No event is emitted for a feature not actually used. Early pre-consent signup-start measurement is intentionally absent; compare started/completed only for consenting flows, do not invent denominator.

Measure: activation = onboarded users with >=1 real recommendation / eligible signed-up users; saves/impressions, dismissals/impressions, opens/impressions; artist intents/active users; ticket clicks/opens; returning user in week 2; unsolicited-discovery saves/total saves. Separate sample and live cohorts. Discovery source is recorded with save actions. No metrics should blend fictional events into demand estimates.

Proposed gates (hypotheses, not industry benchmarks): 15 interviewed users; at least 10 manually onboarded pilot users; 60% find one useful opportunity; 30% return in week two. Ask why every dismissal happens. If users don't return, reduce scope before adding travel APIs. The durable asset could be permissioned first-party artist/city/price intent, not a weighted scoring function. Data from small cohorts is not market-wide demand.

## Development roadmap

1. Write this audit; choose manual-first architecture and theme.
2. Foundation: Next/TS, schema/migrations, local DB, env validation, auth/security, fixtures, lint/tests.
3. Domain: provider normalisation, dedup, preference validation, deterministic scoring and tests.
4. End-to-end persistence: onboarding, feedback, must-see, profile, export/delete.
5. UI: landing/auth/onboarding, feed/detail/artist/saved/settings/inbox; responsive and keyboard verification.
6. External boundaries: Ticketmaster sync and safe outbound; gated Spotify state/PKCE/encryption/refresh; error/timeout tests.
7. Alerts: unique per user/event/type, tier checks, protected scheduled route; no email delivery claims.
8. Travel comparison with missing-price semantics; consent analytics; docs and founder runbook.
9. Verify typecheck, lint, unit/integration tests, production build and browser main flows; capture remaining launch gates in README and handoff.

Founder inputs that are not coding blockers: name/trademark; pilot audience; legal entity and controller contact; authorised data partnerships; Spotify permission; hosting country; affiliate contracts. Theme selected: custom midnight blue with warm stage lighting. No credentials requested or invented.
