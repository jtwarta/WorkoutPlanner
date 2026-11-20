// Engine backtest: replays the real engine over Hevy history.
// usage: python3 tools/pull_history.py <data_dir> && node tools/backtest.js <data_dir>
// <data_dir> must be outside the repo (the repo is public).
const DATA = process.argv[2];
const { load } = require('./engine_harness.js');
const fs = require('fs');
const E = load(require('path').join(__dirname, '..', 'index.html'));
const ws = JSON.parse(fs.readFileSync(DATA + '/workouts.json'));
const routines = JSON.parse(fs.readFileSync(DATA + '/routines.json'));
const templates = JSON.parse(fs.readFileSync(DATA + '/templates.json'));
const RID = routines[0].id;
const T = w => Date.parse(w.start_time);
ws.sort((a, b) => T(b) - T(a)); // newest first, like the API
const NOWMS = Date.parse('2026-11-19T20:43:53-08:00');
const D183 = NOWMS - 183 * 864e5;
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const out = {};
function asOf(ms) { E.setNow(ms); E.ctx.__ws = ws.filter(w => T(w) < ms).slice(0, 155); }
const cls = n => E.run(`classifyExercise(${JSON.stringify(n)}).primary`);
const isLift = e => { const c = cls(e.title); return c !== 'cardio' && c !== 'other'; };
const recent = ws.filter(w => T(w) >= D183 && T(w) < NOWMS).reverse();
out.n_recent = recent.length;

// ---- A. time model ----
{
  const rows = [];
  for (const w of recent) {
    const lifts = w.exercises.filter(isLift); if (!lifts.length || lifts.length !== w.exercises.length) continue;
    const actual = (Date.parse(w.end_time) - T(w)) / 60000; if (actual > 180 || actual < 5) continue;
    let pred = 0, sets = 0;
    asOf(T(w) - 60000); E.run(`__prep(__ws, null)`);
    for (const e of lifts) { const n = e.sets.length; sets += n; pred += E.run(`calculateExerciseTime(${JSON.stringify(e.title)}, ${n})`) / 60; }
    rows.push({ actual, pred, ratio: actual / pred, nEx: lifts.length, sets });
  }
  out.A_time = { n: rows.length, median_actual_min: med(rows.map(r => r.actual)), median_pred_min: med(rows.map(r => r.pred)), median_ratio: +med(rows.map(r => r.ratio)).toFixed(2),
    p25_ratio: +q(rows.map(r => r.ratio), .25).toFixed(2), p75_ratio: +q(rows.map(r => r.ratio), .75).toFixed(2),
    median_min_per_exercise_actual: +med(rows.map(r => r.actual / r.nEx)).toFixed(1), median_min_per_exercise_pred: +med(rows.map(r => r.pred / r.nEx)).toFixed(1),
    median_sets: med(rows.map(r => r.sets)), median_ex: med(rows.map(r => r.nEx)) };
}

// ---- B. routine-started workouts: size + replay overlap ----
{
  const rw = ws.filter(w => w.routine_id === RID && T(w) < NOWMS).reverse();
  const variants = []; for (const n of [3, 4, 5]) for (const eq of ['gym', 'home']) variants.push({ liftCount: n, equipment: eq });
  const rows = [];
  for (const w of rw) {
    asOf(T(w) - 60000);
    E.run(`__r = __prep(__ws, null)`);
    const actual = w.exercises.filter(isLift).map(e => e.title);
    if (!actual.length) continue;
    let best = null; let def = null;
    for (const pool of ['hist', 'tmpl']) {
      if (pool === 'tmpl') { E.ctx.__t = templates; E.run(`__addTemplates(__t)`); }
      for (const v of variants) for (const rr of [0, 1, 2]) {
        E.ctx.__v = v; E.run(`_liftRerollOffset = ${rr}`);
        const s = JSON.parse(E.run(`JSON.stringify(buildTimedSession(__r.recs, __v).exercises.map(e => e.name))`));
        const hit = actual.filter(a => s.includes(a)).length;
        const row = { v, rr, pool, nPres: s.length, hit, s };
        if (!best || hit > best.hit || (hit === best.hit && s.length < best.nPres)) best = row;
        if (pool === 'hist' && v.liftCount === 4 && v.equipment === 'gym' && rr === 0) def = row;
      }
    }
    rows.push({ date: w.start_time.slice(0, 10), nActual: actual.length, bestHit: best.hit, bestN: best.nPres, defN: def.nPres, defHit: def.hit, dur: (Date.parse(w.end_time) - T(w)) / 60000 });
  }
  const r183 = rows.filter(r => Date.parse(r.date) >= D183);
  const sum = a => a.reduce((x, y) => x + y, 0);
  out.B_routine = { n_all: rows.length, n_183: r183.length,
    median_exercises_logged: med(r183.map(r => r.nActual)), median_exercises_default_session: med(r183.map(r => r.defN)), median_duration_min: +med(r183.map(r => r.dur)).toFixed(0),
    logged_exercises_found_in_best_replay_pct: Math.round(100 * sum(r183.map(r => r.bestHit)) / sum(r183.map(r => r.nActual))),
    logged_exercises_found_in_default_replay_pct: Math.round(100 * sum(r183.map(r => r.defHit)) / sum(r183.map(r => r.nActual))),
    share_of_default_session_logged_pct: Math.round(100 * sum(r183.map(r => r.defHit)) / sum(r183.map(r => r.defN))),
    share_of_best_session_logged_pct: Math.round(100 * sum(r183.map(r => r.bestHit)) / sum(r183.map(r => r.bestN))),
    dist_logged: r183.reduce((m, r) => (m[r.nActual] = (m[r.nActual] || 0) + 1, m), {}) };
}

// ---- C. prescription vs actual, per exercise occurrence (last 183d) ----
{
  const rows = [];
  for (const w of recent) {
    asOf(T(w) - 60000);
    E.run(`__r = __prep(__ws, null)`);
    const pres = {};
    for (const e of w.exercises.filter(isLift)) {
      const has = E.run(`!!(exerciseHistory[${JSON.stringify(e.title)}] && exerciseHistory[${JSON.stringify(e.title)}].lastWeightLbs > 0)`);
      if (!has) continue;
      pres[e.title] = JSON.parse(E.run(`JSON.stringify(Object.assign(prescribeExercise(${JSON.stringify(e.title)}), {lastW: exerciseHistory[${JSON.stringify(e.title)}].lastWeightLbs, lastR: exerciseHistory[${JSON.stringify(e.title)}].lastReps, lastDate: exerciseHistory[${JSON.stringify(e.title)}].lastDate}))`));
    }
    // actual gating numbers via the engine's own extraction: preprocess including this workout
    E.setNow(T(w) + 3600e3 * 6); E.ctx.__ws = ws.filter(x => T(x) <= T(w)).slice(0, 155);
    E.run(`__r2 = __prep(__ws, null)`);
    for (const name in pres) {
      const a = JSON.parse(E.run(`JSON.stringify({w: exerciseHistory[${JSON.stringify(name)}].lastWeightLbs, r: exerciseHistory[${JSON.stringify(name)}].lastReps, sets: exerciseHistory[${JSON.stringify(name)}].lastSets})`));
      const p = pres[name]; if (!(p.weightLbs > 0) || !(a.w > 0)) continue;
      const pr = parseInt(String(p.reps).split('-')[0], 10);
      const gap = Math.round((T(w) - Date.parse(p.lastDate + 'T12:00:00-08:00')) / 864e5);
      let c;
      if (a.w === p.weightLbs) c = a.r >= pr ? 'at prescribed weight, reps met' : 'at prescribed weight, reps missed';
      else if (a.w > p.weightLbs) c = 'went heavier'; else c = 'went lighter';
      rows.push({ name, routine: w.routine_id === RID, c, gap, pw: p.weightLbs, pr, aw: a.w, ar: a.r, deload: p.deload, lastW: p.lastW, bump: p.weightLbs > p.lastW, sets: a.sets, psets: p.sets });
    }
  }
  const tally = rs => { const m = {}; rs.forEach(r => m[r.c] = (m[r.c] || 0) + 1); const n = rs.length; const o = { n }; for (const k in m) o[k] = Math.round(100 * m[k] / n) + '%'; return o; };
  out.C_prescription = { all: tally(rows), routine_started: tally(rows.filter(r => r.routine)), freestyle: tally(rows.filter(r => !r.routine)),
    gap_days_median: med(rows.map(r => r.gap)), gap_days_p75: q(rows.map(r => r.gap), .75), share_gap_over_14d_pct: Math.round(100 * rows.filter(r => r.gap > 14).length / rows.length), share_gap_over_28d_pct: Math.round(100 * rows.filter(r => r.gap > 28).length / rows.length),
    bumps: (() => { const b = rows.filter(r => r.bump && !r.deload); return { n: b.length, taken_pct: Math.round(100 * b.filter(r => r.aw >= r.pw).length / b.length), taken_and_reps_met_pct: Math.round(100 * b.filter(r => r.aw >= r.pw && r.ar >= r.pr).length / b.length), median_jump_pct_of_load: +med(b.map(r => 100 * (r.pw - r.lastW) / r.lastW)).toFixed(1), p90_jump_pct: +q(b.map(r => 100 * (r.pw - r.lastW) / r.lastW), .9).toFixed(1) }; })(),
    deloads_prescribed: (() => { const d = rows.filter(r => r.deload); return { n: d.length, followed_pct: d.length ? Math.round(100 * d.filter(r => r.aw <= r.pw).length / d.length) : null, ignored_went_heavier: d.filter(r => r.aw > r.pw).map(r => `${r.name}: rx ${r.pw}, did ${r.aw}x${r.ar}`) }; })(),
    sets_logged_vs_rx_median: [med(rows.map(r => r.sets)), med(rows.map(r => r.psets))] };
  fs.writeFileSync(DATA + '/bt_rows.json', JSON.stringify(rows));
}

// ---- D. exercise rotation ----
{
  const occ = {};
  for (const w of recent) for (const e of w.exercises.filter(isLift)) (occ[e.title] = occ[e.title] || []).push(T(w));
  const names = Object.keys(occ); const counts = names.map(n => occ[n].length);
  const total = counts.reduce((a, b) => a + b, 0);
  out.D_rotation = { distinct_lift_exercises_183d: names.length, total_exercise_slots: total, done_once_or_twice: names.filter(n => occ[n].length <= 2).length, done_6plus: names.filter(n => occ[n].length >= 6).length,
    slots_in_exercises_done_6plus_pct: Math.round(100 * names.filter(n => occ[n].length >= 6).reduce((a, n) => a + occ[n].length, 0) / total) };
}

// ---- E. weekly volume vs targets (26 weeks) ----
{
  asOf(NOWMS); E.run(`__r = __prep(__ws, null)`);
  const targets = JSON.parse(E.run(`JSON.stringify(Object.fromEntries(Object.entries(MUSCLE_GROUPS).map(([k,v])=>[k,v.idealSetsPerWeek])))`));
  const hm = JSON.parse(E.run(`JSON.stringify(__r.pp.heatmapDayMuscle)`));
  const weeks = []; for (let i = 0; i < 26; i++) weeks.push({});
  for (const d in hm) { const age = Math.floor((NOWMS - Date.parse(d + 'T12:00:00-08:00')) / 864e5 / 7); if (age < 0 || age >= 26) continue; for (const m in hm[d]) weeks[age][m] = (weeks[age][m] || 0) + hm[d][m]; }
  let met = 0, cells = 0; const avg = {};
  for (const m in targets) { let s = 0; for (const wk of weeks) { const v = wk[m] || 0; s += v; cells++; if (v >= targets[m]) met++; } avg[m] = +(s / 26).toFixed(1) + ' / ' + targets[m]; }
  const tot = weeks.map(wk => Object.values(wk).reduce((a, b) => a + b, 0));
  out.E_volume = { muscle_weeks_meeting_target_pct: Math.round(100 * met / cells), avg_weekly_sets_vs_target: avg, total_weekly_sets_median: med(tot), total_target: Object.values(targets).reduce((a, b) => a + b, 0) };
  out.I_now = JSON.parse(E.run(`JSON.stringify({high: __r.recs.filter(r=>r.urgency==='high').length, med: __r.recs.filter(r=>r.urgency==='med').length, low: __r.recs.filter(r=>r.urgency==='low').length})`));
  // G. SI sources
  out.G_si_sources = JSON.parse(E.run(`JSON.stringify((function(){ const l = strengthIndexData[strengthIndexData.length-1]; const o = {index: l.index}; for (const k in l.lifts) o[k] = l.lifts[k].src ? (l.lifts[k].rm + ' from ' + l.lifts[k].src.ex + ' ' + l.lifts[k].src.wt + 'x' + l.lifts[k].src.reps + ' on ' + l.lifts[k].src.date) : null; return o; })())`));
  // F. deload flags now, with run dates
  out.F_deloads_now = JSON.parse(E.run(`JSON.stringify(Object.keys(exerciseHistory).filter(n => prescribeExercise(n).deload).map(n => { const h = exerciseHistory[n]; const k = h.weights.length; return n + ': rx ' + prescribeExercise(n).weightLbs + ' | last 4 sessions ' + h.dates.slice(k-4).map((d,i)=> d + ' ' + h.weights[k-4+i] + 'x' + h.reps[k-4+i]).join(', '); }))`));
  // H. determinism: pool with vs without Hevy template library
  const s1 = E.run(`JSON.stringify(buildTimedSession(__r.recs, {liftCount:4,equipment:'gym'}).exercises.map(e=>e.name))`);
  const poolBefore = E.run(`Object.values(_dynamicExercisePool).reduce((a,s)=>a+s.size,0)`);
  E.ctx.__t = templates; E.run(`__addTemplates(__t)`);
  const poolAfter = E.run(`Object.values(_dynamicExercisePool).reduce((a,s)=>a+s.size,0)`);
  const s2 = E.run(`JSON.stringify(buildTimedSession(__r.recs, {liftCount:4,equipment:'gym'}).exercises.map(e=>e.name))`);
  out.H_determinism = { pool_before_templates: poolBefore, pool_after_templates: poolAfter, same_session: s1 === s2, before: JSON.parse(s1), after: JSON.parse(s2) };
  const never = JSON.parse(s2).filter(n => !ws.some(w => w.exercises.some(e => e.title === n)));
  out.H_determinism.after_exercises_never_logged = never;
}
// K. home vs gym inference: equipment by start hour
{
  const gymRe = /(Machine|Cable|Smith|Leg Press|Hack Squat|Pec Deck)/i; const by = {};
  for (const w of recent) { const h = new Date(T(w)).getHours(); const b = h < 17 ? 'before 5pm' : '5pm or later'; by[b] = by[b] || { workouts: 0, withGymOnly: 0 }; by[b].workouts++; if (w.exercises.some(e => gymRe.test(e.title))) by[b].withGymOnly++; }
  out.K_location = by;
}
console.log(JSON.stringify(out, null, 1));
