# Core database (CON-8)

The application uses PostgreSQL SQL through either managed PostgreSQL or local PGlite. `src/server/schema.ts` is an append-only migration sequence; `src/server/migrations.ts` is the runner shared by startup and migration tests. Never edit an applied migration or reset a database to deploy a change. Stop local writers before upgrades; start one instance to migrate managed PostgreSQL before starting replicas. Each migration and its version marker execute in one transaction. Concurrent migration runners are not supported.

| Entity | Storage and identity |
| --- | --- |
| Users/profile | `users`, unique email; validated JSON preferences preserve old profiles. |
| Sessions | `sessions`, hashed opaque token; user FK cascades on deletion, expiry indexed. |
| Artists | `artists`, stable internal ID and display snapshot. Names are not unique: unrelated artists may share a name. |
| External artist identities | `artist_provider_records`, unique `(provider, external_id)` mapped to an internal artist; reverse mapping indexed. |
| Concerts | `events`, stable ID, unique conservative fingerprint, normalized JSON snapshot; mode/date indexed. |
| External concerts | `event_provider_records`, unique `(provider, external_id)`, raw source and observation time; reverse mapping indexed. |
| Venues | `venues`, optional coordinates; `venue_provider_records` gives unique source identities; `event_venues` links a concert to its venue. Names alone never merge venues. |
| Ticket sources | `ticket_sources`, multiple sources per concert, unique `(provider, external_id)`, nullable URL/price/currency, observation and disable timestamps. Unknown prices stay null. |
| Affinity | `affinities`, unique user/artist pair with explicit favourite/hidden flags. |
| Saves and feedback | `feedback`, unique user/event pair with saved/dismissed/clicked state; indexed by user through its primary key and by event. |
| Recommendation events | `analytics`, consent-gated action name and JSON properties (including concert ID and mode), indexed by user/time and retention time. CON-9 owns emission/measurement changes. |
| Intent and alerts | `intents`, unique user/artist; `alerts`, unique user/event/kind with user/time index. |

Version 2 only adds tables and indexes. Existing JSON snapshots remain the read/write source for the current single-provider UI. Venue and ticket-source tables establish the multi-provider schema; future ingestion/ticket-source work must populate them from verified identities and preserve legacy snapshot compatibility. No synthetic external IDs, guessed venue merges, fabricated ticket prices or user-data backfill are performed here. CON-19 owns multi-source selection and outbound behavior.

The provider component of each composite key prevents collisions across providers. Concert fingerprints prevent exact duplicate performances while source identities preserve provenance. Known limitations: ambiguous names require explicit mapping, unknown times must not collapse distinct performances, and source adapters still determine canonical reconciliation.

`tests/migrations.test.ts` creates a fresh in-memory database, reruns migrations, upgrades a synthetic version-1 database, checks that existing users/preferences/events/saves survive, and exercises provider uniqueness, foreign keys and indexes. It never opens the user's database. Run `npm test -- tests/migrations.test.ts` to verify migrations without credentials.


## Saved trip intent (CON-32)

Migration 8 keeps the version-7 table and plan columns. New `trip_data` contains only `{version: 1, transport: {id, provider} | null, accommodation: {id, provider} | null}` selected by the server. Prices, availability, links, hotel names/distances, scores and raw provider payloads are not persisted. The API accepts `{eventId, tripOptionId}` and regenerates the selection before the write, checking the current concert status/date/city/venue and mode again in the insert.

Pre-gate client-controlled snapshots are replaced by `{version: 0}`; origin/destination/date, user, event and internal selection columns remain so the saved plan stays visible. Migration 8 removes only the event FK's delete cascade, retaining the logical event ID for `event_missing` revalidation. User ownership FK and account-deletion cascade are preserved. Both `/api/trips/saved` and app-state reads use the same revalidator; no raw JSON snapshot is returned.

Use the existing single-writer migration procedure above. Tests upgrade a disposable version-7 database with a malicious legacy quote, verify its removal and plan retention on concert deletion, and verify account deletion still removes the plan. The user's local database is not opened by these tests.
