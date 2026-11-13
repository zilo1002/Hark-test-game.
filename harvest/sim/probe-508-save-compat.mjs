// v5.0.8 save compatibility: old (v5.0.7) saves that bought a one-time food `proc`
// tile must keep the upgrade on EVERY machine it covered; new saves must round-trip
// exactly (no migration, no double charge, cap 2).
// Run: node sim/probe-508-save-compat.mjs  (exit 1 on any failure)
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';

const approx = (a, b) => Math.abs(a - b) < 1e-6;
const machine = (w, id) => w.procs.find((p) => p.id === id);
const tile = (w, id) => w.tiles.find((t) => t.id === id);
const baseTime = (li, id) => { const w = new World(li, { quiet: true }); return machine(w, id).time; };
const T = CFG.procUp.timeMul, T2 = CFG.procUp.time2; // 0.42, 0.7
let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`PASS ${name}`); };

// ---- L65 (food, two-stage): old save bought the one-time 快酒桶 tile 'i' (M1+M2) ----
check('L65 old save: bought proc tile keeps Lv1 on BOTH machines (migration)', () => {
  const li = 64; // L65, 0-based index 64
  const t1 = baseTime(li, 'M1'), t2 = baseTime(li, 'M2');
  const w = new World(li, { quiet: true });
  // Fake a v5.0.7 save: tile 'i' bought once; 'u_M2' ABSENT (it did not exist).
  w.restore({ li, t: 0, money: 0, stats: {}, tiles: [{ id: 'i', paid: 0, bought: 1 }] });
  assert.equal(machine(w, 'M1').upLv, 1, 'M1 upLv');
  assert.equal(machine(w, 'M2').upLv, 1, 'M2 upLv (migrated, not lost)');
  assert.ok(approx(machine(w, 'M1').time, t1 * T), `M1 time ${machine(w, 'M1').time} vs ${t1 * T}`);
  assert.ok(approx(machine(w, 'M2').time, t2 * T), `M2 time ${machine(w, 'M2').time} vs ${t2 * T}`);
  assert.equal(tile(w, 'i').bought, 1);
  assert.equal(tile(w, 'u_M2').bought, 1, 'u_M2 bought=1 via migration');
  assert.ok(tile(w, 'i').label.endsWith(' II'), `M1 tile label shows II: ${tile(w, 'i').label}`);
  assert.ok(tile(w, 'u_M2').label.endsWith(' II'), `M2 tile label shows II: ${tile(w, 'u_M2').label}`);
  // After migration, buying M2 again reaches Lv2 (not Lv1 again, no double Lv1).
  w.completeTile(tile(w, 'u_M2'));
  assert.equal(machine(w, 'M2').upLv, 2);
  assert.ok(approx(machine(w, 'M2').time, t2 * T * T2), `M2 Lv2 time ${machine(w, 'M2').time} vs ${t2 * T * T2}`);
  assert.equal(tile(w, 'u_M2').bought, 2);
  assert.equal(tile(w, 'u_M2').done, true, 'capped at 2, no third purchase');
});

// ---- L65: old save that did NOT buy the proc tile -> no migration, both Lv0 ----
check('L65 old save: proc tile not bought -> no migration, both Lv0', () => {
  const li = 64;
  const w = new World(li, { quiet: true });
  w.restore({ li, t: 0, money: 0, stats: {}, tiles: [{ id: 'i', paid: 0, bought: 0 }] });
  assert.equal(machine(w, 'M1').upLv || 0, 0);
  assert.equal(machine(w, 'M2').upLv || 0, 0);
  assert.equal(tile(w, 'u_M2').bought, 0);
});

// ---- L65: new save, only M1 bought -> restore keeps M1 Lv1, M2 Lv0 (no migration) ----
check('L65 new save: only M1 bought -> M2 stays Lv0 (no false migration)', () => {
  const li = 64;
  const w = new World(li, { quiet: true });
  w.completeTile(tile(w, 'i')); // buy M1 Lv1 only
  const snap = w.snapshot();
  assert.equal(snap.tiles.find((t) => t.id === 'u_M2').bought, 0, 'u_M2 present in new save');
  const w2 = new World(li, { quiet: true });
  w2.restore(snap);
  assert.equal(machine(w2, 'M1').upLv, 1);
  assert.equal(machine(w2, 'M2').upLv || 0, 0, 'M2 must NOT be migrated in a new save');
  assert.equal(tile(w2, 'u_M2').bought, 0);
});

// ---- L65: new save, M1 Lv2 + M2 Lv1 -> round-trips exactly, no double charge ----
check('L65 new save: M1 Lv2 + M2 Lv1 round-trips, cap respected', () => {
  const li = 64;
  const t1 = baseTime(li, 'M1'), t2 = baseTime(li, 'M2');
  const w = new World(li, { quiet: true });
  w.completeTile(tile(w, 'i')); w.completeTile(tile(w, 'i')); // M1 Lv2
  w.completeTile(tile(w, 'u_M2')); // M2 Lv1
  assert.equal(machine(w, 'M1').upLv, 2);
  assert.ok(approx(machine(w, 'M1').time, t1 * T * T2));
  const snap = w.snapshot();
  const w2 = new World(li, { quiet: true });
  w2.restore(snap);
  assert.equal(machine(w2, 'M1').upLv, 2);
  assert.equal(machine(w2, 'M2').upLv, 1);
  assert.ok(approx(machine(w2, 'M1').time, t1 * T * T2), 'M1 time survives restore');
  assert.ok(approx(machine(w2, 'M2').time, t2 * T), 'M2 time survives restore');
  assert.equal(tile(w2, 'i').bought, 2);
  assert.equal(tile(w2, 'i').done, true, 'M1 tile done at 2, cannot buy a 3rd time');
  assert.equal(tile(w2, 'u_M2').bought, 1);
});

// ---- L59 (food, was 0 tiers): new tiles buyable, Lv1 then Lv2, label shows II ----
check('L59 new tiles: Lv1 then Lv2, label II, cumulative x0.294', () => {
  const li = 58;
  const t1 = baseTime(li, 'M1');
  const w = new World(li, { quiet: true });
  assert.equal(tile(w, 'u_M1').bought, 0);
  assert.ok(!tile(w, 'u_M1').label.endsWith(' II'), 'Lv1 label has no II yet');
  w.completeTile(tile(w, 'u_M1'));
  assert.equal(machine(w, 'M1').upLv, 1);
  assert.ok(approx(machine(w, 'M1').time, t1 * T));
  assert.ok(tile(w, 'u_M1').label.endsWith(' II'), `label after Lv1: ${tile(w, 'u_M1').label}`);
  assert.equal(tile(w, 'u_M1').done, false, 'not done after Lv1');
  w.completeTile(tile(w, 'u_M1'));
  assert.equal(machine(w, 'M1').upLv, 2);
  assert.ok(approx(machine(w, 'M1').time, t1 * T * T2), `cumulative ${machine(w, 'M1').time} vs ${t1 * T * T2}`);
  assert.equal(tile(w, 'u_M1').done, true);
});

// ---- L26 (machine level, woodworking): round-trip unaffected by the change ----
check('L26 machine level: upgrade round-trips, no migration interference', () => {
  const li = 25;
  const t1 = baseTime(li, 'M1');
  const w = new World(li, { quiet: true });
  w.completeTile(tile(w, 'f')); // M1 Lv1 (original tile id kept by step 4)
  const snap = w.snapshot();
  const w2 = new World(li, { quiet: true });
  w2.restore(snap);
  assert.equal(machine(w2, 'M1').upLv, 1);
  assert.ok(approx(machine(w2, 'M1').time, t1 * T));
  assert.equal(machine(w2, 'M2').upLv || 0, 0, 'M2 untouched');
});

console.log(`ALL SAVE-COMPAT CHECKS PASS (${n} checks)`);
