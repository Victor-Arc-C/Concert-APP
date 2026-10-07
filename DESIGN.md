---
name: Encore
description: The night departures board for your artists' concerts.
colors:
  board-black: "#0b0d12"
  panel: "#11141b"
  panel-raised: "#171b24"
  slat: "#12151d"
  hairline: "#252b38"
  hairline-strong: "#353d4f"
  porcelain: "#eceae4"
  dim: "#9aa0ad"
  faint: "#80879a"
  amber: "#f1b66d"
  amber-ink: "#191104"
  amber-soft: "#f1b66d17"
  amber-line: "#f1b66d66"
  platform-green: "#63d69e"
  platform-green-soft: "#63d69e14"
  signal-red: "#ff7a6b"
  signal-red-soft: "#ff7a6b14"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "3.25rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0.005em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  body-small:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.04em"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.08em"
    fontFeature: "tnum"
  data-figure:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 0.9
    fontFeature: "tnum"
  data-caption:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    letterSpacing: "0.12em"
rounded:
  none: "0px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  row: "20px"
  lg: "28px"
  gutter: "40px"
  gutter-tablet: "28px"
  gutter-mobile: "16px"
  rail: "236px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "11px 20px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "#f6c88b"
    textColor: "{colors.amber-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.porcelain}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "11px 20px"
    height: "46px"
  button-secondary-hover:
    backgroundColor: "{colors.panel-raised}"
  button-small:
    padding: "8px 14px"
    height: "38px"
  input:
    backgroundColor: "{colors.slat}"
    textColor: "{colors.porcelain}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "11px 13px"
    height: "46px"
  board-row:
    backgroundColor: "{colors.board-black}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.none}"
    padding: "16px 18px"
  board-row-slat:
    backgroundColor: "{colors.slat}"
  board-row-hover:
    backgroundColor: "{colors.panel-raised}"
  board-row-next:
    backgroundColor: "{colors.amber-soft}"
    padding: "22px 18px"
  status-flap:
    backgroundColor: "#07080b"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "4px 9px"
  status-flap-go:
    textColor: "{colors.platform-green}"
  status-flap-wait:
    textColor: "{colors.amber}"
  status-flap-stop:
    textColor: "{colors.signal-red}"
  status-flap-quiet:
    textColor: "{colors.dim}"
  save-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    rounded: "{rounded.none}"
    size: "46px"
  save-toggle-saved:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
  nav-item:
    textColor: "{colors.dim}"
    typography: "{typography.label}"
    padding: "12px 10px"
    height: "48px"
  nav-item-active:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
  filter-tab:
    textColor: "{colors.dim}"
    padding: "8px 16px"
    height: "42px"
  filter-tab-selected:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.none}"
    padding: "22px"
---

# Design System: Encore

## Overview

**Creative North Star: "The Night Departures Board"**

Encore is the board of a station that only serves your artists. Every concert is a departure: a mono date block, a condensed uppercase destination, a city and venue line with the reason it is on your board, a fare, and a status flap. The screen is read the way a traveller reads a board at night: one glance down a column of rows, amber where the eye should land, everything else porcelain and grey on near-black.

Density is moderate and tabular. Content is organised as rows separated by hairlines, not as a grid of cards. The boarding pass (concert detail), the itinerary (trips) and the coupon wallet (saved shows) are the same board material bent into travel documents: dashed tear lines, labelled fields, a heavy amber top edge. Corners are square everywhere. Depth comes from tonal slats and hairlines; shadows exist only under things that float.

The marketing site (src/components/marketing) is one brand with this app: it carries the same token values on its own CSS-module scope. Values here and there should move together; this file documents the signed-in app and onboarding only.

**Key Characteristics:**
- Near-black board with alternating slats and 1px hairline row rules.
- One warm accent (amber) for times, prices, the primary action, the selected state and the live signal.
- Three voices of type: condensed uppercase for names, tabular mono for every figure and status, Manrope for prose.
- Square corners, no exceptions.
- Status as split-flap tiles in green / amber / red / grey.

## Colors

A cold, nearly monochrome night palette with a single warm lamp (amber) and two signal lights reserved for status.

### Primary
- **Departure Amber** (amber): the day number on every row, prices on detail and itinerary, the primary button, the active nav item, the selected filter tab and chip, the saved toggle, the blinking live square, focus outlines and text selection. On amber, text is always **Amber Ink** (amber-ink), never white.
- **Amber Wash** (amber-soft) and **Amber Rule** (amber-line): the tinted ground and border for lit-but-not-primary states: the next departure row, the sample-mode banner, the active intent button, the warm fit pill, the current tour row.

### Secondary
- **Platform Green** (platform-green, with platform-green-soft): positive status only: ON SALE flaps, the confirmed-reason ticks on detail, the live status dot.

### Tertiary
- **Signal Red** (signal-red, with signal-red-soft): cancelled or postponed flaps, destructive buttons, form errors.

### Neutral
- **Board Black** (board-black): the page and odd board rows. Also the browser theme colour.
- **Slat** (slat): even board rows, the sidebar, and input fields.
- **Panel** (panel) and **Panel Raised** (panel-raised): side panes, modals, the boarding pass, empty states; Panel Raised is the row and button hover ground.
- **Hairline** (hairline) and **Hairline Strong** (hairline-strong): row rules and section dividers; Hairline Strong frames controls (inputs, secondary buttons, flaps, tabs) and the board's top and header rules.
- **Porcelain** (porcelain): primary text, artist names, headings.
- **Dim** (dim): paragraphs, secondary meta, inactive nav and tabs.
- **Faint** (faint): column headers, captions, placeholders, icons beside meta.

### Named Rules
**The One Lamp Rule.** Amber is the only warm colour on the board. It marks what to read first (the date, the price) or what to press; it never decorates.

**The Signals Are Status Rule.** Green and red appear only to report state (on sale, saved, confirmed; cancelled, postponed, error). Never use them as brand or decoration.

**The Amber Ink Rule.** Anything filled amber carries amber-ink text. White on amber is not used.

## Typography

**Display Font:** Barlow Condensed 800 (with Arial Narrow, sans-serif)
**Body Font:** Manrope 400-800 (with system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono 400/600 (with ui-monospace, monospace)

**Character:** Barlow Condensed is the painted destination on the board, loud, narrow and uppercase. JetBrains Mono is the flap and the timetable, every figure tabular so columns align. Manrope carries the human sentences between them. All three are self-hosted through @fontsource.

### Hierarchy
- **Display** (Barlow Condensed 800, 3.25rem, line-height 0.95, uppercase, balanced wrap): screen titles ("YOUR NEXT GREAT NIGHT."). The boarding-pass artist name scales to clamp(3rem, 6vw, 5.5rem). Drops to 2.5rem under 820px.
- **Headline** (Barlow Condensed 800, 2rem, 0.95, uppercase): artist names on board rows; the next-departure row raises it to 2.75rem.
- **Title** (Barlow Condensed 800, 1.5rem, 1, uppercase): section headings, modal headings, side-pane headings (1.375rem), itinerary step names, tour-row cities (1.25rem).
- **Body** (Manrope 400, 0.9375rem, 1.55): prose in Dim; intros capped at 65ch, fine print at 75ch. Body-small (0.8125rem) for venue lines and notes.
- **Label** (Manrope 800, 0.8125rem, 0.04-0.06em, uppercase): buttons, nav items, filter tabs, back links, footer.
- **Data** (JetBrains Mono 600, 0.75rem, 0.08em, uppercase, tabular): status flaps, weekday/month/time, location button, chips, context strips. Data-figure (2.25rem, 600, tabular) for the day number on rows and the ticket price; 3rem on the next-departure row.
- **Data caption** (JetBrains Mono 400, 0.6875rem, 0.12em, uppercase, Faint): board column headers, boarding-pass field labels, tour-table headers.

### Named Rules
**The Mono Figures Rule.** Every date, time, price, distance, count and status is set in JetBrains Mono with tabular numerals. Figures never appear in Manrope or Barlow on the board.

**The Condensed Names Rule.** Barlow Condensed is for names of things (artists, cities, screens, sections), always uppercase at weight 800. It is never used for sentences.

## Layout

Desktop is a fixed left rail (rail token: 236px; 208px under 1180px) on Slat, and a workspace with a sticky 64px top bar (Board Black at 92% with a 10px backdrop blur) carrying the station line ("DEPARTURES FROM PARIS"), feedback, home-city button and alerts. Main content is capped at 1320px with gutter padding (40px; 28px under 1180px; 16px under 820px).

The feed is a two-column grid: the board (fluid) and a 300px sticky side pane (260px under 1180px), 32px apart. Board rows are a four-column grid, 96px date block, fluid artist/destination, 190px fare and status, 46px save toggle, with 20px column gaps and 16px x 18px padding. Concert detail pairs the boarding pass with a 340px sticky ticket panel; under 960px everything stacks to one column and the ticket panel moves directly under the pass. Under 820px the rail becomes a bottom tab bar and a compact top bar with the wordmark.

Spacing follows a loose 4px-based rhythm, with 8, 12, 16, 20 and 28px doing most of the work; sections separate with hairlines rather than large voids.

## Elevation & Depth

The board is flat. Depth is tonal: Board Black, Slat, Panel and Panel Raised step up in lightness, and hairlines separate everything at rest. Shadows are reserved for layers that float above the board.

### Shadow Vocabulary
- **Toast lift** (`box-shadow: 0 18px 40px #00000080`): the amber confirmation toast.
- **Modal lift** (`box-shadow: 0 30px 80px #000000b3`): dialogs, over a #05060acc backdrop with 4px blur.
- **Flap seam** (`box-shadow: inset 0 -1px 0 #ffffff0a` plus a 1px horizontal mid-line gradient): the split-flap fold on status tiles; a material detail, not elevation.
- **Field focus** (`box-shadow: 0 0 0 1px var(--accent)`): doubles the amber border on focused inputs.

### Named Rules
**The Flat Board Rule.** Rows, panels and passes sit flat on the board. Only toasts and modals cast a shadow.

## Shapes

Square corners throughout (rounded.none, 0px): buttons, inputs, flaps, chips, avatars, the notification dot, status dots, the profile monogram. Borders are 1px hairlines; emphasis comes from a heavier amber top edge (2px on the next-departure row, 3px on modals, 4px on the boarding pass), never from a radius or a fill change alone. Dashed Hairline Strong lines are tear lines: the boarding-pass field stub, the saved-ticket date coupon, empty states. The itinerary spine is a 2px dotted line between square step icons.

**The Square Corner Rule.** Nothing on the board is rounded. If a new element needs softness, it gets a quieter colour, not a radius.

## Components

### Buttons
Blunt, uppercase, heavy.
- **Shape:** square (0px), 46px tall, 11px x 20px padding; small 38px, compact 40px.
- **Primary:** Departure Amber fill, Amber Ink label in Manrope 800 uppercase 0.04em. Hover lightens to #f6c88b. Active nudges 1px down.
- **Secondary:** transparent with a Hairline Strong border, Porcelain label; hover takes Panel Raised ground and an Amber Rule border.
- **Intent active:** Amber Wash ground, Amber Rule border, amber label (e.g. "I need to see this artist" engaged).
- **Destructive:** Signal Red fill with a near-black red ink.
- **Text button:** label weight, underlines and turns amber on hover.
- **Focus:** 2px amber outline, 3px offset, on every interactive element.
- **Disabled:** 45% opacity.

### Status Flaps (signature)
Split-flap tiles: JetBrains Mono 600, 0.75rem, 0.08em uppercase, 4px x 9px on a #07080b face with a Hairline Strong border and a 1px mid-fold line. Tone by state: ON SALE green, NEXT / SOON / NEW amber, CANCELLED / POSTPONED red, NO PRICE / CHECK SELLER dim. On arrival each flap turns once (rotateX from -70deg, 420ms, staggered 40ms per row to 160ms); alert-row flaps do not animate.

### Departure Board Rows (signature)
- **Row:** date block / artist and destination / fare and flaps / save toggle on the four-column grid; odd rows Board Black, even rows Slat; hover Panel Raised; 1px Hairline rule below.
- **Date block:** weekday, then the amber tabular day number beside month and 20:00 time in Dim mono.
- **Destination:** artist in Headline, then a Body-small line with the city in Porcelain bold, a 4px square separator, venue in Dim; then a "via" line in Data caption with an amber spark icon naming why it is here (ARTIST YOU FOLLOW, DISCOVER).
- **Next departure:** the first row is lit: Amber Wash ground, 2px amber top edge, larger day and name, and the primary "Explore this show" action in a second grid row.
- **Alert rows:** compact rows above the board on Panel with a smaller day and a NEW flap.
- **Board header:** Data caption column labels between Hairline Strong rules.

### Save Toggle
46px square, Hairline Strong border, Dim bookmark icon; saved state fills amber with Amber Ink icon.

### Chips and Filter Tabs
- **Filter tabs:** a joined strip inside one Hairline Strong frame, separated by the same rule; Manrope 800 0.75rem uppercase in Dim; selected tab fills amber.
- **City chips:** separate square chips in mono 0.75rem uppercase; selected fills amber.
- **Fit pill:** mono label in a hairline frame; warm variant on Amber Wash.

### Cards / Containers
- **Corner Style:** square.
- **Background:** Panel for the side pane, ticket panel, modals, empty states, quiet banner; Panel Raised for hover.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Hairline or Hairline Strong; empty states use a dashed Hairline Strong border.
- **Internal Padding:** 20-26px.

### Inputs / Fields
- **Style:** Slat ground, 1px Hairline Strong border, square, 46px tall, 11px x 13px; placeholders in Faint; labels Manrope 700 0.8125rem above the field.
- **Hover:** border goes Faint.
- **Focus:** border and a 1px ring in amber, no outline.
- **Error:** Signal Red Soft ground with a translucent red border.
- **Select / date filter:** mono uppercase value with a leading icon.

### Navigation
- **Rail:** wordmark (Barlow 800 30px uppercase with the amber AudioLines mark and amber full stop), then nav items stacked between hairlines: Manrope 800 uppercase 0.06em in Dim, 48px tall; hover Panel ground with Porcelain; active fills amber with Amber Ink. Counts sit in small mono boxes; unread alerts show an 8px amber square that blinks in two steps.
- **Mobile:** bottom tab bar of icon-over-label items; active item fills amber.

### Boarding Pass (concert detail)
The detail header is a pass: Panel ground, Hairline Strong frame, 4px amber top edge. Left half carries the artist in Display at up to 5.5rem and the venue line; right half is a two-by-two field grid (WHERE, WHY, DATE, SHOW) torn off by a dashed rule, with Data caption labels over mono 600 uppercase values. The ticket panel beside it shows the price as an amber Data-figure.

### Coupon Wallet (saved shows)
Saved shows reuse board rows framed individually on Panel, with the date block torn off as a coupon by a dashed vertical rule.

### Itinerary (trips)
Option strip of joined panels (selected fills amber), then the trip as a timeline: square bordered step icons on a dotted spine, Title-sized step names, amber mono prices at the right edge, and an amber estimated total. When the total is incomplete, the option strip shows the stay price explicitly. Transport searches sit within the travel step as wrapping secondary controls; hotel searches use underlined external links with dates prefilled. External searches are distinct from provider quotes and appear only for active real concerts.

### Toast
Amber fill, Amber Ink text, square, Toast lift shadow, rises 12px into place over 260ms.

## Do's and Don'ts

### Do:
- **Do** build new lists as board rows on the four-column grid with alternating Board Black / Slat slats and 1px hairline rules.
- **Do** set every date, time, price, distance, count and status in JetBrains Mono with tabular numerals.
- **Do** report state with status flaps in the four tones (green go, amber wait, red stop, dim quiet).
- **Do** keep amber for what to read first or press: the day number, prices, the primary action, the selected state, the live square.
- **Do** mark emphasis with an amber top edge (2px / 3px / 4px) and tear-line dashes, not with radius or shadow.
- **Do** ease state changes with cubic-bezier(0.16, 1, 0.3, 1) at 160ms and honour reduced motion.
- **Do** keep sample and unknown data visibly labelled in the board's own voice (mono captions, NO PRICE flaps, the amber sample banner).

### Don't:
- **Don't** round any corner.
- **Don't** turn the feed into a grid of poster-thumbnail cards or a dashboard of KPI tiles; it is a board of rows.
- **Don't** use green or red outside of status.
- **Don't** put white text on amber; use amber ink.
- **Don't** cast shadows from rows, panels or the boarding pass; only toasts and modals float.
- **Don't** set sentences in Barlow Condensed or figures in Manrope.
