# Product

<!-- impeccable:product-schema 1 -->

> Written autonomously on 2026-10-07 while the founder was asleep, from the repository (README.md, docs/MVP_SCOPE.md, docs/BETA_KIT.md) and the founder's brief for the marketing site. Lines marked _(inferred)_ were not confirmed by the founder; confirm or correct them at the next session.

## Platform

web

## Users

Concert-goers in France and nearby Europe, starting with students and young adults (the private-beta cohort recruited through friends, campus groups and music communities, `docs/BETA_KIT.md`). The founder's brief says "for every music passionate". They follow a handful of artists across French rap/pop, electronic and international pop, and they go to shows in their own city and sometimes travel to another one. _(inferred: they mostly use the app on a phone, in the evening, between other apps.)_

## Product Purpose

Encore shows upcoming concerts of the artists you follow, explains why each one is recommended, sends you to a trusted ticket seller, and shows how to get there when the show is not in your city (train timetables, hotels near the venue). Success for the private beta (docs/MVP_SCOPE.md): people open recommended concerts, save them, click through to a ticket seller, and come back the following week.

## Positioning

Artist-first concert discovery that treats the trip as part of the show: the same plan holds the ticket, the train and the night's stay, with honest sources and freshness. Encore never sells tickets or invents prices; it points to the seller.

## Operating Context

- Live concert data comes from the Ticketmaster Discovery API; many French events have no listed price ("Price not listed").
- Sample mode shows fictional concerts and must always be labeled as fictional.
- Trip Intelligence: SNCF timetables (no fares) and LiteAPI hotel rates when configured; otherwise components are shown as unavailable.
- Private beta, invite codes, in-app feedback, weekly metrics (docs/ANALYTICS.md).
- A marketing site is being designed in parallel with a train-station departure-board concept ("Every show worth the trip").

## Capabilities and Constraints

- Screens: landing (marketing), signup/login, onboarding (home city, distance, artists, consent), feed "For you", concert detail with ticket sources, saved shows, trips (planner + saved plans), artists (search, follow, must-see), alerts inbox, settings (preferences, data export, account deletion, feedback), privacy and beta terms.
- English UI today. _(inferred: French localisation is likely later; layouts must survive ~30% longer labels.)_
- Next.js 16 / React 19, one global stylesheet (`src/app/globals.css`), self-hosted Fontsource fonts, Lucide icons. No external font or image hosts at runtime (CSP).
- Must never show sample data as live, invent a price, availability or capacity, or hide a source.

## Brand Commitments

- Name: Encore (wordmark "encore." in the app).
- Founder's brief for the brand: loud, nocturnal, communal. Avoid generic purple gradients, stock crowd photos, centred-hero-plus-three-cards, "AI slop".
- Marketing concept in progress: departure board, split-flap readouts, Barlow Condensed 800 display, JetBrains Mono data, Manrope UI.

## Evidence on Hand

- Real live listings (Ticketmaster), sample fixtures (`src/domain/sample.ts`), generic Unsplash atmosphere images (`public/images`, licence in `public/images/SOURCES.md`).
- No testimonials, user counts, press or partner logos exist. None may be invented.

## Product Principles

1. Honest data first: unknown stays unknown, stale is labeled, sources are named.
2. The artist leads; the concert is the unit; the trip follows.
3. One plan for the whole night: ticket, travel, stay.
4. The seller handles the purchase; Encore never pretends to.

## Accessibility & Inclusion

WCAG 2.2 AA contrast and focus visibility; reduced-motion respected; touch targets ≥ 44 px on mobile; screen-reader names on icon buttons and dialogs (existing tests assert several of them).
