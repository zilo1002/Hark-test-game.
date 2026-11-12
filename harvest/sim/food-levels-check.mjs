// Food-workshop regressions: separate player collection stands, full-batch staff routes,
// moderate midgame recipe counts, and a complete handoff from a stand to the sales counter.
import assert from 'node:assert/strict';
import { CFG, valleyLevel } from '../js/config.js';
import { splitSales } from '../js/sales.js';
import { World } from '../js/world.js';
import { isPackableCargo, packageCapacity, packageKind } from '../js/cargo-crate.js';

assert.equal(CFG.levels.length, 67);
assert.equal(CFG.valley.n, 22);
for (const item of ['apple', 'berry', 'grape']) assert.ok(isPackableCargo(item), `${item} fruit must be packed`);
for (const item of ['potato', 'tomato', 'corn', 'pumpkin', 'pepper']) assert.ok(!isPackableCargo(item), `${item} vegetables stay unboxed`);
assert.equal(packageKind('fish'), 'fish-crate');
assert.equal(packageCapacity('fish'), 6);
for (const item of ['xiaolongbao', 'teasnack']) { assert.equal(packageKind(item), 'steamer'); assert.equal(packageCapacity(item), 6); }
const expected = new Map([
  [54, ['晨光面包房', ['bread', 'jam']]], [55, ['果香早餐铺', ['juice', 'jam']]],
  [56, ['山谷茶点坊', ['pie', 'teasnack']]], [57, ['早市烘焙铺', ['bread', 'juice']]],
  [58, ['咸香茶歇屋', ['chips', 'popcorn']]], [59, ['山谷早餐工坊', ['flour', 'bread', 'pie', 'jam']]],
  [60, ['晨茶丰收宴', ['pie', 'xiaolongbao']]],
  [61, ['夜市小摊', ['chips']]], [62, ['灯火小吃街', ['popcorn', 'ketchup']]],
  [63, ['烤鱼夜市', ['smoked', 'bread']]], [64, ['果汁冰饮摊', ['juice', 'jam', 'icecream']]],
  [65, ['葡萄酒夜市', ['gjuice', 'wine']]], [66, ['丰收夜市大排档', ['xiaolongbao', 'chips', 'teasnack']]],
  [67, ['丰收夜市盛宴', ['xiaolongbao', 'pie', 'gjuice']]],
]);
const buyAll = (w, skip = () => false) => {
  let changed = true, loops = 0;
  while (changed && loops++ < 200) {
    changed = false;
    for (const t of w.tiles) if (t.visible && !t.done && !skip(t)) { w.completeTile(t, true); changed = true; }
  }
  assert.ok(loops < 200, 'all visible upgrades settle without an unlock cycle');
};
for (const [lv, [name, outputs]] of expected) {
  for (let season = 0; season < 4; season++) {
    const k = lv - CFG.valley.from - 1;
    const L = splitSales(valleyLevel(k, season));
    assert.equal(L.name, name);
    assert.ok(L.goal.n > 0 && L.par > 0);
    const objs = Object.fromEntries(L.objects.map((o) => [o.id, o]));
    const procs = L.objects.filter((o) => o.type === 'proc');
    const cropKinds = [...new Set(L.objects.filter((o) => ['field', 'coop'].includes(o.type)).map(o => o.type === 'field' ? o.crop : o.item))];
    assert.deepEqual([...new Set(procs.map(p => p.out))].sort(), [...outputs].sort(), `level ${lv} recipe set`);
    assert.ok(procs.length <= 4, `level ${lv} stays within three food lines (L59's wheat line is two-stage: flour then bread, so it needs two machines)`);
    const rawStands = L.objects.filter(o => o.type === 'stand' && o.role === 'raw');
    const processedStands = L.objects.filter(o => o.type === 'stand' && o.role === 'processed');
    assert.deepEqual(rawStands.map(o => o.item).sort(), cropKinds.sort(), `level ${lv}: one raw stand per crop kind`);
    assert.deepEqual(processedStands.map(o => o.item).sort(), [...new Set(procs.map(p => p.out))].sort(), `level ${lv}: one output stand per product type`);
    // v4.9.9: two counters — C1 sells raw goods only, a dedicated PS sells processed goods only
    assert.equal(L.objects.filter(o => o.type === 'counter').length, 2, 'raw + dedicated processed counters');
    assert.ok(objs.C1 && !procs.some((p) => objs.C1.items.includes(p.out)), `level ${lv} ordinary counter sells raw only`);
    assert.ok(cropKinds.every((k) => objs.C1.items.includes(k)), `level ${lv} ordinary counter keeps every raw kind`);
    assert.ok(objs.PS && objs.PS.sale2 && objs.PS.hidden, `level ${lv} dedicated processed counter exists, hidden until unlock`);
    assert.deepEqual([...objs.PS.items].sort(), [...outputs].sort(), `level ${lv} processed counter sells only the level products`);
    assert.ok(L.tiles.some((t) => t.effect?.show?.includes(procs[0].id) && t.effect.show.includes('PS')), `level ${lv} first machine unlock reveals the processed counter`);
    assert.ok(L.tiles.some((t) => (t.effect?.cashier || []).includes('PS')), `level ${lv} a cashier serves the processed counter`);
    const tallyTile = L.tiles.find((t) => t.effect?.worker?.tally);
    assert.ok(tallyTile, `level ${lv} dedicated processed-goods tally clerk hire exists`);
    const firstMachineUnlock = L.tiles.find((t) => t.effect?.show?.includes(procs[0].id));
    assert.ok(firstMachineUnlock && (tallyTile.req || []).includes(firstMachineUnlock.id), `level ${lv} tally clerk requires the first machine unlock`);
    assert.deepEqual([...tallyTile.effect.worker.from].sort(), processedStands.map((o) => o.id).sort(), `level ${lv} tally clerk takes from all processed boards`);
    assert.deepEqual(tallyTile.effect.worker.to, ['PS'], `level ${lv} tally clerk delivers only to the processed counter`);
    for (const p of procs) {
      assert.equal(objs[p.outTo]?.type, 'stand', `${p.id} must deposit into its own wooden stand`);
      assert.ok(L.tiles.some(t => t.effect?.show?.includes(p.id)), `${p.id} has an unlock tile`);
      assert.ok(L.tiles.some(t => t.effect?.show?.includes(p.outTo)), `${p.id}'s output stand has an unlock tile`);
      const from = L.objects.filter(o => (o.type === 'field' && o.crop === p.in) || (o.type === 'coop' && o.item === p.in) || (o.type === 'stand' && o.item === p.in));
      assert.ok(from.length, `${p.id} has an input source`);
    }
    const uniqueTileIds = new Set(L.tiles.map(t => t.id));
    assert.equal(uniqueTileIds.size, L.tiles.length, 'food level tile IDs are unique');
    for (const t of L.tiles) for (const r of t.req || []) assert.ok(uniqueTileIds.has(r), `${t.id} prerequisite ${r} exists`);

    const w = new World(lv - 1, { quiet: true, season, seed: 9000 + lv * 10 + season });
    assert.equal(w.L.name, name);
    const runtimeStands = Object.values(w.objs).filter(o => o.kind === 'stand');
    assert.equal(runtimeStands.length, rawStands.length + processedStands.length);
    assert.equal(w.counters.length, 2);
    assert.ok(w.counters.some((c) => c.sale2 && c.hidden), 'processed counter starts hidden');
    assert.ok(w.counters.some((c) => !c.sale2 && !c.hidden), 'ordinary counter starts visible');
    for (const p of w.procs) assert.equal(p.pile, p.outObj.pile, `${p.id} output uses its collection table as stock pile`);
    buyAll(w);
    assert.equal(w.workers.length, L.tiles.filter(t => t.effect?.worker).length, `level ${lv} all one-per-field and one-per-machine hires can be bought`);
    const workerRoutes = w.workers.map(x => ({ from: x.from[0], to: x.to[0], feed: x.feedFor, tally: x.tally }));
    for (const x of w.workers) if (x.feedFor) assert.equal(x.loader, false, `level ${lv}: machine specialist keeps normal-batch capacity after loader upgrade`);
    if (w.loaders) for (const x of w.workers) if (!x.feedFor && !x.cart && !x.porter) assert.equal(x.loader, true, `level ${lv}: field/stand worker retains loader upgrade`);
    const hadLoaderUpgrade = w.loaders; w.loaders = true;
    const lateFeeder = w.addWorker(['F1'], ['M1'], 0, 0, false, 'M1');
    assert.equal(lateFeeder.loader, false, `level ${lv}: a feeder hired after loader upgrade also keeps normal-batch capacity`);
    w.workers.splice(w.workers.indexOf(lateFeeder), 1); w.loaders = hadLoaderUpgrade; w.refreshStats();
    for (const route of workerRoutes) {
      if (route.feed) assert.ok(w.procs.some(p => p.id === route.feed && route.to === p.id), 'machine specialist only serves its assigned machine');
      else if (route.tally) assert.equal(route.to, 'PS', 'tally clerk delivers only to the processed counter');
      else assert.ok(rawStands.some(s => s.id === route.to), 'field worker deposits at the matching raw-goods stand');
    }
    const deliveries = [];
    const originalLand = w.landFly.bind(w);
    w.landFly = (f) => {
      if (f.kind === 'pileBatch') deliveries.push({ stand: f.ref.owner?.id, count: f.count, batchCap: f.batchCap, workerSeed: f.workerSeed });
      if (f.kind === 'procBatch') deliveries.push({ machine: f.ref.id, count: f.count, batchCap: f.batchCap, workerSeed: f.workerSeed });
      return originalLand(f);
    };
    for (let i = 0; i < 110 * 30; i++) w.update(1 / 30, 0, 0);
    assert.ok(deliveries.length > 0, `level ${lv}, season ${season} exercises full-batch staff delivery`);
    for (const d of deliveries) assert.ok(d.count > 0 && d.count === d.batchCap && Number.isInteger(d.workerSeed), `staff transfers full loads only (${lv}, ${d.stand || d.machine}: ${d.count}/${d.batchCap})`);
    for (const s of runtimeStands) assert.ok(s.pile.total + s.pile.pending <= s.pile.cap, `${s.id} never exceeds table capacity`);
    for (const p of w.procs) assert.ok(p.pile.total + p.pile.pending <= p.pile.cap, `${p.id} output stand never overflows`);
    for (const p of w.procs) assert.ok((p.drops || 0) >= 0);
    assert.ok(w.workers.some((x) => x.tally && (x.drops || {}).PS > 0), `level ${lv}, season ${season} tally clerk stocked the processed counter`);
  }
}
// Exercise the intended player loop: collect packaged raw goods from its table, take them
// to the customer counter, and confirm the counter accepts/sells the real item.
{
  const w = new World(53, { quiet: true, season: 0, seed: 777 }); buyAll(w);
  for (let i = 0; i < 80 * 30; i++) w.update(1 / 30, 0, 0);
  const raw = w.objs.R_wheat; assert.ok(raw.pile.total > 0, 'raw stand has worker-delivered goods');
  const p = w.player; p.x = raw.x; p.y = raw.y; p.vx = p.vy = 0;
  for (let i = 0; i < 24; i++) w.update(1 / 30, 0, 0);
  assert.ok(p.stack.includes('wheat') || p.incoming > 0, 'player can pick up raw goods from the stand');
  const c = w.counters.find((x) => !x.sale2), soldBefore = w.stats.sold.wheat || 0;
  // Leave the collection stand promptly so the player's automatic drop cannot return the goods
  // to the same stand; the counter then sells the delivered wheat in the normal simulation.
  p.x = c.zone.cx; p.y = c.zone.cy; p.vx = p.vy = 0;
  for (let i = 0; i < 8 * 30; i++) w.update(1 / 30, 0, 0);
  assert.ok((w.stats.sold.wheat || 0) > soldBefore, 'player can deliver stand goods to the separate customer checkout');
}
// Verify processed goods follow the same player-pickup loop from their own stand, not the cashier.
// The tally clerk is left unbought here so it cannot drain the processed stand before the player
// gets there; the loop itself (stand -> dedicated processed counter) is what is exercised.
{
  const w = new World(53, { quiet: true, season: 0, seed: 555 });
  buyAll(w, (t) => t.effect?.worker?.tally);
  for (let i = 0; i < 120 * 30; i++) w.update(1 / 30, 0, 0);
  const output = w.objs.P_bread;
  assert.ok(output.pile.total > 0, 'processed stand has worker-delivered goods');
  const p = w.player; p.x = output.x; p.y = output.y; p.vx = p.vy = 0;
  for (let i = 0; i < 24; i++) w.update(1 / 30, 0, 0);
  assert.ok(p.stack.includes('bread') || p.incoming > 0, 'player can pick up processed goods from their own stand');
  const c = w.counters.find((x) => x.sale2), soldBefore = w.stats.sold.bread || 0;
  p.x = c.zone.cx; p.y = c.zone.cy; p.vx = p.vy = 0;
  for (let i = 0; i < 12 * 30; i++) w.update(1 / 30, 0, 0);
  assert.ok((w.stats.sold.bread || 0) > soldBefore, 'player can carry processed stand goods to the dedicated processed checkout');
}
for (const [lv, expectedOut] of [[54, 'bread'], [57, 'juice'], [60, 'pie'], [64, 'icecream'], [65, 'wine']]) {
  const k = lv - CFG.valley.from - 1, L = splitSales(valleyLevel(k, 0));
  const proc = L.objects.find(p => p.type === 'proc' && p.out === expectedOut);
  assert.ok(proc && proc.outTo.startsWith('P_'), `level ${lv} retains the designed ${expectedOut} process and its own stand`);
}
console.log('food level checks: PASS · levels 54–67 · four seasons · at most three food lines · separate wooden stands · full-batch staff routes · raw+processed player-to-cashier loops');
