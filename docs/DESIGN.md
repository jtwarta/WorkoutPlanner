# LiftScript Design System: Growth Rings

**Status:** approved October 11, 2026 (direction A of three). Rulebook for the
visual revamp. Implement against this document only. If a screen needs
something this file doesn't cover, add the rule here first, then build it.

**Scope:** presentation only. Scoring, prescription, recommendation, and data
logic do not change. Every computed value on screen must match the parity
baseline (git tag `pre-revamp-v1.42`). See §11.

---

## 0. The idea

Your training history is a tree cross-section. Each week lays down one ring,
and the ring's width is the working sets you did that week. The rings are the
only ornament in the app, and they are real data.

Three rules override everything below:

1. **Rings mean weeks.** No ring, circle, or concentric shape is used for
   anything else: not percentiles, not recency, not anchors, not loading
   decoration.
2. **One surface level.** Content sits on the page. Grouping comes from
   spacing, type, and hairlines, never from cards inside cards.
3. **Old numbers say how old they are.** Any value from a source that is
   stale shows its age once, at the group level (§9).

## 1. Brief

- **User:** Jon, one person, on an iPhone (393 pt wide). Two contexts: at
  home planning (calm, reading) and between sets at the gym (arm's length,
  glancing, sweaty thumb).
- **Primary jobs:** Today = what to lift, how heavy. Muscles = what's due.
  History = what I did. Body = am I getting stronger and healthier.
- **Tone:** quiet, warm, exact. Confidence comes from restraint: the boot
  sequence is the one loud moment.

## 2. Color

| Token | Hex | Role | Contrast on Char / Bark |
|---|---|---|---|
| `char` | `#17120F` | Page background | n/a |
| `bark` | `#2A211C` | The only raised surface: sheets, tooltips, empty heatmap cells, bar tracks | n/a |
| `line` | `#3A2E26` | Hairlines, bar tracks on Bark | decorative |
| `sapwood` | `#EAD7BC` | Primary text and all numbers | 13.23 / 11.21 |
| `ash` | `#9A8E83` | Secondary text, captions, inactive tabs | 5.82 / 4.93 |
| `heartwood` | `#A4442B` | Graphics only, on Char only: active-tab rule, anchor rule, focus ring | 3.04 (non-text) |
| `lichen` | `#A9BD8B` | Good / on track / done | 9.15 / 7.76 |
| `resin` | `#E0A440` | Attention: due, deload, stale, the chart's secondary line | 8.46 / 7.17 |
| `ember` | `#E5735A` | Errors only | 6.13 / 5.20 |

Ring tones (graphics inside the cross-section only): `ringHeart #8E3B26`
(weeks 9+ ago), `ringSap #D2A37A` (5 to 8 weeks ago), `ringNew #E3C29A` (last
4 weeks).

Rules:
- Heartwood is never text and never sits on Bark (2.58, fails 3:1).
- The one filled button (Send to Hevy) is Sapwood fill with Char text (13.23).
- Translucent variants are rgba of a palette color only, e.g. heatmap ramp
  `rgba(234,215,188, .32 / .52 / .74 / 1)`.
- Status always pairs color with a word ("Due now", "Deload", "Low"). Color
  is never the only signal.

### C object (single source of truth for JS-rendered styles)

New canonical keys: `char, bark, line, sapwood, ash, heartwood, lichen, resin,
ember, ringHeart, ringSap, ringNew`. The CSS `:root` mirrors them for static
markup. innerHTML keeps inline hex from `C` (CSS `var()` fails on the iOS PWA).

Transitional remap, applied in the foundation commit so untouched components
inherit the palette immediately. Old keys are deleted once every tab is
rebuilt:

| Old key(s) | New value |
|---|---|
| `bg` | char |
| `surface`, `surface2`, `surface3` | bark |
| `border` | line |
| `text` | sapwood |
| `textMid`, `textDim`, `textDark`, `textDark2` | ash |
| `accent`, `accentMid`, `teal` | lichen (dims: `rgba(169,189,139,.14/.28)`) |
| `warn`, `amber`, `amberLt`, `cardio`, `gold`, `strength`, `purple`, `purpleLt`, `fuchsia`, `pink` | resin |
| `danger`, `dangerText` | ember (dim: `rgba(229,115,90,.12)`) |
| `blue`, `cyan` | ash |

`MUSCLE_GROUPS[*].color` stays in the data but is no longer read by any UI.

## 3. Type

Two families, clearly distinct:
- **Newsreader** (Google Fonts, variable optical size). All numbers, section
  titles, the wordmark (italic). Digits are tabular by default (verified), so
  count-ups never jitter.
  `https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,500&display=swap`
- **SF Pro** (system stack `-apple-system, 'SF Pro Text', system-ui,
  sans-serif`). All words. Numbers set in SF Pro use
  `font-variant-numeric: tabular-nums`.

JetBrains Mono is removed entirely.

| Role | Family | Size / line | Weight | Used for |
|---|---|---|---|---|
| hero | Newsreader | 48 / 1.0 | 500 | SI value, current weight, boot score (50) |
| title | Newsreader | 24 / 1.2 | 500 | Section titles ("Today's session") |
| figure | Newsreader | 24 / 1.1 | 500 | Prescriptions, stat numbers, vitals |
| body | SF Pro | 17 / 1.35 | 400, 500 for names | Exercise and muscle names, prose |
| secondary | SF Pro | 15 / 1.35 | 400 | Tabs, toggles, row labels |
| caption | SF Pro | 13 / 1.3 | 400 | Units, metadata, freshness, explainers |
| micro | SF Pro | 11 / 1.3 | 400 | Chart axes, heatmap labels only |

Rules: sentence case everywhere. No letter-spacing except hero numbers
(-0.5 px). No more than three sizes inside one component. Units sit after
numbers in caption size, Ash ("145 lb").

## 4. Space, shape, layout

- 4 pt grid. Steps: 4, 8, 12, 16, 22, 32, 48.
- Page gutter 22. Content width 349 at 393.
- Rows: min height 56 (exercise, muscle), 44 (settings, vitals). Every tap
  target is at least 44 x 44.
- Radii: 6 (buttons, toggles, tooltip, heatmap cells 3), 12 (sheets), 999
  (bar ends).
- No shadows, no gradients except the weight-chart fill, no textures.
- Hairline: 1 px Line between rows only where spacing alone is ambiguous.
- Left-aligned text. Numbers right-aligned in rows.

## 5. Motion

### Tokens

| Token | Value | Used for |
|---|---|---|
| `fast` | 160 ms | Press feedback, chevrons, toggles, exits, repeat-visit entrances, tooltips |
| `base` | 320 ms | First-visit entrances, expanders, sheets, single ring growth, period change |
| `slow` | 640 ms | Data reveals: count-ups, bar growth, chart reveal, cross-section travel |

| Easing | Curve | Used for |
|---|---|---|
| `grow` | `cubic-bezier(0.22, 1, 0.36, 1)` | Anything arriving or revealing |
| `settle` | `cubic-bezier(0.4, 0, 0.2, 1)` | State changes in place, FLIP moves |
| `exit` | `cubic-bezier(0.4, 0, 1, 1)` | Anything leaving (always `fast`) |

**Stagger rule (the only one):** item *i* of *n* starts at
`i x min(40 ms, 320 ms / n)`. Total offset never exceeds 320 ms.

### Rules

- Properties: `transform` and `opacity` only. No animating width, height,
  max-height, top/left, margin, padding, shadow, filter, or stroke-dashoffset.
- Bars grow with `scaleX` from the left edge. Rings grow with `scale` from the
  pith. The canvas chart reveals by translating a Char cover panel off it.
- Expanders use FLIP: height changes instantly, revealed content fades and
  rises 8 px (`base`, `grow`), and the rows below slide from their old
  position (`base`, `settle`).
- **All motion goes through one Web Animations API helper**
  (`motion(el, keyframes, duration, easing, delay)`). Count-ups are driven by a
  no-op animation and read its progress each frame. This lets the review
  harness pause every animation and seek to an exact time for frame strips.
- First visit to a tab per app session gets the full entrance. Repeat visits
  get a `fast` fade only: no stagger, no count-ups.
- `prefers-reduced-motion`: every duration is 0, numbers show final values,
  and rings render complete.
- Nothing loops. One exception: while waiting for data, the loader's pith
  breathes (opacity 0.6 to 1, 1600 ms alternate, `settle`) and stops the
  moment data arrives.
- No bounce, no overshoot, no spring.

## 6. Haptics

| Cue | Call | When |
|---|---|---|
| tick | `haptic(6)` | Tab change, toggles, reroll, opening the Power Score sheet, the boot score landing |
| double | `haptic(6)` twice, 90 ms apart | Send to Hevy succeeded |

Nothing else vibrates: no haptics on scroll, on automatic reveals other than
the boot landing, or on errors (errors are Ember text with a fix).

## 7. Storyboards

Times in ms. Boot t = 0 is the moment data is ready (cache or network).

### Boot (cold start only; not on resume or refresh)

| t | Shot | Duration, easing | Haptic |
|---|---|---|---|
| before 0 | Loader: 12 px Heartwood pith centered, wordmark "LiftScript" (Newsreader italic 22) below, status caption below that. Pith breathes. | loop until data | |
| 0 | Wordmark and status fade out | 160 exit | |
| 0 | 26 rings grow outward from the pith, oldest first. Ring *i*: scale from inner/outer radius to 1, opacity 0 to 1, delay *i* x 12 | 320 grow each | |
| 0 | Power Score counts 0 to final inside the pith (Newsreader 50) | 640 grow | tick at 640 |
| 640 | Cross-section travels to its header slot (translate + scale, 292 to 40 px) | 640 grow | |
| 800 | Header (wordmark, version line) and tab bar fade in, rise 6 px | 320 settle | |
| 960 | Today content enters: title, settings row, group labels, rows. Opacity 0 to 1, rise 12 px, stagger rule | 320 grow each | |
| ~1600 | Done | | |

Any touch during boot jumps straight to the end state.

### Today (first visit after another tab)

| t | Shot | Duration, easing |
|---|---|---|
| 0 | Title and settings row fade in | 320 grow |
| 0 | Group labels and rows rise 12 px, stagger rule | 320 grow |

No count-ups on Today. Prescriptions are read, not celebrated.

### Muscles

| t | Shot | Duration, easing |
|---|---|---|
| 0 | Group headers and muscle rows rise 12 px, stagger rule | 320 grow |
| 160 | Volume bars grow (`scaleX`), same stagger | 640 grow |

### History

| t | Shot | Duration, easing |
|---|---|---|
| 0 | Stat trio fades in; numbers count up | 320 grow; 640 grow |
| 160 | Cardio bar grows | 640 grow |
| 240 | Heatmap columns appear left to right (14 columns, stagger rule gives ~23 ms each), today's column last | 320 grow each |

### Body

| t | Shot | Duration, easing |
|---|---|---|
| 0 | SI value counts up; tier marker slides along the scale to its position | 640 grow |
| 160 | Lift percentile bars grow, stagger rule | 640 grow |
| on scroll-in | Chart cover panel translates off to the right (IntersectionObserver, once) | 640 grow |
| on scroll-in | Vitals and measurement rows fade in, stagger rule (first visit only) | 320 grow |

### Interactions

| Interaction | Choreography | Haptic |
|---|---|---|
| Tab switch | Outgoing content fades (160 exit), incoming per its storyboard | tick |
| Why this? / muscle detail | Chevron rotates 180 (160 settle); explainer FLIP-expands inline under its row | |
| Power Score sheet (tap header cross-section) | Bark sheet drops in under the header (rise from -16, 320 grow); its 220 px cross-section regrows rings (stagger rule); pillar numbers count up (640) | tick |
| Reroll | Rows exit left 8 px (160 exit), new rows enter (stagger, 320 grow) | tick |
| Send to Hevy | Label becomes "Sending" (no spinner); success: label becomes "Sent to Hevy" in Lichen; failure: Ember message under the button with what to do | double on success |
| Chart period | Cover wipe replays at 320 | tick |
| Chart tooltip | Fades and rises 4 px (160 grow); auto-hides after 3 s (320 exit) | |

## 8. Components

**Header.** Wordmark "LiftScript" Newsreader italic 20, Sapwood. Under it,
the version line (`#last-updated`, caption, Ash): "v1.4x, 8:36 AM" plus a 6 px
health dot (Lichen ok, Resin stale, Ember missing). Right side: refresh icon
(44 px target, Ash) and the 40 px cross-section with the Power Score inside
(Newsreader 15). The cross-section is the Power Score button.

**Tab bar.** Four text tabs, SF 15. Inactive Ash; active Sapwood with a 2 px
Heartwood rule under it. 44 px tall. No container, no pill.

**Cross-section.** Input: working sets per local week for the last 26 weeks
(via `getWorkingSets`, display-only, no effect on any score; this week matched
History's weekly set count in Phase 0). Geometry: pith radius = 0.32 x outer (0.55 below 120 px so the score fits);
ring widths proportional to `1 + 2.2 x sets / max`, normalized to fill the
band; a zero-set week is a 1.4 px Char line (a missing ring). Edge wobble,
deterministic: `r x (1 + 0.012 sin(3a + 0.7i) + 0.007 sin(5a + 1.3i))`.
Fill by age with the ring tones, opacity `0.55 + 0.45 x sets / max`, 0.6 px
Char separators. Sizes: 292 (boot), 220 (Power Score sheet), 40 (header).
Below 120 px it collapses to three bands (heart, sap, new) and drops
separators.

**Section title.** Newsreader 24 left ("Today's session" / "Tomorrow's
session"), caption right ("About 50 min"). Custom sessions add "Custom" in
caption, Ash.

**Settings row.** The 60m / Gym / Auto cycles become three quiet text toggles
(SF 15, Ash, 44 px tall, no background, underlined in Line; Sapwood when
changed from the default). Reroll is a quiet icon + word button on the
right; a custom session adds "Back to auto". These never look like the
primary action.

**Send to Hevy.** The only filled button in the app: Sapwood fill, Char text,
SF 17 / 500, radius 6, full content width, placed after the last exercise and
before cardio.

**Group label.** SF 13, Ash ("Back", "Quads"). Not colored by muscle.

**Exercise row.** Left: name (SF 17 / 500, Sapwood) and equipment (caption,
Ash). Right: prescription (Newsreader 24) + unit (caption), sets x reps
(caption). Anchor lifts get a 2 px Heartwood rule on the row's left edge
(not a ring). Deload: prescription in Resin plus the word "Deload" in caption,
Resin. Rows are separated by space, hairline only between groups.

**Explainer (Why this? / muscle detail).** Caption-size prose in Ash with
numbers in Sapwood, inline under its row, Bark background, radius 12, 16
padding.

**Cardio plan.** Title "Cardio this week" with "37 of 150 min" (Newsreader
figure + caption). Bar: 4 px, Line track, Sapwood fill, `scaleX`. Protocol
rows: name SF 17, "Zone 2" caption Ash, minutes Newsreader figure, heart-rate
range as caption text ("132 to 145 bpm"). No pills.

**Muscles list.** Replaces the 12-card grid. Grouped by the existing urgency
tiers: "Due now" (high), "Coming due" (med), "On track" (others), "Rested"
(trained within 24 h). Section title "What's due" (caption "By priority"). Row: name SF 17;
days since as Newsreader figure + "days since" caption ("no data" when
unknown); under the name a 4 px volume bar (Line track, Sapwood fill,
capped at target) and caption "0.9 of 10 weekly sets". Tap expands the detail
explainer inline. "Build a custom session" is a quiet button at the top;
select mode shows a 20 px rounded-square check (radius 4) per row.

**Stat trio (History).** Three columns: Newsreader 28 number, caption label,
caption comparison in words ("2 fewer than last week"), Resin only when
behind.

**Heatmap.** 14 columns x 13 rows. Label column 64 px (full names, micro,
Ash). Cells 17 px, gap 3, radius 3. Empty = Bark. Filled = Sapwood ramp at
.32 / .52 / .74 / 1. Cardio row uses the same ramp (15+ min lights a cell). Today's column gets a 1 px
Sapwood outline. Legend in words: "Fewer sets" to "More sets". Cardio minutes bucket at
15 / 25 / 35 / 45. Title "Two weeks"; "This week" captions "Last 7 days".

**SI block.** Hero number (Newsreader 48) with the tier word beside it (SF
15, Ash: "Intermediate"). Tier scale: a hairline from 0 to 2.5 with ticks at
0.9 / 1.3 / 1.8, tier names in micro under the segments, Sapwood marker at
the value. Lift rows: name SF 17, est. 1RM Newsreader figure + "lb", 4 px
percentile bar with a p50 tick, "PR" in Lichen when at PR, else "PR 211" in
caption. 30-day change as words ("down 1 lb in 30 days").

**PR board.** Rows: lift, PR figure, date caption, 1.5 px Sapwood sparkline.
No dividers between rows.

**Weight & Trends chart.** Hero weight (Newsreader 48) with a freshness
caption. Canvas: weight line Sapwood 2 px, fill `rgba(234,215,188,.10)` to
transparent; the single secondary line is always Resin 2 px solid, and the
legend names which metric it is. SI tier rules: 1 px dashed Line with
"Advanced" / "Elite" in micro. Axis labels micro, Ash (`ctx.font` uses the
SF stack, never a CSS var). Period selector: text toggles "1M 3M 6M 1Y All".
Legend: text toggles with an 8 px swatch.

**Vitals.** Rows, not tiles: label (SF 15), value (Newsreader figure + unit),
rating as a word (Elite / Great / Good in Lichen, Fair in Ash, Low in Resin),
60 x 18 sparkline. Group header carries the freshness caption.

**Measurements.** One list: name, "10.8 of 12.4 in", percent (Newsreader
figure), 4 px bar. Waist (inverted) reads "35.0 in, target under 32.4" and
turns Resin when over. Shoulder and hip are display rows without bars. The
duplicate Body Composition tile grid is removed; tapping a row shows its
sparkline. Import and Export are quiet text buttons.

**Tooltip.** Bark, radius 6, padding 6 x 10. Values in Newsreader 15, labels
and date in caption.

**Loading and errors.** See boot. Errors: Ember caption stating what failed
and what to do ("Hevy is rate-limiting. Wait a minute, then refresh.").

## 9. Freshness

| Source | Stale when | Shown as (once, at group level) |
|---|---|---|
| Apple Health vitals | over 48 h (`HEALTH_STALE_HOURS`) | "Apple Health, updated 3 days ago" in Resin |
| Weight | latest weigh-in not today | "Weighed Feb 16" in Ash; Resin after 7 days |
| Measurements | over 30 days | "Measured Mar 29, 6 months ago" in Resin |

Values themselves stay Sapwood. Age is stated once, never per tile.

## 10. Bans

1. Monospace anywhere.
2. `text-transform: uppercase`, tracked labels, and all-caps abbreviations
   ("SHLDR", "ADV", "ELT", "ALL"). Use words.
3. Textures, noise, glows, shadows, decorative gradients (the canopy light
   goes).
4. Branch dividers and every decorative SVG ornament.
5. Cards inside cards. One surface level.
6. Per-muscle colors, and any hue outside §2.
7. Rings for anything but weeks: the SI Big-5 rings, muscle recency rings,
   anchor ring glyphs, and the decorative loader rings all go.
8. Badge shapes as status (hexagon, diamond, circle). Status is a word.
9. Color as the only signal.
10. Idle loops (loader pith excepted while waiting).
11. Animating anything but transform and opacity.
12. Bounce, overshoot, spring.
13. More than one filled button on a screen.
14. A stale number without its age.
15. Middle-dot meta strings ("Apr 25 · +5 lbs"). Use a comma or a second
    line.
16. CSS `var()` inside innerHTML; raw non-ASCII bytes in index.html (use
    `\uXXXX`).

## 11. Build plan and acceptance

One commit per step, each a version:

| Version | Step |
|---|---|
| v1.43 | Foundation: tokens (C + `:root`, transitional remap), Newsreader, motion helper, haptic cues, global bans (texture, dividers, canopy light, mono, uppercase), header, tab bar, loader, boot sequence |
| v1.44 | Today |
| v1.45 | Muscles |
| v1.46 | History |
| v1.47 | Body (and delete the old C keys) |

Each step, before push:
1. `node --check` on every script block, zero non-ASCII bytes, version in all
   3 places.
2. Render with `tools/render.py` against freshly recorded fixtures: full-tab
   screenshots, key states, and a frame strip of the step's entrance (pause
   all animations, seek in 100 ms steps).
3. Review the sheet and strip against this file; list failures; fix;
   re-render.
4. **Numeric parity:** render the baseline tag `pre-revamp-v1.42` and the new
   commit with the same fixtures and frozen clock; the set of numbers on
   each tab must match. Numbers intentionally added (freshness dates, "37 of
   150") are listed in the commit message.
5. Push, then confirm Pages serves the new version.

Done: before/after contact sheets for all four tabs, parity confirmed, Master
doc §30 updated to the final system, pushed.

### Review tooling

`tools/render.py` records live Hevy and health responses once (`record`),
then replays them with the clock frozen at record time, Pacific time, iPhone
393 x 852 @2x (`render`). Any non-GET request to Hevy is aborted, so renders
can never touch the routine. Fixtures stay in the sandbox and are never
committed (the repo is public). `tools/compose.py` builds contact sheets.
Renders substitute Inter for SF Pro, so prose metrics differ slightly from
the device; Newsreader loads from Google Fonts identically in both.
