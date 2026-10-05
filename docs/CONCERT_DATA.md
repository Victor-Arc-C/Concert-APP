# Concert ingestion decision (CON-11)

Decision: retain Ticketmaster Discovery for the private MVP. It is already integrated, has explicit attraction/event IDs and supports the metadata this app needs. A new provider would not remove the need to verify market coverage and usage rights. Review dated 5 October 2026.

| Candidate | Coverage and freshness | Metadata and ticket links | Access, limits and cost | Decision |
| --- | --- | --- | --- | --- |
| Ticketmaster Discovery | Multi-country coverage; no completeness or inventory freshness guarantee. Encore refreshes followed artists hourly. | Artist, venue, date/time and seller URLs; price ranges may be absent. | Key required; documented default 5,000 calls/day and 5/second, deep paging below 1,000 items. Encore uses stricter 4,900/day and 2/second. Commercial rights/affiliate terms need separate review; no commission assumed. | MVP provider. |
| Songkick | Upcoming/past concerts searchable by artist, venue, date and location. No freshness SLA verified. | Event/venue endpoints; ticket-link suitability must be confirmed under the licensed response contract. | Paid licence and partnership required; student/hobby requests are not approved. Exact fee/quota not verified. | Defer until licensed access is secured. |
| Bandsintown | Artist event feed; upcoming and date-range queries. No completeness or freshness SLA verified. | Venue/location, lineup, date/time and ticket links; missing offers are possible. | App ID required. Cross-artist usage rights, price and quotas are not established for Encore. | Defer pending an applicable agreement. |

Sources: [Ticketmaster Discovery reference](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/), [Songkick developer access](https://www.songkick.com/developer), [Bandsintown API documentation](https://help.artists.bandsintown.com/en/articles/9186477-api-documentation). These describe capabilities, not a grant of commercial rights to this app.

## Runtime contract

- Follow canonical live attraction records; sample artists never silently map by name.
- Request all locales, including French-only listings. Fetch at most five pages of 100 events per artist; this cap is a coverage limitation.
- Normalize artist, venue, city/country, date, optional local time/timezone, source ID and safe seller URL. Unknown prices/times stay null. Raw provider payload and IDs remain traceable in `event_provider_records`.
- Repeated source IDs update the canonical event and raw snapshot rather than adding another concert. Fingerprints catch exact matches; distinct performances remain separate.
- Manual imports and the scheduled worker share serialization and cache rules. Successful artist imports cache for one hour; failed artist attempts back off for 15 minutes. Re-running the worker does not duplicate alerts.
- HTTP 429/5xx failures also persist a provider-wide cooldown of at least 15 minutes, extended by a valid `Retry-After` delta or HTTP date. Other users/artists respect that cooldown, including after a process restart. No sleeping request loop holds a web request open; later scheduler invocations retry when due. Existing cached listings remain usable.
- In-process scheduling is for a single local process. Hosted operation requires one external authenticated scheduler; distributed ingestion locking remains a deployment limitation.

`tests/ingestion.test.ts` exercises repeat imports and updated raw provenance against an in-memory migrated database, plus a two-hour provider cooldown shared across artists. Existing provider, jobs and scheduler tests cover locale, cached failures, serialization and import-before-alert order. All tests use synthetic records and no live credentials.
