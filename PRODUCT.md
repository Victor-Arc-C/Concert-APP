# Product

<!-- impeccable:product-schema 1 -->

> Written autonomously on 2026-10-07 while the founder was asleep, from the repository (README.md, docs/MVP_SCOPE.md, docs/BETA_KIT.md) and the founder's brief for the marketing site. Lines marked _(inferred)_ were not confirmed by the founder; confirm or correct them at the next session.

## Platform

web

## Users

Concert-goers in France and nearby Europe, starting with students and young adults (the private-beta cohort recruited through friends, campus groups and music communities, `docs/BETA_KIT.md`). The founder's brief says "for every music passionate". They follow a handful of artists across French rap/pop, electronic and international pop, and they go to shows in their own city and sometimes travel to another one. _(inferred: they mostly use the app on a phone, in the evening, between other apps.)_

## Product Purpose

Showbound (formerly Encore) shows upcoming concerts of the artists you follow, explains why each one is recommended, sends you to a trusted ticket seller, and shows how to get there when the show is not in your city (train timetables, hotels near the venue). Success for the private beta (docs/MVP_SCOPE.md): people open recommended concerts, save them, click through to a ticket seller, and come back the following week.

## Positioning

Artist-first concert discovery that treats the trip as part of the show: the same plan holds the ticket, the train and the night's stay, with honest sources and freshness. Promise: "Never miss your favourite artists live." Showbound never sells tickets or invents prices; it points to the seller.

## Operating Context

- Live concert data comes from the Ticketmaster Discovery API; many French events have no listed price ("Price not listed").
- Sample mode shows fictional concerts and must always be labeled as fictional.
- Trip Intelligence: SNCF timetables (no fares) and LiteAPI hotel rates when configured; otherwise components are shown as unavailable.
- Private beta, invite codes, in-app feedback, weekly metrics (docs/ANALYTICS.md).
- The marketing site and the app share one world: a lit stage in daylight haze (rebrand of 7–8 October 2026, direction "F" with the name Showbound).

## Capabilities and Constraints

- Screens: landing (marketing), signup/login, onboarding (home city, distance, artists, consent), feed "For you", concert detail with ticket sources, saved shows, trips (planner + saved plans), artists (search, follow, must-see), alerts inbox, settings (preferences, data export, account deletion, feedback), privacy and beta terms.
- English first, French second: every interface string lives in `src/i18n` (typed dictionaries), the choice is kept in the `showbound_lang` cookie and on the account for notifications. Layouts must survive ~30% longer French labels.
- Next.js 16 / React 19, one global stylesheet (`src/app/globals.css`) plus a CSS module for marketing, self-hosted Bricolage Grotesque (Fontsource), Lucide icons. No external font or image hosts at runtime (CSP); artist photos only from Spotify's image host when an artist comes from Spotify, initials on the artist's gel otherwise.
- Must never show sample data as live, invent a price, availability or capacity, or hide a source.

## Brand Commitments

- Name: Showbound (wordmark "showbound", lowercase, Bricolage Grotesque 800). Internal identifiers (session cookie, database path, partner sub-IDs) keep the old name on purpose.
- Founder's brief (October 2026 rebrand): brighter, simple, lively, very animated; energetic colours, softer shapes, readable type with character; artist photos and expressive type carry the identity; less text; not everything as pills. Break with the old dark, textual, cubic look.
- Chosen world: a lit stage in daylight haze. Lavender haze for the room, ink for the rig and the words, coloured gels (rose, cyan, amber, lime, violet, flame) for light. A truss with moving heads tops every screen; beams multiply into the haze behind content and follow screens, filters, saves and sign-ups. Founder asked for "less white" and "more present" projectors.
- Signature: the marketing hero (six moving heads find the acts on the floor, lean to the pointer, converge on the confirmation when someone joins). In the app: the follow spot on a saved show and the loader after choosing artists.
- Brand sources: `public/brand/` and `docs/BRAND.md`.

## Evidence on Hand

- Real live listings (Ticketmaster), sample fixtures (`src/domain/sample.ts`), generic Unsplash atmosphere images (`public/images`, licence in `public/images/SOURCES.md`).
- No testimonials, user counts, press or partner logos exist. None may be invented.

## Product Principles

1. Honest data first: unknown stays unknown, stale is labeled, sources are named.
2. The artist leads; the concert is the unit; the trip follows.
3. One plan for the whole night: ticket, travel, stay.
4. The seller handles the purchase; Showbound never pretends to.

## Accessibility & Inclusion

WCAG 2.2 AA contrast and focus visibility; reduced-motion respected; touch targets ≥ 44 px on mobile; screen-reader names on icon buttons and dialogs (existing tests assert several of them).
