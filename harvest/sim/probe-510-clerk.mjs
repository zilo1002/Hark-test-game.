// v5.1.0 (A) regular salesperson: every level with processing machines splits its
// cashier — the original cashier keeps only the processed counter (PS), and a new
// regular salesperson (food_clerk / x_rc) covers the raw counter(s) (C1, C2).
// Run: node sim/probe-510-clerk.mjs  (exit 1 on any failure)
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';

let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`PASS ${name}`); };
const tile = (w, id) => w.tiles.find((t) => t.id === id);
const cashierTiles = (w) => w.tiles.filter((t) => t.effect.cashier && t.effect.cashier.length);
const isFood = (li) => !!CFG.levels[li].foodLines;
const countersOf = (w) => w.counters.map((c) => c.id);

// ---- Food levels (L54-67): food_clerk covers C1, original cashier covers PS only ----
check('food levels: every food level has food_clerk covering C1 only', () => {
  let count = 0;
  for (let li = 0; li < 67; li++) {
    if (!isFood(li)) continue;
    const w = new World(li, { quiet: true });
    const clerk = tile(w, 'food_clerk');
    assert.ok(clerk, `L${li + 1} missing food_clerk`);
    assert.equal(clerk.label, '普通售货员', `L${li + 1} clerk label`);
    assert.equal(clerk.icon, 'cashier', `L${li + 1} clerk icon`);
    assert.ok(clerk.price >= 80 && clerk.price <= 240, `L${li + 1} clerk price ${clerk.price} not in 80-240`);
    assert.deepEqual(clerk.effect.cashier, ['C1'], `L${li + 1} food_clerk cashier ${JSON.stringify(clerk.effect.cashier)}`);
    // req is the first machine unlock (or the starter tile)
    assert.ok((clerk.req || []).length >= 1, `L${li + 1} food_clerk needs a req`);
    // no counterUp may wait on food_clerk (it gets no cashier upgrade)
    assert.ok(!w.tiles.some((t) => t.effect.counterUp && (t.req || []).includes('food_clerk')), `L${li + 1} food_clerk must not have a counterUp`);
    // the original cashier keeps only PS
    const others = cashierTiles(w).filter((t) => t.id !== 'food_clerk');
    assert.equal(others.length, 1, `L${li + 1} should have exactly 1 other cashier, got ${others.map((t) => t.id)}`);
    assert.deepEqual(others[0].effect.cashier, ['PS'], `L${li + 1} original cashier should cover PS only, got ${JSON.stringify(others[0].effect.cashier)}`);
    count++;
  }
  assert.equal(count, 14, `food level count, got ${count}`);
});

// ---- Machine levels: x_rc covers raw counters, original cashier covers PS only ----
check('machine levels: every machine level has x_rc covering raw counters only', () => {
  let count = 0;
  for (let li = 0; li < 67; li++) {
    if (isFood(li)) continue;
    const w = new World(li, { quiet: true });
    if (!w.procs.length) continue; // pure field level — no machines, no split
    const rc = tile(w, 'x_rc');
    assert.ok(rc, `L${li + 1} missing x_rc`);
    assert.equal(rc.label, '普通售货员', `L${li + 1} x_rc label`);
    assert.equal(rc.icon, 'cashier', `L${li + 1} x_rc icon`);
    assert.ok(rc.price > 0 && rc.price % 10 === 0, `L${li + 1} x_rc price ${rc.price} should be a positive multiple of 10`);
    // x_rc covers exactly the raw counters (every counter except PS)
    const rawIds = countersOf(w).filter((id) => id !== 'PS');
    assert.deepEqual([...rc.effect.cashier].sort(), [...rawIds].sort(), `L${li + 1} x_rc cashier ${JSON.stringify(rc.effect.cashier)} vs raw ${JSON.stringify(rawIds)}`);
    // req is the first machine unlock
    const firstMachineTile = w.tiles.find((t) => t.effect.show?.includes(w.procs[0].id));
    assert.ok(firstMachineTile, `L${li + 1} no first machine tile`);
    assert.ok((rc.req || []).includes(firstMachineTile.id), `L${li + 1} x_rc req ${JSON.stringify(rc.req)} should include first machine tile ${firstMachineTile.id}`);
    // no counterUp may wait on x_rc
    assert.ok(!w.tiles.some((t) => t.effect.counterUp && (t.req || []).includes('x_rc')), `L${li + 1} x_rc must not have a counterUp`);
    assert.ok(!tile(w, 'x_cux_rc'), `L${li + 1} must not have x_cux_rc`);
    // the original cashier keeps only PS
    const others = cashierTiles(w).filter((t) => t.id !== 'x_rc' && t.id !== 'x_pc');
    assert.equal(others.length, 1, `L${li + 1} should have exactly 1 original cashier, got ${others.map((t) => t.id)}`);
    assert.deepEqual(others[0].effect.cashier, ['PS'], `L${li + 1} original cashier should cover PS only, got ${JSON.stringify(others[0].effect.cashier)}`);
    // its counterUp (if any) covers PS only
    const cu = w.tiles.find((t) => t.effect.counterUp && (t.req || []).includes(others[0].id));
    if (cu) assert.deepEqual(cu.effect.counterUp, ['PS'], `L${li + 1} original cashier counterUp should cover PS only`);
    count++;
  }
  assert.ok(count >= 20, `machine level count ${count} seems too low`);
  console.log(`  (machine levels with x_rc: ${count})`);
});

// ---- Save compatibility: an old save's bought cashier keeps PS, C1 waits for the clerk ----
check('old save (food): bought original cashier keeps PS, C1 uncovered until food_clerk', () => {
  const li = 53; // L54 晨光面包房
  const w = new World(li, { quiet: true });
  const orig = cashierTiles(w).find((t) => t.id !== 'food_clerk');
  assert.ok(orig, 'L54 original cashier tile');
  // Fake a v5.0.9 save: original cashier bought once; food_clerk ABSENT.
  w.restore({ li, t: 0, money: 0, stats: {}, tiles: [{ id: orig.id, paid: 0, bought: 1 }] });
  const ps = w.counters.find((c) => c.id === 'PS');
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(ps && ps.cashier, 'PS should have a cashier after restore');
  assert.ok(c1 && !c1.cashier, 'C1 should NOT have a cashier until food_clerk is bought');
  // Buying food_clerk covers C1 and sweeps its accumulated cash into the wallet.
  c1.cash = 500;
  const before = w.money;
  w.completeTile(tile(w, 'food_clerk'), true);
  assert.ok(c1.cashier, 'C1 should have a cashier after food_clerk is bought');
  assert.equal(c1.cash, 0, 'C1 cash should be swept on hire');
  assert.equal(w.money, before + 500, 'hiring the clerk should collect C1 cash');
});

check('old save (machine): bought original cashier keeps PS, C1 uncovered until x_rc', () => {
  const li = 25; // L26 木椅工坊
  const w = new World(li, { quiet: true });
  const orig = cashierTiles(w).find((t) => t.id !== 'x_rc' && t.id !== 'x_pc');
  assert.ok(orig, 'L26 original cashier tile');
  w.restore({ li, t: 0, money: 0, stats: {}, tiles: [{ id: orig.id, paid: 0, bought: 1 }] });
  const ps = w.counters.find((c) => c.id === 'PS');
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(ps && ps.cashier, 'PS should have a cashier after restore');
  assert.ok(c1 && !c1.cashier, 'C1 should NOT have a cashier until x_rc is bought');
  c1.cash = 300;
  const before = w.money;
  w.completeTile(tile(w, 'x_rc'), true);
  assert.ok(c1.cashier, 'C1 should have a cashier after x_rc is bought');
  assert.equal(c1.cash, 0, 'C1 cash should be swept on hire');
  assert.equal(w.money, before + 300, 'hiring the clerk should collect C1 cash');
});

console.log(`ALL CLERK CHECKS PASS (${n} checks)`);
