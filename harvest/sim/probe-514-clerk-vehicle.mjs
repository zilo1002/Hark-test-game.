// v5.1.4 售货员换车、一次拿满 — Jin 反馈二 (2026-11-13 22:00):
// "那个普通的理货员，他会在那待很久 不动地方 我的目的就是说东西一次性拿满
// 一次性放在普通柜台上 第2次也拿满 而且工人换货车的时候 那种理货员，
// 他也需要换货车".
// So the food-level salesperson (food_clerk, Jin calls it "普通的理货员") now:
//   - takes a FULL load at once (fullBatch) and drops it all on C1 at once,
//     second trip also a full load — no more partial dribbles (v5.1.2);
//   - rides a loader like other workers when the loader upgrade is bought
//     (big shovel loader, same as harvest workers — it has no feedFor, so the
//     existing rule gives it 'big'). Its carrying capacity stays fixed at base
//     50 in refreshStats (same rule as the v5.1.1 chain specialist): the loader
//     gives it speed + the truck look, but the cap never grows, so every batch
//     stays fillable from a deep raw stand and it never hoards stand stock the
//     machine feeders need (v5.1.2's fit warning: L13/L22/L51/L52 PS front wait
//     +0.4-0.5s when a clerk hoarded 180).
// Machine levels keep x_rc cashier-ONLY (no carrying, no loader): carrying from
// the stands was tried in v5.1.2 and REVERTED — the clerk and the machine
// feeders share the single raw stand (L13 R_tomato, L51 R_rose) and the clerk
// taking from it starved the feeders (fit 35/37). A cashier-only clerk has no
// load to carry, so a truck would be useless there.
// Checks:
//   1. tile structure: every food level's food_clerk has a worker effect with
//      fullBatch (from = raw stands only, to = [C1], raw, clerk, fullBatch);
//      every machine level's x_rc is cashier-only (no worker effect).
//   2. vehicle: after the loader upgrade, the food clerk rides a big loader
//      (loader true, loaderKind 'big'), its cap stays at base 50 (not 150/180),
//      and its speed is loader speed (faster than on-foot 92). A clerk hired
//      AFTER the upgrade also rides a loader.
//   3. end-to-end food L54 (buyAll, 120 s): every delivery batch the clerk
//      makes is a full load (== cap), delivered to C1 only, raw items only,
//      counter never overfills; a second trip also fills up.
//   4. machine L26: x_rc creates no worker (cashier-only), no loader.
//   5. old save: a v5.1.2/v5.1.3 save that bought food_clerk restores with a
//      fullBatch carrying worker that rides a loader when the upgrade was
//      bought; a bought x_rc restores cashier-only.
// Run: node sim/probe-514-clerk-vehicle.mjs  (exit 1 on any failure)
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
// The loader upgrade tile ('园丁换铲车', effect upgradeWorkers 'loader').
function buyLoaderUpgrade(w) {
  const t = w.tiles.find((x) => x.effect && x.effect.upgradeWorkers === 'loader');
  if (!t) return false;
  buyTile(w, t.id);
  return true;
}

// ---- 1. tile structure: food levels ----
check('food levels: food_clerk has fullBatch (raw stands -> C1, cashier kept)', () => {
  let count = 0;
  for (let li = 0; li < 67; li++) {
    if (!isFood(li)) continue;
    const w = new World(li, { quiet: true });
    const clerk = tile(w, 'food_clerk');
    assert.ok(clerk, `L${li + 1} missing food_clerk`);
    assert.equal(clerk.label, '普通售货员', `L${li + 1} label`);
    assert.deepEqual(clerk.effect.cashier, ['C1'], `L${li + 1} cashier`);
    const wk = clerk.effect.worker;
    assert.ok(wk, `L${li + 1} food_clerk needs a worker effect`);
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
    assert.ok(wk.clerk, `L${li + 1} clerk worker must be flagged clerk`);
    assert.ok(!wk.tally, `L${li + 1} clerk worker must NOT be tally (that flag means the PS tally clerk)`);
    assert.ok(wk.fullBatch, `L${li + 1} clerk must be fullBatch (v5.1.4: one full load at a time)`);
    assert.ok(!wk.feeder, `L${li + 1} clerk must NOT be a machine feeder`);
    count++;
  }
  assert.equal(count, 14, `food level count, got ${count}`);
});

// ---- 1b. tile structure: machine levels: x_rc is cashier ONLY ----
check('machine levels: x_rc is cashier only (no carrying, no loader)', () => {
  let count = 0;
  for (let li = 0; li < 67; li++) {
    if (isFood(li)) continue;
    const w = new World(li, { quiet: true });
    if (!w.procs.length) continue;
    const rc = tile(w, 'x_rc');
    assert.ok(rc, `L${li + 1} missing x_rc`);
    assert.equal(rc.label, '普通售货员', `L${li + 1} label`);
    assert.ok(!rc.effect.worker, `L${li + 1} x_rc must NOT carry (machine levels stock C1 from the fields already)`);
    count++;
  }
  assert.ok(count >= 20, `machine level count ${count} seems too low`);
  console.log(`  (machine levels with cashier-only x_rc: ${count})`);
});

// ---- 2. vehicle: clerk rides a big loader, cap stays 50, speed is loader speed ----
check('vehicle: clerk rides a big loader after upgrade, cap stays base 50', () => {
  // L54 has a loader upgrade tile; use it as the representative food level.
  const w = new World(53, { quiet: true, seed: 7 });
  buyAll(w);
  const clerk = clerkOf(w);
  assert.ok(clerk, 'L54 clerk worker should exist after buyAll');
  assert.ok(clerk.fullBatch, 'L54 clerk must be fullBatch');
  // buyAll bought the loader upgrade if the level has one; if L54 has none,
  // buy it explicitly — either way the clerk must end up on a loader.
  if (!w.loaders) {
    const ok = buyLoaderUpgrade(w);
    assert.ok(ok, 'L54 should have a loader upgrade tile to buy');
  }
  assert.ok(w.loaders, 'L54 loader upgrade should be bought by now');
  assert.equal(clerk.loader, true, 'L54 clerk must ride a loader after the upgrade');
  assert.equal(clerk.loaderKind, 'big', `L54 clerk loaderKind must be 'big' (no feedFor, like harvest workers), got ${clerk.loaderKind}`);
  // Capacity stays at base 50 (+ roster wcap), never the loader's 150/180 —
  // otherwise it would hoard stand stock and wait forever for a huge batch.
  assert.ok(clerk.cap <= CFG.worker.cap + 10, `L54 clerk cap ${clerk.cap} must stay at base ${CFG.worker.cap} (not a loader load)`);
  // Speed is loader speed: base worker is 92, a big loader is 122.
  assert.ok(clerk.speed > CFG.worker.speed, `L54 clerk speed ${clerk.speed} must beat on-foot ${CFG.worker.speed} (loader speed)`);
  console.log(`  (clerk cap ${clerk.cap}, speed ${clerk.speed.toFixed(1)}, loaderKind ${clerk.loaderKind})`);
});

check('vehicle: a clerk hired AFTER the loader upgrade also rides a loader', () => {
  const w = new World(53, { quiet: true, seed: 7 });
  // Buy the loader upgrade FIRST, then hire the clerk.
  const ok = buyLoaderUpgrade(w);
  assert.ok(ok, 'L54 should have a loader upgrade tile');
  assert.ok(w.loaders, 'loader upgrade should be active');
  buyTile(w, 'food_clerk');
  const clerk = clerkOf(w);
  assert.ok(clerk, 'L54 clerk hired after upgrade should exist');
  assert.equal(clerk.loader, true, 'clerk hired after the upgrade must also ride a loader');
  assert.equal(clerk.loaderKind, 'big', `clerk hired after upgrade loaderKind must be 'big', got ${clerk.loaderKind}`);
  assert.ok(clerk.cap <= CFG.worker.cap + 10, `clerk hired after upgrade cap ${clerk.cap} must stay at base ${CFG.worker.cap}`);
});

// ---- 3. end-to-end: every delivery batch is a full load ----
// Track each collect -> deliver transition: the stack size at that moment is
// the batch size. With fullBatch every batch must equal the clerk's cap.
function carryRun(li, label) {
  const w = new World(li, { quiet: true, seed: 7 });
  buyAll(w);
  const clerk = clerkOf(w);
  assert.ok(clerk, `${label}: clerk worker should exist after buyAll`);
  assert.ok(clerk.fullBatch, `${label}: clerk must be fullBatch`);
  const rawIds = rawCountersOf(w).map((c) => c.id);
  const rawItems = new Set(rawCountersOf(w).flatMap((c) => c.items));
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(c1, `${label}: C1`);
  const batches = [];
  let prevState = clerk.state, badItem = null, badDest = null, maxRaw = 0;
  let stockedSamples = 0, samples = 0;
  for (let i = 0; i < 150 * 30; i++) {
    w.update(1 / 30, 0, 0);
    // collect -> deliver transition: record the batch size. The worker flips
    // to 'deliver' when stack + incoming >= cap (world.js space <= 0), so the
    // true batch is stack.length + incoming — stack alone can read short
    // (e.g. 41 + 9 in flight = 50) because the in-flight items land after
    // the flip. A fullBatch worker only flips on a full load.
    if (prevState === 'collect' && clerk.state === 'deliver' && (clerk.stack.length + (clerk.incoming || 0)) > 0) batches.push(clerk.stack.length + (clerk.incoming || 0));
    prevState = clerk.state;
    if (clerk.stack.length) {
      for (const it of clerk.stack) if (!rawItems.has(it) && !badItem) badItem = it;
    }
    for (const d of Object.keys(clerk.drops || {})) if (!rawIds.includes(d) && !badDest) badDest = d;
    maxRaw = Math.max(maxRaw, w.rawStock(c1));
    if (i >= 30 * 30 && i % 30 === 0) { samples++; if (c1.stock.length > 0) stockedSamples++; }
  }
  const delivered = (clerk.drops && (clerk.drops.C1 || 0)) || 0;
  const stockedFrac = samples ? stockedSamples / samples : 0;
  return { clerk, batches, delivered, maxRaw, badItem, badDest, stockedFrac };
}

check('end-to-end food L54: every clerk batch is a full load, to C1 only', () => {
  const r = carryRun(53, 'L54');
  assert.ok(r.batches.length >= 2, `L54 clerk made only ${r.batches.length} delivery trips in 150s, expected >= 2 (second trip must also fill up)`);
  for (const [i, b] of r.batches.entries()) {
    assert.equal(b, r.clerk.cap, `L54 clerk batch #${i + 1} was ${b} items, expected a full load of ${r.clerk.cap} (Jin: 一次拿满)`);
  }
  assert.ok(r.delivered > 0, `L54 clerk delivered ${r.delivered} to C1, expected > 0`);
  assert.equal(r.badItem, null, `L54 clerk carried a non-raw item: ${r.badItem}`);
  assert.equal(r.badDest, null, `L54 clerk delivered to a non-raw counter: ${r.badDest}`);
  assert.ok(r.maxRaw <= CFG.v46.rawFull + 4, `L54 C1 rawStock peaked at ${r.maxRaw}, over rawFull+4=${CFG.v46.rawFull + 4}`);
  assert.ok(r.stockedFrac >= 0.30, `L54 C1 held stock in only ${Math.round(r.stockedFrac * 100)}% of samples after warmup`);
  console.log(`  (L54 clerk batches: ${r.batches.join(', ')} — cap ${r.clerk.cap}, delivered ${r.delivered})`);
});

// ---- 4. machine L26: x_rc creates no worker, no loader ----
check('machine L26: x_rc is cashier-only, creates no worker and no loader', () => {
  const w = new World(25, { quiet: true, seed: 7 });
  buyAll(w);
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(c1 && c1.cashier, 'L26 C1 should have a cashier after buyAll');
  assert.ok(!clerkOf(w), 'L26 must have no clerk worker (x_rc is cashier-only in machine levels)');
});

// ---- 5. old save: bought clerk restores with loader + fullBatch ----
check('old save (food): bought food_clerk restores with a loader + fullBatch worker', () => {
  const w = new World(53, { quiet: true });
  // A v5.1.2/v5.1.3 save: clerk bought, loader upgrade bought. Restore must
  // give the clerk a loader (it was on foot before) and fullBatch.
  w.restore({ li: 53, t: 0, money: 0, stats: {}, tiles: [{ id: 'food_clerk', paid: 0, bought: 1 }] });
  // Simulate the loader upgrade having been bought in the old save: the
  // upgrade tile itself is restored the same way — buy it now to mirror that.
  buyLoaderUpgrade(w);
  const clerk = clerkOf(w);
  assert.ok(clerk, 'L54 restored food_clerk should have a carrying worker');
  assert.ok(clerk.fullBatch, 'restored clerk must be fullBatch');
  assert.equal(clerk.loader, true, 'restored clerk must ride a loader once the upgrade is active');
  assert.ok(clerk.cap <= CFG.worker.cap + 10, `restored clerk cap ${clerk.cap} must stay at base ${CFG.worker.cap}`);
});

check('old save (machine): bought x_rc restores cashier-only, no worker', () => {
  const w = new World(25, { quiet: true });
  w.restore({ li: 25, t: 0, money: 0, stats: {}, tiles: [{ id: 'x_rc', paid: 0, bought: 1 }] });
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(c1 && c1.cashier, 'L26 C1 should have a cashier after restore');
  assert.ok(!clerkOf(w), 'L26 restored x_rc must NOT create a carrying worker (cashier-only in machine levels)');
});

console.log(`ALL CLERK-VEHICLE CHECKS PASS (${n} checks)`);
