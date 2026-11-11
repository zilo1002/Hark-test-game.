// Focused regression checks for the pause save, crate presentation and high-volume hauling fix.
import { strict as assert } from 'node:assert';
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import { saveRun } from '../js/run-save.js';
import { isPackableCargo, hasPackableCargo, makeWoodCrate, cargoCratePosition } from '../js/cargo-crate.js';
import { collectWaitLimit } from '../js/worker-policy.js';

function buyReady(w, skip = () => false) {
  let changed = true;
  while (changed) { changed = false; for (const t of w.tiles) if (t.visible && !t.done && !skip(t)) { w.completeTile(t, true); changed = true; } }
}

// Pause save stores the active snapshot and the normal startup restore path resumes it.
{
  const w = new World(0, { quiet: true, seed: 700 });
  w.t = 31; w.money = 246; w.player.stack = ['wheat', 'wheat'];
  const desk = w.counters[0]; desk.stock.push('wheat', 'wheat');
  const data = { cur: null }; let credits = 0;
  const receipt = saveRun(data, w, { credit: () => credits++, persist: (d) => { assert.equal(d.cur.li, 0); return { persisted: true }; } });
  assert.deepEqual([receipt.saved, receipt.resumable, receipt.persisted], [true, true, true]);
  assert.equal(credits, 1);
  const resumed = new World(0, { quiet: true, seed: 701 }); resumed.restore(data.cur);
  assert.equal(resumed.t, 31); assert.equal(resumed.money, 246);
  assert.deepEqual(resumed.player.stack, ['wheat', 'wheat']);
  assert.deepEqual(resumed.counters[0].stock, ['wheat', 'wheat']);
  // Saving during both a harvest flight and a counter delivery must settle them once;
  // neither the in-flight goods nor their reserved incoming counts are in the old format.
  const flightWorld = new World(0, { quiet: true, seed: 703 });
  const flightDesk = flightWorld.counters[0];
  flightWorld.player.incoming++;
  flightWorld.launch('wheat', 'stack', 1, 2, 3, flightWorld.player, 0, 0, 0, 1);
  flightDesk.incoming++;
  flightWorld.launch('wheat', 'counter', 1, 2, 3, flightDesk, 0, 0, 0, 1);
  const flightSnapshot = flightWorld.snapshot();
  assert.deepEqual(flightSnapshot.stack, ['wheat']);
  assert.deepEqual(flightSnapshot.stock[0], ['wheat']);
  assert.equal(flightWorld.fly.length, 0);
  assert.equal(flightWorld.player.incoming, 0);
  assert.equal(flightDesk.incoming, 0);
  const repeatFlightSnapshot = flightWorld.snapshot();
  assert.deepEqual(repeatFlightSnapshot.stack, ['wheat']);
  assert.deepEqual(repeatFlightSnapshot.stock[0], ['wheat']);
  const flightResumed = new World(0, { quiet: true, seed: 704 }); flightResumed.restore(flightSnapshot);
  assert.deepEqual(flightResumed.player.stack, ['wheat']);
  assert.deepEqual(flightResumed.counters[0].stock, ['wheat']);
  const unavailable = saveRun({ cur: null }, w, { persist: () => ({ persisted: false }) });
  assert.equal(unavailable.resumable, true); assert.equal(unavailable.persisted, false);
}

// Exercise the real localStorage adapter as the pause-menu would use it, including a blocked write.
{
  const store = new Map();
  globalThis.window = { localStorage: { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null, removeItem: (k) => store.delete(k) } };
  const real = await import('../js/save.js?feature-check-real');
  assert.equal(real.storageAvailable(), true);
  const data = real.defaults(); data.cur = { li: 33, t: 42, money: 321 };
  assert.equal(real.save(data).persisted, true);
  assert.deepEqual(real.load().cur, data.cur, 'the persisted active run is restored from localStorage');
  globalThis.window.localStorage.setItem = () => { throw new Error('quota'); };
  const blocked = await import('../js/save.js?feature-check-blocked');
  assert.equal(blocked.save(data).persisted, false, 'a failed write must not claim persistence');
}

// The actual game reports persistence truthfully rather than treating in-memory fallback as a disk save.
{
  const ordinary = new World(1, { quiet: true, seed: 701 });
  const loader = ordinary.tiles.find((t) => t.effect?.upgradeWorkers === 'loader');
  assert.ok(loader, 'representative level should include the loader upgrade');
  buyReady(ordinary, (t) => t === loader);
  assert.ok(ordinary.workers.some((w) => !w.cart && !w.porter));
  for (const w of ordinary.workers) if (!w.cart && !w.porter) assert.equal(w.cap, CFG.worker.cap, 'standard hire carries the normal full load');
  assert.ok(loader.visible); ordinary.completeTile(loader, true);
  for (const w of ordinary.workers) if (!w.cart && !w.porter) assert.equal(w.cap, CFG.loader.cap, 'vehicle upgrade raises the full load');
}

// Fishers retain the school's restock window; they should not dump one fish as soon as a school moves away.
{
  const w = new World(33, { quiet: true, seed: 702 });
  const pondWait = collectWaitLimit({ feedFor: 'M1' }, [{ kind: 'pond' }], CFG);
  assert.ok(pondWait >= 7 && pondWait <= 12);
  const level = w.L;
  buyReady(w);
  const feeders = w.workers.filter((worker) => worker.feedFor && worker.from.some((id) => w.objs[id]?.kind === 'pond'));
  assert.ok(feeders.length > 0, 'smoked-fish workers should be assigned to pond supply');
  const loads = new Map(feeders.map((worker) => [worker, []]));
  let maxLoad = 0;
  for (let i = 0; i < 180 * 30; i++) {
    const before = new Map(feeders.map((worker) => [worker, worker.state]));
    w.update(1 / 30, 0, 0);
    for (const worker of feeders) {
      const size = worker.stack.length + worker.incoming; maxLoad = Math.max(maxLoad, size);
      assert.ok(size <= worker.cap);
      if (before.get(worker) === 'collect' && worker.state === 'deliver') loads.get(worker).push({ size, cap: worker.cap });
    }
  }
  const allLoads = [...loads.values()].flat();
  assert.ok(allLoads.length > 0, 'pond feeders delivered to the smokehouse');
  assert.ok(allLoads.every(({ size, cap }) => size === cap), `each smokehouse feeder trip should start with a full load (${allLoads.filter(({ size, cap }) => size !== cap).map(({ size, cap }) => `${size}/${cap}`).join(', ')})`);
  assert.ok(maxLoad <= Math.max(...feeders.map((worker) => worker.cap)));
  // While a fish batch is on the carrier it remains visibly packable; cargo identity is untouched.
  assert.ok(isPackableCargo('fish') && isPackableCargo('tomato') && isPackableCargo('apple'));
  assert.ok(hasPackableCargo(['fish', 'smoked'])); assert.ok(!hasPackableCargo(['smoked']));
  const crate = makeWoodCrate(); assert.equal(crate.name, 'harvest-wood-crate'); assert.ok(crate.children.length >= 20);
  const crate0 = cargoCratePosition(0), crate1 = cargoCratePosition(1), crate2 = cargoCratePosition(2);
  assert.deepEqual([crate0.x, crate0.z, crate1.x, crate1.z, crate2.x, crate2.z], [0, 0, 0, 0, 0, 0], 'carried crates should occupy one vertical column, never a 2x2 layout');
  assert.ok(crate0.base < crate1.base && crate1.base < crate2.base, 'each carried crate should stack above the last');
  assert.ok(w.counters.some((c) => !c.sale2 && !c.items.includes('smoked')));
  assert.ok(w.counters.some((c) => c.sale2 && c.items.includes('smoked')));
}

console.log('feature checks: PASS · resumable snapshot + persistence status · 50→150 carrying · smoked-fish feeders carry full loads · single-column crate geometry');
