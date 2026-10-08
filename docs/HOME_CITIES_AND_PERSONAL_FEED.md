# Departure cities and personal feed

Home city is the journey origin. Country or Europe scope includes the followed artist's
concerts elsewhere, including Paris; city-only and an optional radius remain explicit filters.

The catalogue offers 63 French origins, at least three in each of the 18 regions, including
overseas, plus the existing seven European cities. This is a regional selection, not every
French commune. Names, INSEE codes, regions and town-hall coordinates were retrieved from
[API Découpage administratif](https://geo.api.gouv.fr/decoupage-administratif/communes) on
8 October 2026 (`/communes/{code}?fields=nom,code,region,mairie`). The checked-in snapshot in
`src/domain/french-cities.ts` requires no runtime API or key. Town-hall coordinates represent
the departure centre, not a station or an exact home address. Réunion city names include the
region to avoid confusing them with mainland namesakes. Supported origins do not guarantee
transport inventory; existing provider availability rules still apply.

The concert catalogue is shared for ingestion and artist lookup. The personal feed requires
an active affinity belonging to the signed-in account. Matching genres and follows by other
accounts do not qualify. No followed artists or no matching shows produces an empty feed.
Saved concerts, alerts and saved trips remain scoped to their owner and accessible even if
the artist is no longer followed; saving a show does not implicitly follow its artist.

Regression coverage includes two live accounts against the same PGlite database, a new empty
account, hiding an artist, saved-show retention, Limoges to Paris with country/radius filters,
and a browser flow through onboarding, must-see destinations and persisted settings.
