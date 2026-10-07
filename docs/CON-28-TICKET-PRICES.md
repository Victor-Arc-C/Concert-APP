# French ticket-price sources (CON-28)

Research checked on 7 October 2026. **The missing-price problem remains open.** No new provider has been enabled and no new tariff has been imported. The only configured local ticket credential is Ticketmaster Discovery.

**Access update, 7 October:** Victor's Awin publisher account is activated and authenticated dashboard access was verified. Fnac Spectacles programme 12494 is still **Pending Approval**. Its profile displays 108,719 total products and an update today, but the France/French advertiser search in Create-a-Feed has no selectable Fnac result. This establishes catalogue metadata, not download permission or usable session-level prices. No feed or credential was exported. Wait for advertiser approval, then validate the actual permitted sample before implementation; do not submit the same programme application again.

## Recommendation

Start with **Fnac Spectacles / France Billet through Awin**, programme **12494**, for access validation. France Billet explicitly advertises a daily XML catalogue searchable by artist, venue and location. This establishes a feed route, not its current tariff fields or Encore's entitlement. Do not confuse this with Fnac.com's retail programme 12665. [France Billet affiliate tools](https://www.francebillet.com/campaign/affiliation-partenaire), [Fnac Spectacles programme](https://ui.awin.com/merchant-profile/12494).

**Weezevent is the second candidate**: its official API documents external-event discovery and price ranges, but it needs partner credentials and its actual concert coverage is unmeasured. This is stronger technical evidence than an affiliate link alone. No provider is implementation-ready for Encore today.

The product priority is now “Never miss your favourite artists live.” Judge the source on matching French concerts and useful tariffs, rather than travel features or nominal commission rates.

**Geographic boundary:** Fnac Spectacles is complementary for France, Belgium and Switzerland; it must not replace Ticketmaster's international listings or imply tariff coverage elsewhere. Seller markets do not determine artist nationality: Fnac also lists international artists performing locally, such as [Tame Impala in Paris](https://www.fnacspectacles.com/artist/tame-impala/). The full feed's proportion of French versus international artists has not been measured. Evaluate both groups after access is approved, retain explicit unknown prices outside verified coverage, and scope any Fnac import to its confirmed markets.

## Ranked feasibility

“Partial” means a relevant official route exists but access, coverage or pricing must still be verified. “No” means no verified route for this pilot today, not that a private commercial integration cannot exist. Coverage assessments are hypotheses; no authenticated comparison has been completed.

| Rank | Provider                                 | Feasibility now        | Coverage hypothesis / limitation                                            | Access and price evidence                                                                                          | Complexity / commercial potential                                                            | Next action                                                                    |
| ---- | ---------------------------------------- | ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | Fnac Spectacles / France Billet via Awin | Partial                | First candidate for French concert breadth; exact overlap unmeasured        | Official XML catalogue; tariffs, session IDs, fees and available fields still unverified                           | Medium if session-level data exists; official affiliate route                                | Apply to 12494; obtain feed sample and field specification                     |
| 2    | Weezevent                                | Partial                | Partner-calendar events, not a proven complete French artist catalogue      | Documented external-event search and price ranges; registered partner/API key + access token                       | Medium; artist mapping and currency need confirmation; no commission entitlement established | Request calendar access, third-party prices and permitted reuse                |
| 3    | See Tickets France                       | Partial                | Potential concert/festival complement; overlap unmeasured                   | Official distribution/integration offering; no usable public French catalogue-price contract verified              | Unknown until specification; commercial terms negotiated                                     | Ask business team for read-only catalogue and tariff feed                      |
| 4    | Shotgun                                  | Partial                | Candidate for electronic/club events; not measured against followed artists | Official promoter programme is invitation-based and event-scoped; no documented broad catalogue-price API verified | Unknown; commissions/offers depend on organizer agreement                                    | Ask for a discovery partnership, rather than using private frontend endpoints  |
| 5    | Ticketmaster affiliate / Discovery Feed  | Partial                | FR supported, but not an independent coverage source                        | Feed has price columns but explicitly derives from Discovery; cannot assume missing French prices will appear      | Low identity cost, approval required; affiliation does not grant Partner API                 | Ask whether a different French tariff source exists before onboarding          |
| 6    | Eventbrite standard API                  | No for broad discovery | Existing-event/organizer integrations are not artist-wide discovery         | Public Event Search is documented as shut down; distribution requires separate agreement                           | Medium only after access; no current tariff feed verified                                    | Defer unless distribution entitlement and representative concerts are supplied |

Supporting primary sources:

- [Weezevent API](https://api.weezevent.com/): `/event/search/` documents events outside the caller's organization, `/event/:id/details/` shows `price.min`/`max`, and `/tickets` lists ticket classes. The examples do not establish currency or fee semantics, current coverage, or permission to read every external event's ticket classes. [Current access instructions](https://help.weezevent.com/en/articles/13399570-how-to-use-weezevent-s-api) confirm partner registration and fair-use restrictions. Numeric quotas and affiliate terms need confirmation.
- [See Tickets ticketing](https://group.seetickets.com/ticketing/) confirms third-party integrations, but organizer reporting/access-control APIs do not by themselves prove catalogue or tariff access. [Official business contact](https://group.seetickets.com/) is the route to establish that contract.
- [Shotgun promoter portal](https://support-pro.shotgun.live/hc/fr/articles/13970940523154--Le-Portail-des-Partenaires-de-Vente) requires an organizer invitation and supplies event tracking links. It establishes event promotion, not platform-wide API access.
- [Ticketmaster Discovery Feed](https://developer.ticketmaster.com/products-and-docs/apis/dc-dataFeeds/) documents FR, authorization, `minPrice`, `maxPrice`, `currency` and a common Discovery source. [Affiliate FAQ](https://developer.ticketmaster.com/support/faq/) lists France and distinguishes affiliate resources from restricted transactional access. An affiliate account is not evidence that prices are populated.
- [Eventbrite API reference](https://www.eventbrite.com/platform/new/api), Event Search section, states that public search was shut down on 12 December 2019. Broad marketing text elsewhere is not evidence that this endpoint works.

## Awin access check

Use [the programme-specific signup](https://ui.awin.com/publisher-signup/fr/awin?advertiser=12494). A publisher account, programme acceptance and feed availability are separate checks. Ask the programme manager for an export before promising an integration.

[Awin feed-list documentation](https://help.awin.com/developers/docs/product-feed-list-download) describes a credentialed list with advertiser ID, feed ID, download URL and last import time. Its data-feed key differs from the Publisher/Partner API credential. Inspect mapped columns for programme 12494; generic Awin price columns do not prove Fnac supplies them. Never put a download URL containing a key in a commit, log or client response.

[Awin column definitions](https://help.awin.com/developers/docs/hosting-feeds) document price/currency, seller links and update metadata. Check their actual mapping to event/session, standard versus restricted tariff, fees and inventory before normalization. A tour-wide minimum or members-only offer cannot become an exact concert price.

## Live evidence

Rechecked during this session on 7 October through official Discovery detail requests using the existing key. No secret or raw payload was saved.

| Concert             | Discovery ID      | Date       | Response | Price ranges |
| ------------------- | ----------------- | ---------- | -------- | ------------ |
| Tame Impala, Paris  | `ZkyMmBwZ1A78Z_Z` | 2027-06-12 | HTTP 200 | Absent       |
| L2B, Toulouse       | `ZkyMmBwZ1A7FPx4` | 2027-03-05 | HTTP 200 | Absent       |
| Malcolm Todd, Paris | `ZkyMmBwZ1A783qA` | 2027-02-22 | HTTP 200 | Absent       |

A single bounded request to the documented FR Discovery Feed catalogue with the existing key returned nonstandard HTTP **600**, without a usable catalogue. This is inconclusive about entitlement; it is not a successful access test or a verified 401. No retry fan-out or alternate undocumented endpoint was attempted. Earlier investigation and fixes remain in [CON-27](CON-27-PRICES.md).

Fnac, Weezevent, See Tickets, Shotgun and Eventbrite were not authenticated or tested for prices. There are no confirmed alternate tariffs for these three concerts in this report.

## Access questions and pilot gate

Send the [prepared access requests](CON-28-ACCESS-REQUESTS.md). Request:

1. Permission for public artist-first discovery, tariff display, server caching and seller redirects, including attribution and removal/retention requirements.
2. A sample and stable session ID with artist, venue, city, country, local date/time/timezone, sale/status, amount, ISO currency, eligibility, fees and exact booking link.
3. Whether each amount is a standard publicly purchasable ticket, a starting range, face value, or total inclusive of mandatory fees; treatment of sold-out/closed/discount/member offers.
4. Source observation/update time, TTL, disappearance/cancellation semantics and rate/download limits. Re-downloading an old feed must not make an old quote fresh.
5. Access cost, approval requirements, allowed domains and affiliate terms. Do not assume approval timing, free access or income.

In a disposable environment, compare the three concerts above plus Ninho and Orelsan sessions from the existing coverage audit. Record exact-session matches, missing events, usable prices, eligible tariff categories, fees, freshness and the seller destination. Missing a test concert is a coverage finding, not permission to substitute another show or invent a price.

Choose a provider only after obtaining a usable sample and confirming rights. At least one exact-session, current, eligible price and its matching seller link must be verified end to end. Report sample counts; do not present them as France-wide coverage. If the feed is links-only, tour-level, stale or missing currency, it does not pass the price pilot gate.

## Smallest conditional implementation

Proposed follow-up: **Validate Fnac Spectacles feed access and pilot exact-session ticket prices**. It must stay blocked on access; no speculative adapter is included here.

- Start with one approved feed and a small explicitly mapped concert set. Keep Ticketmaster discovery and user follows. Map external IDs to canonical artist/venue/date/time identities; ambiguous matches require review, using the existing normalization-review path.
- Store new seller observations under their own `ticket_sources` provider/external ID and preserve raw provenance server-side. Do not write a Fnac tariff into a Ticketmaster source row. The SQL model supports multiple sources, but `Concert.provider` is a closed union and the current feed reads its exact listing source: adding a row alone does not add feed prices.
- Extend source presentation and outbound validation together. Each displayed price must retain its currency, observation time, eligibility/fee scope and selected seller. Never silently display a second seller's price beside a Ticketmaster-only link. Approve exact seller/tracker hosts under the confirmed agreement rather than allowing arbitrary redirects.
- Retain the 24-hour price rule, with a stricter provider expiry when required. Keep provider update time distinct from retrieval time. Stale, absent, disabled, future, cancelled or postponed observations remain unavailable; a valid ticket link can remain usable without a tariff.
- Refresh centrally with provider limits and explicit failure states. No production writes during validation and no automatic fallback to fictional inventory.
- Verify exact/ambiguous session matching, foreign currencies, actual zero, malformed/stale prices, closed/restricted offers, expiry, source isolation and seller-link alignment with unit/SQL tests and one browser price-selection flow. Run the standard checks before rollout.

This research changes documentation only. It does not resolve prices in the deployed app, create an affiliate account, send provider messages or establish an approved partnership.
