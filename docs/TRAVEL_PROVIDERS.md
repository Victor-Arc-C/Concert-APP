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

Hotel quotes keep the configured LiteAPI white-label hotel link when available ([documented deep links](https://docs.liteapi.travel/docs/deeplinking-to-whitelabel)). Without that link, the UI offers a Booking.com search for the selected hotel's name, city, dates and guests; the price and availability there may differ. With `BOOKING_AFFILIATE_URL` set (the CJ deep-link base from booking.cj.com → Create a Deep Link, without its query, e.g. `https://www.dpbolvw.net/click-<property>-<ad>`), that search goes through CJ with `sid=showbound-hotel&url=<Booking search>` for commission; no personal data. No LiteAPI rate is represented as bookable through Booking.com. Sample, cancelled and postponed concerts have no external search actions.

## Getting there: the real ways to the show

The trip page opens with a **Getting there** panel (`src/components/getting-there.tsx`, `GET /api/trips/compare`, `src/server/transport-comparison.ts`). It shows **no estimated price**: every figure a user sees comes from the seller's live search behind a link. (An earlier version showed SNCF's yearly price bands and a fuel estimate; Victor found them misleading and they were removed.)

Modes appear by straight-line distance from the home city to the venue, best first:

| Distance | Shown | Recommended |
| --- | --- | --- |
| < 500 km | Train, car, coach | Train when a TGV/OUIGO/Intercités route exists, else car |
| 500–1,000 km | Train, plane, car, coach | Train when served, else plane |
| ≥ 1,000 km | Plane (train only if a French route exists below 1,500 km) | Plane |

- **Plane**: nearest airport city to home and to the venue (`src/domain/airport-cities.ts`, within 120 km). The main link is a Google Flights search for the concert day (`Flights from PAR to ATH on <date> one way`), which shows live flights and prices; the panel says to land three hours before the show (or fly the day before for shows before 09:00). When configured, Omio's documented dynamic search receives the airport city names and concert date; no route slugs are guessed.
- **Train**: `src/server/providers/rail.ts` finds stations near home (15 km) and the venue (40 km) and uses the SNCF fare tables only to know which carriers run the route (no prices are read). One Omio route link per arrival town, plus SNCF Connect. With no direct TGV, OUIGO or Intercités from home, it looks for a change at the nearest big hub on the way (Paris, Lyon, Lille, Rennes…, at most a third longer than the straight line) that has one to the venue, and says so: Auxerre → Paris → Brest. The first leg (TER or car) is not in these tables, so it is named but not detailed; Omio's search from home covers the whole journey.
- **Car**: Google Maps driving directions (time, route, tolls). **Coach**: Omio's coach page to the arrival station's town.

Real fares inside Encore (cheapest train or flight arriving before the show) need a live fare API: Omio Meta Search API (requested through the Omio partnership) or a flight API. Until then, the links open live searches.

## Omio affiliate links

See [Omio travel planning](OMIO.md) for the native concert planner, current official redirect template, Impact configuration, account verification and limitations. The provider requires `OMIO_ENABLED=true` and your real `OMIO_PARTNER_ID`; without them no Omio URL is generated. The legacy `OMIO_AFFILIATE_URL` and untracked route-page fallback are no longer used.

The existing itinerary comparison also uses the documented dated search links. Its train/coach destinations retain the known arrival station town. Search links are not quotes or proof of availability, attribution or commission. Current account approval and end-to-end landing behavior must be verified before enabling the feature.

## Flight prices (Google Flights through SerpApi, first)

`src/server/providers/google-flights.ts` asks SerpApi's Google Flights engine (`engine=google_flights`, one way, one adult, EUR) for the concert day. Metropolitan codes become airport lists (`PAR` → `CDG,ORY,BVA`, `STO` → `ARN,BMA,NYO`…, `airportCodes` in `airport-cities.ts`). Only the route and the day are sent, never anything about the user.

- Searches use `deep_search=true`, `show_hidden=true` and `sort_by=2` (price): the quick search missed flights the Google Flights page lists (Paris → Stockholm, 12 Feb 2027: it returned a €140 one-stop and missed a €107 SAS nonstop). Deep search is slower, hence a 40 s timeout.
- A cheaper flight landing after the deadline but at least 1 h 30 before the show is offered as "cheaper but tight", never counted in the trip total.
- The cheapest itinerary leaving that day and landing at least three hours before the show (Google gives landing times local to the arrival airport, read in the concert's timezone) wins. The page says it is Google Flights' price checked in the last 6 hours and links to the same Google Flights search.
- Answers (including "no flights") are stored in `fare_cache` for 6 hours and shared by every user, so the plan's monthly searches last (free plan: 250 per month). Quota or key errors are not cached; the page then falls back to Travelpayouts.
- `SERPAPI_KEY` from serpapi.com → Dashboard. Without it, nothing is fetched.

## Flight fares (Travelpayouts, fallback)

`src/server/providers/travelpayouts.ts` reads the Aviasales Data API `GET /aviasales/v3/prices_for_dates` (origin and destination city codes from `airport-cities.ts`, the concert day, one way, EUR; token in the `X-Access-Token` header). These are **real fares Aviasales travellers found in the last 48 hours**, not a live booking quote, and the page says so.

- Only flights leaving on the concert day. The cheapest that provably lands at least three hours before the show (show start in the venue's timezone; arrival = departure + `duration_to`/`duration`) wins. Flights without a duration count only when none is provably on time, and the page asks to check the landing time.
- Booking link: the itinerary `link` the API returns on aviasales.com (never another host), else `https://www.aviasales.com/search/PAR1205ATH1`, with `marker=<TRAVELPAYOUTS_MARKER>` for commission.
- Cached 30 minutes per route and day. Without `TRAVELPAYOUTS_TOKEN`, nothing is fetched and the Google Flights link remains.
- Coverage is thin for far-off dates: it is a cache of other travellers' searches (Paris → Stockholm had nothing for February 2027 when checked on 9 October 2026). That is why Google Flights comes first.
- The fare is added to "Trip so far" as the transport price when the plan has no transport price of its own.
- **To verify with a real token**: the response field names (`price`, `airline`, `flight_number`, `departure_at`, `duration_to`, `link`) follow Travelpayouts' published examples; the official reference was not reachable from the build machine.
