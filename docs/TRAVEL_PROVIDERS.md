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
   - A **sandbox** key (`sand_…`) returns test prices. It works locally and in previews, is labeled "LiteAPI sandbox — test prices, not bookable", and is **ignored by production**.
   - A **production** key (`prod_…`) returns live rates. LiteAPI asks for a card and payout details before issuing it; that is a business decision.
   - Optional: configure the LiteAPI white-label booking site and set its HTTPS address as `LITEAPI_WHITELABEL_URL`. Hotels then get a "Check accommodation booking" link to that host only. Verify one link by hand after setup: the deep-link format (`/hotels/{hotelId}?checkin&checkout&adults`) is taken from LiteAPI's documentation and has not been tested with a real account.
3. Add the variables in Vercel → Settings → Environment Variables (Production), then redeploy.

## How it works

- `src/server/trips.ts` `selectTripProviders` builds the live registry from server variables; `tripSearchContext` takes the home city centre from the catalog and the venue coordinates from the stored Ticketmaster record (falling back to the city centre).
- `src/server/providers/sncf.ts`: two journey searches (arrive one hour before the show; return from 09:00 the next morning), local Paris times converted to ISO offsets, walking-only journeys dropped, results cached 4 minutes, shared daily rate limit.
- `src/server/providers/liteapi.ts`: hotel catalog search around the venue, then one rates call; cheapest offer per hotel; results cached 4 minutes; 4 requests/second limit.
- Timetables are "schedule-only" quotes (`scheduleOnly` in `src/domain/trip-safety.ts`): no price, never totalled, never badged Cheapest/Fastest/Best value.
- Planning a trip is limited to 20 requests per minute per user.
- Tests: `tests/travel-providers.test.ts` (fixture responses only; no network).
