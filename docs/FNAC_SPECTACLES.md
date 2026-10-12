# Fnac Spectacles prices

Fnac Spectacles (France Billet) is a second ticket seller for concerts already in the catalogue. Awin programme 12494 accepted the Showbound publisher profile on 12 October 2026. Ticketmaster remains the only source of concerts; Fnac adds a price and a ticket link where it sells the same show.

Each matched show gets its own `ticket_sources` row with provider `fnac`. Nothing is written into the Ticketmaster row, and no concert is created from the feed.

## Configuration

| Variable             | Value                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------- |
| `AWIN_FEED_LIST_URL` | The **Feed List Download** address shown at the top of Awin → Toolbox → Create-a-Feed |
| `CRON_SECRET`        | Already used by `/api/jobs`; the same secret protects `/api/jobs/fnac`                |

The address contains the account's product-feed key. Keep it in hosting secrets or the ignored `.env.local`, never in a commit, a log or a client response. Without it the refresh does nothing and no Fnac price or link is shown.

## Refresh

`GET` or `POST /api/jobs/fnac` with the scheduler secret:

1. Reads upcoming, active concerts in France, Belgium and Switzerland (the programme's regions).
2. Downloads Awin's feed list and takes the feed address for advertiser 12494, only if the membership is active. Only the column list of that address is replaced.
3. Streams the feed (about 110,000 sessions, 2 MB compressed, a few seconds) and keeps the sessions of the catalogue's artists and dates.
4. Upserts one `ticket_sources` row per matched session, observed at the time of the run.

`vercel.json` runs it at 05:30 and 17:30 UTC, after the 05:00 concert check. Prices are shown for 24 hours after an observation, so two daily runs leave no gap. A failed run returns an error and changes nothing; existing rows age out through the usual freshness rules.

The response counts concerts considered, sessions matched, matched sessions with a price and concerts left unmatched because two sessions could not be told apart. Those are also recorded in `normalization_reviews` with reason `ambiguous_session`.

## Feed columns

One feed row is one session: a show on one date in one venue.

| Column                                               | Use                                         |
| ---------------------------------------------------- | ------------------------------------------- |
| `merchant_product_id`                                | Session identifier, stored as `external_id` |
| `aw_deep_link`                                       | Awin tracked link, stored as `url`          |
| `Tickets:primary_artist`                             | Artist name                                 |
| `Tickets:event_date`                                 | Local date                                  |
| `custom_7`                                           | Local start time; `00:00` means none        |
| `Tickets:venue_name`                                 | Venue                                       |
| `custom_5`                                           | Country code                                |
| `Tickets:min_price`, `Tickets:max_price`, `currency` | Lowest and highest listed tariff            |
| `stock_quantity`                                     | Sale state, e.g. `2 - AVAILABLE`            |

`2 - AVAILABLE` sessions keep their price. `6 - NO_AMOUNT` and `7 - BEFORE_ONSALE` keep the link without a price. Cancelled, off-sale, undeliverable and unknown sessions are ignored.

## Matching

A session is attached to a concert only when all of these hold:

- the artist name is the same once accents, case and punctuation are removed; joining words are ignored, so "Bigflo & Oli" is "Bigflo et Oli";
- the date and the country are the same;
- the venue names, or the concert's city and the session's venue name, share a distinctive word. Words that name a kind of venue ("Zénith", "Arena", "Palais") do not count;
- when two sessions fit, the start times are identical.

A venue that changed its name is matched through a short reviewed list in `src/domain/fnac.ts` (`renamedVenues`), currently Paris La Défense Arena and Plenitude Arena. Add a pair there only after checking the rename.

Anything else stays unmatched: a missing price is preferred to another show's price. A session belongs to one concert; duplicate listings of the same show keep the one whose start time agrees, then the lowest id.

Checked on 12 October 2026 against the public audit panel (`docs/coverage-audit-fr.public.json`) and the three CON-28 concerts: 105 of 107 upcoming shows matched, 76 with a price. The two misses were GIMS at Paris La Défense Arena, which Fnac lists under the venue's new name, Plenitude Arena; that rename is now in the reviewed list.

## Display and links

- The feed and the concert page show the concert's own price when it has one. Fnac's price is shown only when the concert's own listing has none.
- A price always sits next to its seller: when the Fnac price is shown, the main button opens Fnac Spectacles, and the other seller is offered below.
- The outbound endpoint opens Fnac only when the page asks for that exact source. Without a choice it uses the concert's own seller.
- Approved destinations are Awin click links for advertiser 12494 (`https://www.awin1.com/pclick.php?…&m=12494`), which land on fnacspectacles.com. No other Awin link or advertiser is accepted.
- The Fnac link is an affiliate link. The concert page and the privacy notice say so.

## Known limits

- The link opens the artist's or the tour's page on fnacspectacles.com, not the session.
- The feed does not say whether prices include booking fees. They are shown as starting prices, like every other price.
- The feed has no update time per row; the observation time is the time of the download.
- `6 - NO_AMOUNT` appears to mean sold out. It is treated as "no price", not as a statement about availability.
- The `custom_8` value "Adhérent" (about half of the rows) is not documented and is not used.
