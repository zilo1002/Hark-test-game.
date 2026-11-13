// v5.1.5 no-machine levels: farm workers heap harvest onto the wooden stand.
// Jin (2026-11-13): 没有机器加工的关卡，农工收割也要放在木台上 (要不然后面就没法玩了).
// The raw board JOINS the counter in the harvest workers' `to` (dual-target,
// sales.js addRawStands), instead of replacing it. The deliver logic already
// prefers a low counter (x0.004 below rawLow), so the counter stays topped up
// and the worker fills the board the rest of the time; when the board cannot
// take the whole load it is blocked (all-or-nothing) and the worker falls back
// to the counter — no freeze, because the counter is always an alternative sink.
// This is NOT the v4.9.7 reroute (carriers to the board ONLY, which starved the
// counter: L47 +3:48, L49 +3:16, the bot shuttled). No partial-drop (tried and
// reverted: L53 3★->2★, L27/L32 fit waits over 3.0s).
// Checks:
//   1. tile structure: in every no-machine level (no procs, not food), every
//      harvest worker tile (from field/coop, to a counter) now also lists the
//      raw stand of what it carries in `to`; porters (from a tray/stand) and
//      workers already bound for a stand are untouched. Machine levels and
//      food levels are untouched by addRawStands.
//   2. end-to-end L1 (buyAll, 120 s): the harvest worker actually delivers to
//      BOTH the stand (R_wheat drops > 0) and the counter (C1 drops > 0); C1
//      holds stock a healthy fraction of the time (counter not starved); the
//      level earns money.
//   3. end-to-end L2 (same, different crop) to confirm it is not L1-only.
//   4. no freeze: workers keep making trips (total drops grow); no worker sits
//      in 'deliver' holding a full load for the whole run.
//   5. old save: a v5.1.4 save that bought a harvest worker restores without
//      error, and the restored worker has the stand in its `to`.
// Run: node sim/probe-515-no-machine-stands.mjs  (exit 1 on any failure)
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';

let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`PASS ${name}`); };
const tile = (w, id) => w.tiles.find((t) => t.id === id);
const isFood = (li) => !!CFG.levels[li].foodLines;
const isNoMachine = (w) => w.procs.length === 0 && !isFood(w.li);

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
const sourceItem = (w, id) => {
  const o = w.objs[id];
  if (!o) return null;
  return o.type === 'field' ? o.crop : o.type === 'coop' ? o.item : null;
};

// ---- 1. tile structure: no-machine harvest workers gain the stand in `to` ----
check('no-machine levels: harvest worker tiles gain the raw stand in `to`', () => {
  let levels = 0, workers = 0, untouchedPorters = 0;
  for (let li = 0; li < 67; li++) {
    if (isFood(li)) continue;
    const w = new World(li, { quiet: true });
    if (!isNoMachine(w)) continue;
    levels++;
    for (const t of w.tiles) {
      const wk = t.effect && t.effect.worker;
      if (!wk || !wk.from || !wk.to) continue;
      const fromObjs = wk.from.map((id) => w.objs[id]).filter(Boolean);
      const fromField = fromObjs.some((o) => o.type === 'field' || o.type === 'coop');
      const toCounter = wk.to.some((id) => { const o = w.objs[id]; return o && o.type === 'counter'; });
      if (!fromField || !toCounter) { untouchedPorters++; continue; }
      // harvest worker: every item it carries must have its raw stand in `to`
      const items = [...new Set(fromObjs.filter((o) => o.type === 'field' || o.type === 'coop').map((o) => sourceItem(w, o.id)))];
      for (const it of items) {
        const stand = Object.values(w.objs).find((o) => o.type === 'stand' && o.role === 'raw' && o.item === it);
        assert.ok(stand, `L${li + 1} tile ${t.id}: no raw stand for ${it}`);
        assert.ok(wk.to.includes(stand.id), `L${li + 1} tile ${t.id}: worker to ${JSON.stringify(wk.to)} must include raw stand ${stand.id} for ${it}`);
      }
      workers++;
    }
  }
  assert.ok(levels >= 10, `no-machine level count ${levels} seems too low`);
  assert.ok(workers >= 10, `harvest worker tile count ${workers} seems too low`);
  console.log(`  (no-machine levels: ${levels}, harvest worker tiles with stand in to: ${workers}, untouched non-harvest worker tiles: ${untouchedPorters})`);
});

// ---- 1b. machine + food levels untouched ----
check('machine and food levels: worker tiles unchanged by addRawStands', () => {
  let machineFarmhands = 0, foodClerks = 0;
  for (let li = 0; li < 67; li++) {
    if (isFood(li)) {
      const w = new World(li, { quiet: true });
      const clerk = tile(w, 'food_clerk');
      if (clerk && clerk.effect.worker) {
        assert.deepEqual(clerk.effect.worker.to, ['C1'], `L${li + 1} food_clerk to must stay [C1]`);
        foodClerks++;
      }
      continue;
    }
    const w = new World(li, { quiet: true });
    if (!w.procs.length) continue;
    for (const t of w.tiles) {
      const wk = t.effect && t.effect.worker;
      if (!wk || !wk.standCarrier) continue;
      // a machine-level farmhand goes field -> raw board ONLY (no counter)
      assert.ok(!wk.to.some((id) => { const o = w.objs[id]; return o && o.type === 'counter'; }), `L${li + 1} tile ${t.id}: machine farmhand must not gain a counter in to`);
      machineFarmhands++;
    }
  }
  assert.ok(machineFarmhands >= 10, `machine farmhand count ${machineFarmhands} seems too low`);
  assert.ok(foodClerks >= 10, `food clerk count ${foodClerks} seems too low`);
  console.log(`  (machine farmhands checked: ${machineFarmhands}, food clerks checked: ${foodClerks})`);
});

// ---- 2/3. end-to-end: the worker really uses BOTH sinks ----
function dualRun(li, label) {
  const w = new World(li, { quiet: true, seed: 7 });
  buyAll(w);
  const harvesters = w.workers.filter((x) => !x.feedFor && !x.porter && !x.clerk && x.from.length > 0 && x.from.some((id) => { const o = w.objs[id]; return o && (o.kind === 'field' || o.kind === 'coop'); }));
  assert.ok(harvesters.length > 0, `${label}: no harvest worker after buyAll`);
  const c1 = w.counters.find((c) => c.id === 'C1');
  assert.ok(c1, `${label}: C1`);
  const stands = Object.values(w.objs).filter((o) => o.kind === 'stand' && o.role === 'raw');
  assert.ok(stands.length > 0, `${label}: no raw stand`);
  const standIds = new Set(stands.map((s) => s.id));
  let stocked = 0, samples = 0, maxStand = 0;
  let trips0 = 0;
  for (let i = 0; i < 120 * 30; i++) {
    w.update(1 / 30, 0, 0);
    for (const s of stands) maxStand = Math.max(maxStand, s.pile ? s.pile.total : 0);
    if (i >= 30 * 30 && i % 30 === 0) { samples++; if (c1.stock.length > 0) stocked++; }
  }
  let toStand = 0, toCounter = 0, trips = 0;
  for (const h of harvesters) {
    for (const [d, v] of Object.entries(h.drops || {})) {
      if (standIds.has(d)) toStand += v;
      else if (d === 'C1' || w.counters.some((c) => c.id === d)) toCounter += v;
    }
    trips += h.trips || 0;
  }
  trips0 = trips;
  const stockedFrac = samples ? stocked / samples : 0;
  return { toStand, toCounter, trips: trips0, stockedFrac, maxStand, earned: w.stats.earned || 0, harvesters: harvesters.length };
}

check('end-to-end L1: harvest worker delivers to BOTH stand and counter, counter not starved', () => {
  const r = dualRun(0, 'L1');
  console.log(`  (L1: toStand=${r.toStand} toCounter=${r.toCounter} trips=${r.trips} stockedFrac=${r.stockedFrac.toFixed(2)} maxStand=${r.maxStand} earned=${r.earned} harvesters=${r.harvesters})`);
  assert.ok(r.toStand > 0, `L1 harvest worker never delivered to the stand (toStand=${r.toStand})`);
  assert.ok(r.toCounter > 0, `L1 harvest worker never delivered to the counter (toCounter=${r.toCounter})`);
  assert.ok(r.trips > 0, `L1 harvest worker made no trips`);
  assert.ok(r.maxStand > 0, `L1 raw stand never held any goods (maxStand=${r.maxStand})`);
  assert.ok(r.stockedFrac >= 0.30, `L1 C1 held stock in only ${Math.round(r.stockedFrac * 100)}% of samples after warmup (counter starved)`);
  assert.ok(r.earned > 0, `L1 earned nothing`);
});

check('end-to-end L2: same dual-sink behaviour, different crop', () => {
  const r = dualRun(1, 'L2');
  console.log(`  (L2: toStand=${r.toStand} toCounter=${r.toCounter} trips=${r.trips} stockedFrac=${r.stockedFrac.toFixed(2)} maxStand=${r.maxStand} earned=${r.earned} harvesters=${r.harvesters})`);
  assert.ok(r.toStand > 0, `L2 harvest worker never delivered to the stand`);
  assert.ok(r.toCounter > 0, `L2 harvest worker never delivered to the counter`);
  assert.ok(r.trips > 0, `L2 harvest worker made no trips`);
  assert.ok(r.stockedFrac >= 0.30, `L2 C1 held stock in only ${Math.round(r.stockedFrac * 100)}% of samples after warmup`);
  assert.ok(r.earned > 0, `L2 earned nothing`);
});

// ---- 4. no freeze: no worker sits in deliver holding a load at the end ----
check('no freeze: no harvest worker stuck holding a full load', () => {
  for (const li of [0, 1, 4, 6]) {
    const w = new World(li, { quiet: true, seed: 7 });
    buyAll(w);
    for (let i = 0; i < 120 * 30; i++) w.update(1 / 30, 0, 0);
    for (const h of w.workers) {
      if (h.feedFor || h.porter || h.clerk) continue;
      // a worker that finished its run empty-handed is fine; one still
      // holding a full load in deliver after 120 s of play is frozen.
      if (h.state === 'deliver' && h.stack.length >= h.cap && h.trips === 0) {
        assert.fail(`L${li + 1} worker stuck in deliver holding ${h.stack.length}/${h.cap} with 0 trips`);
      }
    }
  }
});

// ---- 5. old save: bought harvest worker restores with the stand in `to` ----
check('old save: bought harvest worker restores with the stand in `to`', () => {
  const w = new World(0, { quiet: true }); // L1
  // v5.1.4 save: worker tile 'b' bought (from F1/F2, to C1)
  w.restore({ li: 0, t: 0, money: 0, stats: {}, tiles: [{ id: 'b', paid: 0, bought: 1 }] });
  const workers = w.workers.filter((x) => !x.feedFor && !x.porter && !x.clerk);
  assert.ok(workers.length > 0, 'L1 restored worker tile b should create a harvest worker');
  const h = workers[0];
  assert.ok(h.to.includes('R_wheat'), `L1 restored worker to ${JSON.stringify(h.to)} must include R_wheat`);
  assert.ok(h.to.includes('C1'), `L1 restored worker to ${JSON.stringify(h.to)} must keep C1`);
  // and it still works: run a little, it should make a trip
  for (let i = 0; i < 60 * 30; i++) w.update(1 / 30, 0, 0);
  assert.ok((h.trips || 0) > 0 || Object.keys(h.drops || {}).length > 0, 'L1 restored worker made no delivery');
});

console.log(`\nALL NO-MACHINE-STAND CHECKS PASS (${n} checks)`);
