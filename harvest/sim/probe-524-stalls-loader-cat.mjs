// v5.2.4: targeted regressions for the long-standby report, late multi-crop
// loader coverage, and the new exchangeable mottled cat.
// Run from repo root: node harvest/sim/probe-524-stalls-loader-cat.mjs
import assert from 'node:assert/strict';
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import { crewDefaults } from '../js/crew.js';
import { PETS, itemById, buy, normShop } from '../js/shop.js';
import * as M from '../js/models.js';

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
  while (changed && loops++ < 500) {
    changed = false;
    for (const t of w.tiles) if (t.visible && !t.done) { w.completeTile(t, true); changed = true; }
  }
}

check('ordinary clerk dispatches a partial load even with stock still available', () => {
  const crew = crewDefaults().map((m) => ({ ...m, lv: 10 }));
  const w = new World(53, { quiet: true, seed: 524, crew }); // L54
  buyTile(w, 'food_clerk');
  const clerk = w.workers.find((x) => x.clerk);
  assert.ok(clerk, 'L54 has a regular salesperson');
  const source = w.objs[clerk.from[0]], item = source.item;
  assert.equal(clerk.cap, CFG.worker.cap, 'Dazhuang/strong trait cannot enlarge the clerk batch');
  source.pile.total = 200; // a valid source remains available throughout the wait
  clerk.state = 'collect'; clerk.stack = Array(10).fill(item); clerk.incoming = 0;
  clerk.clerkBatch = clerk.cap; clerk.clerkCollectAge = 0; clerk.wait = 0;
  for (let i = 0; i < 5.1 * 30 && clerk.state === 'collect'; i++) w.workerAI(clerk, 1 / 30);
  assert.equal(clerk.state, 'deliver', `clerk state after ${clerk.clerkCollectAge.toFixed(2)}s with source stock: ${clerk.state}`);
  assert.ok(clerk.clerkCollectAge <= 5.1, `bounded by ~5 sec, got ${clerk.clerkCollectAge.toFixed(2)}`);
  assert.equal(clerk.stack.length, 10, 'available partial cargo is preserved, not discarded');
  assert.equal(source.pile.total, 200, 'diagnostic source remained stocked; not the old dry-source timeout path');
  console.log(`  (partial batch ${clerk.stack.length}/${clerk.cap} dispatched after ${clerk.clerkCollectAge.toFixed(2)} s while 200 items remained)`);
});

check('strong Dazhuang never inflates a regular salesperson carrying batch', () => {
  const crew = [{ id: 'dazhuang', name: '大壮', trait: 'strong', lv: 10, mul: { speed: 1, cap: 1.3, rate: 1, reach: 1 } }];
  const w = new World(53, { quiet: true, seed: 525, crew });
  buyTile(w, 'food_clerk');
  const clerk = w.workers.find((x) => x.clerk);
  assert.ok(clerk && clerk.crewId === 'dazhuang', 'first hire slot is Dazhuang');
  assert.ok(clerk.crewMul.cap > 1, 'test exercises the strong-trait multiplier');
  assert.equal(clerk.cap, CFG.worker.cap, `Dazhuang clerk cap ${clerk.cap} must remain base ${CFG.worker.cap}`);
  buyTile(w, 'a');
  w.refreshStats();
  assert.equal(clerk.cap, CFG.worker.cap + w.upg.wcap, 'normal bag upgrade applies, crew bonus still does not inflate clerk capacity');
  const chain = w.addWorker([], [], 0, 0, false, ['M1', 'M2']);
  chain.crewMul = crew[0].mul; w.refreshStats();
  assert.equal(chain.cap, CFG.worker.cap + w.upg.wcap, 'chain feeder batch remains fillable too');
});

check('every 54–75 level with at least two crop types has a general loader upgrade, clerks included', () => {
  const covered = [];
  for (let li = 53; li < Math.min(75, CFG.levels.length); li++) {
    const l = CFG.levels[li];
    const crops = new Set((l.objects || []).filter((o) => o.type === 'field').map((o) => o.crop));
    if (crops.size < 2) continue;
    const w = new World(li, { quiet: true, seed: 526 + li });
    const up = w.tiles.find((t) => t.effect?.upgradeWorkers === 'loader');
    assert.ok(up, `L${li + 1} (${l.name}) has ${crops.size} crop types but no forklift upgrade`);
    buyTile(w, up.id);
    buyAll(w);
    const clerks = w.workers.filter((wk) => wk.clerk);
    assert.ok(clerks.length, `L${li + 1} should include an ordinary salesperson`);
    for (const clerk of clerks) {
      assert.equal(clerk.loader, true, `L${li + 1} clerk must get the forklift`);
      assert.equal(clerk.loaderKind, 'big', `L${li + 1} clerk gets the large carrier, not machine forklift`);
    }
    covered.push(li + 1);
  }
  assert.deepEqual(covered, [54,55,56,57,58,59,60,62,63,64,66,67,70,71,72,73,74,75]);
  console.log(`  (${covered.length} levels: ${covered.join(', ')})`);
});

check('late-hired salesperson receives forklift after upgrade, L59', () => {
  const w = new World(58, { quiet: true, seed: 527 });
  const up = w.tiles.find((t) => t.effect?.upgradeWorkers === 'loader');
  assert.ok(up, 'L59 loader tile exists');
  buyTile(w, up.id);
  buyTile(w, 'food_clerk');
  const clerk = w.workers.find((x) => x.clerk);
  assert.ok(clerk);
  assert.equal(clerk.loader, true);
  assert.equal(clerk.loaderKind, 'big');
});

check('mottled cat uses the standard coin exchange and survives save normalization', () => {
  const cat = PETS.find((p) => p.id === 'catMottled');
  assert.ok(cat && itemById('catMottled') === cat && cat.pet === 'cat');
  assert.equal(cat.price, 520);
  assert.equal(typeof cat.starPrice, 'undefined', 'not a star or real-money item');
  const d = { coins: 520, spent: 0, stars: {}, shop: { owned: [], eq: {}, pet: { dog: null, cat: null }, maps: [], deco: [], decoInstances: [] } };
  assert.equal(buy(d, 'catMottled'), 'ok');
  assert.equal(d.coins, 0);
  assert.ok(d.shop.owned.includes('catMottled'));
  assert.equal(d.shop.pet.cat, 'catMottled');
  const restored = normShop(JSON.parse(JSON.stringify(d.shop)));
  assert.equal(restored.pet.cat, 'catMottled');
  assert.ok(cat.col.patch2d.length >= 2, 'appearance uses a blended coat palette from the references');
  const model = M.makePet('cat', cat.col);
  assert.ok(model.root.children.length > 0, 'low-poly pet body model builds');
  assert.ok(model.body.children.length > 10, 'cat body includes ordinary features and mottled patches');
});

console.log(`ALL v5.2.4 STALL/LOADER/CAT CHECKS PASS (${checks} checks)`);
