import assert from 'node:assert/strict';
import { loadEcon } from './econ.mjs';
const E = loadEcon();
/* existing formulas preserved */
assert.equal(E.goal(1), 1e3); assert.equal(E.goal(10), 2.5e11 * 5);
assert.equal(E.coinCost(1, 1), 10); assert.equal(E.mergeCost(0, 1), 30);
assert.equal(E.coinCap(1, 0), 8); assert.equal(E.coinCap(20, 0), 30); assert.equal(E.coinCap(1, 11), 11);
/* on-screen speed cap */
assert.deepEqual(E.speedSplit(2), [2, 1]); assert.deepEqual(E.speedSplit(6), [3, 2]);
assert.equal(E.speedTotal(10, 5, true), 6);
/* chips: cube root of lifetime (8x lifetime to double), multiplier ignores spent chips */
assert.equal(E.chipsTotal(E.CHIP_K * 1000), 10); assert.equal(E.chipsTotal(E.CHIP_K * 8000), 20);
assert.equal(E.chipGain(E.CHIP_K * 1000, 4), 6); assert.equal(E.chipGain(E.CHIP_K * 1000, 99), 0);
assert.equal(E.chipMult(10), 1 + E.CHIP_BONUS * 10);
/* migration (Review Focus 1) */
const v1 = { v: 1, money: 5e6, stage: 4, stageEarned: 1e6, tiers: [0, 2, 3], pads: 5, t: 123 };
const m = E.migrate(v1);
assert.equal(m.v, 2); assert.equal(m.stage, 4); assert.equal(m.money, 5e6); assert.equal(m.pads, 5);
assert.deepEqual(m.tiers, [0, 2, 3]); assert.deepEqual(m.padLv, Array(12).fill(1));
assert.equal(m.lifetime, 1e3 + 2e4 + 4e5 + 1e6); assert.equal(m.chips, 0); assert.equal(m.ips, 0);
assert.equal(E.migrate(m), m); assert.equal(E.migrate(null), null); assert.equal(E.migrate({ v: 9 }), null);
/* big numbers (Review Focus 5) */
assert.equal(E.fmt(1500), '1.5K'); assert.match(E.fmt(1e40), /^1(\.0+)?E40$/); assert.equal(E.fmt(Infinity), 'MAX');
/* growth/convenience shop: COIN SLOT+ adds on top of the stage cap, BOUNCE+ is additive and endless */
assert.equal(E.coinCap(1, 0, 15), 23); assert.equal(E.coinCap(20, 0, 15), 45);
assert.equal(E.bounceMult(0), 1); assert.equal(E.bounceMult(4), 3);
const it = id => E.SHOP.find(x => x.id === id);
assert.equal(E.shopCost(it('speed'), 0), 5); assert.equal(E.shopCost(it('bounce'), 3), 4000);
assert.equal(it('bounce').max, Infinity); assert.equal(E.PAD_LV_MAX, E.TIERS.length);
for (const x of E.SHOP.filter(x => x.max !== Infinity)) assert.equal(x.cost.length, x.max, x.id);
assert.equal(E.AUTO_IV.length, it('acoin').max);
console.log('econ ok');
