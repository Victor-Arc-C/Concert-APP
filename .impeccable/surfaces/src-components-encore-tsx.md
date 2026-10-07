---
version: 1
slug: "src-components-encore-tsx"
primary_target: "src/components/encore.tsx"
related_targets: ["src/components/screens.tsx","src/components/trips-screen.tsx","src/components/settings.tsx","src/components/onboarding.tsx","src/app/globals.css"]
---

# Signed-in app (Encore)

Scope: every signed-in and onboarding screen — app shell, For you, concert detail, saved, trips, artists, alerts, settings, auth and onboarding forms. Not the marketing landing (separate session, src/components/marketing).
Mode: Operate. Audience: French students and young concert-goers on a phone at night. Task: see which shows of my artists are coming, decide, get the ticket link, plan the trip.
Constraints: honest data (unknown stays unknown, sample labeled), existing tests rely on accessible names and copy; no external hosts; build path code-led (no image generation available; founder asleep, structure round unattended — lead structure taken).

## Direction contract

THESIS: Your concerts are departures. The app is the night board of a station that only serves your artists: rows, times, destinations, statuses. Refuses the card-grid feed of poster thumbnails and the dashboard of KPI tiles.
OWN-WORLD: One brand with the marketing site (its tokens, adopted 2026-10-07): night-board black #0b0d12, panels #11141b, hairlines #252b38, porcelain ink #eceae4, dim #9aa0ad, amber #f1b66d for times, prices, the primary action and the live state; signal red for cancelled/postponed, platform green for on sale/saved. Barlow Condensed 800 uppercase for screen titles and artist names; JetBrains Mono tabular for dates, times, prices, distances, statuses; Manrope for everything else. Square corners, hairline row rules, alternating board slats, status flaps.
STORY: A user opens Encore, reads the next departures of their artists in one glance, opens one as a boarding pass, taps through to the seller, plans the trip as an itinerary, and keeps the shows they want in a coupon wallet.
FIRST VIEWPORT: Mobile: compact top bar (wordmark, home city, alerts) under a mono "DEPARTURES FROM PARIS" strip. Below, the board: column header strip (DATE · ARTIST · DESTINATION · STATUS), then 6–8 rows; each row = mono date block, condensed artist name, city/venue line with a "via" reason, status flap (ON SALE / SOON / NO PRICE / CANCELLED), save toggle. Filters sit in the board header as tabs. Desktop: left rail nav, board centred at ~860px with a detail pane.
FORM: alerts-first departures stream (my list #7, dealt lead; seed cf5f15e3), with itinerary timeline (#3) for trips and ticket wallet (#2) for saved.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
