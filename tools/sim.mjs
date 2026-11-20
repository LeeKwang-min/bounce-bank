// Economy sim: greedy player, no fever, 1s ticks. Uses the game's real formulas via loadEcon().
// Hit model from in-game measurement: 0.73 hits/s/coin with 1 pad -> 2.0 with 9 pads; 12 pads measured at 1.56x the 9-pad hits.
import { loadEcon } from './econ.mjs';
const E = loadEcon();
const RUNS = +(process.argv[2] || 80), VERBOSE = process.argv.includes('-v');
const hitRate = p => 0.73 + (2.0 - 0.73) * (Math.min(p, 9) - 1) / 8 + 0.37 * Math.max(0, p - 9);

const g = { chips: 0, chipsEver: 0, lifetime: 0, best: 0, stars: 0, starsEver: 0, chipsAll: 0, climb: 0, climbT0: 0, reach40: [], vaults: [], shop: Object.fromEntries(E.SHOP.map(x => [x.id, 0])), t: 0 };
let r; const runs = [], events = [];
const ev = name => events.push({ t: g.t, name });
function startRun() {
  const st = g.shop.start;
  r = { t0: g.t, money: 0, stage: 1, stageEarned: 0, padCount: 1 + st, padLv: new Array(12).fill(1 + g.shop.padlv), speedLv: 0, coins: new Array(1 + 2 * st).fill(0), reach: { 1: 0 } };
}
const slots = () => 9 + g.shop.slot, maxTier = () => Math.min(E.TIERS.length - 1, 7 + g.shop.tier + g.shop.stier);
const avgPad = (pc = r.padCount, lv = r.padLv) => { let s = 0; for (let i = 0; i < pc; i++) s += 2 ** (lv[i] - 1); return s / pc; };
const mults = () => E.stageMult(r.stage) * E.chipMult(g.chipsEver) * E.bounceMult(g.shop.bounce) * E.starMult(g.starsEver) * E.speedTotal(r.speedLv, g.shop.speed, false);
const coinV = () => r.coins.reduce((a, t) => a + E.TIERS[t].v, 0);
const income = () => coinV() * avgPad() * hitRate(r.padCount) * mults();
const lowPad = () => { let b = -1; for (let i = 0; i < r.padCount; i++) if (r.padLv[i] < E.PAD_LV_MAX && (b < 0 || r.padLv[i] < r.padLv[b])) b = i; return b; };
const pairTier = () => { const n = {}; for (const t of r.coins) n[t] = (n[t] || 0) + 1; for (let t = 0; t < maxTier(); t++) if (n[t] >= 2) return t; return -1; };

function candidates() {
  const c = [], base = income(), per = avgPad() * hitRate(r.padCount) * mults(), cap = E.coinCap(r.stage, 1 + 2 * g.shop.start, 5 * g.shop.coinslot);
  if (r.padCount < slots()) {
    const pc = r.padCount + 1;
    c.push({ k: 'pad', cost: E.padCost(r.padCount), gain: coinV() * avgPad(pc) * hitRate(pc) * mults() - base, run: () => { r.padCount++; ev('pad'); } });
  } else { const i = lowPad(); if (i >= 0) {
    const lv = r.padLv.slice(); lv[i]++; const k = r.padLv.reduce((a, b) => a + b, 0) - 12 * (1 + g.shop.padlv);
    c.push({ k: 'lv', cost: E.lvCost(k), gain: coinV() * avgPad(r.padCount, lv) * hitRate(r.padCount) * mults() - base, run: () => { r.padLv[i]++; ev('lv'); } });
  } }
  if (r.coins.length < cap) c.push({ k: 'coin', cost: E.coinCost(r.coins.length, r.stage), gain: E.TIERS[0].v * per, run: () => r.coins.push(0) });
  const t = pairTier();
  if (t >= 0) {
    const full = r.coins.length >= cap;
    c.push({ k: 'merge', cost: E.mergeCost(t, r.stage), gain: (E.TIERS[t + 1].v - 2 * E.TIERS[t].v + (full ? E.TIERS[0].v : 0)) * per * (full ? 4 : 1),
      run: () => { r.coins.splice(r.coins.indexOf(t), 1); r.coins.splice(r.coins.indexOf(t), 1); r.coins.push(t + 1); if (t + 1 > g.best) { g.best = t + 1; ev('tier'); } } });
  }
  if (r.speedLv < E.SPEED_MAX) c.push({ k: 'speed', cost: E.speedCost(r.speedLv), gain: base * 0.1 / (1 + 0.1 * r.speedLv), run: () => { r.speedLv++; ev('speed'); } });
  return c;
}
function buy() {
  for (let n = 0; n < 50; n++) {
    const c = candidates(); if (!c.length) return;
    c.sort((a, b) => b.gain / b.cost - a.gain / a.cost);
    const best = c[0];
    if (best.cost > r.money) return;
    r.money -= best.cost; best.run();
  }
}
const pending = () => E.chipGain(g.lifetime, g.chipsEver, E.chipBoost(g.shop.chipup));
/* cheapest-first shopping; tab 3 is paid in stars, the rest in chips */
function shop(cur, tabs) {
  for (let bought = true; bought;) { bought = false;
    const opts = E.SHOP.filter(s => tabs.includes(s.tab) && g.shop[s.id] < s.max).map(s => ({ s, cost: E.shopCost(s, g.shop[s.id]) })).sort((a, b) => a.cost - b.cost);
    if (opts[0] && opts[0].cost <= g[cur]) { g[cur] -= opts[0].cost; g.shop[opts[0].s.id]++; bought = true; ev('shop:' + opts[0].s.id); }
  }
}
function cashOut() {
  const gain = pending();
  runs.push({ dur: (g.t - r.t0) / 60, stage: r.stage, reach: r.reach, gain, chipsEver: g.chipsEver + gain, climb: g.climb });
  g.chips += gain; g.chipsEver += gain; g.chipsAll += gain; ev('cashout');
  shop('chips', [0, 1, 2]);
  startRun();
}
function vault() {
  const p = pending(); g.chipsAll += p;
  const sg = E.starGain(g.chipsAll, g.starsEver);
  runs.push({ dur: (g.t - r.t0) / 60, stage: r.stage, reach: r.reach, gain: p, chipsEver: g.chipsEver + p, climb: g.climb, vault: sg });
  g.vaults.push({ t: g.t, stars: sg, climbT: g.t - g.climbT0 }); ev('vault');
  g.stars += sg; g.starsEver += sg; g.chips = 0; g.chipsEver = 0; g.lifetime = 0;
  for (const s of E.SHOP) if (s.tab <= 1) g.shop[s.id] = 0;
  shop('stars', [3]);
  g.climb++; g.climbT0 = g.t; startRun();
}
startRun();
while (runs.length < RUNS && g.t < 40 * 3600) {
  const inc = income(); r.money += inc; r.stageEarned += inc; g.lifetime += inc; g.t++;
  while (r.stageEarned >= E.goal(r.stage)) { r.stageEarned -= E.goal(r.stage); r.stage++; r.reach[r.stage] = (g.t - r.t0) / 60; ev('stage'); }
  buy();
  const gain = pending(), runMin = (g.t - r.t0) / 60;
  if (r.stage >= E.VAULT_STAGE && g.reach40[g.climb] === undefined) g.reach40[g.climb] = g.t - g.climbT0;
  const sg = r.stage >= E.VAULT_STAGE ? E.starGain(g.chipsAll + gain, g.starsEver) : 0;
  /* VAULT once it at least doubles the star multiplier (first one: any star), or after 2h stuck; AUTO CASH holds while VAULT is open */
  if (sg >= 1) { if (sg >= 1 + g.starsEver || runMin > 120) vault(); }
  /* idle-style player: cash out once it at least doubles income (or after 2h stuck) */
  else if (r.stage >= E.PRESTIGE_STAGE && gain >= 1 && (E.chipMult(g.chipsEver + gain) >= 2 * E.chipMult(g.chipsEver) || runMin > 120)) cashOut();
}
const f = x => x === undefined ? '  -  ' : x.toFixed(1).padStart(5);
console.log('run | dur(min) | maxStage | chips+ | chipMult | reach stage 2..10 (min)');
runs.forEach((x, i) => console.log(`${i + 1}${x.climb ? '*' : ' '}  | ${f(x.dur)}    | ${String(x.stage).padStart(4)}     | ${String(x.gain).padStart(5)}  | ${E.chipMult(x.chipsEver).toFixed(1).padStart(5)}    | ${[2,3,4,5,6,7,8,9,10].map(s => f(x.reach[s])).join(' ')}`));
const v1 = g.vaults[0], E1 = events.filter(e => !v1 || e.t <= v1.t);
let gap = 0, gapAt = 0; for (let i = 1; i < E1.length; i++) { const d = (E1[i].t - E1[i - 1].t) / 60; if (d > gap) { gap = d; gapAt = E1[i - 1].t / 60; } }
console.log(`max gap between visible events: ${gap.toFixed(1)} min (at ${gapAt.toFixed(0)} min) · total ${(g.t / 3600).toFixed(1)} h · shop ${JSON.stringify(g.shop)}`);
if (VERBOSE) console.log(events.filter(e => e.name !== 'lv').map(e => `${(e.t / 60).toFixed(1)} ${e.name}`).join('\n'));
const avg = a => a.reduce((p, x) => p + x.dur, 0) / a.length;
g.vaults.forEach((v, i) => console.log(`VAULT ${i + 1} at ${(v.t / 3600).toFixed(1)} h (climb ${(v.climbT / 3600).toFixed(1)} h) +${v.stars} stars`));
console.log(`stage 40 reached after ${g.reach40.map(x => (x / 3600).toFixed(2) + ' h').join(', ')} of each climb`);
/* the original checks describe the first climb only (runs before the first VAULT) */
const R = runs.filter(x => !x.climb && !x.vault).slice(0, 30), after = runs.filter(x => x.climb === 1), checks = [
  ['run1 stage1 ~2min (1-3)', R[0] && R[0].reach[2] >= 1 && R[0].reach[2] <= 3],
  /* sim is a greedy always-on player (~1.5x faster than real idle play), so first CASH OUT 15-35 sim-min ~ 25-50 real-min */
  ['run1 first CASH OUT in 15-35 sim-min', R[0] && R[0].dur >= 15 && R[0].dur <= 35],
  ['run2 reaches stage 6 within 10min', R[1] && R[1].reach[6] <= 10],
  ['run2 ends at stage 7-8', R[1] && R[1].stage >= 7 && R[1].stage <= 8],
  ['runs 3-9 last 8-60 sim-min (BOOST tab not reached yet)', R.slice(2, 9).every(x => x.dur >= 8 && x.dur <= 60)],
  /* BOOST items land around run 10 and shorten runs for a while; they must not collapse, and must grow back */
  ['runs 10+ never collapse below 4 sim-min', R.slice(9).every(x => x.dur >= 4 && x.dur <= 60)],
  /* the first VAULT (~run 26) now ends the first climb, so compare against the BOOST dip instead of run 30 */
  ['first climb: runs grow back after the BOOST dip (last 3 >= 2x shortest)', avg(R.slice(-3)) >= 2 * Math.min(...R.slice(9).map(x => x.dur))],
  ['shop not maxed before run 6', (() => { const c = E.SHOP.filter(x => x.tab === 0).reduce((a, x) => a + x.cost.reduce((p, q) => p + q, 0), 0); return R.length < 5 || R[4].chipsEver < c; })()],
  ['runs 3+ beat previous max stage by 1-2 (0-3 allowed)', R.slice(2).every((x, i) => x.stage - R[i + 1].stage >= 0 && x.stage - R[i + 1].stage <= 3) && R.slice(2).some((x, i) => x.stage > R[i + 1].stage)],
  ['no visible-event gap > 15min', gap <= 15],
  ['first VAULT at 4-8 sim-h with 3-5 stars', v1 && v1.t >= 4 * 3600 && v1.t <= 8 * 3600 && v1.stars >= 3 && v1.stars <= 5],
  ['first CASH OUT after VAULT within 15 sim-min', after[0] && after[0].dur <= 15],
  ['second climb reaches stage 40 in <= 60% of the first', g.reach40[1] !== undefined && g.reach40[1] <= 0.6 * g.reach40[0]],
  [`completed ${RUNS} runs`, runs.length === RUNS],
];
let ok = true; for (const [n, p] of checks) { console.log((p ? 'PASS ' : 'FAIL ') + n); ok = ok && !!p; }
process.exitCode = ok ? 0 : 1;
