// Focused regressions for the latest fishing-boat and regular-salesperson feedback.
// Run: node harvest/sim/fisher-clerk-regression.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';
import { makeFishingBoat } from '../js/models.js';
import { splitSales } from '../js/sales.js';

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


check('all fish-source hires, including late food fields, remain boat-based', () => {
  let fishHires = 0;
  for (let li = 0; li < CFG.levels.length; li++) {
    const w = new World(li, { quiet: true, seed: 900 + li });
    const hires = w.tiles.filter((t) => t.effect?.worker?.from?.some((id) => ['field', 'pond'].includes(w.objs[id]?.kind) && w.objs[id]?.item === 'fish'));
    if (!hires.length) continue;
    const upgrade = w.tiles.find((t) => t.effect?.upgradeWorkers === 'loader');
    if (upgrade) buyTile(w, upgrade.id);
    for (const tile of hires) {
      buyTile(w, tile.id);
      const fisher = w.workers.find((x) => x.fisher && x.from.some((id) => tile.effect.worker.from.includes(id)));
      assert.ok(fisher, `L${li + 1} fish-source hire creates a fisher`);
      assert.equal(fisher.boat, true, `L${li + 1} fisherman uses a boat`);
      assert.equal(fisher.loader, false, `L${li + 1} fisherman never uses a loader`);
      fishHires++;
    }
  }
  assert.ok(fishHires >= 10, 'coverage includes multiple pond/fishing levels and late food markets');
});

check('ordinary food clerk walks before upgrade and uses the large loader after it', () => {
  for (const li of [67, 68, 72]) { // levels 68, 69 and 73 exercise the role in distinct layouts
    const w = new World(li, { quiet: true, seed: 150 + li });
    const clerkTile = w.tiles.find((t) => t.id === 'food_clerk');
    const upgrade = w.tiles.find((t) => t.effect?.upgradeWorkers === 'loader');
    if (!clerkTile || !upgrade) continue;
    buyTile(w, clerkTile.id);
    const clerk = clerkOf(w);
    assert.ok(clerk, `L${li + 1} has a normal sales clerk`);
    assert.equal(clerk.loader, false, `L${li + 1} clerk walks before the vehicle upgrade`);
    buyTile(w, upgrade.id);
    assert.equal(clerk.loader, true, `L${li + 1} clerk receives the vehicle upgrade`);
    assert.equal(clerk.loaderKind, 'big', `L${li + 1} clerk uses the large loader, not the small machine forklift`);
  }
  const late = new World(68, { quiet: true, seed: 180 });
  const upgrade = late.tiles.find((t) => t.effect?.upgradeWorkers === 'loader');
  buyTile(late, upgrade.id);
  buyTile(late, 'food_clerk');
  const hiredLate = clerkOf(late);
  assert.ok(hiredLate);
  assert.equal(hiredLate.loader, true, 'a clerk hired after the upgrade gets a vehicle');
  assert.equal(hiredLate.loaderKind, 'big');
});

check('late supply expansions use separate paid sources and shared crop boards', () => {
  const fishball = splitSales(CFG.levels[68]); // level 69
  const fishFields = fishball.objects.filter((o) => o.type === 'field' && o.crop === 'fish');
  assert.deepEqual(fishFields.map((o) => o.id), ['F1', 'F2']);
  const secondPondUnlock = fishball.tiles.find((t) => t.effect?.show?.includes('F2'));
  assert.ok(secondPondUnlock && secondPondUnlock.price > 0, 'second pond has its own coin unlock');
  for (const id of ['F1', 'F2']) {
    const hire = fishball.tiles.find((t) => t.effect?.worker?.from?.includes(id));
    assert.ok(hire && hire.price > 0, `${id} has a separately paid fisher hire`);
  }
  const board = fishball.objects.find((o) => o.id === 'R_fish');
  assert.ok(board && board.w >= 140 && board.h >= 70 && board.cap >= 900, 'fishball level has an enlarged central board');
  assert.ok(board.x > 450 && board.x < 750 && board.y > 430 && board.y < 650, 'fishball board sits centrally, not at the far-right counter');
  const clerkTile = fishball.tiles.find((t) => t.id === 'food_clerk');
  const machineTile = fishball.tiles.find((t) => t.id === 'food_machine_M1');
  assert.deepEqual(clerkTile.effect.worker.from, ['R_fish'], 'sales clerk is assigned from the shared raw board');
  assert.deepEqual(machineTile.effect.worker.from, ['R_fish'], 'machine specialist is assigned from the same raw board');
  assert.deepEqual(clerkTile.effect.worker.to, ['C1']);

  const fishballWorld = new World(68, { quiet: true, seed: 169 });
  buyTile(fishballWorld, 'food_machine_M1');
  const machineWorker = fishballWorld.workers.find((x) => x.feedFor === 'M1');
  assert.ok(machineWorker, 'fishball machine specialist is hired');
  assert.equal(machineWorker.fisher, false, 'stand-fed machine specialist is not misclassified as a fish harvester');
  assert.equal(machineWorker.boat, false, 'machine specialist does not use a fishing boat');
  const fishballUpgrade = fishballWorld.tiles.find((t) => t.effect?.upgradeWorkers === 'loader');
  buyTile(fishballWorld, fishballUpgrade.id);
  assert.equal(machineWorker.fisher, false, 'vehicle upgrade keeps the machine role distinct from fishermen');

  const rubber = splitSales(CFG.levels[67]); // level 68 single slow crop
  assert.ok(rubber.objects.some((o) => o.id === 'F2' && o.crop === 'rubber'));
  assert.ok(rubber.tiles.some((t) => t.effect?.show?.includes('F2') && t.price > 0), 'level 68 expansion costs coins');
  const breakfast = splitSales(CFG.levels[71]); // level 72: rubber grows slowly and is much sparser than the other two crops
  assert.ok(breakfast.objects.some((o) => o.id === 'F4' && o.crop === 'rubber'));
  const fair = splitSales(CFG.levels[72]); // level 73: pumpkin's 22-unit spacing yields far fewer plants
  assert.ok(fair.objects.some((o) => o.id === 'F4' && o.crop === 'pumpkin'));
});

console.log(`ALL FISHER/CLERK REGRESSIONS PASS (${checks} checks)`);
