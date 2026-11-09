// Regression checks for empty-counter patience and the machine → tray → porter hand-off.
//   node sim/customer-check.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';

const w = new World(50, { quiet: true, season: 3, seed: 91 }); // L51 winter, machine + processed-goods counter
const c = w.counters.find((x) => x.id === 'PS');
const p = w.procs.find((x) => x.id === 'M1');
assert(c && p && p.outObj === c && p.pile, 'expected L51 processed-goods counter and output tray');
c.hidden = false; p.hidden = false;
const porterTile = w.tiles.find((t) => t.effect.worker?.porter && t.effect.worker.tray === p.id);
assert(porterTile, 'expected a generated porter hire for M1');
w.applyEffect(porterTile.effect, porterTile, true);
const feederTile = w.tiles.find((t) => t.effect.worker?.feeder === p.id);
assert(feederTile, 'expected a generated feeder hire for M1');
w.applyEffect(feederTile.effect, feederTile, true);

function setFront(counter = c) {
  const front = { state: 'wait', want: 1, bag: [], incoming: 0, wait: 0, dry: 0, t0: w.t, tFront: w.t };
  counter.queue = [front]; counter.customers = [front]; counter.stock = []; counter.incoming = 0; counter.spawnT = 100;
  return front;
}
function tick(front) { w.updateCounter(c, CFG.customer.patience * 2 + 0.2); return front.state; }

// Before the first delivery, customers can arrive before the player hires a configured porter.
// They get a finite setup window rather than leaving immediately or waiting forever.
p.pile.total = 0; p.buf = 0; p.work = 0; c.everStocked = false;
const openingPorter = w.workers.find((x) => x.porter), openingFeeder = w.workers.find((x) => x.feedFor === p.id);
openingPorter.state = 'idle'; openingFeeder.state = 'idle';
let front = setFront(); w.updateCounter(c, CFG.customer.patience * 20);
assert.equal(front.state, 'wait', 'opening customer should wait during the configured supply setup window');
assert(front.dry > 0, 'opening customer should accrue finite unstaffed patience');

// An available tray keeps a waiting buyer from timing out while the porter is on its collection leg.
p.pile.total = 2;
assert.equal(w.counterSupplyInTransit(c), true, 'tray stock should count as committed counter supply');
front = setFront(); tick(front);
assert.equal(front.state, 'wait', 'customer should stay while porter can fetch tray stock');
assert.equal(front.dry, 0, 'customer dry timer should reset during tray hand-off');

// A worker's delivery has launched from its stack, so the counter's own incoming
// flight must keep the buyer waiting until the item lands.
p.pile.total = 0; p.buf = 0; p.work = 0;
c.incoming = 1; c.everStocked = true;
assert.equal(w.counterSupplyInTransit(c), true, 'counter-bound flying stock should count as committed supply');
front = setFront(); c.incoming = 1; tick(front);
assert.equal(front.state, 'wait', 'buyer should wait while a delivery is flying to the counter');
assert.equal(front.dry, 0, 'counter-bound flight should reset the stockout timer');
c.incoming = 0;

// A hired worker on its collection leg with ripe, sellable source stock is also
// a concrete near-term supply route, even before it has picked up the item.
const rawCounter = w.counters.find((x) => x.items.includes('potato'));
const potatoField = w.fields.find((x) => x.item === 'potato');
assert(rawCounter && potatoField, 'expected a raw counter and matching field');
rawCounter.everStocked = true; rawCounter.stock = []; rawCounter.incoming = 0;
potatoField.hidden = false; potatoField.ripe = 1;
w.workers.push({ id: 'test-worker', to: [rawCounter.id], from: [potatoField.id], stack: [], state: 'collect', sources: null });
assert.equal(w.counterSupplyInTransit(rawCounter), true, 'assigned worker with ripe sellable source stock should count as supply');
// Even while all crops are regrowing, an assigned collector has a renewable source.
// Buyers should not time out during the normal crop cycle.
potatoField.ripe = 0;
potatoField.g.fill(0.99);
assert.equal(w.counterSupplyInTransit(rawCounter), true, 'assigned worker with regrowing sellable crop should count as expected supply');
potatoField.ripe = 1;
potatoField.g.fill(1);

front = { state: 'wait', want: 1, bag: [], incoming: 0, wait: 0, dry: 0, t0: w.t, tFront: w.t };
rawCounter.queue = [front]; rawCounter.customers = [front]; rawCounter.spawnT = 100;
w.updateCounter(rawCounter, CFG.customer.patience * 2 + 0.2);
assert.equal(front.state, 'wait', 'buyer should wait while assigned worker is collecting sellable stock');
assert.equal(front.dry, 0, 'active source route should reset the stockout timer');
w.workers.pop(); potatoField.ripe = 0;

// The three reported levels have matching configured raw suppliers. Before those hires are
// bought, a customer should get the finite setup grace; after it, the customer must still leave.
for (const [level, season] of [[26, 0], [39, 0], [51, 3]]) {
  const world = new World(level - 1, { quiet: true, season, seed: 19 });
  const raw = world.counters.find((x) => !x.sale2);
  assert(raw && world.counterHasPlannedSupply(raw), `L${level} raw counter should have a configured supply hire`);
}
rawCounter.items = ['unobtainable']; rawCounter.everStocked = true;
assert.equal(w.counterHasPlannedSupply(rawCounter), false, 'counter with no matching item route must not receive setup grace');
front = setFront(rawCounter);
w.updateCounter(rawCounter, CFG.customer.emptyPatience + 0.2);
assert.equal(front.state, 'out', 'genuinely unsuppliable customer must leave after finite empty-counter patience');
rawCounter.items = ['potato']; rawCounter.everStocked = true;
front = setFront(rawCounter);
w.updateCounter(rawCounter, CFG.customer.emptyPatience + 0.2);
assert.equal(front.state, 'wait', 'counter with an unbought but configured route should receive setup grace');
w.updateCounter(rawCounter, CFG.customer.unstaffedPatience);
assert.equal(front.state, 'out', 'unstaffed route setup grace must be finite, not an infinite wait');

// On startup, an empty machine can still have a feeder's first batch en route.
p.pile.total = 0; p.buf = 0; p.work = 0;
const feeder = w.workers.find((x) => x.feedFor === p.id);
assert(feeder && feeder.to.includes(p.id), 'expected feeder dedicated to M1');
feeder.stack = [p.inItem];
assert.equal(w.counterSupplyInTransit(c), true, 'feeder cargo headed to the machine is committed supply');
front = setFront(); tick(front);
assert.equal(front.state, 'wait', 'customer should stay while the first raw batch is carried to the machine');
feeder.stack = [];
// Even before pickup, the feeder's active collection trip from a regrowing source is a real
// production pipeline; customers should not time out during that first stage either.
const logField = w.fields.find((x) => x.item === p.inItem);
assert(logField, 'expected a visible raw-input field for the machine');
logField.hidden = false; logField.ripe = 0; logField.g.fill(0.99);
feeder.state = 'collect';
assert.equal(w.counterSupplyInTransit(c), true, 'feeder collecting from a regrowing source should count as production supply');
front = setFront(); tick(front);
assert.equal(front.state, 'wait', 'customer should wait while feeder gathers the first batch');
feeder.state = 'idle'; logField.ripe = 1; logField.g.fill(1);

// A machine already working/ready to output also bridges the short tray-empty interval.
p.pile.total = 0; p.buf = p.ratio; p.work = 0;
assert.equal(w.counterSupplyInTransit(c), true, 'ready machine batch should count as committed supply');
front = setFront(); tick(front);
assert.equal(front.state, 'wait', 'customer should stay while a ready machine batch is processed');

// With no carried items, tray stock, pending output or active batch, genuine stockout still times out.
p.buf = 0; p.inc = 0; p.work = 0; p.pile.pending = 0; p.pile.total = 0; c.everStocked = true;
const savedItems = c.items; c.items = ['unsellable'];
assert.equal(w.counterSupplyInTransit(c), false, 'a genuinely empty production route must not hold customers forever');
front = setFront();
w.updateCounter(c, CFG.customer.emptyPatience - 0.1);
assert.equal(front.state, 'wait', 'customer should tolerate one full normal supply cycle');
front.dry = CFG.customer.emptyPatience;
w.updateCounter(c, 0.2);
assert.equal(front.state, 'out', 'customer should leave after a sustained post-launch stockout');
c.items = savedItems;

// A partially fulfilled order waits for a bounded restock when a real counter supply route
// is active; after stock arrives, the customer can finish the remaining units.
c.hidden = false; p.hidden = false; p.pile.total = 0; p.buf = 0; p.work = 0;
c.items = [p.outItem]; c.everStocked = true; c.stock = []; c.incoming = 1;
front = { state: 'wait', want: 2, bag: [p.outItem], incoming: 0, wait: 0, dry: 0, stockoutWait: 0, t0: w.t, tFront: w.t };
c.queue = [front]; c.customers = [front]; c.spawnT = 100;
w.updateCounter(c, CFG.customer.partialPatience / 2);
assert.equal(front.state, 'wait', 'partially served customer should wait while counter-bound replenishment is active');
assert(front.stockoutWait > 0 && front.stockoutWait < CFG.customer.partialPatience, 'partial-order stockout time should accumulate under a finite cap');
c.incoming = 0; c.stock = [p.outItem]; c.buyAcc = 0;
w.updateCounter(c, 0.1);
assert.equal(front.state, 'wait', 'partially served customer should stay while the restock is transferred into the order');
assert.equal(front.incoming, 1, 'restocked item should be committed to this customer');
c.stock = []; front.incoming = 0; front.bag.push(p.outItem);
w.updateCounter(c, 0.1);
assert.equal(front.state, 'out', 'customer should complete the order after the remaining item arrives');
assert.equal(front.bag.length, front.want, 'customer should leave only after receiving the full requested order');

// A real but stalled/slow route earns only one bounded replenishment window; waiting while
// a supplier exists must still time out if no new unit actually reaches this order.
c.items = [p.outItem]; c.stock = []; c.incoming = 0; c.everStocked = true;
assert.equal(w.counterHasPlannedSupply(c), true, 'the processing counter should still have a configured real supplier');
front = { state: 'wait', want: 3, bag: [p.outItem], incoming: 0, wait: 0, dry: 0, stockoutWait: 0, t0: w.t, tFront: w.t };
c.queue = [front]; c.customers = [front]; c.spawnT = 100;
w.updateCounter(c, CFG.customer.partialPatience + 0.2);
assert.equal(front.state, 'out', 'a stalled feasible supply route must not hold a partial order beyond its finite cap');

// If a partially fulfilled order has no matching supplier, retain the short ordinary
// stockout timeout instead of granting long setup/restock patience.
c.items = ['no-such-item']; c.stock = []; c.incoming = 0; c.everStocked = true;
front = { state: 'wait', want: 2, bag: ['potato'], incoming: 0, wait: 0, dry: 0, stockoutWait: 0, t0: w.t, tFront: w.t };
c.queue = [front]; c.customers = [front]; c.spawnT = 100;
w.updateCounter(c, CFG.customer.patience + 0.1);
assert.equal(front.state, 'out', 'partial order with no feasible supply must close after ordinary finite patience');
assert(front.stockoutWait > CFG.customer.patience, 'unsuppliable partial order should not receive an extended restock window');

// End-to-end comparison to the new simple-level example: crops carried to the sales counter,
// customers queue, and each sale completes rather than ending as a partial purchase.
const demo = new World(1, { quiet: true, seed: 78 }); // L2 郁金香花田
for (let more = true; more;) {
  more = false;
  for (const tile of demo.tiles) if (tile.visible && !tile.done) { demo.completeTile(tile, true); more = true; }
}
for (let i = 0; i < 180 * 30; i++) demo.update(1 / 30, 0, 0);
const demoCounter = demo.counters[0];
const demoCustomers = demo.waitLog || [];
assert(demo.workers.some((worker) => (worker.drops || {})[demoCounter.id] > 0), 'simple example: a hired worker should deliver harvested goods to the sales counter');
assert((demo.stats.sold.tulip || 0) > 0, 'simple example: queued customers should buy counter stock');
assert(demoCustomers.some((customer) => customer.got === customer.want), 'simple example: at least one customer should finish a full order');
assert.equal(demoCustomers.filter((customer) => customer.got > 0 && customer.got < customer.want).length, 0, 'simple example: no customer should leave after only part of an order');

console.log('customer-check: configured finite setup grace, partial-order replenishment and no-route timeout, source regrowth, flights, machine/tray supply, stockout behavior, and L2 end-to-end sales passed');
