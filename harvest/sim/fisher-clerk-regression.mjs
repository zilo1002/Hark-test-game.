// Focused regressions for the latest fishing-boat and regular-salesperson feedback.
// Run: node harvest/sim/fisher-clerk-regression.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';
import { makeFishingBoat } from '../js/models.js';

let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
function buyTile(w, id, bought = new Set()) {
  const t = w.tiles.find((x) => x.id === id);
  if (!t || t.done || bought.has(id)) return;
  bought.add(id);
  for (const req of t.req || []) buyTile(w, req, bought);
  w.updateTileVis(true);
  const ready = w.tiles.find((x) => x.id === id);
  if (ready && !ready.done) w.completeTile(ready, true);
}
function buyAll(w) {
  let changed = true, loops = 0;
  while (changed && loops++ < 300) {
    changed = false;
    for (const t of w.tiles) if (t.visible && !t.done) { w.completeTile(t, true); changed = true; }
  }
}
const clerkOf = (w) => w.workers.find((x) => x.clerk);

check('fisherman stays a boat-based fisher through the loader upgrade (L44)', () => {
  const w = new World(43, { quiet: true, seed: 47 });
  buyAll(w);
  const fishers = w.workers.filter((x) => x.fisher);
  assert.ok(fishers.length >= 1, 'L44 should hire at least one fisherman');
  assert.ok(w.loaders, 'L44 should exercise the general vehicle upgrade');
  for (const f of fishers) {
    assert.equal(f.boat, true, 'fisherman keeps boat identity');
    assert.equal(f.boatUpgrade, true, 'boat receives the general upgrade benefit');
    assert.equal(f.loader, false, 'fisherman must not become a loader/forklift driver');
    assert.ok(f.speed > CFG.worker.speed, 'fisherman still receives the speed upgrade');
  }
  const boat = makeFishingBoat();
  assert.ok(boat.root.children.length > 0, 'fishing boat model contains visible geometry');
});

check('fisherman hired after the vehicle upgrade also stays on a boat', () => {
  const w = new World(43, { quiet: true, seed: 48 });
  const up = w.tiles.find((t) => t.effect?.upgradeWorkers === 'loader');
  assert.ok(up, 'L44 has loader upgrade');
  buyTile(w, up.id);
  const fisherTile = w.tiles.find((t) => t.effect?.worker?.from?.some((id) => w.objs[id]?.item === 'fish'));
  assert.ok(fisherTile, 'L44 has a fisherman hire');
  buyTile(w, fisherTile.id);
  const f = w.workers.find((x) => x.fisher);
  assert.ok(f);
  assert.equal(f.boat, true);
  assert.equal(f.loader, false);
  assert.equal(f.boatUpgrade, true);
});

check('food clerks collect available board stock below the former blanket threshold (L68–75)', () => {
  for (const li of [67, 68, 69, 70, 71, 72, 73, 74]) {
    const w = new World(li, { quiet: true, seed: 49 });
    buyTile(w, 'food_clerk');
    const clerk = clerkOf(w);
    assert.ok(clerk, `L${li + 1} clerk exists`);
    const stands = clerk.from.map((id) => w.objs[id]).filter((o) => o?.kind === 'stand' && o.pile);
    assert.ok(stands.length, `L${li + 1} clerk has raw boards`);
    for (const st of stands) st.pile.total = 25;
    w.workerAI(clerk, 1 / 30);
    assert.equal(clerk.clerkBatch, 25, `L${li + 1} should dispatch from the available 25-item board stock`);
    assert.equal(clerk.state, 'collect');
    assert.equal(clerk.wait, 0, `L${li + 1} must not idle waiting for a 100-item threshold`);
  }
});

check('full-batch clerk keeps cargo intact if only partial counter room remains', () => {
  const w = new World(67, { quiet: true, seed: 50 });
  buyTile(w, 'food_clerk');
  const clerk = clerkOf(w), c1 = w.counters.find((x) => x.id === 'C1');
  assert.ok(clerk && c1);
  const item = clerk.from.map((id) => w.objs[id]).find((o) => o?.kind === 'stand').item;
  assert.ok(c1.items.includes(item), 'board crop sells at C1');
  clerk.state = 'deliver'; clerk.stack = Array(25).fill(item); clerk.incoming = 0;
  clerk.canPick = false; clerk.canDrop = true; clerk.toObjs = [c1];
  clerk.x = c1.zone.cx; clerk.y = c1.zone.cy; clerk.top = { C1: true };
  c1.stock = Array(CFG.v46.rawFull - 10).fill(item); c1.incoming = 0;
  const beforeDrops = clerk.drops?.C1 || 0;
  w.interact(clerk, 1 / 30, false);
  assert.equal(clerk.stack.length, 25, 'the blocked full batch remains on the carrier');
  assert.equal(clerk.drops?.C1 || 0, beforeDrops, 'no individual items were trickled onto C1');

  c1.stock = Array(20).fill(item);
  w.interact(clerk, 1 / 30, false);
  assert.equal(clerk.stack.length, 0, 'once safe room exists, the whole load leaves together');
  assert.equal((clerk.drops?.C1 || 0) - beforeDrops, 25, 'C1 receives the complete batch in one delivery');
});

console.log(`ALL FISHER/CLERK REGRESSIONS PASS (${checks} checks)`);
