# Verified regional artist records (CON-45)

Ticketmaster can split one artist across regional attraction records. Reading only `Artist.providerId` can miss concerts even when other Ticketmaster identities already belong to the same canonical artist.

Ingestion now reads the selected ID and the canonical artist's existing `artist_provider_records` Ticketmaster mappings. It also expands one explicitly reviewed family: **Bigflo & Oli** `K8vZ917KBrV` and **Bigflo et Oli** `K8vZ917pPdf`. Either existing follow fetches both records without merging user accounts, follows or artist rows. The review used official Discovery attraction/event responses on 7 October 2026; the latter record supplied the French Karma Tour. The [official Fnac artist page](https://www.fnacspectacles.com/artist/bigflo-et-oli/?inApp=true) uses both the “et” URL and “&” display name. This pair is an explicit provider-ID relationship, not permission to treat every similar name or every “et”/“&” variant as the same artist.

Unknown homonyms retain their existing ambiguity/review handling. More families require identity evidence and a reviewed code change; they must not be inferred from artist nationality, name similarity or seller coverage alone.

Each linked record gets a first-page request before pagination consumes the remaining **shared five-request budget** (100 requested listings per page). More than five linked IDs produces an explicit pilot-limit error. Large catalogues can still be truncated by the existing budget. Duplicate provider event IDs are returned once; canonical concert deduplication and exact ticket-source attribution remain in the existing persistence path. Provider failures stay visible and the one-hour success cache / 15-minute failure backoff still apply.

Requests keep `locale=*` and do not apply a France-only country filter. Recommendations continue to apply the user's region/date preferences afterward. Price metadata stays attached to the original event/seller and currency; absent prices remain absent. This change supplies no new ticket-price source.

## Fnac is complementary

Fnac Spectacles / France Billet is an additional candidate for **France, Belgium and Switzerland**, pending advertiser approval and tariff validation. It must not replace international Ticketmaster discovery or promise prices for other countries.

Seller geography is distinct from artist nationality. Fnac lists international artists performing in its markets, for example [Tame Impala's Paris dates](https://www.fnacspectacles.com/artist/tame-impala/). No evidence reviewed here measures the proportion of French versus international artists in the full feed. Do not filter out international artists or claim complete coverage of any nationality.

Tests exercise either Bigflo follow, French and UK events, preserved GBP and unknown source values, overlapping event IDs and a later unavailable price, canonical mapping isolation, unreviewed names and fair bounded paging. Real verification and deployment status are recorded in the PR; a synthetic test tariff is not a verified live ticket price.
