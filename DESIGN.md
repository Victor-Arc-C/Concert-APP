---
name: Showbound
description: A lit stage in daylight haze, where the artists you follow are the acts.
colors:
  haze: "#efeafb"
  haze-deep: "#e4dcf8"
  haze-floor: "#f6e8f3"
  card: "#faf8ff"
  white: "#ffffff"
  line: "#ddd5f2"
  line-strong: "#c4b9e6"
  ink: "#15122b"
  ink-hover: "#2b2650"
  ink-soft: "#4a4566"
  ink-mute: "#6b6687"
  on-ink-soft: "#d6d2ee"
  truss: "#2b2840"
  truss-light: "#4a4468"
  truss-edge: "#3d3858"
  rose: "#ff3d7f"
  cyan: "#1fb6ff"
  amber: "#ffaa00"
  lime: "#7be03a"
  violet: "#a58bff"
  flame: "#ff6a3d"
  alert-ink: "#b0144a"
  alert-wash: "#ffe3ec"
  go-ink: "#1d6b15"
typography:
  display-stage:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(50px, 7.4vw, 116px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.04em"
    fontVariation: "'opsz' 96"
  display:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(42px, 9vw, 76px)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.04em"
    fontVariation: "'opsz' 96"
  headline:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(24px, 3.4vw, 30px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontVariation: "'opsz' 48"
  title:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.03em"
    fontVariation: "'opsz' 48"
  title-small:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  wordmark:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontVariation: "'opsz' 48"
  body:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.15
  meta:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "'tnum' 1"
rounded:
  xs: "8px"
  s: "10px"
  m: "14px"
  l: "20px"
  xl: "26px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  gutter-phone: "16px"
  gutter-tablet: "32px"
  gutter-desktop: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.m}"
    padding: "0 18px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.m}"
    padding: "0 18px"
    height: "48px"
  button-destructive:
    backgroundColor: "{colors.alert-ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.m}"
    padding: "0 18px"
    height: "48px"
  icon-button:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.m}"
    size: "44px"
  cue-filter:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.m}"
    padding: "0 14px"
    height: "44px"
  cue-filter-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  chip:
    backgroundColor: "{colors.haze}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    padding: "3px 9px"
    height: "28px"
  count-badge:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.meta}"
    height: "26px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.m}"
    padding: "0 14px"
    height: "50px"
  concert-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "12px"
  save-button:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.m}"
    height: "44px"
  save-button-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
  modal:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "22px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    padding: "10px 10px 10px 16px"
  trip-total:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
  form-error:
    backgroundColor: "{colors.alert-wash}"
    textColor: "{colors.alert-ink}"
    rounded: "{rounded.m}"
    padding: "12px 14px"
---

# Design System: Showbound

Brand guide (name, logo files, voice, external updates): [docs/BRAND.md](docs/BRAND.md). This file holds the tokens and component rules. Source of truth for every value: `src/app/globals.css` (`:root`) and `src/components/marketing/marketing.module.css`.

## Overview

**Creative North Star: "The Lit Stage in Daylight Haze"**

Every screen is a stage seen in daylight: a lavender haze room, a dark lattice truss across the top with moving heads hanging from it, and coloured gel beams falling into the haze behind the content. The artists are the acts. They stand in the light as grey prints tinted by their own gel, and the interface around them is ink on haze, plain and readable. Light is the only decoration, and light always means something: a cue, a save, a result.

The density is calm and phone-first. One column of lit act cards on phones, two columns and a rail on desktop, generous 26px card corners, 14px control corners, and large Bricolage Grotesque 800 headings that carry the character so the rest of the type can stay quiet. Motion is lighting: lamps power on in turn, beams swing on interruptible springs between cues, a white follow spot lands on what you saved, and every beam converges on a result.

The world replaces a dark departures-board identity (Encore). It is light, soft-cornered and colourful, but the colour lives in light (beams, washes, pools, photo tints), never in text and never as flat coloured blocks behind words.

**Key Characteristics:**
- Lavender haze room, ink rig and words, six gels for light only.
- A truss with three moving heads tops the app (six on the marketing hero); beams multiply into the haze behind content.
- Artist photos printed grey and lit by the artist's gel; initials on the gel when the photo is missing.
- One display face, Bricolage Grotesque, 800 at -0.04em for display, optical sizing everywhere.
- Soft corners from 8px to 26px; no pill-shaped controls.
- Motion as lighting: power on, cues, follow spot, converge; reduced motion keeps the light and drops the travel.

## Colors

A pale violet room lit by saturated stage gels, with one deep blue-black ink doing all the reading work.

### Primary
- **Stage Ink** (ink): every word on a light surface, primary buttons, the active cue filter, count badges, toasts, the trip total, the marketing join section, the focus ring and text selection. It is the one "accent" that carries meaning on a control. Hovered primary buttons step to **Ink Lift** (ink-hover).

### Secondary
- **The Six Gels** (rose, cyan, amber, lime, violet, flame): light, never text. They colour beams, lamp lenses, card washes, floor pools, photo tints, status squares in chips and cue filters, the notification dot and the tab underline gradient (rose, amber, cyan). Every artist owns one gel (`src/components/stage/gel.ts`: fixed for the sample catalogue, FNV-1a hash of the name otherwise). Rose is the house gel: the logo beam, the caret, the input focus halo.

### Tertiary
- **Text-safe signals** (alert-ink, go-ink): the only coloured text. Alert Ink for errors, destructive buttons and danger text buttons, on white or on **Alert Wash** (alert-wash). Go Ink for the verified line on trip steps.

### Neutral
- **Haze** (haze): the page, the room itself.
- **Haze Deep** (haze-deep): the desktop rail, the top of the stage gradient, the marketing header and section sheets, the fade under the rig.
- **Haze Floor** (haze-floor): the warm pink bottom of the full stage (loader).
- **Card** (card) and **White** (white): panels, modals and banners sit on Card; act cards, buttons, fields and icon buttons sit on White.
- **Line** (line) and **Line Strong** (line-strong): 1px card and chip borders; 1.5px field borders and secondary button borders.
- **Ink Soft** (ink-soft) and **Ink Mute** (ink-mute): secondary text and meta; Ink Mute only for placeholders (4.6:1 on haze).
- **On-Ink Soft** (on-ink-soft): secondary text on ink surfaces (active cue counts, join copy, trip total notes).
- **Truss** (truss), **Truss Light** (truss-light), **Truss Edge** (truss-edge): the rig only (lattice, yokes, lamp heads, lenses at rest).

### Named Rules
**The Gels Are Light Rule.** A gel colour is never a text colour on a light background and never a flat fill behind words. Gels arrive as beams, washes at 6 to 42% opacity, pools, tints on grey photos, or 9 to 10px status squares beside ink text.

**The One Gel Per Artist Rule.** An artist is lit by the same gel on every screen and every visit; always pass the artist name through `gelFor`, never pick a gel by hand outside the fixed sample map.

**The Ink Carries Meaning Rule.** Selected, primary and confirmed states turn ink (filled ink, white text). Colour never replaces the ink state; it accompanies it.

## Typography

**Display Font:** Bricolage Grotesque Variable (with ui-sans-serif, system-ui, -apple-system, Segoe UI)
**Body Font:** the same family, optical sizing on
**Label/Mono Font:** the same family; tabular figures for dates, times, prices and counts

**Character:** One self-hosted grotesque with a wide optical range: at 800 and opsz 96 it is loud and characterful, at body sizes it is plain and friendly. Hierarchy comes from weight and size, not from a second face.

### Hierarchy
- **Display Stage** (800, clamp(50px, 7.4vw, 116px), 0.9): the marketing promise only. Section headings on marketing use the same treatment at clamp(36px, 4.4vw, 64px) to clamp(44px, 6vw, 96px).
- **Display** (800, clamp(42px, 9vw, 76px), 0.92): the page title of each app screen ("Who's on"). Trip heads use clamp(36px, 7vw, 64px).
- **Headline** (800, clamp(24px, 3.4vw, 30px), 1.05): section and modal headings, empty states.
- **Title** (800, 22px, 1.02): act card artist names; the next show grows to 26px, then clamp(30px, 3vw, 42px) at opsz 96 on desktop. Very long names drop to 18px.
- **Title Small** (800, 19px, 1.15): h3 and step headers.
- **Body** (400, 16px, 1.5): running text; page intros at 17px held to 52ch, marketing leads at clamp(18px, 1.5vw, 21px) held to 44ch.
- **Label** (700, 15px): buttons (16px), field labels, cue filters, back links, list heads.
- **Meta** (700, 13px, tabular): chips, counts, badges, fine print (500 weight at 13px). The month on the act date tag is the only uppercase text (11px).

### Named Rules
**The Loud Head, Quiet Body Rule.** 800 weight with negative tracking (-0.02em to -0.04em) is for headings, artist names, the wordmark and big numbers only. Everything else is 400 to 700 with zero tracking.

**The Tabular Truth Rule.** Dates, times, prices, counts and distances use tabular figures so columns of facts line up and never jitter.

## Layout

Phone first. The app stacks: truss and lamps (rig height 58px plus the safe area), the topbar with wordmark left and city plus alerts right, banners, the display title, cue filters that scroll sideways under a 16px gutter, search with month, then the feed of act cards with 12px gaps. A fixed five-tab bar sits at the bottom (64px plus the safe area) on a translucent card fill with a 16px backdrop blur.

At 768px the gutter becomes 32px and the page head puts actions beside the title; cue filters wrap instead of scrolling. At 900px act cards go two-up with 14px gaps, and the next show spans both columns with a 200px photo. At 1024px a 248px Haze Deep rail replaces the tab bar, the rig starts after the rail, the gutter becomes 40px and the rig is 64px. At 1280px the feed gains a 300px "Your artists" lineup column. Content is capped at 1180px.

Rhythm: 6, 8, 10, 12 and 14px gaps inside components; 18px between page blocks; 20px panel padding (26px from 768px). Scroll padding keeps focus and anchors clear of the rig and the tab bar. Every touch target is at least 44px.

Marketing runs the same stage at full width with a fluid gutter (clamp(16px, 4.4vw, 64px)), a 72px header, the promise at the left and three acts standing on a floor line at the bottom right, followed by rounded section sheets (44px top corners) that overlap the section above.

## Elevation & Depth

Depth is light first, shadow second. The room gets depth from the haze gradient (Haze Deep at the top to Haze), from beams multiplied into it, and from gel washes inside cards. Surfaces themselves are mostly flat and separated by 1px Line borders; shadows are reserved for things that float above the page.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 30px 60px -36px rgb(43 40 64 / 0.55)`): modals, toasts, the sticky settings save button and onboarding footer, the loader ring, the marketing join confirmation and journey photo. Anything that floats above the stage.
- **Card** (`box-shadow: 0 1px 0 rgb(43 40 64 / 0.04), 0 18px 40px -32px rgb(43 40 64 / 0.45)`): the active rail item and the ticket panel on show detail; the one resting surface that reads a step up because it holds the action.
- **Tag** (`box-shadow: 0 6px 14px -8px rgb(21 18 43 / 0.5)`): the small white date tag sitting on an artist photo.
- **Focus** (`outline: 3px solid ink; outline-offset: 3px`): every focusable element; white on ink sections. Fields add a 4px rose halo at 22%.

### Named Rules
**The Beams Behind Rule.** Beams live in a fixed layer under the content (`mix-blend-mode: multiply`, about 0.42 to 0.5 opacity, masked to fade downwards). They colour the page; they never sit over text. Content scrolling under the rig fades into a Haze Deep gradient instead of colliding with the lamps.

**The Float Only Rule.** A shadow means the element floats above the stage. Cards on the page use a border and their gel wash, not a shadow; the ticket panel is the one resting exception.

## Shapes

Soft rounded rectangles throughout, sized by role: 8px for tiny tags and badges, 9 to 10px for chips and date tags, 14px (m) for buttons, fields, cue filters, icon buttons and banners, 20px (l) for option cards and photo tiles, 26px (xl) for act cards, panels, empty states, modals and the trip total. Phone modals become bottom sheets with 26px top corners. Circles are kept for lenses, live and notification dots, the loader ring and the loader's lineup portraits. Status marks inside chips and cue filters are 9 to 10px squares with 3px corners that turn 45 degrees when the cue is active. The beam is a narrow trapezoid (clip-path from a 7 to 8% top edge to full width at the bottom).

**The No-Pill Rule.** Controls are rounded rectangles, never full pills: 14px for buttons, fields and filters, up to 20px for card-sized choices such as trip plan options. The founder asked for "not everything as pills".

## Components

### Buttons
Solid, plain and pressable.
- **Shape:** gently rounded (rounded.m), 48px tall, 44px for the small variant (12px corners, 15px text).
- **Primary:** ink fill, white 16px 700 text; the default call to action everywhere, including the marketing header.
- **Hover / Focus:** primary steps to Ink Lift, secondary border turns ink (hover only on fine pointers); press scales to 0.97 over 160ms on the ease-out curve; focus is the 3px ink ring.
- **Secondary:** white fill, Line Strong border, ink text. **Destructive:** Alert Ink fill. **Text button:** 700 weight with a 2px Line Strong underline that turns ink on hover. **Disabled primary** keeps a readable label on a dimmed lavender fill instead of fading.
- **On ink (join section):** the button inverts to white with ink text and hovers to Haze.

### Chips
- **Style:** Haze fill, 1px Line border, 9px corners, 13px 700 tabular text, with an optional 9px gel status square (lime for go, amber for wait, rose for new).
- **State:** "stop" chips (cancelled) invert to ink; quiet chips drop to 500 weight and Ink Soft.

### Cue Filters (signature)
The feed filters are lighting cues. White rounded.m buttons with a gel square and a tabular count; the pressed cue fills ink, its square turns 45 degrees, and the whole stage swings to that cue's gels (three registered colour properties crossfade over 700ms while the beams move on springs). They scroll sideways on phones and wrap from 768px.

### Cards / Containers
- **Corner Style:** rounded.xl for act cards, panels, empty states and saved trips.
- **Background:** White for act cards and saved trips, Card for panels, empty states and banners.
- **Shadow Strategy:** none at rest (see Elevation).
- **Border:** 1px Line.
- **Internal Padding:** 12px on act cards (14px for the desktop next show), 20 to 26px on panels.
- **Act card:** a 96px gel-lit photo with a white date tag, then tier, name, when, where and a row of chips with the save button. A diagonal wash of the artist's gel brightens as the card crosses the middle of the viewport (scroll-driven, 0.06 to 0.38) and holds at 0.42 once saved. Cancelled shows strike the name and grey the photo. Cards rise in with a 40ms stagger.

### Artist Photo (signature)
A grey print lit by a gel: the photo is greyscale with slight contrast and brightness and multiplied over the artist's gel. When the image is missing or fails, the artist's initials (800, grapheme-safe, first and last word) sit on the gel under a soft white hotspot. This fallback is deliberate and is never replaced by an empty box or a generic icon.

### Save Button and Follow Spot (signature)
A 44px rounded.m button with a 1.5px ink border; saved fills ink and the bookmark drops. Saving calls the stage's follow spot: a warm white beam swings from the rig to the card, holds, and fades over 1.1s while the card pulses to 1.02. In narrow cards (container under 440px) it collapses to a 44px square named by its label.

### Inputs / Fields
- **Style:** white, 1.5px Line Strong border, rounded.m, 50px tall, 16px 500 text; selects draw their chevron from two gradients.
- **Focus:** border turns ink with a 4px rose halo at 22%; the caret is rose.
- **Error / Disabled:** invalid fields take an Alert Ink border; form errors sit in an Alert Wash block with Alert Ink 700 text.

### Navigation
- **Phone:** a fixed five-tab bar on translucent Card with backdrop blur; 11px labels; the current tab is ink with a 26px rose-amber-cyan underline; counts sit in ink badges, unread alerts as a rose dot.
- **Desktop:** the Haze Deep rail with the wordmark, nav items 46px tall with 12px corners; the current item lifts onto white with the Card shadow and an ink count badge.
- **Wordmark:** the Mark (lamp, rose beam, performer) beside lowercase "showbound" at the wordmark style; the beam warms to amber on hover.

### Modal
Card fill, rounded.xl, 22px padding, Lift shadow, ink backdrop at 42% with a 3px blur; scales in over 320ms. Under 768px it becomes a bottom sheet that slides up over 420ms on the drawer curve.

### Trip Cue Sheet (signature)
Trips read as a lighting cue sheet: steps (ticket, travel, bed) in rows with 44px white step icons and a cue number, separated by 1px lines. A follow-spot glow walks down the steps as they load and each lit step keeps a gel wash from the left. The total sits in an ink block with a large tabular price; every price shows its source or says it is not listed.

### Loader (signature)
After onboarding the stage fills the screen (haze to Haze Floor). A ring fills with real progress (a rose-amber-cyan conic sweep while waiting), and a lineup of round portraits lights one by one in each artist's gel as the server checks them; when the check finishes every beam converges on the ring.

### Motion
Springs (`src/components/stage/spring.ts`) are interruptible; retargeting keeps velocity. App beams use response 0.8s, damping 0.7; marketing beams 0.75s, 0.72. Lamps power on in turn (250ms plus 180ms per lamp in the app, 200ms plus 150ms on the hero) with a stepped 520ms flicker. Screen swaps fade out in 140ms and rise in over 320ms; artist photos morph between screens with a view transition. Under reduced motion lights are set without travel: no flicker, no sway, no spot sweep, fades instead of slides.

## Do's and Don'ts

### Do:
- **Do** put every word on light surfaces in ink, Ink Soft, or the text-safe Alert Ink and Go Ink.
- **Do** light artists with `gelFor(name)` through the ArtistPhoto component, so a missing photo shows initials on the artist's gel.
- **Do** make a new filter or screen a cue: give it three gels on the stage and let the beams move there on springs.
- **Do** use Bricolage Grotesque 800 at -0.04em and opsz 96 for display sizes, and tabular figures for dates, times, prices and counts.
- **Do** keep controls at 44px or taller and corners within the rounded scale (14px for controls, 20px for option cards, 26px for cards).
- **Do** give every motion a reduced-motion version that keeps the light state and drops the travel.
- **Do** label sample data as sample and show "Price not listed" when a price is unknown.

### Don't:
- **Don't** set text in a gel colour on a light background, or fill a block behind words with a gel.
- **Don't** put beams, washes or spots over text; they live in the layer behind content.
- **Don't** make controls full pills; a button, field or filter never rounds past 14px.
- **Don't** shadow act cards or panels that rest on the page; shadows are for modals, toasts, sticky bars and other floating layers.
- **Don't** replace a missing artist photo with a blank box or a generic placeholder icon.
- **Don't** add a second typeface or set "showbound" in anything but the wordmark style.
- **Don't** bring back the departures-board look: no dark full-screen app surfaces, no flap or split-flap type, no condensed board lettering. Ink surfaces stay local (rig, buttons, toasts, the trip total, the join section).
- **Don't** use em dashes in interface copy.
