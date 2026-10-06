# Ticket sources and outbound attribution

Ticketmaster ingestion writes each provider listing to the existing `ticket_sources` table, using the canonical event ID. Multiple listings can refer to one concert. Migration 6 preserves existing event snapshots and backfills their current sources; no user data is replaced.

Authenticated `GET /api/tickets?eventId=...` returns usable sources for an event in the user's current mode. `POST /api/outbound` accepts an event ID and optional `{provider, externalId}` source. The server validates the source against that event; it never accepts a destination URL from the client. Without a selection it uses deterministic provider/ID order. Source-selection presentation and price comparison are CON-20.

Links must use an approved HTTPS seller domain, have no embedded credentials, be enabled and have a provider observation within seven days. Cancellation/postponement and fictional samples block outbound navigation. This freshness limit is an MVP cutoff, not a guarantee of inventory. A refresh updates observations but does not re-enable manually disabled sources. Operators can set `ticket_sources.disabled_at` for a known broken link. There is no crawler or claim of live availability.

Clicks retain canonical event, provider and source external ID; exports include these fields. Existing click records remain intact with a null source ID. No affiliate parameters are appended and no commission is claimed without an approved agreement. Choosing a link does not reserve or buy a ticket.

## Price display rules (CON-20)

A live starting price is shown only when finite, nonnegative, accompanied by a three-letter uppercase currency code, a source and a valid observation timestamp no more than 24 hours old. Future or invalid timestamps are rejected. Missing/stale prices remain unknown, never zero; actual supplied zero remains zero. The stored observation is preserved, while server responses suppress unsafe display values. Fictional sample prices remain clearly labelled and do not imply real offers.

Prices are starting observations, not totals: fees and availability must be checked with the seller. Different currencies are never converted or sorted as comparable prices. Sources are ordered deterministically by provider then external ID, not by price or commission. Outbound requests can select an exact represented source; there is no claim of a cheapest or best source. The event's observation date/source remain visible on detail. Link freshness (seven days) and price freshness (24 hours) are separate checks.
