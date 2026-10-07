# Live travel providers for Trip Intelligence

Trip Intelligence shows a train/coach journey and a hotel for concerts outside the user's home city. Live data comes only from the providers below, and only when their server-side keys are set. Without a key the component is shown as unavailable; nothing is invented. Sample (fictional) travel stays limited to sample-mode concerts in test/local/development profiles (CON-32).

| Provider                           | What it gives                                                                                                                                                    | What it does not give                                                                                               | Server variable                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **SNCF open API** (Navitia engine) | Real train and coach timetables (TGV, OUIGO, TER, Intercités, some coaches and cross-border trains), duration, changes, earliest return the next morning         | Fares, seat availability, booking. The app shows "Timetable only · price with the seller" and links to SNCF Connect | `SNCF_API_KEY`                                       |
| **Nuitée LiteAPI**                 | Hotels within 3 km of the venue with current bookable rates for one adult, one night; distance to the venue; partial-price flag when taxes are paid at the hotel | Reviews/photos (not displayed), multi-room or group stays                                                           | `LITEAPI_API_KEY`, optional `LITEAPI_WHITELABEL_URL` |

Priced multimodal transport (train + coach + flight with fares and checkout) needs a partner agreement, for example Omio Meta Search (see the CON-30 research). It is not self-service, so it is not integrated.

## Setup (founder)

1. **SNCF**: request a free token at <https://numerique.sncf.com/startup/api/token-developpeur/>. It arrives by email. Quota: 5,000 requests per day; the app stops at 4,500.
2. **LiteAPI**: create a free account at <https://dashboard.liteapi.travel/>, then **Developers → API Keys**.
   - A **sandbox** key (`sand_…`) returns test prices. It works in local and development profiles, is labeled "LiteAPI sandbox — test prices, not bookable", and is **ignored by production deployments** (including Vercel previews built in production mode).
   - A **production** key returns live rates. Production accepts only a key starting with `prod_`; if your production key looks different, it will be ignored (fail safe) and the code needs a one-line change. LiteAPI asks for a card and payout details before issuing it; that is a business decision.
   - Optional: configure the LiteAPI white-label booking site and set its HTTPS address as `LITEAPI_WHITELABEL_URL`. Hotels then get a "Check accommodation booking" link to that host only. Verify one link by hand after setup: the deep-link format (`/hotels/{hotelId}?checkin&checkout&occupancies=<base64 JSON>`, per LiteAPI's white-label deep-linking guide) has not been tested with a real account. The displayed price is LiteAPI's `offerRetailRate`; confirm with LiteAPI that it matches your white-label checkout price and may be shown publicly.
3. Add the variables in Vercel → Settings → Environment Variables (Production), then redeploy.

## How it works

- `src/server/trips.ts` `selectTripProviders` builds the live registry from server variables; `tripSearchContext` takes the home city centre from the catalog and the venue coordinates from the stored Ticketmaster record (falling back to the city centre).
- `src/server/providers/sncf.ts`: two journey searches (arrive one hour before the show, keeping only journeys arriving at least 30 minutes before; return from 09:00 Paris time the next morning, DST-safe), local Paris times converted to ISO offsets, walking-only journeys dropped, shared rolling 24-hour limit of 4,500 requests.
- `src/server/providers/liteapi.ts`: hotel catalog search around the venue, then one rates call; cheapest offer per hotel; 4 requests/second limit. A venue distance is shown only when the real venue position is known (never from the city-centre fallback).
- Both adapters reuse an answer for at most 60 seconds (bounded in-memory cache) and keep its original fetch time, so a cached quote is never presented as newer than it is.
- Live travel is never queried by the app-state poll. Saved plans are re-checked when the Trips page opens (at most five per request; the rest show as not yet checked). Provider failures are logged as `provider_failed` and shown as unavailable.
- A fictional sample concert never receives live trains or hotels.
- Timetables are "schedule-only" quotes (`scheduleOnly` in `src/domain/trip-safety.ts`): no price, never totalled, never badged Cheapest/Fastest/Best value.
- Planning a trip and re-checking saved plans share a limit of 20 requests per minute per user.
- Tests: `tests/travel-providers.test.ts` (fixture responses only; no network).
