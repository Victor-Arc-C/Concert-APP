# Showbound brand

**Never miss your favourite artists live.**

Showbound (formerly Encore) follows the artists you love, finds their dates, links the tickets and plans the trip when the show is far. This guide covers the name, the logo, the visual world, motion, voice in English and French, and what still carries the old name outside the code. The design tokens and component rules are in [DESIGN.md](../DESIGN.md).

## Name

- **Showbound**, one word, capital S in running text. The wordmark is lowercase: **showbound**.
- Meaning: bound for the show, the way a train is bound for a city. It carries the trip without the old departures-board look.
- Never translate it. In French: « Showbound suit tes artistes… ».
- Internal identifiers keep the old name on purpose: the `encore_session` cookie, the `.data/encore` database path, process globals, and the `encore-trip` sub-ID on Omio links (changing it would split partner reports in two).

## Logo

A moving head (the lamp), its beam, and the performer standing in the light.

| File (`public/brand/`) | Use |
| --- | --- |
| `showbound-logo.svg` | Default lockup on light backgrounds (haze, white). |
| `showbound-logo-reversed.svg` | On ink or dark photos. Haze lamp and text, rose beam. |
| `showbound-logo-mono.svg`, `showbound-logo-mono-white.svg` | One colour (print, embossing, partner pages that ask for mono). The beam is cut around the lamp and the performer so all three still read. |
| `showbound-symbol.svg` (+ `-reversed`, `-mono`, `-mono-white`) | Small spaces, avatars, the favicon (`src/app/icon.svg`). |
| `showbound-wordmark.svg` | Text only, outlined. |
| `showbound-app-icon.svg`, `showbound-app-icon-1024.png` | Home-screen and store icon: the stage in miniature, truss on top. |
| `showbound-app-icon-maskable.svg` | Android maskable icon (content inside the safe circle). |
| `showbound-badge.svg` | Android notification badge (white silhouette, read as a mask). |
| `showbound-logo-1200.png` | Raster lockup for decks and partner forms. |

Rules:

- Clear space around the lockup: the height of the lamp on every side.
- Minimum size: symbol 16 px, lockup 96 px wide.
- Don't recolour the beam outside the gel palette, add effects, outline the wordmark, or set "showbound" in another typeface.
- The wordmark is Bricolage Grotesque 800, optical size 48, tracking −0.035em, outlined to paths from the font the app ships.

Provenance: drawn in code from the approved direction (no image generation). The symbol geometry lives in `src/components/ui.tsx` (`Mark`) and in the SVG sources; the wordmark was outlined from `@fontsource-variable/bricolage-grotesque` (OFL); PNG icons were rasterised from the SVG sources (`src/app/icon.png`, `src/app/apple-icon.png`, `public/icons/*`).

## The world: a lit stage in daylight haze

The room is lavender haze, the rig and the words are ink, and light comes in coloured gels.

| Role | Colour |
| --- | --- |
| Haze (page) | `#efeafb` |
| Haze deep (rail, top of the stage) | `#e4dcf8` |
| Floor (bottom of the stage) | `#f6e8f3` |
| Card | `#faf8ff` / white |
| Ink (text, rig, primary buttons) | `#15122b` |
| Ink soft (secondary text) | `#4a4566` |
| Truss | `#2b2840` |
| Gels | rose `#ff3d7f`, cyan `#1fb6ff`, amber `#ffaa00`, lime `#7be03a`, violet `#a58bff`, flame `#ff6a3d` |

- Gels are light, not text. Text on light backgrounds is ink; errors use `#b0144a`.
- Every artist keeps one gel, picked from their name, so the same artist is lit the same way everywhere.
- Artist photos are printed grey and lit by the artist's gel. Without a photo, the artist's initials sit on the gel: a deliberate fallback, never an empty box.
- Beams sit behind the content and multiply into the haze. They colour the page; they never cover text.

## Type

Bricolage Grotesque Variable, self-hosted. 800 at display sizes with −0.04em tracking and optical size 96; optical sizing on everything else. Dates, times and prices use tabular figures.

## Motion

Motion is lighting. Every animation is a lamp doing its job:

- **Power on.** Lamps flicker on in turn and their beams tilt into place (app shell, marketing hero, loader).
- **Cues.** Each screen and each filter is a lighting cue: the beams swing on springs and the gels change colour.
- **Follow spot.** Saving a show drops a white spot on its card. Building a trip walks a spot down the cue sheet, ticket, travel, bed.
- **Converge.** When the artist check finishes, or someone joins the waitlist, every beam lands on the result.
- **Signature.** On the marketing stage, six moving heads find three real acts on the floor, lean towards the pointer, and spotlight the act you point at.

Springs are interruptible (retargeting keeps velocity). With reduced motion, lights are set without travel: no flicker, no sway, no spot sweep, fades instead of slides.

## Voice

Short, warm, concrete. Say what is known and say what is not.

- English: "Who's on", "Saved. It stays in the light.", "Price not listed".
- French uses *tu*, the way students talk: « Qui joue », « Gardé. Il reste dans la lumière. », « Prix non communiqué ».
- Never invent a price, a total, a number of fans or a partnership. Sample data is always called sample (« démo »).
- No em dashes in interface copy.

## External updates (not done, to do by the owner)

These still show "Encore" or point to the old identity. None was changed from here:

- **Spotify developer app**: app name, description and icon (Spotify dashboard). Users see the app name on the consent screen.
- **Vercel project**: project name and the `concert-app-drab.vercel.app` domain. No domain was bought or changed.
- **Domain**: no `showbound` domain was checked or bought. Check availability and trademark before any purchase.
- **Impact / Omio**: the partner profile (account name, website description). The `Impact-Site-Verification` line stays in the root layout; the `encore-trip` sub-ID stays for report continuity.
- **CJ / Booking.com** (application pending): property name "Encore - Concert Discovery & Travel Planning".
- **Ticketmaster developer app**, **LiteAPI** and **Awin / partner requests**: app or company name where they show it. Prepared partner emails in `docs/CON-28-ACCESS-REQUESTS.md` keep the old name because they are a record of what was prepared.
- **Beta invitations already sent** named Encore; `docs/BETA_KIT.md` now uses Showbound for new messages.
- **Push notifications**: devices already subscribed keep the old icon until the browser refreshes it.
