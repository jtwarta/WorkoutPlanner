# LiftScript — Master Documentation

**Version: v1.39** · **Reconstructed July 10, 2026**

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

- **Single file:** all HTML/CSS/JS in `index.html` (~7,600 lines at v1.39).
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
  URL. The token value lives in Claude's project memory (deliberately not
  written into this document since a copy is committed to the repo).
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
- **GET /workouts set kind field is `type`, NOT `set_type`** (live-verified
  July 2026; values: `normal`, `warmup`, `failure`, `dropset`).
  `getWorkingSets` (v1.35) reads `s.type || s.set_type` and counts
  `normal` + `failure` as working sets. Pre-v1.35 it checked only
  `set_type` — vacuously true, all sets counted (latent bug, §28 #19).
- `GET /exercise_templates` — supports `pageSize=100`; ~473 templates total
  (live-verified). App fetches at pageSize=10 up to 50 pages with early stop
  once all needed names are matched; result cached 7 days.
- `GET /routines`, `POST /routines`, `PUT /routines/{id}` — see §26.
  Quirk: `folder_id` is required by POST but rejected by PUT.
- Weight display quirk: Hevy shows lbs as `floor(kg × 2.20462, 2dp)` —
  truncation. The app therefore **ceils** kg to 3dp on send so the
  back-conversion lands on or above the target (e.g. 140 lbs → 63.504 kg,
  not 63.503).

## 6. Apple Health Pipeline (health-data.json)

Written by the iOS Shortcut on a schedule; fetched with cache-busting
`?t=Date.now()`, `cache: 'no-store'`. Considered stale after 48 h
(`HEALTH_STALE_HOURS`); status ok/stale/missing drives the header sync dot
and the Health Vitals card.

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
the clock), `muscle1RMs` (30-day best per key lift + percentile), the SI
timeline (§10), the Cardio Fitness and Dedication timelines (§21), and the
heatmap maps (`heatmapDayMuscle`, `heatmapDayWorkouts`, `heatmapDayCardio`).

Apple Watch cardio is merged into `heatmapDayCardio` after the Hevy pass:
non-cardio Watch types excluded by regex (strength/yoga/pilates/etc.); walk
filter per §20; dedup against Hevy cardio within a 30-minute timestamp
window.

## 9. Exercise Prescription & Double Progression

`prescribeExercise(name)`:
- Defaults from `EXERCISE_DB` (sets, rep range, benchmark lbs, note, rest).
- With history: sets from `lastSets` (clamped 2–6); then
  **double progression** — if gating reps ≥ rep-range ceiling: +5 lbs, reset
  to range bottom; otherwise hold weight, +1 rep. The v1.33 gate requires
  ALL working sets at the top weight to hit the ceiling (lastReps = min reps
  among heaviest-weight sets); degrades to a top-set gate for pyramid
  logging.
- **v1.39 stall detection → deload:** if the trailing run at the current
  weight spans ≥ 4 sessions and no attempt in the last 3 sessions exceeded
  the baseline gating rep count (`max(reps[-3:]) <= reps[-4]`) while still
  below the rep ceiling, prescribe a ~10% deload (rounded to 5 lbs,
  guaranteed below the stalled weight, floor 5 lbs) with reps reset to the
  range bottom. A single bad day after progress (6,8,9,6) does NOT trigger;
  flat (7,7,7,7) or declining (4,4,3,3) runs do. Skipped for
  bodyweight/hold exercises. Prescriptions carry a `deload` flag → amber
  DELOAD chip on the Today tab + `deload -10%` in the Hevy exercise notes.
- No history: `estimateWeightFromPeers` scales the DB benchmark by the
  user's average strength ratio in that muscle group (isolation ratio capped
  1.5×, compound 2.0× — prevents cross-exercise ratio inflation); exercises
  absent from the DB start at 80% of the median same-type logged weight.
- Final guards: bodyweight/hold notes force 0 lbs; weights rounded to 5 lbs.

Rest periods (`getRestSeconds`, evidence: Schoenfeld 2016, de Salles 2009,
Singer 2024): 180 s heavy barbell compounds; 120 s moderate compounds; 90 s
multi-joint machines / heavier isolation; 60 s pure isolation/small muscles.
Hardcoded per exercise in `EXERCISE_DB.rest` with a pattern-based fallback.

Time model (`TIME_CONSTANTS`): 45 s/compound set, 35 s/isolation set,
inter-set rest, +90 s transition per exercise; session caps 30/45/60 min.

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
  (track max 2.5). Rendered as segmented XP bar with tappable tier tooltips,
  concentric Big-5 percentile rings, per-lift percentile bars with source-
  set detail (tap), 30-day trend arrows, and the PR board (all-time PR per
  lift from the timeline, sparklines).
- Known scope note: the OHP pattern set (`overhead press|shoulder press|
  military press`) matches machine shoulder presses too.

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

`EXERCISE_DB` holds ~80 exercises (benchmark lbs for an average mid-30s
~75 kg male, type, default sets/reps, rest). `MUSCLE_EXERCISE_PICKS` is the
static fallback pool; the dynamic pool unions DB + workout history + Hevy
templates (classifiable only). `COMPOUND_ANCHORS`: Bench Press (Barbell),
Bent Over Row (Barbell), Overhead Press (Barbell), Squat (Barbell), Romanian
Deadlift (Barbell), Hip Thrust (Barbell).

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

## 14. Session Builder

`buildTimedSession(recs, prefs)`:
- Focus modes: auto / foundation (tiers ≤ 2 only) / neglect (score minus
  structural bonus). Custom sessions (muscle multi-select → Build Session)
  override focus and pin selected muscles to the top.
- Start with top 3 muscles, expand up to 6 while total time < 75% of cap
  (skipping suppressed/negative-score muscles). Per-muscle candidate caps
  [3,2,2,then 2] (`MUSCLE_EXERCISE_CAP`).
- Candidate importance = groupScore × typeBonus (compound 1.5) ×
  deficitBonus (1.3 if lifting <85% of benchmark) × orderBonus (−0.1/rank).
- `fitCandidates` greedy fit under the time cap with guards:
  - movement-pattern dedup for compounds (`MOVEMENT_PATTERNS`: h-push,
    v-push, h-pull, v-pull, knee-dominant, hip-dominant)
  - ≤1 compound per muscle until 70% of budget used
  - v1.33 variety: one exercise per name-family per session; ≤2 isolations
    per muscle (silent skips)
  - **Big 5 rails (v1.29/v1.30):** regex classifier for barbell
    bench/squat/deadlift/OHP/row; cap 2 per session ≤75 min (3 otherwise),
    relaxed to 3 when Foundation volume delivery < 0.60 of target
    (`foundationVolumeDeliveryRatio`); conflicts — Squat+Deadlift **block**
    (CNS/spinal), Deadlift+Row **caution** (skip past 40% budget). Skips
    logged to the collapsible "Session Adjustments" strip.
  - guarantees one isolation for the #1 muscle if it fits.
- Final list demand-ordered (`getExerciseDemandRank`): heavy barbell
  compounds → other compounds → large-muscle isolation → small-muscle
  accessories. Grouped by anatomy order for display.
- Rerolls: lift reroll rotates non-anchor candidates per muscle
  (`_liftRerollOffset`); cardio reroll cycles protocols. Both haptic-backed.

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
point at today merges the live Apple Health waist. (Pre-v1.37 the timeline
was a constant — §28 #21.)

**Power Score (0–100, header tree-ring):** Strength 30% (SI piecewise:
0.9→50, 1.3→70, 1.8→90, 2.5→100), Cardio Fitness 25% (×50), Body Comp 20%
(×50), Dedication 25% (×100 — the ×50 bug fixed v1.33); weights
re-normalized across available pillars. Tap to expand the pillar breakdown.

## 22. Body Measurements & Frame Targets

- `MEASUREMENTS_BASELINE` embedded (2020-06-10, 2026-02-18, 2026-03-29);
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
  waist merges in when newer than manual entries.

## 23. Weight & Trends Chart

- Canvas chart, period chips 1M/3M/6M/1Y/ALL. Weight line always on (green,
  gradient fill); ONE secondary line at a time (v1.27 exclusive legend
  toggle, persisted in `chart_secondary_v1`; `'none'` sentinel since v1.35
  so the weight-only view survives reload): Strength (purple), Cardio
  Fitness (red), Dedication (gold, 5-point smoothed), Body Comp (rose).
- **v1.36:** weight line (fill, endpoint dots, tooltip anchors) plots on the
  same day-offset time-proportional x-axis as the overlays. (Pre-v1.36
  weight was index-spaced — two x-axes on one canvas, §28 #20.)
- Each overlay self-normalizes to its own min/max within the visible span.
  SI tier rules (dashed) at 1.30 ADV / 1.80 ELT when the SI line is visible.
- Tap-to-inspect: nearest point tooltip (weight + all attached index values
  within 3 days), highlight dot, 3 s auto-fade.

## 24. UI Systems & Storage

- **Tabs:** Today / Muscles / History / Body; fade+slide transitions; ARIA
  tablist (v1.28).
- **Today:** hero (Today's/Tomorrow's Session + est. minutes + CUSTOM
  badge), completed banner, rest-day chip (3+/5+ consecutive days),
  Reroll/Reset/Hevy/60m/Gym/Auto chip row, Session Adjustments strip,
  anatomy-ordered exercise groups with "Why this?" expanders, anchor ◉
  glyphs, DELOAD chips (v1.39), cardio plan with weekly moss progress bar
  and tappable source breakdown.
- **Muscles:** grid sorted by priority score; cross-section recency rings
  (days-since in organic tree rings), urgency-tier volume bars + fractions
  (v1.34), RESTED gold treatment, tap for explainer (auto scroll-into-view),
  Build Custom multi-select → custom session.
- **History:** This Week stats (sessions/volume/coverage vs last week +
  cardio bar); 14-day × 13-row heatmap (12 muscles + cardio row; 5-step
  graduated fill; ≥15 min lights the cardio cell; tap for day detail).
- **Body:** Strength Index card (§10), Weight & Trends (§23), Health Vitals
  (RHR/Recovery/VO2 with 12/6/3-mo sparklines; Steps/Active Cal/Walking HR;
  unified 5-tier badges Elite/Great/Good/Fair/Low), Body Measurements card
  (§22) with Import/Export.
- **Redwood aesthetic:** bark-noise texture on cards, branch-divider SVGs,
  moss progress bars, time-of-day canopy light gradient (6 diurnal bands),
  tree-ring loading screen, JetBrains Mono (data) + SF Pro (prose) dual
  typography, WCAG-lifted `--danger-text` #ED7960 for small red text
  (v1.34). Haptics via iOS 17.4 checkbox-switch label-click workaround
  (WebKit blocks clicking the input directly); navigator.vibrate on
  Android. prefers-reduced-motion honored globally.
- **localStorage keys:** `workoutCache_v1` (8 h TTL), `wa_prefs_v1_1`,
  `weightHistory`, `bodyMeasurements_v1`, `hevy_template_map` +
  `hevy_template_map_ts` (7 d TTL), `hevy_routine_id`, `chart_secondary_v1`,
  `v117_cache_cleared` (one-time cache bust flag).
- **Boot:** cache-first render, background refresh when stale; health fetch
  in parallel; global onerror/unhandledrejection surface to the loading
  screen.

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
- Sets: prescribed rep count (low end if a range), `type: 'normal'`, kg
  ceiling per the §5 truncation quirk, per-exercise `rest_seconds`. Notes
  field: `deload -10%` (v1.39) and/or `per hand`/`per side`.

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

## 29. Version History

Reconstructed from the verbatim changelog in the `index.html` header (which
is itself a complete record). Entries for v1.14 and v1.18–v1.19b were not
individually preserved in the header; what is known of them appears from
cross-references.

| Version | Key changes |
|---|---|
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

## Appendix: Sprint validation practices (July 2026)

- Cross-reference all findings against the live API and live data before
  stating claims (e.g., set `type` field, 473 templates, 14 cardio-only
  workouts, SI 1.20 old-vs-new parity were all live-verified).
- Node unit harnesses extract functions from index.html via regex and run
  scenario matrices before push (15 scenarios for the v1.39 deload rule).
- Master doc updated with version deltas after each sprint.
