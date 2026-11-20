// Loads the engine script block from index.html into a Node vm with a stub DOM and a settable clock.
// Used by tools/backtest.js. No network, no writes.
// Loads the LiftScript engine from index.html into a vm context with a stubbed DOM and a controllable clock.
process.env.TZ = 'America/Los_Angeles';
const fs = require('fs'), vm = require('vm');
function load(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const src = blocks[blocks.length - 1];
  const el = () => new Proxy(function(){}, {
    get(t, k) { if (k === Symbol.toPrimitive) return () => ''; if (k === 'style' || k === 'classList' || k === 'dataset' || k === 'parentElement' || k === 'parentNode') return el(); if (k === 'length') return 0; if (k === 'getBoundingClientRect') return () => ({width: 349, height: 150, left: 0, top: 0}); if (k==='then') return undefined; return el(); },
    set() { return true; }, apply() { return el(); }
  });
  const RealDate = Date;
  const state = { now: RealDate.now() };
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(state.now); else super(...a); }
    static now() { return state.now; }
  }
  const store = {};
  const ctx = {
    console: { log(){}, warn(){}, error(){}, group(){}, groupEnd(){} },
    Date: FakeDate, Math, JSON, Promise, Set, Map, Object, Array, String, Number, RegExp, Error, parseInt, parseFloat, isNaN, Infinity, NaN, Symbol, Proxy,
    setTimeout: () => 0, clearTimeout: () => {}, requestAnimationFrame: () => 0,
    document: { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener(){}, createElement: () => el(), body: el(), documentElement: el() },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {}, getComputedStyle: () => ({ getPropertyValue: () => 'x', boxSizing: 'border-box' }),
    fetch: () => Promise.reject(new Error('no network in harness')),
    IntersectionObserver: function(){ return { observe(){}, disconnect(){} }; },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'index.html.js' });
  const run = code => vm.runInContext(code, ctx);
  // Helper inside the context: compute engine state "as of now" from a workout list (mirrors renderDashboard L7213-7240, no rendering)
  run(`function __prep(workouts, hd) {
    healthData = hd || null;
    _customSessionActive = false; _liftRerollOffset = 0;
    WEIGHT_DATA = getMergedWeightData();
    if (WEIGHT_DATA.length > 0) PROFILE.bodyweightLbs = WEIGHT_DATA[0].value;
    latestMeasurements = getLatestMeasurements();
    proportionDeficits = computeProportionDeficits(latestMeasurements);
    const pp = preprocessWorkouts(workouts, PROFILE.bodyweightLbs, WEIGHT_DATA);
    exerciseHistory = pp.exerciseHistory; _templateIdMap = Object.assign({}, pp.templateIdMap || {});
    muscleAnalysis = pp.muscleStats; muscle1RMs = pp.muscle1RMs; strengthIndexData = pp.strengthIndexTimeline;
    heatmapDayWorkouts = pp.heatmapDayWorkouts || {}; heatmapDayCardio = pp.heatmapDayCardio || {};
    buildDynamicExercisePool();
    const recs = generateRecommendations(pp.muscleStats); LAST_RECS = recs;
    _consecutiveTrainDays = countConsecutiveTrainingDays(pp.heatmapDayWorkouts);
    return { pp, recs };
  }
  function __addTemplates(list) { for (const t of list) { if (t.title && !_templateIdMap[t.title]) _templateIdMap[t.title] = t.id; } addHevyTemplatesToPool(); }`);
  return { run, ctx, setNow: ms => { state.now = ms; }, RealDate };
}
module.exports = { load };
