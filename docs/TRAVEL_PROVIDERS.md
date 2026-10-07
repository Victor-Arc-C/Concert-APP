# Live travel providers for Trip Intelligence

Trip Intelligence shows a train/coach journey and a hotel for concerts outside the user's home city. Live data comes only from the providers below, and only when their server-side keys are set. Without a key the component is shown as unavailable; nothing is invented. Sample (fictional) travel stays limited to sample-mode concerts in test/local/development profiles (CON-32).

| Provider                           | What it gives                                                                                                                                                    | What it does not give                                                                                               | Server variable                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **SNCF open API** (Navitia engine) | Real train and coach timetables (TGV, OUIGO, TER, Intercités, some coaches and cross-border trains), duration, changes, earliest return the next morning         | Fares, seat availability, booking. The app shows "Timetable only · price with the seller" and links to SNCF Connect | `SNCF_API_KEY`                                       |
| **Nuitée LiteAPI**                 | Hotels within 10 km of the venue (up to 100 compared) with current rates for one adult, one night, each shown offer re-confirmed live (prebook, no charge); distance to the venue; partial-price flag when taxes are paid at the hotel | Reviews/photos (not displayed), multi-room or group stays                                                           | `LITEAPI_API_KEY`, optional `LITEAPI_WHITELABEL_URL` |

Priced multimodal transport (train + coach + flight with fares and checkout) needs a partner agreement, for example Omio Meta Search (see the CON-30 research). It is not self-service, so it is not integrated.

## Setup (founder)

1. **SNCF**: request a free token at <https://numerique.sncf.com/startup/api/token-developpeur/>. It arrives by email. Quota: 5,000 requests per day; the app stops at 4,500.
2. **LiteAPI**: create a free account at <https://dashboard.liteapi.travel/>, then **Developers → API Keys**.
   - A **sandbox** key (`sand_…`) returns test prices. It works in local and development profiles, is labeled "LiteAPI sandbox — test prices, not bookable", and is **ignored by production deployments** (including Vercel previews built in production mode).
   - A **production** key returns live rates. Production accepts only a key starting with `prod_`; if your production key looks different, it will be ignored (fail safe) and the code needs a one-line change. LiteAPI asks for a card and payout details before issuing it; that is a business decision.
   - Optional: configure the LiteAPI white-label booking site and set its HTTPS address as `LITEAPI_WHITELABEL_URL`. Hotels then get a "Book this hotel at this price" link to that exact hotel, dates and guests, on that host only. Every LiteAPI account comes with a white-label site: copy its address from the LiteAPI dashboard. Verify one link by hand after setup: the deep-link format (`/hotels/{hotelId}?checkin&checkout&occupancies=<base64 JSON>`, per LiteAPI's white-label deep-linking guide) has not been tested with a real account. The displayed price is LiteAPI's `offerRetailRate`; confirm with LiteAPI that it matches your white-label checkout price and may be shown publicly.
3. Add the variables in Vercel → Settings → Environment Variables (Production), then redeploy.

## How it works

- `src/server/trips.ts` `selectTripProviders` builds the live registry from server variables; `tripSearchContext` takes the home city centre from the catalog and the venue coordinates from the stored Ticketmaster record (falling back to the city centre).
- `src/server/providers/sncf.ts`: two journey searches (arrive one hour before the show, keeping only journeys arriving at least 30 minutes before; return from 09:00 Paris time the next morning, DST-safe), local Paris times converted to ISO offsets, walking-only journeys dropped, shared rolling 24-hour limit of 4,500 requests.
- `src/server/providers/liteapi.ts`: hotel catalog search within 10 km of the venue (100 hotels), then one rates call with the cheapest room per hotel; 4 requests/second limit. Four stays are kept: the three cheapest complete prices plus the cheapest within walking distance (1.5 km), else the next cheapest. Each shown offer is confirmed with LiteAPI prebook (`book.liteapi.travel/v3.0/rates/prebook`: live availability and final price, nothing charged or held); an offer that is gone (4xx, e.g. 408 "outdated offerId") is replaced by the next candidate, an offer that cannot be checked (timeout, 5xx) is not shown, at most eight checks per plan, confirmations reused for 10 minutes. The page shows the meal plan, refundability and the time availability was confirmed. A venue distance is shown only when the real venue position is known (never from the city-centre fallback).
- Both adapters reuse an answer for at most 60 seconds (bounded in-memory cache) and keep its original fetch time, so a cached quote is never presented as newer than it is.
- Live travel is never queried by the app-state poll. Saved plans are re-checked when the Trips page opens (at most three per request; the rest show as not yet checked). Provider failures are logged as `provider_failed` and shown as unavailable.
- A fictional sample concert never receives live trains or hotels.
- Timetables are "schedule-only" quotes (`scheduleOnly` in `src/domain/trip-safety.ts`): no price, never totalled, never badged Cheapest/Fastest/Best value.
- Planning a trip and re-checking saved plans share a limit of 20 requests per minute per user.
- Tests: `tests/travel-providers.test.ts` (fixture responses only; no network).

## Trip interface searches

The SNCF timetable adapter skips requests when the concert-day outbound or next-day return falls outside the published N+23 window, using the Europe/Paris calendar day. The UI explains that limit and offers train and bus seller searches plus venue directions by car or public transport, including when provider loading fails. These links are searches, not live inventory or quotes.

Hotel quotes keep the configured LiteAPI white-label hotel link when available ([documented deep links](https://docs.liteapi.travel/docs/deeplinking-to-whitelabel)). Without that link, the UI offers a Booking.com search for the selected hotel's name, city, dates and guests; the price and availability there may differ. No LiteAPI rate is represented as bookable through Booking.com. Sample, cancelled and postponed concerts have no external search actions.

## Getting there: published fares for every mode

The trip page opens with a **Getting there** panel (`src/components/getting-there.tsx`, `GET /api/trips/compare`) that prices each way to travel side by side, independently of the 23-day timetable window. Every figure comes from an official open dataset, read server-side and cached (`src/server/providers/fares.ts`); nothing is invented.

| Mode | What is shown | Source | Limits |
| --- | --- | --- | --- |
| Train | Per carrier (TGV INOUI, OUIGO, Intercités), the published one-way 2nd-class price band, standard and with an Avantage railcard, to the station nearest the venue (and any other within 15 km of it) | SNCF Voyageurs open data, ODbL: `tarifs-tgv-inoui-ouigo`, `tarifs-intercites`, station positions from `gares-de-voyageurs` | A band, not a live fare: the exact price depends on date and demand and is confirmed on SNCF Connect. TER regional fares are not covered. France only. "Tarif Réglementé" and school-subscription profiles are not shown. |
| Car | Fuel cost estimate: straight-line distance × 1.3 road factor, 6.5 L/100 km, today's national average E10 price | Ministère de l'Économie, "Prix des carburants – flux instantané" | Estimate, labelled as such. Tolls and parking are excluded; the Google Maps link shows the real route and tolls. |
| Coach | No price shown: fares change per departure. Link to the Omio coach page for the route to the arrival station's town | Omio (affiliate) | Omio gives links, not a price feed. |

Fare queries use digits-only station codes and fixed field names; the cache keeps station lookups for 24 hours, fare bands for 12 hours and the fuel average for 6 hours. Sample, cancelled and postponed concerts get no comparison. Tests: `tests/fares.test.ts` (fixtures only).

ODbL attribution: the panel names "SNCF Voyageurs open data (ODbL)" as its source.

## Omio affiliate links

Omio approved Encore on Impact ("Omio Travel Partner Program", campaign 7385; online sales earn 2–10 %, 30-day referral). The programme provides tracking links, banners, coupons and widgets, **not an API or price feed**, so Encore cannot show Omio prices; it sends people to Omio's route page, where Omio shows live times and prices.

- Link builder: `src/server/providers/omio.ts`. Route pages are `https://www.omio.fr/{trains|bus}/{from}/{to}` with Omio's slugs (lower case, no accents, `-`). They exist for towns with a station or coach stop (Metz, Thionville, Saint-Étienne…), not for small venue towns (Amnéville returns 410), so links use the **town of the arrival station** from the fare comparison, resolved from the station's INSEE code through geo.api.gouv.fr (arrondissements fold into Paris, Lyon, Marseille).
- Tracking: `OMIO_AFFILIATE_URL` is the long Impact link without query, e.g. `https://omio.sjv.io/c/<partner>/<ad>/<campaign>` (Impact → link icon → "Create and share link" gives a short `omio.sjv.io/…` link; its redirect reveals the long form). Encore adds `u=<route page>`, `subId1=encore-trip`, `subId2=<trains|bus>`; no personal data. Without the variable, links go to omio.fr unattributed.
- Checked by hand on 7 October 2026: the long link lands on `/trains/paris/metz` with Impact's click ID.
