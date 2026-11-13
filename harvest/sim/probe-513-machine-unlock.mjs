// v5.1.3 machine unlock: the initial (farm-fed) machine is free — Jin: 初始机器不用金币解锁.
// A chained (second-stage) machine still costs coins to unlock (its reveal tile keeps a price).
// Run: node sim/probe-513-machine-unlock.mjs  (exit 1 on any failure)
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';

let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`PASS ${name}`); };
const revealTile = (w, id) => w.tiles.find((t) => t.effect.show?.includes(id));
const isFood = (li) => !!CFG.levels[li].foodLines;
// A machine is chained (second-stage) when another machine's output feeds it;
// otherwise it is farm-fed (initial — processes raw material straight from the field).
// NOTE: use in/out, not outTo — by the time a World is built, outTo has been
// rewritten to the processed stand (P_<item>), so the chain link is only visible
// in the in/out pair (M2.in === M1.out).
const isChained = (w, p) => w.procs.some((q) => q.out === p.in);

// A tile is "bundled" if it reveals a field/coop (a raw-material source)
// alongside the machine (L45 'c' shows ['P1','M3'], 'e' shows ['T1','M4']).
// The processed stand (P_<item>, type 'stand') and the PS counter (type
// 'counter') are auto-appended to machine tiles later and do NOT count.
function isBundled(w, t, p) {
  return (t.effect.show || []).some((id) => {
    if (id === p.id) return false;
    const o = w.objs[id];
    return o && (o.type === 'field' || o.type === 'coop');
  });
}
// A tile that bundles a field with the machine (L45 'c' shows ['P1','M3'], 'e'
// shows ['T1','M4']) keeps its price — the field is the real cost, and zeroing
// it would give the field away free and break the level (L45 casual bot stalls).
check('machine levels: initial machine tile free (price 0), second-stage tile costs coins', () => {
  let machineLevels = 0, chainedLevels = 0, bundledLevels = 0;
  for (let li = 0; li < 67; li++) {
    if (isFood(li)) continue;
    const w = new World(li, { quiet: true });
    if (!w.procs.length) continue; // pure field level — no machines
    machineLevels++;
    for (const p of w.procs) {
      const t = revealTile(w, p.id);
      assert.ok(t, `L${li + 1} ${p.id} missing reveal tile`);
      if (isChained(w, p)) {
        assert.ok(t.price > 0, `L${li + 1} ${p.id} is chained (second-stage) but its tile is free (price ${t.price}) — it must cost coins`);
        chainedLevels++;
      } else if (isBundled(w, t, p)) {
        // bundled field+machine tile: keeps its price (the field is the cost)
        assert.ok(t.price > 0, `L${li + 1} ${p.id} bundled tile should keep its price, got ${t.price}`);
        bundledLevels++;
      } else {
        assert.equal(t.price, 0, `L${li + 1} ${p.id} is the initial machine but its tile costs ${t.price} — it must be free`);
      }
    }
  }
  assert.ok(machineLevels >= 30, `machine levels with procs, got ${machineLevels}`);
  assert.equal(chainedLevels, 6, `chained machine tiles in machine levels (L26/L32/L38/L40/L43/L45), got ${chainedLevels}`);
  assert.equal(bundledLevels, 4, `bundled field+machine tiles (L45 M3/M4, L53 M2/M3), got ${bundledLevels}`);
});

// ---- Food levels: same rule (bundled tiles keep their price, see above) ----
check('food levels: initial machine tile free (price 0), second-stage tile costs coins', () => {
  let foodLevels = 0, chainedLevels = 0;
  for (let li = 0; li < 67; li++) {
    if (!isFood(li)) continue;
    const w = new World(li, { quiet: true });
    if (!w.procs.length) continue;
    foodLevels++;
    for (const p of w.procs) {
      const t = revealTile(w, p.id);
      assert.ok(t, `L${li + 1} ${p.id} missing reveal tile`);
      if (isChained(w, p)) {
        assert.ok(t.price > 0, `L${li + 1} ${p.id} is chained (second-stage) but its tile is free (price ${t.price}) — it must cost coins`);
        chainedLevels++;
      } else if (isBundled(w, t, p)) {
        assert.ok(t.price > 0, `L${li + 1} ${p.id} bundled tile should keep its price, got ${t.price}`);
      } else {
        assert.equal(t.price, 0, `L${li + 1} ${p.id} is the initial machine but its tile costs ${t.price} — it must be free`);
      }
    }
  }
  assert.equal(foodLevels, 14, `food levels, got ${foodLevels}`);
  assert.equal(chainedLevels, 2, `chained machine tiles in food levels (L59/L65), got ${chainedLevels}`);
});

// ---- Completing the free initial-machine tile (for 0 coins) reveals the machine ----
// Bundled field+machine tiles (L45 M3/M4) are skipped here — they keep their
// price and are covered by the price checks above.
check('initial machine: completing its free tile reveals it (no coins, no walk required by the check)', () => {
  let count = 0;
  for (let li = 0; li < 67; li++) {
    const w = new World(li, { quiet: true });
    for (const p of w.procs) {
      if (isChained(w, p)) continue;
      const t = revealTile(w, p.id);
      assert.ok(t, `L${li + 1} ${p.id} missing reveal tile`);
      if (isBundled(w, t, p)) continue; // bundled field+machine tile — not free
      assert.equal(t.price, 0, `L${li + 1} ${p.id} initial tile price`);
      assert.equal(t.done, false, `L${li + 1} ${p.id} initial tile starts unbought (player taps it, free)`);
      const money = 50; w.money = money;
      w.completeTile(t);
      assert.equal(w.money, money, `L${li + 1} ${p.id} completing the free tile must not deduct coins`);
      assert.ok(!p.hidden, `L${li + 1} ${p.id} initial machine visible after completing its free tile`);
      count++;
    }
  }
  assert.ok(count >= 30, `initial machines revealed by free tile, got ${count}`);
});
check('two-stage levels: completing the paid M2 tile reveals M2', () => {
  const twoStage = [25, 31, 37, 39, 42, 44, 58, 64]; // L26/L32/L38/L40/L43/L45/L59/L65, 0-based
  for (const li of twoStage) {
    const w = new World(li, { quiet: true });
    const m2 = w.procs.find((p) => isChained(w, p));
    assert.ok(m2, `L${li + 1} should have a chained M2`);
    const t = revealTile(w, m2.id);
    assert.ok(t.price > 0, `L${li + 1} M2 tile price ${t.price}`);
    // NOTE: food levels (L59/L65) leave M1/M2 unhidden in the config, so do not
    // assert M2 starts hidden — the unlock is the tile purchase itself.
    w.money = 10000;
    w.completeTile(t);
    assert.ok(!m2.hidden, `L${li + 1} M2 should be revealed after buying its tile`);
    assert.equal(t.done, true, `L${li + 1} M2 tile done`);
  }
});

// ---- Old save: M1 tile bought at the old coin price stays bought, machine visible ----
check('old save: M1 tile bought at old price stays bought, M1 visible (no double charge)', () => {
  // L26 (machine level): M1 tile is generated m_M1, old price was r10(s*0.5).
  const li = 25; // L26
  const w = new World(li, { quiet: true });
  const t = revealTile(w, 'M1');
  assert.equal(t.price, 0, 'M1 tile is free in v5.1.3');
  // Fake a v5.1.2 save: M1 tile bought once (paid the old price).
  w.restore({ li, t: 0, money: 0, stats: {}, tiles: [{ id: t.id, paid: 100, bought: 1 }] });
  assert.equal(t.done, true, 'M1 tile stays done after restore');
  assert.ok(!w.procs.find((p) => p.id === 'M1').hidden, 'M1 visible after restore');
  // M2 not bought in that save — still hidden, still costs coins.
  const m2 = w.procs.find((p) => p.id === 'M2');
  assert.ok(m2.hidden, 'M2 still hidden (not bought)');
  assert.ok(revealTile(w, 'M2').price > 0, 'M2 tile still costs coins');
});

// ---- Old save: M1 tile NOT bought -> restores with paid 0 (not -1), completes for free ----
check('old save: unbought M1 tile restores paid 0 and completes for free', () => {
  const li = 25; // L26
  const w = new World(li, { quiet: true });
  const t = revealTile(w, 'M1');
  // Fake a v5.1.2 save: M1 tile never bought, nothing paid.
  w.restore({ li, t: 0, money: 0, stats: {}, tiles: [{ id: t.id, paid: 0, bought: 0 }] });
  assert.equal(t.paid, 0, `M1 tile paid after restore should be 0, got ${t.paid} (the pre-fix value was -1, which would charge 1 coin)`);
  assert.equal(t.done, false, 'M1 tile not done yet');
  // Completing it costs no coins: money untouched, machine revealed.
  w.money = 50;
  w.completeTile(t);
  assert.equal(w.money, 50, 'completing the free M1 tile must not deduct coins');
  assert.ok(!w.procs.find((p) => p.id === 'M1').hidden, 'M1 visible after completing its free tile');
});

// ---- Old save (food level): L59 M1 tile 'b' bought at 240 stays bought ----
check('old save (food): L59 M1 tile bought at 240 stays bought, M1 visible', () => {
  const li = 58; // L59
  const w = new World(li, { quiet: true });
  const t = revealTile(w, 'M1');
  assert.equal(t.price, 0, 'L59 M1 tile is free in v5.1.3');
  w.restore({ li, t: 0, money: 0, stats: {}, tiles: [{ id: t.id, paid: 240, bought: 1 }] });
  assert.equal(t.done, true, 'L59 M1 tile stays done after restore');
  assert.ok(!w.procs.find((p) => p.id === 'M1').hidden, 'L59 M1 visible after restore');
  // M2 tile 'c' not bought — still not done, still costs coins.
  // (Do not assert M2.hidden: food levels leave M1/M2 unhidden in the config;
  // the unlock is the tile purchase, not the hidden flag.)
  assert.equal(revealTile(w, 'M2').done, false, 'L59 M2 tile not done (not bought)');
  assert.ok(revealTile(w, 'M2').price > 0, 'L59 M2 tile still costs coins');
});

// ---- New save round-trip: free M1 + paid M2 restore exactly ----
check('new save: free M1 + paid M2 round-trips exactly', () => {
  const li = 25; // L26
  const w = new World(li, { quiet: true });
  const t1 = revealTile(w, 'M1'), t2 = revealTile(w, 'M2');
  w.completeTile(t1); // free
  w.completeTile(t2); // coins (completeTile itself does not deduct; the pay loop does)
  assert.ok(!w.procs.find((p) => p.id === 'M1').hidden);
  assert.ok(!w.procs.find((p) => p.id === 'M2').hidden);
  const snap = w.snapshot();
  assert.equal(snap.tiles.find((t) => t.id === t1.id).bought, 1);
  assert.equal(snap.tiles.find((t) => t.id === t2.id).bought, 1);
  const w2 = new World(li, { quiet: true });
  w2.restore(snap);
  assert.equal(revealTile(w2, 'M1').done, true, 'M1 done after round-trip');
  assert.equal(revealTile(w2, 'M2').done, true, 'M2 done after round-trip');
  assert.ok(!w2.procs.find((p) => p.id === 'M1').hidden);
  assert.ok(!w2.procs.find((p) => p.id === 'M2').hidden);
});

console.log(`\nALL MACHINE-UNLOCK CHECKS PASS (${n} checks)`);
