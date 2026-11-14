// v5.1.8 售货员不等满批 — Jin 反馈 (2026-11-14 11:54, 附 67 关实拍):
// "普通理货员就拿一点有时候还等着 就不能像我一样一次性拿满吗？
// 中间可以等个两三秒 但是不能等半分钟啊".
// Root cause (confirmed in code + sim, see below): two waits, both from the
// clerk's fullBatch + 300 reserve (v5.1.2/v5.1.4):
//   (a) the clerk only STARTS picking from a stand with >= 300 items
//       (w.cap + 5x base cap). Some food lines run shallow (L67 pumpkin
//       hovers 0-230), so the clerk stands idle empty-handed waiting for a
//       stand that never reaches 300. Realistic-bot sim: empty-handed waits
//       of 7.7-10.9 s right after the clerk is hired.
//   (b) once it holds a partial load and the stand drops below the reserve,
//       best becomes null and the clerk waits FOREVER — fullBatch workers
//       are excluded from the collectWait -> deliver transition, so there is
//       no timeout at all. It holds a partial load and stands at the stand.
// Fix (world.js, clerk only — chain/machine specialists untouched):
//   (a) reserve 300 -> 100 (cap + 1x base cap). One batch still leaves a
//       full feeder load behind after the clerk takes its 50, so machine
//       feeders are not starved.
//   (b) wait cap: a fullBatch clerk holding a partial load with NO eligible
//       source delivers after 3 s (Jin: 等两三秒可以，不能等半分钟).
//       Full-batch-first, leave-on-timeout — while a source is available it
//       keeps filling up; the cap only fires when best is null.
// Checks:
//   1. tile structure: food_clerk still fullBatch (raw stands -> C1);
//      machine x_rc still cashier-only.
//   2. wait cap + reserve (the core test): L54, hire ONLY the clerk (no
//      farmhand, no feeder — no refill). Seed the raw stand with 120 items
//      (< old 300 reserve, >= new 100). The clerk must pick from it at all
//      (proves the reserve was lowered — old code never picks below 300)
//      and must deliver a partial load within a bounded time (proves the
//      3 s cap — old code waits forever with a partial load). Its longest
//      partial-load wait must be <= 4 s.
//   3. full batch still preferred: L54 buyAll, every clerk batch is a full
//      load (50) — the cap/reserve change must not turn it back into
//      partial dribbles.
//   4. machine L26: x_rc cashier-only, no clerk worker.
//   5. old save: bought food_clerk restores with a carrying clerk.
// Run: node sim/probe-518-clerk-wait.mjs  (exit 1 on any failure)
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';

let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`PASS ${name}`); };
const tile = (w, id) => w.tiles.find((t) => t.id === id);
const isFood = (li) => !!CFG.levels[li].foodLines;
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

// ---- 1. tile structure ----
check('food levels: food_clerk still fullBatch (raw stands -> C1)', () => {
  let count = 0;
  for (let li = 0; li < 67; li++) {
    if (!isFood(li)) continue;
    const w = new World(li, { quiet: true });
    const clerk = tile(w, 'food_clerk');
    assert.ok(clerk, `L${li + 1} missing food_clerk`);
    const wk = clerk.effect.worker;
    assert.ok(wk && wk.fullBatch && wk.clerk, `L${li + 1} food_clerk must be fullBatch + clerk`);
    assert.deepEqual(wk.to, ['C1'], `L${li + 1} clerk to must be [C1]`);
    count++;
  }
  assert.equal(count, 14, `food level count, got ${count}`);
});

check('machine levels: x_rc still cashier-only (no carrying)', () => {
  let count = 0;
  for (let li = 0; li < 67; li++) {
    if (isFood(li)) continue;
    const w = new World(li, { quiet: true });
    if (!w.procs.length) continue;
    const rc = tile(w, 'x_rc');
    assert.ok(rc, `L${li + 1} missing x_rc`);
    assert.ok(!rc.effect.worker, `L${li + 1} x_rc must NOT carry`);
    count++;
  }
  assert.ok(count >= 20, `machine level count ${count} seems too low`);
  console.log(`  (machine levels with cashier-only x_rc: ${count})`);
});

// ---- 2a. reserve lowered (300 -> 100): clerk picks from a shallow stand ----
// L54 has one raw stand (R_wheat). Hire ONLY the clerk (its req chain pulls
// in the first machine tile, which shows M1 — but no feeder and no farmhand
// are hired, so the stand gets no refill). Seed the stand with 120 items:
// below the OLD 300 reserve (old code would never pick from it at all) and
// above the NEW 100 reserve (new code picks from it). The clerk must deliver
// to C1 within a bounded time. (Note: once the clerk is standing at the stand
// it keeps picking from nearby pile cells even after the total drops below
// the reserve — the pickup loop only checks its sources, not best — so it
// may fill to a full 50 here. The partial-load case is check 2b.)
check('reserve lowered: clerk picks from a 120-item stand (old code never would)', () => {
  const w = new World(53, { quiet: true, seed: 7 }); // L54
  buyTile(w, 'food_clerk');
  const clerk = clerkOf(w);
  assert.ok(clerk, 'L54 clerk worker should exist after hiring food_clerk');
  assert.ok(clerk.fullBatch, 'L54 clerk must be fullBatch');
  assert.ok(clerk.clerk, 'L54 clerk must be flagged clerk');
  const stand = w.objs[clerk.from[0]];
  assert.ok(stand && stand.kind === 'stand', 'clerk source must be a raw stand');
  for (let k = 0; k < 120; k++) stand.pile.add(stand.x, stand.y, w.rnd);
  assert.ok(stand.pile.total >= 100 && stand.pile.total < 300, `seeded stand total ${stand.pile.total} must be in [100, 300)`);
  let delivered = 0, firstDeliverAt = -1;
  let prevState = clerk.state;
  for (let i = 0; i < 45 * 30; i++) {
    w.update(1 / 30, 0, 0);
    if (prevState === 'collect' && clerk.state === 'deliver' && firstDeliverAt < 0) firstDeliverAt = w.t;
    prevState = clerk.state;
    delivered = (clerk.drops && (clerk.drops.C1 || 0)) || 0;
    if (delivered > 0) break;
  }
  assert.ok(delivered > 0, `L54 clerk delivered ${delivered} to C1 in 45 s — old code never delivers from a 120 stand (below the 300 reserve)`);
  assert.ok(firstDeliverAt < 20, `L54 first delivery took ${firstDeliverAt.toFixed(1)} s, expected < 20 s`);
  console.log(`  (clerk picked from a 120-item stand and delivered ${delivered} to C1 at ${firstDeliverAt.toFixed(1)} s)`);
});

// ---- 2b. wait cap (core): partial load + dry stand -> delivers in <= 3 s ----
// Same L54 setup, but once the clerk has started picking (a partial load),
// drain the stand completely — simulating the stand running dry mid-pickup
// (feeder drained it / farmhand is slow), which is exactly Jin's "拿一点
// 然后干等". The clerk now holds a partial load with NO eligible source.
// The 3 s cap must send it to C1 with that partial load; the old code has
// no cap at all and would wait forever (the stand never refills here).
check('wait cap: clerk with a partial load and a dry stand delivers within ~3 s', () => {
  const w = new World(53, { quiet: true, seed: 7 }); // L54
  buyTile(w, 'food_clerk');
  const clerk = clerkOf(w);
  assert.ok(clerk, 'L54 clerk worker should exist after hiring food_clerk');
  const stand = w.objs[clerk.from[0]];
  for (let k = 0; k < 120; k++) stand.pile.add(stand.x, stand.y, w.rnd);
  // Step until the clerk has a partial load in hand, then drain the stand.
  let drainAt = -1, partialAtDrain = 0;
  let maxPartialWait = 0, curPartialWait = 0;
  let deliverAt = -1, batchAtDeliver = 0;
  let prevState = clerk.state;
  for (let i = 0; i < 60 * 30; i++) {
    w.update(1 / 30, 0, 0);
    if (drainAt < 0 && clerk.state === 'collect' && clerk.stack.length > 0 && clerk.stack.length < clerk.cap) {
      // The clerk is mid-pickup with a partial load: the stand runs dry now.
      drainAt = w.t;
      partialAtDrain = clerk.stack.length + (clerk.incoming || 0);
      stand.pile.total = 0; stand.pile.pending = 0; stand.pile.hs.fill(0);
    }
    if (drainAt >= 0) {
      const partial = clerk.state === 'collect' && clerk.stack.length > 0 && clerk.stack.length < clerk.cap;
      if (partial && (clerk.wait || 0) > 0) {
        curPartialWait += 1 / 30;
        if (curPartialWait > maxPartialWait) maxPartialWait = curPartialWait;
      } else curPartialWait = 0;
      if (prevState === 'collect' && clerk.state === 'deliver' && deliverAt < 0) {
        deliverAt = w.t;
        batchAtDeliver = clerk.stack.length + (clerk.incoming || 0);
      }
    }
    prevState = clerk.state;
    const delivered = (clerk.drops && (clerk.drops.C1 || 0)) || 0;
    if (deliverAt >= 0 && delivered > 0) break;
    if (w.t > 45 && drainAt >= 0 && deliverAt < 0) break; // give up: old code never delivers
  }
  assert.ok(drainAt >= 0, 'clerk never picked up a partial load to drain the stand under');
  assert.ok(partialAtDrain > 0 && partialAtDrain < clerk.cap, `partial load at drain was ${partialAtDrain}, expected a partial load (< cap ${clerk.cap})`);
  assert.ok(deliverAt >= 0, `clerk never left 'collect' after the stand ran dry in 45 s — old code waits forever (no cap)`);
  const waitAfterDrain = deliverAt - drainAt;
  assert.ok(waitAfterDrain <= 4, `clerk waited ${waitAfterDrain.toFixed(1)} s after the stand ran dry, expected <= 4 s (3 s cap + frame margin) — Jin: 不能等半分钟`);
  assert.ok(batchAtDeliver > 0 && batchAtDeliver < clerk.cap, `delivered batch was ${batchAtDeliver}, expected the partial load (< cap ${clerk.cap})`);
  assert.ok(maxPartialWait <= 4, `longest partial-load wait was ${maxPartialWait.toFixed(1)} s, expected <= 4 s`);
  const delivered = (clerk.drops && (clerk.drops.C1 || 0)) || 0;
  assert.ok(delivered > 0, `clerk delivered ${delivered} to C1, expected the partial load`);
  console.log(`  (partial load ${partialAtDrain} at drain, delivered ${batchAtDeliver} after ${waitAfterDrain.toFixed(1)} s, longest partial wait ${maxPartialWait.toFixed(1)} s)`);
});

// ---- 3. full batch still preferred: L54 buyAll, every batch is full ----
check('full batch still preferred: L54 buyAll, every clerk batch is a full load', () => {
  const w = new World(53, { quiet: true, seed: 7 });
  buyAll(w);
  const clerk = clerkOf(w);
  assert.ok(clerk, 'L54 clerk worker should exist after buyAll');
  assert.ok(clerk.fullBatch, 'L54 clerk must be fullBatch');
  const batches = [];
  let prevState = clerk.state;
  for (let i = 0; i < 150 * 30; i++) {
    w.update(1 / 30, 0, 0);
    if (prevState === 'collect' && clerk.state === 'deliver' && (clerk.stack.length + (clerk.incoming || 0)) > 0) batches.push(clerk.stack.length + (clerk.incoming || 0));
    prevState = clerk.state;
  }
  assert.ok(batches.length >= 2, `L54 clerk made only ${batches.length} delivery trips in 150 s, expected >= 2`);
  for (const [i, b] of batches.entries()) {
    assert.equal(b, clerk.cap, `L54 clerk batch #${i + 1} was ${b} items, expected a full load of ${clerk.cap} (fullBatch must still hold when the stand is deep)`);
  }
  const delivered = (clerk.drops && (clerk.drops.C1 || 0)) || 0;
  assert.ok(delivered > 0, `L54 clerk delivered ${delivered} to C1, expected > 0`);
  console.log(`  (L54 clerk batches: ${batches.join(', ')} — cap ${clerk.cap}, delivered ${delivered})`);
});

// ---- 4. machine L26: x_rc cashier-only, no clerk worker ----
check('machine L26: x_rc is cashier-only, creates no worker', () => {
  const w = new World(25, { quiet: true, seed: 7 });
  buyAll(w);
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(c1 && c1.cashier, 'L26 C1 should have a cashier after buyAll');
  assert.ok(!clerkOf(w), 'L26 must have no clerk worker (x_rc is cashier-only in machine levels)');
});

// ---- 5. old save: bought food_clerk restores with a carrying clerk ----
check('old save (food): bought food_clerk restores with a carrying clerk', () => {
  const w = new World(53, { quiet: true });
  w.restore({ li: 53, t: 0, money: 0, stats: {}, tiles: [{ id: 'food_clerk', paid: 0, bought: 1 }] });
  const clerk = clerkOf(w);
  assert.ok(clerk, 'L54 restored food_clerk should have a carrying worker');
  assert.ok(clerk.fullBatch, 'restored clerk must be fullBatch');
  assert.ok(clerk.clerk, 'restored clerk must be flagged clerk');
  assert.ok(clerk.cap <= CFG.worker.cap + 10, `restored clerk cap ${clerk.cap} must stay at base ${CFG.worker.cap}`);
});

console.log(`ALL CLERK-WAIT CHECKS PASS (${n} checks)`);
