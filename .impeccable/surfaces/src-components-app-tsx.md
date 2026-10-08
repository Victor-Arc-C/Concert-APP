---
version: 1
slug: "src-components-app-tsx"
primary_target: "src/components/app.tsx"
related_targets: ["src/components/screens.tsx","src/components/trips-screen.tsx","src/components/settings.tsx","src/components/onboarding.tsx","src/components/finder.tsx","src/components/ui.tsx","src/components/stage/rig.tsx","src/app/globals.css"]
---

# Signed-in app (Showbound)

Scope: every signed-in and onboarding screen: app shell, For you, concert detail, saved, trips (planner and list), artists, artist detail, alerts, settings, auth, onboarding with the artist-check loader, privacy. Not the marketing landing (src/components/marketing).
Mode: Operate. Audience: French students and young concert-goers, mostly on a phone. Task: see which shows of my artists are coming, decide, open the ticket link, plan the trip.
Constraints: honest data (unknown stays unknown, sample labeled, sources named); English first, French second, every string from src/i18n; existing tests rely on accessible names; no external hosts except Spotify images; build path code-led (no image generation).

## Direction contract

THESIS: Every screen is a lit stage and your artists are the acts. Refuses the dark departures board it replaces and the generic card-grid feed with a dashboard header.
OWN-WORLD: Lavender haze room (#efeafb, #e4dcf8, floor #f6e8f3), ink #15122b for rig and words, gels rose #ff3d7f, cyan #1fb6ff, amber #ffaa00, lime, violet, flame. A dark truss with three moving heads tops the app; beams multiply into the haze behind white cards. Bricolage Grotesque 800 display at -0.04em, soft 14-26px radii, cue-square filters, artist photos tinted by the artist's gel, initials on the gel when missing.
STORY: Open the app, the rig powers on, read who is on and where, save a show and watch a follow spot land on it, open it, plan the trip as a cue sheet that lights step by step, keep the nights you want.
FIRST VIEWPORT: Mobile: truss and lamps, then wordmark left with city and alerts right, sample banner when relevant, "Who's on" at display size, cue filters with counts, search and month, then the next show as a large lit card. Desktop: haze-deep rail with nav, lamps over the content column, two-column cards, "Your artists" lineup on the right.
FORM: lit act cards in a cue-driven feed (form #2 of my list, seed 09db1cc5, reroll 1); itinerary as a lighting cue sheet for trips.
SIGNATURE: cue filters swing the rig and change its gels; saving drops a white follow spot on the card; the loader after choosing artists polls real progress and lights each artist as it is checked.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
