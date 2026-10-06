# CON-27: live ticket price investigation

Verified 6 October 2026 against the deployed `400efe2` application, its authenticated production ticket-source API, and live official Discovery responses using the configured local API key. Only public event identifiers and findings are recorded here. Live payloads were processed in memory in a disposable database, not committed. Production database credentials were not available; production source observations were verified through `/api/tickets`, not direct SQL.

## Representative French events

These three events were visible in the current production live feed. Each production source was enabled, recently observed (6 October), and returned null price/currency. Matching Discovery event search and detail requests both returned HTTP 200 with no `priceRanges`.

| Event        | Discovery event ID | Date / city              | Classification                |
| ------------ | ------------------ | ------------------------ | ----------------------------- |
| Tame Impala  | `ZkyMmBwZ1A78Z_Z`  | 12 June 2027 / Paris     | Provider did not supply price |
| L2B          | `ZkyMmBwZ1A7FPx4`  | 5 March 2027 / Toulouse  | Provider did not supply price |
| Malcolm Todd | `ZkyMmBwZ1A783qA`  | 22 February 2027 / Paris | Provider did not supply price |

Additional official search/detail checks: Tame Impala Paris 13 June (`ZkyMmBwZ1A78Z_v`), Ninho Amneville 20 January (`ZkyMmBwZ1A7uIfN`), Orelsan Eckbolsheim 20 October (`ZkyMmBwZ1A7167-`), and Triangle des Bermudes Paris 27/28 November (`ZkyMmBwZ1A7uM4t`, `ZkyMmBwZ1A7uUvP`) also supplied no price. These were supplementary provider checks, not all verified against production source records. A date-sorted sample of 100 French music listings supplied zero price ranges; this is a sample, not a claim about the entire French catalogue.

No tested live event had a supplied price lost by the app, or malformed provider price. Deterministic tests exercise those failure classes separately without representing synthetic values as live provider observations.

## End-to-end findings and fix

Discovery raw payload → optional `priceRanges` → normalization → `events.data` and `ticket_sources(price_min,currency,observed_at)` → `displayPrice` → API → card/detail `money`.

Absent ranges correctly become null throughout. Actual live payloads for the three production IDs were replayed through normalization, real SQL persistence in a disposable PGlite database, ticket-source read, feed read and frontend formatter; every stage remained null / `Price not listed`.

Two code defects were identified independently of the missing upstream French prices:

- Price validation previously rejected the entire event if any range was malformed, and only inspected the first range. Individual invalid ranges now become unavailable without discarding the concert; the first usable range is preserved, including its currency. Negative/nonfinite minima, missing currency, invalid currency format and inverted ranges are rejected. No currency conversion or lowest-price comparison is introduced.
- Feed/detail previously read the event JSON price snapshot independently of the source table. They now read the exact provider/external-ID source associated with the displayed listing. Missing, disabled, stale or future observations cannot fall back to the snapshot or a different listing. The source observation timestamp is exposed as `priceObservedAt` and displayed with available prices. Cancelled/postponed events suppress prices; sample behavior is unchanged.

CON-20's existing 24-hour price rule and seven-day ticket-link rule remain separate. Null prices do not disable valid links. Source ordering and exact outbound selection remain unchanged. Currency is taken from the same source as the price. Frontend formatting also rejects negative/nonfinite values and invalid currency formats.

## Official alternative endpoints

- [International Discovery](https://developer.ticketmaster.com/products-and-docs/apis/international-discovery/v2/) offers `GET https://app.ticketmaster.eu/mfxapi/v2/events/{event_id}/prices`, with market-local IDs and a domain. France is absent from its supported markets/domains; Discovery universal IDs and French seller `idmanif` values cannot be assumed to be International IDs. The configured key returned 401 on both the countries endpoint and the documented Netherlands price example. New International API key requests are no longer accepted.
- [Inventory Status](https://developer.ticketmaster.com/products-and-docs/apis/inventory-status/) requires explicitly authorized access. Its region and price-coverage lists omit France. The configured key returned 401 for a POST availability request using a representative event ID. A Discovery key does not establish entitlement to this service.
- [Partner API](https://developer.ticketmaster.com/products-and-docs/apis/partner/) is restricted to official distribution partners. No partner credentials/entitlement are configured or established in this investigation. No reservation or purchasing endpoints were called.

There is no verified alternate endpoint available to this account for these French listings. Therefore no alternate adapter, speculative ID mapping, retry fan-out, scraping or fake fallback is added. A successful alternate-endpoint test is not applicable to this patch: there is no supported alternate integration to test. The persistence/feed regression does verify a later official source observation supplying a valid price independently of the event snapshot, and unavailable observations clearing it. Adding an alternate API requires verified market support, account entitlement and exact event mapping first.

## Verification

Focused unit/SQL regressions cover present/absent Discovery prices, malformed ranges, actual zero, independent source updates, missing sources, stale/future observations, disabled sources, multiple listings, currency and cancelled/postponed handling. Browser regression covers unavailable detail display, usable link without price, EUR/GBP formatting, source attribution and return to unavailable state. Existing frontend and outbound behavior remains covered.

Local lint needed `--ignore-pattern 'tennis-simulation/**'` because an unrelated untracked Python virtual environment contains vendor JavaScript errors. That directory is excluded from the patch; CI runs ordinary lint on the clean repository.

Validation completed: 75 unit tests, typecheck, application lint with the local-only exclusion above, production build, all 8 browser/API tests, and a fresh rerun of the focused price browser test. CI and deployment results are recorded in the linked PR.
