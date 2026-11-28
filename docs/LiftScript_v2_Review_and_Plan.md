# LiftScript v2: Review and Plan

Reviewed v1.48 (commit 694a147) on November 19, 2026. No app code changed in this run.

## Where things stand (November 27, 2026)

**Live version: v2.1f.** The authoritative technical reference is
`docs/Master_documentation.md` in the repo (and its copy in the project).

| Version | Date | What it did |
|---|---|---|
| v1.49 | Nov 19 | Reliability: sync on every open, faster cached paint, state kept across background updates, visible errors, weigh-in entry, dead code removed |
| v2.0 | Nov 19 | Four-lift sessions by region from your own lift history, targets scaled to your pace, fitted session time, Today rebuilt with swap and skip |
| v2.1 | Nov 20 | Progression: personal rep bands, real load steps, repeat after a 21-day gap, stalls flagged with an optional back-off |
| v2.1a | Nov 20 | Phone layout: space under the status bar, no empty band at the bottom |
| v2.1b, v2.1c | Nov 22 | Strength Index proxies: leg press (at half) for squat, barbell Romanian deadlift (one for one) for deadlift, machine shoulder press (one for one) for overhead press |
| v2.1d | Nov 27 | Plans the region trained longest ago; fixed a leg day repeating three days after the last |
| v2.1e | Nov 27 | Leg press set as the preferred quad lift, so leg days in Gym mode lead with it |
| v2.1f | Nov 27 | Accessories rotate through your three most-used options; main lifts stay fixed |

**Decisions made along the way**
- Four lifts per session, expecting about one to be dropped.
- Composite scores to be cut (in v2.2).
- Rep bands inferred from logs. In-app weigh-ins, no Shortcut change. Single user.
- Moving from barbell back squats to the leg press; squats were kept light
  to protect the lower back, so past squat numbers understate leg strength.
- Proxies accepted for the Strength Index, always labelled Estimated.

**Standing request from Jon (Nov 27, 2026):** stay alert to better options
as time unfolds. At every review, do not only rerun the numbers; look for
and propose improvements unprompted. Checklist:
- Lifts he keeps adding by hand or swapping to: should one become a
  preferred or main lift (`PREFERRED_LIFTS`)?
- Lifts the plan keeps offering that he keeps skipping or swapping away.
- Main lifts that are still stalled after a month of leading their muscle.
- Whether accessory rotation is being followed or swapped back.
- Regions or muscles drifting out (legs, glutes, neck, calves).
- Proxy inputs going stale in the Strength Index.
- New evidence or Hevy API features worth using.

**What drives completion (Jon, Nov 27, 2026):** he finished all four planned
pull lifts that day because each one feels good to perform. Enjoyment, not
only habit, is why a lift gets done. Ranking by use is a rough stand-in for
it. A better signal would be how often a lift is completed when it is
offered, which the app cannot measure yet because it keeps no record of the
plans it sent. Candidate for the next review: log each sent plan so
follow-through per lift can be measured, then rank on that.

**Next**
1. Use the app for about four weeks without tuning (to roughly December 25).
2. Then rerun `tools/backtest.js` on the new sessions. The numbers to beat:
   prescribed load with reps met 36%; share of each plan done 15%; first plan
   covers the muscles trained 47%.
3. Then v2.2: three tabs (Today, Week, Progress) and the composite scores
   cut. Presentation only. v2.3 (readiness signals, offline) stays optional.

**Open items**
- No leg press has been logged since February 26, 2026. From v2.1e leg days
  in Gym mode prescribe it (240 lb, repeating the February session). The
  Strength Index squat slot stays at the last real squat (129) until one
  syncs.
- The row slot has no qualifying lift in the last six months (last barbell
  row May 27), so it reads "No data".
- The overhead press figure (140, from July 29) leaves the six-month window
  in late January.
- Body weight is still the February 16 value until a weigh-in is entered on
  the Body tab.
- Loads, layout and controls were checked in a headless browser and against
  two phone screenshots. The headless render cannot reproduce the phone's
  status bar or insets.
- Cardio suggestions still name machines (rower, bike) not in the logs;
  slated for v2.2.
- The "LiftScript v2 proposed screens" page shows the earlier three-lift
  layout, not what shipped.
- The `pre-v1.49` backup tag could not be pushed; the history holds every
  earlier version.

---

**How to read the evidence.** *Verified* means I ran it: the real engine code in a Node harness against all 588 Hevy workouts, a headless-browser render with recorded fixtures, or a live API call. *Hypothesis* means I inferred it from reading. Line numbers refer to `index.html` at v1.48.

**Coverage.** I read the engine, data, session, cardio, boot and scoring code line by line (L884 to L5583, L6249 to L6383, L6940 to L7442). I did not line-read the Body-tab renderers, CSV import, vitals renderer and motion helpers (L5584 to L6248, L6379 to L6939); I reviewed those through the rendered output and the function list.

---

## Executive summary

**Thesis.** LiftScript plans for a lifter who does not exist. It writes a nine-exercise, "47-minute" session against 90 weekly sets. Over the last six months you did a median of three exercises in 40 minutes, about 35 sets a week, and matched the prescription on one lift in four. The model is wrong about your time, your capacity and what you will repeat. v2 should plan the session you will do and spend its intelligence on the three or four decisions in it.

**What matters most**

1. **The time model is off by about 2.5 times.** Your sessions take 13.2 minutes per exercise; the model assumes 5.2. A "60 minute" session is really over two hours of work. (Verified)
2. **You do a tenth of what is sent.** In the 40 sessions started from the LiftScript Daily routine, you logged a median of 3 exercises against 9 prescribed. Only 28% of what you logged was in the default session the engine would have built. (Verified, with a caveat in the findings)
3. **Volume targets cannot be met, so "due" means nothing.** Targets were met in 6% of muscle-weeks. Seven of twelve muscles read "Due now" today. (Verified)
4. **Progression rules do not fit how you train.** The median gap between repeats of the same exercise is 17 days, and a third exceed 28 days, yet the engine always asks for one more rep. The flat 5 lb jump is a median 11% of the load. You took 32% of prescribed jumps and landed 20%. (Verified)
5. **Stalls are answered with a deload you ignore.** You overrode 6 of 10 deloads. Bench has sat at 185 for sets of 2 to 4 since August while the engine asks for 165. (Verified)
6. **You cannot edit a session.** There is no way to swap or drop one exercise, which is exactly what you do in Hevy afterwards. (Verified)
7. **The app can show a stale plan after a workout.** Inside the 8-hour cache window it makes no Hevy request, so a session logged two hours ago is invisible. (Verified)
8. **The headline numbers rest on bad inputs.** Bodyweight is frozen at February 16 with no way to update it. The Strength Index counts a Romanian deadlift as your deadlift and a machine press as your overhead press. (Verified)

**Recommendation.** v2 is a smaller, more accurate planner: four lifts, sized from your own logs; a week view that spreads about ten weekly exercise slots across the body; progression tuned to gaps and real increments; a Today screen where Send sits above the fold and any lift can be swapped. Cut the composite scores. Ship reliability fixes first as v1.49.

Revision to my opening view: I expected the engine to need more signals (readiness, sleep). The backtest says its main problem is scale and fit, so readiness moves to the last, optional phase.

---

## Findings

### 1. Prescription engine

| Finding | Evidence | Impact | Effort | Risk |
|---|---|---|---|---|
| Prescriptions are followed 25% of the time: 27% same weight but reps missed, 21% heavier, 27% lighter (215 lift occurrences, 183 days). Routine-started sessions are no better (26%). | Verified. `prescribeExercise` L3465 to L3552 | High | Med | Med |
| "+1 rep" ignores elapsed time. Median repeat gap 17 days; 34% over 28 days. | Verified. L3533 to L3537 | High | Low | Low |
| Flat +5 lb is a median 11.1% jump (90th percentile 38.9%); the NSCA range the code cites is 2 to 10%. Jumps taken 32%, landed 20%. | Verified. L3529 to L3532 | High | Med | Low |
| Stall rule has no time awareness. Squat is flagged for deload from five sessions spread March to October. | Verified. L3494 to L3517 | Med | Low | Low |
| Deload is the wrong remedy for your stalls. Bench is trained about every three weeks; the stall looks like under-exposure. In one trial a deload week reduced strength gains, and the dose-response work points to frequency for strength. | Data verified; interpretation is a hypothesis. Sources 3, 4 | High | Med | Med |
| Rep ranges are generic. The table says bench 6 to 8; you train it at 2 to 4. | Verified. `EXERCISE_DB` L1568 to L1700 | Med | Low | Low |
| Rep progression is sound and should stay: adding reps at a fixed load produced similar gains to adding load in a randomized trial. | Source 1 | n/a | n/a | n/a |

The engine was right that bench has stalled. The app made the answer easy to ignore: one amber word and a number you did not believe.

### 2. Session design and planning

| Finding | Evidence | Impact | Effort | Risk |
|---|---|---|---|---|
| Time model underestimates by 2.54 times (middle half 1.83 to 3.43; 72 lift-only sessions). Your durations may include unlogged warm-ups and coaching time; the model should still match them. | Verified. `TIME_CONSTANTS` L1343 to L1356 | High | Low | Low |
| Targets total 90 sets a week; you deliver a median 35.5. Quads average 1.7 of 10, calves 0.8 of 6. | Verified. `MUSCLE_GROUPS` L1548 to L1561 | High | Low | Med |
| Exercise ranking rewards novelty (recency +0.4, variety +0.25), which works against progressing a stable set of lifts. You used 60 different lifts in six months; 28 of them once or twice. A systematic review finds variation can help or hurt depending on how it is applied. | Verified. L1859 to L1933. Source 5 | High | Med | Med |
| Anchors override your habits. Today's plan includes barbell hip thrust at 220 lb, which you have never logged in 588 workouts; you use the machine. | Verified. L1719 to L1726, L1900 to L1903 | Med | Low | Low |
| Planning is one session at a time. With about ten exercise slots a week, small muscles stay "due" forever (neck: 112 days). | Verified. L3564 to L3707 | High | High | Med |
| Classification is by regex on names. Hevy templates already carry `primary_muscle_group` and `equipment`. | Verified from the live API. L1408 to L1540 | Med | Med | Low |
| Cardio protocols assume a rower, bike and elliptical. Your logged cardio is walking, hiking, running and the stair machine. | Verified. L2869 to L2950 | Low | Low | Low |
| Half-credit for indirect sets matches the best-fitting model in the current dose-response literature. Keep it. | Source 2 | n/a | n/a | n/a |
| Composite scores do not drive decisions. Power Score, Dedication and Body Comp feed nothing in the planner. Body fat is null, weight is nine months old. | Verified. L7066 to L7126 | Med | Low | Low |
| Strength Index sources: deadlift 315 from Romanian deadlift 245 x 9; overhead press 140 from seated machine press 100 x 12. | Verified. L2315 to L2321 | Med | Low | Low |

Caveat on finding 2 of the summary: the replay cannot know which settings or rerolls you used, or that older engine versions wrote those routines. Under the most favourable combination of settings the overlap rises to 43%. The routine also appears to be rewritten with what you actually did when a workout ends (its last update matches the end of your November 17 session and holds bench at 185 x 3), so it drifts from the plan between sends.

### 3. Data and reliability

| Finding | Evidence | Impact | Effort | Risk |
|---|---|---|---|---|
| No Hevy request inside the 8-hour cache window; Today can show a finished session as still to do. | Verified in browser. L2264 to L2279, L7300 to L7320 | High | Low | Low |
| Hevy offers `GET /workouts/events?since=`; one small call per open would replace 16 sequential page fetches. | Verified live (HTTP 200) | High | Med | Low |
| Background refresh re-renders everything, discarding a custom session and changing the list under you. | Verified in browser. L7197 to L7203, L7310 to L7314 | Med | Low | Low |
| Cached first paint waits for the health file: 6.7 s with a 6 s health response. | Verified in browser. L7305 | Med | Low | Low |
| Errors after boot are written to the hidden loading screen. | Verified in browser. L1012 to L1020 | Med | Low | Low |
| Weight cannot be entered: `weightHistory` is read but never written, and the Shortcut sends an empty `weight_entries`. | Verified. L1986 to L1988; live health file | High | Low | Low |
| Health file: `body_fat_pct`, `lean_body_mass_lbs`, `vo2_3m`, `rec_3m` are null. No HRV or sleep fields exist. | Verified | Low | Med | Low |
| No service worker; the app does not open offline. | Verified (no reference in the file) | Low | Med | Med |

### 4. Information architecture and interaction

Measured at 393 x 852.

| Task | Today | Problem |
|---|---|---|
| See today's session | 0 taps; 9 rows; list runs 1.5 screens | Too long to take in |
| Send it | Scroll, then 1 tap. The button sits at 1,066 pt, below the 852 pt fold | Primary action hidden |
| Change one exercise | Not possible. Reroll rotates every non-anchor lift | You finish the edit in Hevy |
| Am I progressing | 1 tap to Body, then a 3.5-screen page; the index is contaminated | Answer is buried and unreliable |
| Log weight | Not possible | |
| Log a measurement | Export a CSV from Hevy, then Import at the bottom of Body | Heavy for one number |

**Proposed structure: three tabs.**

- **Today.** Four lifts, each showing your last result (the frames show an earlier three-plus-tail layout). Send above the fold. Tap a lift for the reason, your own alternatives, or skip. Cardio is one line.
- **Week** (merges Muscles and History). What you did, what the next three sessions cover, and coverage against your own pace.
- **Progress** (replaces Body). Core lifts with trend and how often you trained each, then weight with an entry control, measurements and vitals collapsed below.

### 5. Visual and motion craft

Growth Rings holds up. The type pairing, the single surface and the ring cross-section are distinctive and should stay. Gaps: the system has no pattern for an editable row, no input control, and no place for "last time" context; the header score would leave an empty pith if the Power Score is cut. Leftover non-system colours remain in the toast (L3968) and in muscle metadata (L1549 to L1560).

Rendered frames are published as "LiftScript v2 proposed screens". Two options for Today:

- **A, list.** Three equal rows, Send at 712 pt. **Recommended.** You read LiftScript before training to review and send; the lifting itself happens in Hevy. Fast review matters more than arm's-length legibility.
- **B, lead lift.** First lift set large. More dramatic, but Send drops to 817 pt and one number is over-weighted.

Prescriptions in the frames illustrate the proposed rules. "Last" values, trends and weekly figures are your real data.

### 6. Code health

| Finding | Evidence |
|---|---|
| About 175 lines of dead code: Redwood-era helpers L1139 to L1260, `tierEmblem` L5463 to L5493, `toggleSectionExplainer` L4550 to L4570 | Verified by reference count |
| `muscle1RMs` is computed on every load and never read | Verified. L2495 to L2511, L2587 to L2598 |
| Dev test A4 checks a CSS variable deleted in v1.47 and would fail if enabled | Verified. L7374 to L7381 |
| Template fuzzy-matching is written three times; the chart overlay block four times | Verified. L3985, L4133, L4176; L5150 to L5370 |
| No tests in the repo. The engine runs unmodified in Node with a stub DOM and a fake clock | Verified; harness added under `tools/` |

The single file is not what is holding the app back. Keep it. Move validation into the committed harness.

---

## Cut or simplify

- Power Score, Dedication, Body Comp and Cardio Fitness composites, and the four chart overlays. Keep the ring cross-section as the header mark.
- Strength Index as a headline. Keep per-lift trends on lifts you actually do.
- The 60/45/30 minute toggle; replace with lift count.
- Foundation and Neglect focus modes, once targets are scaled.
- Machine cardio protocols you do not use.
- The dead code above.

---

## Phased plan

**Status, November 19, 2026.** v1.49 shipped. v2.0 shipped with two of its
three backtest targets met: duration ratio 1.06 and "Due now" at 2. The
exact-match target (60%) was missed: 20% on the first plan, the same as
before but with four lifts instead of nine, and 31% within three rerolls.
Half of the logged sessions mix regions and close variants count as misses,
so the target was the wrong measure. The share of each plan actually done
doubled (7% to 15%; 9% to 24% best case). Three things were added beyond the
plan: sessions are built by region (push, pull, legs), Reroll steps to the
next region, and a small muscle untrained for 60 days is no longer pushed
into every session.

v2.1 shipped November 20, 2026, with neither replay target met: prescribed
load with reps met rose from 25% to 36% (target 45%), and prescribed jumps
landed 9% of the time on a sample of 22 (target 50%). Jumps are now a median
4.4% of the load, down from 11.1%. One planned rule was dropped on the
evidence: stepping back after a 42-day gap. After such gaps the last load was
matched or beaten 86% of the time, so the lift now simply repeats. Stalls no
longer trigger a deload; the lift is flagged, leads its muscle's days, and a
back-off is offered. Next: about four weeks of live use before any tuning,
then v2.2.

**v1.49, reliability.** No engine change.
- Sync with `/workouts/events` on every open; full fetch only on cold start.
- Paint from cache without waiting for health; apply background data without resetting session state.
- Visible error line on the dashboard.
- Weigh-in entry on Progress, stored in `weightHistory`.
- Remove dead code; fix dev test A4.
- *Should not change:* any prescription, score or count for the same data. *Validate:* text parity on all tabs against v1.48 with the same fixtures; browser scenarios R1 to R4 pass.

**v2.0, right-sized planner and Today.**
- Fit minutes per exercise from your trailing sessions.
- Scale weekly targets to delivered volume plus 10%.
- Session is four lifts (decided; see Decisions); rank by your own 90-day use; drop the novelty bonus for core lifts; anchors must be lifts you have done.
- Today rebuilt to frame A with swap and skip.
- Fix Strength Index patterns.
- *Will change:* session contents, time estimate, urgency groups, index value. *Validate on the backtest:* logged exercises found in the prescribed session rises from 28% to at least 60%; predicted versus actual duration ratio within 0.8 to 1.25; "Due now" count at most 3. Every other number unchanged.

**v2.1, progression.**
- Increments from the steps you have actually logged per exercise, held to 2 to 10%.
- Gap rule: repeat after 21 days, step back after 42 (thresholds tuned on the backtest).
- Personal rep band per core lift.
- Stall response: schedule the lift weekly and offer a back-off option in the row.
- *Validate:* "prescribed weight, reps met" rises from 25% to at least 45% in replay; jump success from 20% to at least 50%. The replay measures against behaviour shaped by old prescriptions, so confirm with four weeks of live use before tuning further.

**v2.2, Week and Progress.**
- Three-tab structure, week plan, coverage view, core-lift trends; composites removed; DESIGN.md extended with the editable row, the input and the "last time" caption.
- *Validate:* parity for every retained number; frame-strip review of each entrance.

**v2.3, optional.** Readiness from resting heart rate applied to lifting; HRV and sleep if the Shortcut gains them; offline shell.

---

## Decisions (settled November 19, 2026)

1. **Session size: four lifts.** The plan loads four, expecting about one to be dropped in session; extras are added by hand in Hevy. No separate "If there's time" tail.
2. **Composite scores: cut all four** (Power Score, Dedication, Body Comp, Cardio Fitness).
3. **Core lifts and rep bands: inferred** from 90 days of logs, with the list shown for review.
4. **Weigh-ins: in-app entry.** No Shortcut change for now.
5. **Single user.** Every workout in the Hevy account is Jon's; nothing is excluded from history.

---

## Sources

1. Plotkin et al. 2022, load versus repetition progression: https://peerj.com/articles/14142
2. Pelland et al., weekly volume and frequency meta-regressions: https://sportrxiv.org/index.php/server/preprint/download/460/967/908
3. Pelland et al., per-session volume: https://sportrxiv.org/index.php/server/preprint/view/537
4. Coleman et al. 2024, one-week deload: https://pubmed.ncbi.nlm.nih.gov/38274324/
5. Kassiano et al. 2022, exercise variation review: https://pubmed.ncbi.nlm.nih.gov/35438660/
6. Hevy workout events endpoint (also verified live): https://mintlify.wiki/chrisdoc/hevy-mcp/tools/workouts

Reproduce the numbers: `tools/engine_harness.js` and `tools/backtest.js` (see header comments). Workout data is fetched to a local folder and never committed.
