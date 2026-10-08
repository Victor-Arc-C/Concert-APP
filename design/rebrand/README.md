# Rebrand, step 1: directions

Standalone prototypes, kept apart from the app's routes. Nothing here is imported by `src/`.

- `index.html`: comparison page (French). Names, logos, live marketing and iPhone previews side by side, a data switch (demo, worst case, empty, error) for the three phones, the recommendation.
- Round 2 (current, `index.html`): `d-gigaway/`, `e-showbound/`, `f-pitstop/`. Round 1 (set aside by the founder, `round-1.html`): `a-roadie/`, `b-allez/`, `c-sortie/`. Each has `marketing.html` (desktop) and `feed.html` (iPhone, framed on desktop). Add `?data=worst|empty|error` to a feed to see the hard cases.
- `shared/`: sample data (fictional dates and prices; real public Spotify artist photos loaded from `i.scdn.co`, the host the app's CSP already allows), helpers (spring, initials, formatting), Lucide icons extracted from `lucide-react`.
- `captures/`: Chromium 1440×900 desktop shots and WebKit iPhone 15 shots (touch emulation), including worst case, empty, error, signature interactions and reduced motion. `comparison-sheet.png` (round 1) and `comparison-sheet-2.png` (round 2) put each round side by side.

Run it with the `rebrand-directions` entry in `.claude/launch.json`, or:

```bash
python3 -m http.server 4020 --bind 127.0.0.1 --directory design/rebrand
```

Prototype-only shortcuts, to undo when the chosen direction is built into the app: fonts come from Google Fonts (the app must self-host them under its CSP), copy is English only, nothing is wired to real data.
