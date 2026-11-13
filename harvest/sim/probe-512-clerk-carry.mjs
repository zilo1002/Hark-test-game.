// v5.1.2 (A补) regular salesperson carries raw goods — in FOOD levels only.
// The food_clerk keeps its cashier job AND gains a raw-carrying job, from the
// raw wooden stands (R_<item>) to C1. In food levels nobody stocked C1 except
// the player; now the clerk does it. The clerk is a plain raw carrier (raw:
// true, no feeder/porter/fullBatch/tally): it carries NO `tally` flag, because
// the sim checks use `tally` to mean the processed-goods tally clerk
// (delivers to PS only). Machine levels keep x_rc cashier-ONLY: they already
// stock C1 from the fields (raw carriers), and carrying from the stands was
// tried and REVERTED — the clerk and the machine feeders share the single
// raw stand (L13 R_tomato, L51 R_rose) and the clerk taking from it starved
// the feeders and slowed PS front wait +0.4s (fit 35/37).
// Checks:
//   1. tile structure: every food level's food_clerk has a worker effect
//      (from = raw stands only, to = [C1], raw, no tally/fullBatch/feeder),
//      price/req/label unchanged; every machine level's x_rc is cashier-only
//      (no worker effect).
//   2. end-to-end food L54 (buyAll, 120 s): the clerk actually delivers raw
//      goods to C1 (its own drops map), only raw items, only to C1, and the
//      counter never overfills (rawStock <= rawFull + 4).
//   3. cashier still works (C1 cash auto-deposits on hire).
//   4. old save: a v5.1.1 save that bought the clerk restores without error;
//      food_clerk gains the carrying worker, x_rc stays cashier-only.
// Run: node sim/probe-512-clerk-carry.mjs  (exit 1 on any failure)
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';

let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`PASS ${name}`); };
const tile = (w, id) => w.tiles.find((t) => t.id === id);
const isFood = (li) => !!CFG.levels[li].foodLines;
const rawCountersOf = (w) => w.counters.filter((c) => c.id !== 'PS');
// The clerk is the only raw carrier whose sources are all wooden stands
// (raw carriers take from fields/coops, farmhands take from fields, the tally
// clerk is not a raw carrier, feeders have feedFor).
const clerkOf = (w) => w.workers.find((x) => x.rawCarrier && !x.feedFor && !x.porter && x.from.length > 0 && x.from.every((id) => w.objs[id] && w.objs[id].kind === 'stand'));

function buyTile(w, id, bought = new Set()) {
  const t = w.tiles.find((x) => x.id === id);
  if (!t || t.done || bought.has(id)) return;
  bought.add(id);
  for (const r of (t.req || [])) buyTile(w, r, bought);
  w.updateTileVis(true);
  const t2 = w.tiles.find((x) => x.id === id);
  if (t2 && !t2.done) w.completeTile(t2, true);
}
function buyAll(w) {
  let changed = true, loops = 0;
  while (changed && loops++ < 300) {
    changed = false;
    for (const t of w.tiles) if (t.visible && !t.done) { w.completeTile(t, true); changed = true; }
  }
}

// ---- 1. tile structure: food levels ----
check('food levels: food_clerk carries raw stands -> C1 (cashier kept)', () => {
  let count = 0;
  for (let li = 0; li < 67; li++) {
    if (!isFood(li)) continue;
    const w = new World(li, { quiet: true });
    const clerk = tile(w, 'food_clerk');
    assert.ok(clerk, `L${li + 1} missing food_clerk`);
    assert.equal(clerk.label, '普通售货员', `L${li + 1} label`);
    assert.equal(clerk.price, w.tiles.find((t) => t.id === 'food_tally')?.price, `L${li + 1} price must stay hirePrice`);
    assert.deepEqual(clerk.effect.cashier, ['C1'], `L${li + 1} cashier`);
    const wk = clerk.effect.worker;
    assert.ok(wk, `L${li + 1} food_clerk needs a worker effect`);
    // from: raw stands only, and only stands whose item C1 sells
    const c1 = w.counters.find((c) => c.id === 'C1');
    assert.ok(c1, `L${li + 1} no C1`);
    assert.ok(wk.from.length > 0, `L${li + 1} clerk from is empty`);
    for (const id of wk.from) {
      const o = w.objs[id];
      assert.ok(o && o.type === 'stand' && o.role === 'raw', `L${li + 1} clerk from ${id} must be a raw stand`);
      assert.ok(c1.items.includes(o.item), `L${li + 1} clerk from ${id} item ${o.item} must be sold at C1`);
    }
    assert.deepEqual(wk.to, ['C1'], `L${li + 1} clerk to must be [C1], got ${JSON.stringify(wk.to)}`);
    assert.ok(wk.raw, `L${li + 1} clerk worker must be raw`);
    assert.ok(wk.clerk, `L${li + 1} clerk worker must be flagged clerk (stays on foot, base cap)`);
    assert.ok(!wk.tally, `L${li + 1} clerk worker must NOT be tally (that flag means the PS tally clerk)`);
    assert.ok(!wk.fullBatch, `L${li + 1} clerk must NOT be fullBatch (delivers partial loads)`);
    assert.ok(!wk.feeder, `L${li + 1} clerk must NOT be a machine feeder`);
    count++;
  }
  assert.equal(count, 14, `food level count, got ${count}`);
});

// ---- 1b. tile structure: machine levels: x_rc is cashier ONLY ----
// Machine levels stock C1 from the fields already (raw carriers), so the
// clerk's job there is the cash. Carrying from the stands was tried and
// REVERTED (see header): it starved the machine feeders (fit 35/37).
check('machine levels: x_rc is cashier only (no carrying)', () => {
  let count = 0;
  for (let li = 0; li < 67; li++) {
    if (isFood(li)) continue;
    const w = new World(li, { quiet: true });
    if (!w.procs.length) continue;
    const rc = tile(w, 'x_rc');
    assert.ok(rc, `L${li + 1} missing x_rc`);
    assert.equal(rc.label, '普通售货员', `L${li + 1} label`);
    assert.ok(rc.price > 0 && rc.price % 10 === 0, `L${li + 1} price ${rc.price}`);
    const rawIds = rawCountersOf(w).map((c) => c.id);
    assert.deepEqual([...rc.effect.cashier].sort(), [...rawIds].sort(), `L${li + 1} cashier`);
    assert.ok(!rc.effect.worker, `L${li + 1} x_rc must NOT carry (machine levels stock C1 from the fields already)`);
    count++;
  }
  assert.ok(count >= 20, `machine level count ${count} seems too low`);
  console.log(`  (machine levels with cashier-only x_rc: ${count})`);
});

// ---- 2. end-to-end: the clerk really moves raw goods stand -> counter ----
function carryRun(li, label) {
  const w = new World(li, { quiet: true, seed: 7 });
  buyAll(w);
  const clerk = clerkOf(w);
  assert.ok(clerk, `${label}: clerk worker should exist after buyAll`);
  // v5.1.2 on-foot rule: the clerk never rides a loader (a 150/180 load would
  // hoard stand stock the feeders need) and its cap stays at base.
  assert.ok(clerk.clerk, `${label}: clerk worker must be flagged clerk`);
  assert.equal(clerk.loader, false, `${label}: clerk must stay on foot (no loader)`);
  assert.ok(clerk.cap < CFG.loader.cap, `${label}: clerk cap ${clerk.cap} must stay below a loader load (${CFG.loader.cap})`);
  const rawIds = rawCountersOf(w).map((c) => c.id);
  const rawItems = new Set(rawCountersOf(w).flatMap((c) => c.items));
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(c1, `${label}: C1`);
  let maxRaw = 0, sawCarry = false, badItem = null, badDest = null;
  let stockedSamples = 0, samples = 0;
  // 120 s of play; the player idles, staff do everything.
  for (let i = 0; i < 120 * 30; i++) {
    w.update(1 / 30, 0, 0);
    if (clerk.stack.length) {
      sawCarry = true;
      for (const it of clerk.stack) if (!rawItems.has(it) && !badItem) badItem = it;
    }
    for (const d of Object.keys(clerk.drops || {})) if (!rawIds.includes(d) && !badDest) badDest = d;
    maxRaw = Math.max(maxRaw, w.rawStock(c1));
    // after warmup, sample whether C1 holds stock (a single instant can
    // legitimately be empty right after a customer wave drains it).
    if (i >= 30 * 30 && i % 30 === 0) { samples++; if (c1.stock.length > 0) stockedSamples++; }
  }
  const delivered = (clerk.drops && (clerk.drops.C1 || 0)) || 0;
  const stockedFrac = samples ? stockedSamples / samples : 0;
  return { clerk, delivered, maxRaw, sawCarry, badItem, badDest, stockedFrac, sold: w.stats.sold || {} };
}

check('end-to-end food L54: clerk stocks C1 with raw goods only, never overfills', () => {
  const r = carryRun(53, 'L54');
  assert.ok(r.sawCarry, 'L54 clerk never carried anything');
  assert.ok(r.delivered > 0, `L54 clerk delivered ${r.delivered} to C1, expected > 0`);
  assert.equal(r.badItem, null, `L54 clerk carried a non-raw item: ${r.badItem}`);
  assert.equal(r.badDest, null, `L54 clerk delivered to a non-raw counter: ${r.badDest}`);
  assert.ok(r.maxRaw <= CFG.v46.rawFull + 4, `L54 C1 rawStock peaked at ${r.maxRaw}, over rawFull+4=${CFG.v46.rawFull + 4}`);
  // Threshold 0.30, not 0.50: the sim player idles, so the clerk alone must
  // outpace customer demand. Baseline (v5.1.1, no clerk carrying): L54 C1
  // stocked 0% (0/90), 0 raw goods sold. With the clerk: 36-41% across
  // seeds 1/2/3/7/11, 368 raw goods sold. 0.30 verifies the clerk
  // meaningfully stocks C1 (far above the 0% baseline) with margin below
  // the observed 0.36 minimum; in real play Jin also stocks C1, so the
  // real stocked fraction is higher.
  assert.ok(r.stockedFrac >= 0.30, `L54 C1 held stock in only ${Math.round(r.stockedFrac * 100)}% of samples after warmup`);
});

check('end-to-end machine L26: C1 stocked by raw carriers, x_rc creates no worker', () => {
  const w = new World(25, { quiet: true, seed: 7 });
  buyAll(w);
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(c1 && c1.cashier, 'L26 C1 should have a cashier after buyAll');
  assert.ok(!clerkOf(w), 'L26 must have no clerk worker (x_rc is cashier-only in machine levels)');
  let stocked = 0, samples = 0;
  for (let i = 0; i < 120 * 30; i++) {
    w.update(1 / 30, 0, 0);
    if (i >= 30 * 30 && i % 30 === 0) { samples++; if (c1.stock.length > 0) stocked++; }
  }
  assert.ok(stocked / samples >= 0.30, `L26 C1 held stock in only ${Math.round(stocked / samples * 100)}% of samples (raw carriers should stock it)`);
});

// ---- 3. cashier still works ----
check('cashier still works: hiring the clerk sweeps C1 cash + creates the carrier', () => {
  const w = new World(53, { quiet: true }); // L54
  const c1 = w.counters.find((c) => c.id === 'C1');
  c1.cash = 500;
  const before = w.money;
  buyTile(w, 'food_clerk');
  assert.ok(c1.cashier, 'L54 C1 should have a cashier after food_clerk');
  assert.equal(c1.cash, 0, 'C1 cash should be swept on hire');
  assert.equal(w.money, before + 500, 'hiring the clerk should collect C1 cash');
  assert.ok(clerkOf(w), 'the same hire should create the carrying worker');
});

// ---- 4. old save: bought clerk gains carrying, no error ----
check('old save (food): bought food_clerk restores with a carrying worker', () => {
  const w = new World(53, { quiet: true });
  w.restore({ li: 53, t: 0, money: 0, stats: {}, tiles: [{ id: 'food_clerk', paid: 0, bought: 1 }] });
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(c1 && c1.cashier, 'L54 C1 should have a cashier after restore');
  const clerk = clerkOf(w);
  assert.ok(clerk, 'L54 restored food_clerk should have a carrying worker');
  assert.deepEqual(clerk.to, ['C1'], 'restored clerk to');
  assert.ok(clerk.from.length > 0 && clerk.from.every((id) => w.objs[id] && w.objs[id].role === 'raw'), 'restored clerk from raw stands');
});

check('old save (machine): bought x_rc restores cashier-only, no worker', () => {
  const w = new World(25, { quiet: true });
  w.restore({ li: 25, t: 0, money: 0, stats: {}, tiles: [{ id: 'x_rc', paid: 0, bought: 1 }] });
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(c1 && c1.cashier, 'L26 C1 should have a cashier after restore');
  assert.ok(!clerkOf(w), 'L26 restored x_rc must NOT create a carrying worker (cashier-only in machine levels)');
});

console.log(`ALL CLERK-CARRY CHECKS PASS (${n} checks)`);
