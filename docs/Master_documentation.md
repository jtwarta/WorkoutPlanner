# LiftScript — Master Documentation

**Version: v2.1c** · **Reconstructed July 10, 2026 · updated to v2.1c November 22, 2026**

> **Provenance note:** the original `Master_documentation.md` (last at v1.34 +
> pending v1.35–v1.39 deltas) was deleted from the project before patching. This
> document is a reconstruction. Ground truth used: (1) the complete v1.11→v1.39
> changelog preserved verbatim in the `index.html` header, (2) a full read of the
> 7,636-line v1.39 codebase, (3) the v1.35–v1.39 delta file written against the
> original's section anchors, (4) facts verified against the live Hevy API and
> live health-data.json in July 2026. Section numbering for §5, §9, §10, §21,
> §23, §27, §28, §29 matches the original (anchored by the delta file); numbering
> of the sections between those anchors is reconstructed and may not match the
> original ordering. All technical content is grounded in the current code — no
> section content has been invented.
>
> **v1.40–v1.41 update (Oct 11, 2026):** patched in from the `index.html`
> changelog and verified against the 7,675-line v1.41 code. Touches §2, §3,
> §5, §22, §28 (#23–24), §29, Appendix.
>
> **v1.42 update (Oct 11, 2026):** chart time-domain fix. Touches §2, §23,
> §28 (#25), §29.
>
> **v2.1 update (Nov 20, 2026):** progression. §9 is rewritten; also touches
> §26 (exact loads on send), §29, Appendix.
>
> **v2.0 update (Nov 19, 2026):** right-sized planner, second phase of the v2
> plan. Changes what is prescribed. §13 and §14 are rewritten; also touches
> §9 (time), §10 (SI sources), §12 (targets), §24, §29, Appendix. Decisions
> behind it are recorded in `docs/LiftScript_v2_Review_and_Plan.md`.
>
> **v1.49 update (Nov 19, 2026):** reliability release, first phase of the v2
> plan (`docs/LiftScript_v2_Review_and_Plan.md`). Touches §2, §5, §6, §22,
> §24, §28 (#27-30), §29, Appendix. No engine or scoring change.
>
> **v1.43–v1.47 update (Oct 11, 2026):** visual revamp (Growth Rings). Touches
> §10, §23, §24, §29, §30, Appendix. Presentation only; logic unchanged.

---

## 1. Overview & Philosophy

LiftScript is a single-file iOS PWA that pulls workout data from the Hevy API
and Apple HealthKit, generates personalized strength + cardio recommendations,
tracks progress metrics, and pushes daily sessions back to Hevy as a routine.
One user (Jon), one file, no backend.

Scientific foundation (as documented in the code header):
- **Pillar 1 — Volume/hypertrophy targets:** Schoenfeld et al. (2017)
  dose-response; targets scaled to ~65% of Schoenfeld optimal for a
  recreational 3–4×/week lifter.
- **Pillar 2 — Strength standards:** OpenPowerlifting-derived, shifted so
  competition 25th percentile ≈ general gym-population 50th.
- **Pillar 3 — 1RM estimation:** Brzycki (1993) for ≤10 reps, Epley (1985)
  for >10.
- **Pillar 4 — Progressive overload:** NSCA guideline (+2–10% when target
  reps achieved), implemented as double progression (§9).
- **Pillar 5 — Cardio:** ACSM (2018) 150 min/week; Seiler (2010) polarized
  80/20; Tanaka (2001) HRmax = 208 − 0.7×age; Karvonen (1957) HRR zones;
  Stöggl & Sperlich (2014).
- **Pillar 6 — Anthropometric proportions:** McRobert (2005), Casey Butt
  (2010) wrist-based natural-max targets, Katch & McArdle (1983).
- Session-construction research: Simão et al. 2012 (order effects),
  Schoenfeld 2017/2019, coaching convergence (5/3/1, Starting Strength,
  Juggernaut, RP) on 2 heavy compounds/session at intermediate+ loads.

## 2. Architecture & Development Rules

- **Single file:** all HTML/CSS/JS in `index.html` (~7,290 lines at v2.0).
  Assets: `manifest.json`, `icon-180/192/512.png`, `health-data.json`
  (written by the iOS Shortcut, not by hand).
- **Pure ASCII in index.html.** Special characters use `\uXXXX` escapes.
  Every push is byte-scanned for raw UTF-8 multibyte sequences.
- **Inline hex styles for anything JS-rendered via innerHTML** — CSS
  `var(--token)` references silently fail on the live iOS PWA. The `C` color
  constant object (JS) mirrors the CSS custom properties and is the single
  source of truth for dynamic styles.
- **Version bumps land in all 3 locations:** HTML comment header changelog,
  static subtitle (`<div class="subtitle" id="last-updated">`), and the JS
  `last-updated` innerHTML overwrite in `renderDashboard`.
- **Validation before every push:** `node --check` on the extracted script
  blocks (`re.findall(r'<script>(.*?)</script>', content, re.DOTALL)`) plus
  the zero-non-ASCII byte scan.
- **Edits via Python patch scripts** with `assert content.count(old) == 1`
  anchors (str_replace silently fails on anchor mismatch in the sandbox).
- **Back up the deployed HTML before any major push.**
- Dev test harness `runDevTests()` exists behind `DEV_TEST_MODE = false`;
  boot-time `checkCSS()` sanity check guards against encoding regressions.

## 3. Deployment & Repo

- GitHub repo `jtwarta/WorkoutPlanner`, served via GitHub Pages at
  `https://jtwarta.github.io/WorkoutPlanner/`. Installed to iOS home screen
  as a PWA (manifest + apple-touch-icon, added v1.22).
- Claude clones from `github.com` (NOT `api.github.com` — proxy-blocked in
  the sandbox), sets `git config user.email/user.name` explicitly, commits
  per phase, and pushes at the end of every session. Jon never runs git.
- Push auth: HTTPS with a classic repo-scope token embedded in the clone
  URL, from a **Chat-mode** conversation in the LiftScript project (Jon's
  workflow for over a year; works from mobile with the desktop off). The
  token value is deliberately not written into this document (a copy is
  committed to the public repo); Claude retrieves it from past project chats
  or asks Jon at session start.
- **Cowork mode cannot push** (verified Oct 16, 2026): its git proxy only
  allows repos in the session's authorized set and rejects
  `jtwarta/WorkoutPlanner` even with a valid token in the URL; the GitHub
  API is gated the same way. Do analysis and patch prep in Cowork if
  convenient, but push from a Chat-mode conversation (or, as a fallback, a
  Code-tab session with the repo selected -- the Claude GitHub App is
  installed on all of Jon's repos).
- The iOS Shortcut commits `health-data.json` to the repo directly (the
  frequent "Update health data" commits).

## 4. Data Sources Overview

| Source | Transport | Contents |
|---|---|---|
| Hevy API | fetch, `api-key` header | Workouts (lifts + logged cardio), exercise templates, routines (write) |
| Apple Health | `health-data.json` via iOS Shortcut → repo → Pages | Vitals, quarterly vital history, Watch workouts, weight entries, waist, body fat, lean mass |
| Embedded baselines | Constants in index.html | `WEIGHT_DATA_BASELINE` (Strong CSV export), `MEASUREMENTS_BASELINE` |
| localStorage | `Storage` wrapper | Caches, prefs, measurement deltas (see §24 keys) |

Merge precedence for weight: stored (localStorage) > Apple Health entries >
embedded baseline, deduped by date (`getMergedWeightData`).
`PROFILE.bodyweightLbs` is overwritten from the latest merged entry at render.

## 5. Hevy API Integration

- Base: `https://api.hevyapp.com/v1/`, header `api-key: <key>` (key is a
  constant in the file; Jon is aware it is exposed in the public repo and is
  unconcerned — do not flag it).
- `GET /workouts?page=N&pageSize=10` — newest first; terminate on
  `page_count`. Fetch caps: `maxPages 16`, `HARD_CAP 155` workouts
  (~6 months at 6 days/week). 15 s fetch timeout (`fetchWithTimeout`).
  `/workouts` rejects `pageSize` > 10 with HTTP 400 (live-verified Aug 2026).
- **Rate limiting (v1.41):** every Hevy call (workouts, both template
  loops, routine search + save) routes through `fetchHevy()`, which wraps
  `fetchWithTimeout`. On HTTP 429 it waits `Retry-After` seconds when the
  header is numeric (capped at 30 s), else 2 s / 5 s / 10 s, retrying up to
  3x (4 calls max) with a "Hevy rate limit -- retrying in Ns" loading
  message. A terminal 429 in `fetchWorkouts` throws a readable "wait a
  minute, then refresh" error. Pre-v1.41 a cold refresh could burst ~16
  workout pages + ~47 template pages with no 429 handling (§28 #24).
- **GET /workouts set kind field is `type`, NOT `set_type`** (live-verified
  July 2026; values: `normal`, `warmup`, `failure`, `dropset`).
  `getWorkingSets` (v1.35) reads `s.type || s.set_type` and counts
  `normal` + `failure` as working sets. Pre-v1.35 it checked only
  `set_type` — vacuously true, all sets counted (latent bug, §28 #19).
- `GET /exercise_templates` — supports `pageSize=100`; ~473 templates total
  (live-verified). App fetches at `pageSize=100` (v1.41; was 10) with
  `maxPages 8` (~5 pages for the full library; was 50/30), early stop once
  all needed names are matched; result cached 7 days.
- `GET /routines`, `POST /routines`, `PUT /routines/{id}` — see §26.
  Quirk: `folder_id` is required by POST but rejected by PUT.
- **Incremental sync (v1.49):** `GET /workouts/events?page=N&pageSize=10&since=<ISO>`
  (live-verified Nov 2026) returns `{page, page_count, events}`; each event is
  `{type:'updated', workout}` (the full workout object, same shape as
  `/workouts`) or `{type:'deleted', id, deleted_at}`. `syncWorkoutEvents()`
  runs on every open with a warm cache: `since` = last sync time
  (`workoutSyncTs_v1`) minus 10 min; updates are merged by id, deletes
  removed, the list re-sorted newest first and capped at 155. It falls back
  to the full `fetchWorkouts()` when the cache is older than 21 days or the
  change list exceeds 6 pages. Full fetch still runs on cold start and on
  the manual refresh button. `CACHE_STALE_MS` / `isCacheStale` are no longer
  used by boot (§28 #27).
- Weight display quirk: Hevy shows lbs as `floor(kg × 2.20462, 2dp)` —
  truncation. The app therefore **ceils** kg to 3dp on send so the
  back-conversion lands on or above the target (e.g. 140 lbs → 63.504 kg,
  not 63.503).

## 6. Apple Health Pipeline (health-data.json)

Written by the iOS Shortcut on a schedule; fetched with cache-busting
`?t=Date.now()`, `cache: 'no-store'`. Considered stale after 48 h
(`HEALTH_STALE_HOURS`); status ok/stale/missing drives the header sync dot
and the Health Vitals card.

**Local copy (v1.49):** the last good parsed file is stored in
`healthCache_v1`. Boot paints from it immediately and re-renders only if the
network copy differs; a failed fetch falls back to it instead of "missing".
On a first run with no local copy, boot waits up to 1.5 s for the network.

**Sanitizer** (Shortcuts emits malformed JSON): strip literal newlines/CRs,
`}{ → },{`, remove thousands commas, strip `kcal` suffixes, `": ," → ": null,"`,
`": }" → ": null}"`.

**Top-level schema (live-verified July 2026):** `updated`,
`resting_heart_rate`, `rhr_12m/_6m/_3m`, `cardio_fitness` (VO2),
`vo2_12m/_6m/_3m`, `cardio_recovery`, `rec_12m/_6m/_3m`, `steps`,
`active_energy_kcal`, `walking_heart_rate_avg`, `body_fat_pct`,
`lean_body_mass_lbs`, `waist_circumference_in`, `weight_entries`
(`{date, lbs}`), `workouts` (`{type, start, duration_min, calories}` —
`calories` added mid-2026, piped into the cardio breakdown since v1.35).

Quarterly vital snapshots are linearly interpolated into daily values
(`buildVitalTimeline` / `interpolateVital`) for the Cardio Fitness timeline.

## 7. User Profile

`PROFILE` (silent, never displayed): DOB 1989-07-21, male, 166 lbs baseline
(overwritten by latest weigh-in), height 72 in, wrist 6.5625 in (Casey Butt
frame targets), computed `age` and `bodyweightKg` getters.

## 8. Preprocessing Pipeline

`preprocessWorkouts(workouts, bodyweightLbs, weightData)` — single
chronological pass producing: `exerciseHistory` (per exercise:
`lastWeightLbs`, `lastReps` [gating rep = min reps among top-weight sets,
v1.33], `lastDate`, `lastSets`, and parallel `weights[]`/`dates[]`/`reps[]`
arrays [reps added v1.39]), `templateIdMap` (from
`exercise_template_id` seen in workouts), `muscleStats` (30-day sets/volume/
recency per muscle, secondary muscles at 0.5 credit; `daysSincePrimary`
tracked separately from `daysSinceAny` so indirect stimulus doesn't reset
the clock), the SI timeline (§10; the unused `muscle1RMs` output was removed
in v1.49), the Cardio Fitness and Dedication timelines (§21), and the
heatmap maps (`heatmapDayMuscle`, `heatmapDayWorkouts`, `heatmapDayCardio`).

Apple Watch cardio is merged into `heatmapDayCardio` after the Hevy pass:
non-cardio Watch types excluded by regex (strength/yoga/pilates/etc.); walk
filter per §20; dedup against Hevy cardio within a 30-minute timestamp
window.

## 9. Exercise Prescription & Double Progression

`prescribeExercise(name)` (v2.1). With history (a logged load above zero):
- **Sets:** from the last session, clamped 2 to 6.
- **Rep band** (`personalRepBand`): median gating reps of the last 6 sessions
  inside 180 days, keeping the `EXERCISE_DB` band's width (bench: table 6-8,
  personal 2-4). Under 3 such sessions the table band applies. Gating reps =
  fewest reps among the heaviest sets (v1.33).
- **Steps** (`liftSteps`): the distinct loads logged for the lift. Step size =
  smallest gap between them (default 5, floor 2). Next load up = the next
  logged load if it is closer than one step, else last + step. If that jump
  is over 10% of the load, two reps past the band are required first.
- **Rule, in order:**
  1. Over 21 days since the lift: **repeat** the last load, target = last
     reps capped at the band top.
  2. Every set reached the required reps: **up** one step, target = band
     bottom.
  3. Otherwise **reps**: same load, last reps + 1.
- **Stall:** 4 or more sessions at the current load inside 90 days with no
  rep gained (`max(reps[-3:]) <= reps[-4]`), while in case 3. No automatic
  deload. The prescription holds, carries `stalled`, `stallRun`,
  `stallEveryDays` and, when a lighter load exists, `backoff` (a logged load
  within 20%, else about 10% off for lifts of 50 lb or more) at the band top.
  `liftCandidates` ranks a stalled lift first for its muscle. The Today
  detail offers "Use a back-off today" (`_sessionBackoffs`, cleared with the
  other session edits); chosen, it sends the note `back-off`.
- **Exact loads:** nothing is rounded to 5 lb when history exists (a 62 lb
  kettlebell stays 62). `holdKg` carries the logged kg when the load is held.
- Each prescription records `mode` (`up`, `reps`, `repeat`, `stalled`, `new`),
  `band`, `gapDays`, `lastW`; the Today detail turns `mode` into a sentence.
- `deload` is always false since v2.1 (field kept for old callers).
- Why: on a replay of 215 lift occurrences the v1.39 rules were met 25% of
  the time; +5 lb was a median 11% jump; 6 of 10 deloads were ignored. A
  step-back after long gaps was tried and dropped: after 42+ days away Jon
  matched or beat the last load 86% of the time.
- No history: `estimateWeightFromPeers` scales the DB benchmark by the
  average strength ratio in that muscle group (isolation ratio capped 1.5x,
  compound 2.0x); exercises absent from the DB start at 80% of the median
  same-type logged weight; rounded to 5 lb. Bodyweight/hold notes force 0.

Rest periods (`getRestSeconds`, evidence: Schoenfeld 2016, de Salles 2009,
Singer 2024): 180 s heavy barbell compounds; 120 s moderate compounds; 90 s
multi-joint machines / heavier isolation; 60 s pure isolation/small muscles.
Hardcoded per exercise in `EXERCISE_DB.rest` with a pattern-based fallback.

Time model (v2.0): `_fitSecPerSet` = median of (logged duration / working
sets) over lift-only sessions of 5 to 180 min in the last 90 days, fitted in
`applyPersonalModel`; an exercise takes sets x that (about 6.6 min per set in
Nov 2026). With fewer than 5 such sessions it falls back to the old formula
(`TIME_CONSTANTS`: 45 s/compound set, 35 s/isolation set, inter-set rest,
+90 s transition), which ran about 2.5x short of real sessions. The 30/45/60
minute caps are gone; sessions are sized in lifts (§14).

## 10. Strength Index (SI)

- Five lifts with weights and gym-population p50 BW-multipliers:
  bench 0.20/0.95, squat 0.25/1.20, deadlift 0.30/1.45, ohp 0.10/0.55,
  row 0.15/0.70 (`STRENGTH_INDEX_LIFTS`, regex-matched by exercise name).
  SI 1.0 = 50th-percentile gym-goer; weights re-normalize across whichever
  lifts have data. Bodyweight interpolated per date from merged weight data.
- **True 183-day rolling window (v1.38):** per-lift chronological event
  lists record the best estimated 1RM per lift per workout; each timeline
  datapoint takes the max over events in the trailing 183 days relative to
  THAT date. SI can decline as PRs age out. (Pre-v1.38: cumulative
  high-water mark gated at 183-days-before-*now* — monotone timeline, whole-
  timeline rewrites on boundary crossings; §28 #22.) The fetch cap means the
  earliest points have a partially-filled window.
- Tiers: Developing < 0.9 ≤ Intermediate < 1.3 ≤ Advanced < 1.8 ≤ Elite
  (track max 2.5). Rendered (v1.47) as a Newsreader hero with the tier word, a hairline
  tier scale (tap a tier for its range), per-lift rows with percentile,
  30-day change in words and a p50-ticked bar (tap for the source set), and
  the PR board (all-time PR per lift, Sapwood sparklines). The concentric
  Big-5 rings were removed (rings mean weeks).
- **Sources (v2.0):** exact barbell lifts only: Bench Press (Barbell), Squat
  (Barbell) / Back Squat, Deadlift (Barbell or Trap Bar), Overhead /
  Military / Shoulder Press (Barbell), Bent Over / Pendlay / Barbell Row.
  Before v2.0 the deadlift slot was fed by Romanian deadlifts and the OHP and
  row slots by machine, cable and dumbbell lifts (SI 1.21 with them, 1.10
  without, same data). Lifts with no qualifying set in 183 days show "No
  data" and the weights re-normalize.
- **Proxies (v2.1b, Jon's decision Nov 22, 2026):** he keeps barbell squats
  light to protect his lower back and is moving to the leg press, so the
  squat slot may be fed by Leg Press (Machine) at 0.5 x its estimated 1RM,
  and the deadlift slot by Romanian Deadlift (Barbell) at 1.0 x. Each slot
  takes the best of real and proxy events in the 183-day window. Proxies
  show "Estimated" and name their source in the row detail. The 0.5 factor
  is a cautious rule of thumb, not a validated conversion (his own squat ran
  0.47 of his leg press while held back; textbook ratios applied to his RDL
  would imply a squat near 300 lb). SI on Nov 22: 1.17 with the RDL proxy;
  1.21 once a leg press at the Feb 2026 level (240 x 10) is logged.
  **v2.1c:** Seated Shoulder Press (Machine) feeds the OHP slot at 1.0 x. In
  the first half of 2026, when both were trained, the machine's median
  estimated 1RM was 112 against 108 on the barbell, so one for one is
  supported by his own data. SI on Nov 22 with the RDL and machine-press proxies: 1.21.

## 11. Exercise Classification

`classifyExercise(name)`: cardio patterns first (`CARDIO_PATTERNS`), then
`EXERCISE_MUSCLE_MAP` ordered specific-before-generic (upright row/face pull
before `/row/`, RDL/stiff-leg before `/deadlift/`, goblet/front/hack before
`/squat/`, tricep dip/chest dip before `/dip/`, close-grip bench before
bench) → `{primary, secondary[]}` or `other`. Cached per template-id or
normalized name (`classifyExerciseCached`). `normalizeExerciseName`
lowercases, collapses whitespace, and normalizes curly apostrophes.
`exerciseFamily` (v1.33) strips the trailing equipment parenthetical so
equipment variants compete for one session slot.

## 12. Muscle Group Metadata

`MUSCLE_GROUPS` — 12 groups with ideal frequency (days), weekly set targets
(~65% of Schoenfeld optimal), display color, structural tier:

| Group | Freq | Sets/wk | Tier |
|---|---|---|---|
| Chest | 5 | 10 | 1 |
| Back | 5 | 12 | 1 |
| Shoulders | 5 | 10 | 1 |
| Quads | 5 | 10 | 1 |
| Hamstrings | 6 | 8 | 2 |
| Glutes | 6 | 8 | 2 |
| Biceps / Triceps / Calves / Core | 6/6/6/4 | 6 | 3 |
| Neck / Forearms | 5 | 4 | 3 |

**Personal targets (v2.0, `applyPersonalModel`, run at the end of
`preprocessWorkouts`):** the table above is the reference (90 sets a week).
Delivered volume = fractional sets over the last 56 days / 8. Scale =
clamp(delivered x 1.10 / 90, 0.25, 1). Each muscle's weekly target =
reference x scale, rounded to 0.5, minimum 1. The ideal gap stretches by
tier as the scale falls: gap x (1 + (tierMult - 1) x clamp((1 - scale) / 0.6,
0, 1)) with tierMult 1.4 / 1.7 / 2.5 for tiers 1 / 2 / 3. In Nov 2026: scale
0.38, chest 4 sets every 7 days, biceps 2.5 every 15. Everything downstream
(scoring, urgency, the Muscles list) reads the personal values.

`EXERCISE_DB` holds ~80 exercises (benchmark lbs for an average mid-30s
~75 kg male, type, default sets/reps, rest). `MUSCLE_EXERCISE_PICKS` is the
static fallback pool; the dynamic pool unions DB + workout history + Hevy
templates (classifiable only); since v2.0 it is used for template matching
only, not for picking lifts. `COMPOUND_ANCHORS` was removed in v2.0.

## 13. Recommendation Scoring (5-Signal)

`generateRecommendations(muscleStats)` per muscle:
`score = recency·W1 + volumeDeficit·W2 + imbalance·W3 + proportionDeficit·W4
+ structuralBonus`
- recency = min(daysSincePrimary / idealFreq, 3)
- volumeDeficit = max(0, 1 − sets30d/idealSets30d)
- imbalance = 1 − (volumeRatio / maxVolumeRatio)
- proportionDeficit from frame targets (§22), 0 without measurements
- Weights: 0.40/0.30/0.30/0 without measurements; 0.35/0.25/0.25/0.15 with.
- **Structural importance:** tier bonus (T1 1.0, T2 0.5, T3 0) × a
  frequency-scaled weight (weekly lift frequency from last 14 d): ≥5/wk →
  0.08, 3–4 → 0.16, 1–2 → 0.25, 0 → 0.35.
- Urgency: high if daysSince ≥ 2.5× ideal or (volDeficit > 0.7 and
  imbalance > 0.5); med if ≥ 1.5× ideal or volDeficit > 0.5.
- **Recovery guard:** muscles with daysSincePrimary === 0 get score −1 +
  "trained today" explainer (suppressed from next-day recommendations; shown
  as RESTED sap-gold in the muscle grid). Note: daysSince is elapsed-hours
  floor, so "today" ≈ within 24 h.
- Human-readable explainer strings generated per muscle for the grid detail
  panel and Today-tab "Why this?" expanders.

## 14. Session Builder (v2.0)

`buildTimedSession(recs, prefs)` with `prefs = { liftCount, equipment }`:
- **Size:** N lifts, 3 / 4 / 5, default 4 (Jon expects to drop about one).
- **Region:** push (chest, shoulders, triceps), pull (back, biceps, forearms,
  neck) or legs (quads, hamstrings, glutes, calves). Regions are ordered by
  their most overdue large (tier 1 to 2) muscle; the first is planned.
  **Reroll steps to the next region**; after a full cycle it also rotates
  the lifts through the five most-used per muscle.
- **Slots** (`planSessionSlots`): the region's large muscles, most overdue
  first, one lift each; if the region has fewer than three large muscles the
  lead muscle gets a second lift; then small muscles of the region and core,
  most overdue first, except that a small muscle untrained for 60 days goes
  last (it still shows as due on Muscles). A custom session puts the chosen
  muscles first and gives each a second lift before filling from the region.
- **Lifts** (`liftCandidates`): only exercises in the workout history whose
  primary muscle matches, ranked by uses in the last 90 days, then recency.
  The first lift for a large muscle prefers a compound. Home mode filters
  `GYM_ONLY_REGEX`. A muscle with no history falls back to
  `MUSCLE_EXERCISE_PICKS` (shown as "New for you").
- **Guards:** no repeated exercise or name-family; within one muscle no
  repeated movement pattern; Squat + Deadlift (Big 5) still blocked.
- **Edits:** `_sessionSwaps` / `_sessionSkips` keyed by slot ("quads#0"),
  set from the Today tab, applied by the builder, cleared by reroll, a toggle
  change, a new custom session, or a full (non-keepState) render.
- Output keeps the old shape (`exercises[]` with `prescription`, `totalSec`),
  so Send to Hevy is unchanged. Order: heavy compounds first
  (`getExerciseDemandRank`).
- Removed in v2.0: the time-capped greedy builder, focus modes, per-muscle
  candidate caps, `rankExercisesForMuscle` (recency + variety + anchor
  bonuses), the Big 5 cap and the Session Adjustments strip.
- Loads and reps still come from `prescribeExercise` (§9), untouched until
  v2.1; e.g. a 62 lb kettlebell is still rounded to 60.

## 15–20. Cardio Engine

**Zones (§ Karvonen/Tanaka):** HRmax = 208 − 0.7×age; Karvonen HRR zones
when RHR available, %HRmax fallback. Zones 1–5 at 50/60/70/80/90% bounds.

**Weekly targets:** 150 min moderate (ACSM), polarized 80/20 → 120 min Zone
2 + ~30 min HIIT, 3 sessions/week (2 easy + 1 hard).

**Protocols (`CARDIO_PROTOCOLS`):** Zone 2 — Incline Walk (3.5 mph 8–12%),
Steady-State Cycling, Elliptical, Stair Climber Steady, Rowing Steady; HIIT —
Rowing Intervals (Z4), Cycling Intervals (Billat, Z5), Stair Climber
Intervals (Z4), Incline Treadmill Sprints (Z5, replaced flat sprints in
v1.16). Each carries expandable form-cue instructions. Progressive Zone 2
duration: +5 min at ≥6 cardio sessions/30 d, +10 at ≥12.

**HIIT readiness gates (v1.15):** blocked if RHR >10% above quarterly
baseline, recovery < 15 bpm, zero cardio sessions in 14 d (build base
first), or ≥4 consecutive training days. Block reason surfaced under the
plan. Split logic prescribes from what was already done this week (HIIT done
→ rest Zone 2; Zone-2 base exists → HIIT due; nothing yet → Zone 2 first).

**Counting rules (v1.17, walk gate revised v1.18a):**

| Source | Type | Counts toward 150 min/wk? |
|---|---|---|
| Hevy | any cardio | ALWAYS (intentional logging) |
| Watch | Indoor Walk | ALWAYS |
| Watch | Hiking | ALWAYS |
| Watch | other walks | only if ≥ 20 min (filters errands; per-workout HR unavailable) |
| Passive steps | — | never (vitals only) |

Hevy cardio minutes from `duration_seconds` (15-min default if a cardio
exercise has sets but no duration). Watch workouts come from an all-source
HealthKit query (§27). HIIT detection is name-based (interval/sprint/hiit/
tabata or exact protocol names) — known limitation for renamed Watch
workouts.

## 21. Composite Scores

**Cardio Fitness (0–2):** vitals-only — VO2 percentile/50 (cap 2.0) at 50%,
60/RHR (0.5–1.5) at 30%, recovery/20 (cap 2.0) at 20%; re-weighted for
available signals; daily via interpolated quarterly vitals.

**Dedication (0–~1.09, rolling 7 d):** liftScore (peak 1.0 at 5–6 days/wk,
−0.15/day at 7+; recalibrated v1.32) × 0.40 + muscle coverage (of 12) × 0.20
+ cardio min/150 (cap 1.3) × 0.30 + consistency bonus (1.0 if ≥3 lifts and
≥100 cardio min; 0.5 partial) × 0.10, minus consecutive-day fatigue penalty
(−0.07/day from 6 consecutive). **v1.35:** cardio-only Hevy days no longer
count as lift days (§28 #18). Timeline points exist on activity dates only.

**Body Composition (0–2):** bf% score ((35−bf)/12.5, weight 40) + frame-
target achievement (avg deficit → ×2, weight 40) + waist-to-height
((0.60−WHtR)/0.09, weight 20), re-weighted per available components.
**v1.37:** computed per-date from dated measurement entries with per-field
carry-forward; bf held constant (single snapshot, no history source); final
point at today uses the merged `getLatestMeasurements()` waist (v1.48; was
raw Apple Health, §28 #26). (Pre-v1.37 the timeline
was a constant — §28 #21.)

**Power Score (0–100, header tree-ring):** Strength 30% (SI piecewise:
0.9→50, 1.3→70, 1.8→90, 2.5→100), Cardio Fitness 25% (×50), Body Comp 20%
(×50), Dedication 25% (×100 — the ×50 bug fixed v1.33); weights
re-normalized across available pillars. Tap to expand the pillar breakdown.

## 22. Body Measurements & Frame Targets

- `MEASUREMENTS_BASELINE` embedded (2020-06-10, 2026-02-18, 2026-03-29,
  2026-08-02 [v1.48]);
  localStorage stores only deltas (`bodyMeasurements_v1`, capped 400
  entries); merged by date at read (baseline survives storage clears).
- Import path: Hevy CSV export (Profile → Settings → Export) — handles cm or
  inch columns, averages L/R pairs, parses "23 Oct 2023, 00:00" dates.
  Export button emits the merged array for re-embedding into the baseline.
- Frame targets (Casey Butt, wrist 6.5625"): neck 2.405×w, chest 6.500×w,
  bicep 2.340×w, forearm 1.885×w, thigh 3.445×w, calf 2.210×w; waist
  height×0.45 (inverted — lower is better); shoulder/hip display-only (no
  validated wrist formula). Deficits feed recommendation signal 4 (§13) and
  the Frame-Adjusted Targets bars (sorted worst-first). Latest Apple Health
  waist merges in only when dated (`waist_date`) and newer than manual
  entries. **The Shortcut currently sends waist undated**, so manual/Hevy
  entries win everywhere (v1.48 extended this to the waist sparkline and the
  Body Comp "now" point, §28 #26).
- **Weigh-in entry (v1.49):** "Add a weigh-in" on the Body weight card opens
  an inline field (80 to 400 lb, one entry per local date) and writes
  `weightHistory`, the stored source that outranks Apple Health and the
  baseline. Before v1.49 nothing wrote that key and the Shortcut sends an
  empty `weight_entries`, so body weight was frozen at the Feb 16, 2026
  baseline (§28 #30). A weigh-in re-renders the whole dashboard; the
  Strength Index picks it up from the next workout dated on or after it.
- **Source-of-truth rule (v1.40):** every measurement tile, including the
  Body Composition WAIST tile, reads the merged value from
  `getLatestMeasurements()`, never raw `healthData` fields. Pre-v1.40 the
  WAIST tile read raw Apple Health, so a newer manual/Hevy-imported entry
  was shadowed by a stale HealthKit value (§28 #23). The target-delta label
  (distance from height×0.45) is unchanged.

## 23. Weight & Trends Chart

- Canvas chart, period chips 1M/3M/6M/1Y/ALL. Weight line always on (green,
  gradient fill); ONE secondary line at a time (v1.27 exclusive legend
  toggle, persisted in `chart_secondary_v1`; `'none'` sentinel since v1.35
  so the weight-only view survives reload): Strength, Cardio Fitness,
  Dedication (5-point smoothed), Body Comp. Since v1.47 the weight line is
  Sapwood and the one secondary line is always Resin and solid; the legend
  names it.
- **v1.36:** weight line (fill, endpoint dots, tooltip anchors) plots on the
  same day-offset time-proportional x-axis as the overlays. (Pre-v1.36
  weight was index-spaced — two x-axes on one canvas, §28 #20.)
- Each overlay self-normalizes to its own min/max within the visible span.
  SI tier rules (dashed) at 1.30 ADV / 1.80 ELT when the SI line is visible.
- Tap-to-inspect: nearest point tooltip (weight + all attached index values
  within 3 days), highlight dot, 3 s auto-fade.
- **Time domain (v1.42):** the x-axis is the selected period ending today
  (ALL: earliest point across weight and all overlay series). Every overlay
  filters to that domain. The weight layer draws only when weigh-ins exist
  in the window, and its fill closes at the first weigh-in. Tooltip anchors
  are added for the visible secondary line wherever no weigh-in is within
  3 days, so data after the last weigh-in is inspectable. Pre-v1.42 the
  domain was the span of weigh-ins in the window (§28 #25).

## 24. UI Systems & Storage

- **Tabs:** Today / Muscles / History / Body; fade+slide transitions; ARIA
  tablist (v1.28).
- **Today (v2.0):** title + "About N min" (fitted); a caption naming the
  region and why; toggles "4 lifts" / "Gym"; Reroll (next region); a flat
  list of lift rows with the last result on each; tap a row for the reason,
  up to three swaps from history, or skip; "N lifts skipped, Undo"; Send to
  Hevy on the first screen (bottom edge at 573 pt of 852 at four lifts);
  cardio plan rows below.
- **Muscles (v1.45):** list grouped by urgency (Due now / Coming due / On
  track / Rested), volume bar + "N of M weekly sets", days-since figure,
  inline detail, quiet "Build a custom session" select mode.
- **History (v1.46):** stat trio with week-over-week change in words, cardio
  row, 14-day heatmap (full names, one Sapwood ramp for lifts and cardio,
  today's column outlined), inline day detail.
- **Body (v1.47):** Strength (§10), Weight and trends (§23) with "Weighed
  <date>", Vitals as rows with ratings in words and one freshness caption,
  Measurements as one list against frame targets with "Measured <date>"
  (duplicate tile grid removed), Import/Export as quiet text buttons.
- **Growth Rings design system (v1.43+, §30):** Char/Bark surfaces,
  Sapwood text, Heartwood/Lichen/Resin/Ember accents; Newsreader + SF Pro;
  WAAPI motion; the 26-week cross-section as header Power Score button,
  boot sequence, and Power Score sheet. Haptics via the iOS 17.4
  checkbox-switch label-click workaround (WebKit blocks clicking the input
  directly); navigator.vibrate on Android. prefers-reduced-motion honored.
- **localStorage keys:** `workoutCache_v1` (no TTL since v1.49; kept current by the events sync), `wa_prefs_v1_1`,
  `weightHistory`, `bodyMeasurements_v1`, `hevy_template_map` +
  `hevy_template_map_ts` (7 d TTL), `hevy_routine_id`, `chart_secondary_v1`,
  `v117_cache_cleared` (one-time cache bust flag), `workoutSyncTs_v1` and
  `healthCache_v1` (v1.49).
- **Boot (v1.49):** cache-first render using the local health copy, then an
  incremental workout sync and the health fetch in the background. Background
  results call `renderDashboard(workouts, {keepState: true})`, which keeps
  reroll offsets, an active custom session (rebuilt from `_customSessionKeys`)
  and muscle select mode. Global onerror/unhandledrejection write to the
  loading screen and, once the dashboard is up, to an Ember line under the
  tabs (`#inline-error`); AbortError rejections are ignored.

## 25. (Reserved — original content unknown)

The original document had sections here whose exact content could not be
recovered. Everything technical they may have covered is folded into
§2/§24 above.

## 26. Send to Hevy & Template Resolution

- Routine title "LiftScript Daily". Find-first by NAME (paginated search,
  cached IDs go stale when the routine is deleted in Hevy) → `PUT` update;
  404 falls through to `POST` create (with `folder_id: null`). No
  duplicates.
- Template ID resolution order: workout-derived IDs → `HEVY_ID_OVERRIDES`
  (hardcoded map for neck/forearm exercises whose Hevy names don't
  fuzzy-match: Neck Curl/Extension Plate + Harness, Neck Lateral Flexion,
  Wrist Curls, Reverse Wrist Curl, Farmer Carry) → prefix-based fuzzy match
  against the loaded template library → live API paging for stragglers.
  Verified July 2026: no fuzzy false-positive risk exists for the override
  names in the current 473-template library. Unresolvable exercises are
  dropped at send time with a toast note.
- Sets: prescribed rep count (low end if a range), `type: 'normal'`,
  per-exercise `rest_seconds`. Weight (v2.1): the logged kg when the load is
  held (`holdKg`), otherwise the prescribed lb converted with the kg ceiling
  per the §5 truncation quirk; no 5 lb rounding. Notes field: `back-off`
  (v2.1) and/or `per hand`/`per side`.

## 27. iOS Shortcut: HealthKit Export Behavior

The Shortcut's HealthKit workout query returns workouts from ALL sources
(iPhone, third-party apps, Watch) — not Watch-only as earlier doc/code
comments claimed (corrected here and in the v1.35 code comment). Cardio
attribution therefore relies on the type-name filters and the 30-minute
Hevy dedup window (§8, §20), not on source filtering. The Shortcut also
emits quarterly vital snapshots, weight entries, waist, body fat, lean
mass, and (since mid-2026) per-workout calories. Shortcut JSON is malformed
by construction; see the §6 sanitizer.

## 28. Known Bug Fixes (pattern library)

Items 1–17 below are **reconstructed** from the code changelog and inline
comments — the original ordering/wording is lost; the set is believed
complete. Items 18–22 are preserved verbatim from the v1.35–v1.39 deltas.
Items 23–25 come from the v1.40–v1.42 changelog; #26 from v1.48.

1. Classification priority: specific patterns before generic (Tricep Dip vs
   /dip/, RDL vs /deadlift/, upright row vs /row/) — v1.1.
2. Curly-apostrophe normalization in exercise name matching.
3. UTC/local date drift: all day keys via `localDateStr()` — v1.16.
4. "Tomorrow's Session" label race on `heatmapDayWorkouts` — v1.17.
5. En-dash vs double-hyphen in CSS `var()` references (boot `checkCSS`
   guard + dev test).
6. Universal reset `*` selector typo (dev test A5 guard).
7. Markdown code-fence leakage into rendered page (dev test A6 guard).
8. `STRENGTH_INDEX_LIFTS` reference-before-definition (dev test A7 guard).
9. iOS haptics: WebKit blocks programmatic clicks on `<input switch>`; must
   click an associated `<label>` — v1.26a/b.
10. U+202F narrow no-break space in iOS locale time output stripped —
    v1.34.
11. Power Score Dedication pillar ×50 cap (should be ×100) — v1.33.
12. Double-progression first-set gate → min-reps-at-top-weight gate — v1.33.
13. Dead `walkHRPassesGate` + stray 220−age formula removed (Tanaka is the
    single HRmax source) — v1.33.
14. Big 5 cap message broken ordinal ("a 4rd") — v1.33.
15. Hevy kg display truncation → ceil-to-3dp on send (§5).
16. Stale cached routine ID after in-Hevy deletion → always search by name,
    404 falls through to create.
17. Cross-exercise ratio inflation in `estimateWeightFromPeers` → isolation
    ratio cap 1.5× (heavy Reverse Curl inflating Wrist Curl).
18. **Dedication cardio-only lift-day inflation (v1.35):** empty-array
    truthiness in the Dedication rolling-7d loop; 14 cardio-only Hevy
    workouts in the then-current history each counted as a lift day. Fix:
    `.length > 0`.
19. **getWorkingSets set_type field (v1.35):** filtered on a field the GET
    /workouts API never returns. Latent (no non-normal sets in history).
20. **Chart dual x-axes (v1.36):** weight index-spaced vs overlays
    time-spaced.
21. **Body Comp constant timeline (v1.37):** current-snapshot score stamped
    on all historical dates.
22. **SI pseudo-rolling window (v1.38):** cumulative high-water mark gated
    at now−183d instead of per-date trailing window.
23. **Waist tile shadowing (v1.40):** Body Composition WAIST tile read raw
    Apple Health, hiding newer manual/Hevy-imported waist entries. Fix: read
    `getLatestMeasurements()`.
24. **No 429 handling (v1.41):** the first Hevy rate-limit response killed
    the whole refresh with a raw error; template paging at pageSize=10 made
    cold-refresh bursts large enough to trigger it. Fix: `fetchHevy()`
    backoff wrapper + template pageSize=100.
25. **Chart clipped to the weigh-in span (v1.42):** the x-domain was the
    first-to-last weigh-in inside the period, so all overlays stopped at the
    last weigh-in (Feb 16, 2026 at the time: eight months of SI hidden in the
    1Y view) and the chart did not render when the period held no weigh-ins.
    Found by the Phase 0 visual audit. Fix: period-ending-today domain.
26. **Undated Apple Health waist stamped as today (v1.48):** the Shortcut
    sends `waist_circumference_in` with no date. The waist sparkline plotted
    it at today and the Body Comp timeline's "now" point used it raw, so the
    stale 35.0" (likely the Mar 29 value) overrode the newer 34.5" manual
    entry (Aug 2). The tile was already correct via `getLatestMeasurements()`.
    Fix: sparkline plots AH waist only when `waist_date` exists; timeline
    "now" point reads `getLatestMeasurements()`.

27. **Stale plan inside the cache window (v1.49):** with a cache under 8 h
    old the app made no Hevy request, so a workout logged since the last
    fetch was invisible and Today offered a finished session again. Fix:
    incremental `/workouts/events` sync on every open.
28. **Background refresh discarded session state (v1.49):** the stale-cache
    refresh called `renderDashboard`, which reset rerolls and any custom
    session and changed the list under the user. Fix: `keepState`.
29. **Cached paint blocked on the health file; errors hidden (v1.49):** the
    cached dashboard awaited `health-data.json` (6.7 s measured with a 6 s
    response; now 0.5 s), and runtime errors after boot were written to the
    hidden loading screen.
30. **Body weight could not be updated (v1.49):** `weightHistory` was read
    but never written. Fix: weigh-in entry.

## 29. Version History

Reconstructed from the verbatim changelog in the `index.html` header (which
is itself a complete record). Entries for v1.14 and v1.18–v1.19b were not
individually preserved in the header; what is known of them appears from
cross-references.

| Version | Key changes |
|---|---|
| v2.1c | Seated machine shoulder press (x1.0) may feed the Strength Index OHP slot, labelled Estimated |
| v2.1b | Strength Index proxies: leg press (x0.5) may feed the squat slot and barbell Romanian deadlift (x1.0) the deadlift slot, labelled Estimated |
| v2.1a | Phone layout: `.app` top padding = safe-area inset + 14 px (the wordmark sat on the inset edge and was blurred by the status bar); bottom padding 120 px to 16 px + inset; lift rows 64 px; Send margin 20 px. Found from a device screenshot: the headless render reports zero insets, so check layout with insets simulated (59 top, 34 bottom) |
| v2.1 | Progression: personal rep bands; loads step through logged weights with jumps held under 10%; repeat after a 21-day gap; stalls flagged with an optional back-off instead of an automatic deload, and the stalled lift leads its muscle; exact loads sent to Hevy |
| v2.0 | Right-sized planner: N-lift sessions by region from your own lift history; personal weekly targets and gaps; fitted session time; Today rebuilt with last result, swap and skip, Send on the first screen; Strength Index restricted to barbell lifts; old builder, ranker, focus modes and Big 5 cap removed |
| v1.49 | Reliability: incremental `/workouts/events` sync on every open; cached paint from a local health copy; state-preserving background re-render; visible error line; weigh-in entry; dead code removed (Redwood helpers, tier emblems, unused `muscle1RMs`, `toggleSectionExplainer`); dev test A4 fixed. Engine output identical to v1.48 (14 replay dates x 18 setting combinations) |
| v1.48 | 2026-08-02 measurements embedded in `MEASUREMENTS_BASELINE`; undated Apple Health waist no longer overrides newer manual entries in the waist sparkline or Body Comp timeline (§28 #26) |
| v1.47 | Body rebuilt (SI hero + tier scale, lift rows, PR rows, weight freshness, chart restyle with Resin secondary line, vitals rows, measurements list; duplicate tiles removed) and transitional palette retired (88 C refs + 23 CSS vars renamed, old keys deleted). Revamp complete |
| v1.46 | History rebuilt: stat trio with week-over-week change in words, cardio row, heatmap with full names / one Sapwood ramp for lifts + cardio (cardio buckets 15/25/35/45) / today column outline / word legend, inline FLIP day detail, column-by-column entrance; parity 13/13 |
| v1.45 | Muscles rebuilt: grid to list grouped by urgency tier (Due now / Coming due / On track / Rested), volume bar + weekly-sets caption, days-since figure, inline FLIP detail, quiet select mode, Heartwood focus ring; recency rings and legend removed; parity 41/41 |
| v1.44 | Today rebuilt: Newsreader session title + prescriptions, quiet settings toggles, anchor Heartwood rule, Resin deload, FLIP explainers, Send to Hevy as the single filled button (no spinner, double haptic), cardio plan rows, tab exit/entrance via motion(); parity: all 88 Today numbers match incl. collapsed content |
| v1.43 | Growth Rings foundation: tokens + transitional C remap, Newsreader + SF Pro (mono/uppercase/tracking removed), WAAPI motion system, 26-week cross-section (header + Power Score sheet), cold-start boot sequence, header/tab bar/loader rebuilt, cards flattened, texture/dividers/canopy removed |
| v1.42 | Chart time domain = selected period ending today (overlays no longer clipped at last weigh-in; renders without weigh-ins; overlay tooltip anchors) |
| v1.41 | Hevy 429 hardening: `fetchHevy()` backoff wrapper (Retry-After or 2/5/10 s, 3 retries) on all call sites; template pageSize 10→100 (~47→~5 requests); readable terminal-429 message |
| v1.40 | WAIST tile source-of-truth fix: merged `getLatestMeasurements()` value instead of raw Apple Health |
| v1.39 | Stall detection + ~10% deload (reps[] history; ≥4-session run, max(last 3 reps) ≤ baseline; DELOAD chip; Hevy note) |
| v1.38 | SI true 183-day rolling window (per-lift event lists; SI can decline; timeline 95→159 pts at change; current SI unchanged 1.20) |
| v1.37 | Body Comp timeline per-date from measurement history (was constant); dead weight_history branch removed |
| v1.36 | Weight line on time-proportional x-axis matching overlays; csMin dead field removed |
| v1.35 | Correctness remediation: dedication cardio-only fix, set `type` field fix (latent), per-workout calories piped, chart off-state persists, stale comments |
| v1.34 | Legibility micro-pass: legend wrap, --danger-text #ED7960, urgency-tier muscle bars, detail scroll-into-view, two-line subtitle, Body Comp rose recolor, copy fixes |
| v1.33 | Audit remediation: Dedication ×100 fix, session variety (family dedup, 2-isolation cap), min-reps progression gate, dead code removal, test.html removed |
| v1.32 | Dedication recalibration: 6-day/week peak; fatigue penalty from 6 consecutive |
| v1.30x | Today card branch dividers; adaptive Big 5 cap (relax to 3 below 0.60 Foundation delivery) |
| v1.29 | Big 5 conflict resolution: classifier, Squat+Deadlift block, Deadlift+Row caution, budget cap, Session Adjustments strip |
| v1.28 | Accessibility: contrast, focus-visible, 44px tap targets, Dynamic Type, ARIA |
| v1.27 | Data-viz: single-secondary chart + persistence, SI tier rules, legend states, PR dots |
| v1.26/a/b | Microinteractions + haptics (label-click WebKit fix), tab transitions, reduced-motion |
| v1.25 | Info hierarchy: 5-step heatmap, RESTED chips, anchor promotion, card-hero |
| v1.24 | Brand payoff: bark texture, 6-band canopy light, tree-ring loading, SI rings helper |
| v1.23 | PWA polish: manifest, icons, safe-area insets, viewport-fit |
| v1.22 | Typography system: JetBrains Mono + SF Pro dual fonts, tabular figures |
| v1.21 | Palette cleanup: HUD-era pink/teal → Redwood greens/golds |
| v1.19–v1.19b | Redwood aesthetic utilities (branch dividers, moss bars, cross-section rings); filters always visible (v1.19b) |
| v1.18/a | Walk HR-gate replaced with 20-min duration gate (v1.18a); Zone-2 duration scaling |
| v1.17-era | Structural importance boost, demand-ordered exercise list, lift reroll |
| v1.16 | PR board, trend arrows, chart periods, cardio reroll + instruction cards, polarized 80/20, incline sprints, structural tiers, walk filtering, fuzzy Hevy matching, routine find-first PUT, Tomorrow label fix |
| v1.15 | localDateStr everywhere, measurements delta persistence, 155-workout cap, inverted waist display, HIIT readiness gates |
| v1.13-era | Exercise rotation scoring, compound anchors, vitals-only Cardio Score, Dedication score, Body Comp index, Power Score composite, 5-line chart |
| v1.11–v1.12b | Hevy CSV measurement import, new measurement fields, tappable tiles + sparklines, radar proportions, muscle grid redesign |

## 30. Design System: Growth Rings (v1.43 to v1.47)

- Approved October 11, 2026 (direction A of three, chosen from rendered
  style frames). Rulebook: `docs/DESIGN.md`. Every presentation change goes
  through it; add the rule there before building something it doesn't cover.
- Three overriding rules: rings mean weeks; one surface level; stale numbers
  state their age once, at the group level.
- Tokens live in the C object and `:root`: char, bark, line, sapwood, ash,
  heartwood, lichen, resin, ember, ring tones, plus rgba variants. The
  pre-revamp keys were renamed app-wide and deleted in v1.47.
- Type: Newsreader (numbers, titles, wordmark; tabular digits by default) +
  SF Pro. No monospace, no uppercase transforms, no tracking.
- Motion: `motion()` Web Animations helper; durations 160 / 320 / 640 ms;
  easings grow / settle / exit; stagger `i x min(40, 320 / n)` ms; FLIP
  expanders; transform and opacity only. Boot ~1.6 s on cold start (tap to
  skip); full entrance on a tab's first visit per session, quiet fade after;
  reduced motion is instant.
- Signature: the 26-week cross-section (ring width = working sets that week,
  display only), at 292 px in the boot, 220 px in the Power Score sheet,
  40 px as the header Power Score button.
- Review tooling (`tools/`): `render.py` records live Hevy + health
  responses once and replays them with a frozen clock at iPhone size (Hevy
  writes blocked; fixtures never committed); `compose.py` builds contact
  sheets; `strip_tab.py` pauses all animations and seeks them in 100 ms
  steps for frame strips.
- Parity vs tag `pre-revamp-v1.42` (every number in each tab's text,
  including collapsed panels): Today 88/88, Muscles 41/41, History 13/13.
  Body differs only by design: the duplicate measurement tiles (9 values +
  9 "195d ago" ages + the duplicate waist tile) and the "Est 1RM" header
  were removed; freshness dates were added; health age reads in days.

## Appendix: Sprint validation practices (July 2026)

- Cross-reference all findings against the live API and live data before
  stating claims (e.g., set `type` field, 473 templates, 14 cardio-only
  workouts, SI 1.20 old-vs-new parity were all live-verified).
- Node unit harnesses extract functions from index.html via regex and run
  scenario matrices before push (15 scenarios for the v1.39 deload rule).
- Master doc updated with version deltas after each sprint.
- Revamp (Oct 2026): each step rendered against recorded fixtures, numeric
  parity checked against the baseline tag, entrance reviewed as a seeked
  100 ms frame strip, failures fixed and re-rendered before push.
- v1.41 (Aug 2026): 5-scenario unit test of `fetchHevy` (clean 200; 429×2
  then 200; 429 forever = 4 calls; Retry-After capped at 30 s; non-numeric
  Retry-After falls back to 2 s) before push. Live `curl -D` header capture
  confirmed the pageSize limits before patching.
- v1.49 (Nov 2026): engine parity by Node replay (`tools/engine_harness.js`):
  recommendations, sessions for all 18 setting combinations, SI, Dedication,
  Cardio Fitness, Body Comp, Power Score and cardio plans identical to v1.48
  at 14 dates. Text parity on all four tabs with the recorded fixtures (only
  additions: the weigh-in control and the version string). Browser scenarios:
  no-change open = 1 events call and 0 workout pages; a new workout appears
  and a deleted one disappears without a manual refresh; a custom session
  and reroll survive a background sync; a 500 from the sync leaves the
  dashboard up; weigh-in saves and rejects out-of-range input.

- v2.0 (Nov 2026), replayed over 78 multi-lift sessions in 183 days with
  `tools/backtest.js` and ad hoc scripts. Time: predicted / actual duration
  median 1.06 (was 0.39), fitted out of sample. "Due now": 2 muscles (was 7).
  Exact-name match of logged lifts to the first plan: 20% (unchanged) with a
  4-lift plan instead of 9; within three rerolls 31% (was 27%). Share of the
  plan that was done: 15% first plan, 24% best (was 7% and 9%). Sessions with
  at least one planned lift: 49% first, 76% best (was 36% and 53%). The plan
  document's 60% exact-match target was not met: half the logged sessions
  mix regions and near-identical variants (bench vs incline bench) count as
  misses. Judge v2.0 on live use.
- v2.1 (Nov 2026), same replay (215 lift occurrences, 183 days): at the
  prescribed load with reps met 36% (was 25%); reps missed 22% (27%); went
  heavier 25% (21%); went lighter 17% (27%). Prescribed jumps: 22 (was 59),
  median 4.4% of the load (was 11.1%), taken 32%, landed 9%. The plan's
  targets (45% met, 50% of jumps landed) were not reached. The replay
  compares against behaviour shaped by the old prescriptions, so the next
  check is live use, not more tuning.
