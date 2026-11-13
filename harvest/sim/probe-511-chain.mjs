// v5.1.1 (C) chain specialist probe.
//   - Chain tile exists in the two food two-stage levels (L59, L65) at single x1.5,
//     replacing the two single specialists; M3/M4 singles stay.
//   - Machine two-stage levels (L26/32/38/40/43/45) have NO chain tile: there M2 is
//     fed directly by M1's output (world.js chain branch), so no M2 feeder exists
//     to replace and a chain worker would have no second feeding task.
//   - One task at a time (feedFor is a single id; chainFor is the list).
//   - Rotation: M2 dry + M1 safe -> go help M2; M2 fed or M1 dry -> back to M1.
//   - No switch while carrying / delivering.
//   - Machine close/remove (hidden) does not crash.
//   - Old saves load without error; a save that bought either single gets the
//     chain tile (one purchase); a save that bought neither gets nothing.
//   - 4 scenarios on L59/L65 (buy nothing / chain only / chain + upgrades / buy all):
//     M1/M2 starvation + counter service.
// Run: node sim/probe-511-chain.mjs [--level=N]
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';

const FOOD_CHAIN = [59, 65]; // food two-stage levels with a real M1+M2 feeder pair
const MACHINE_CHAIN = [26, 32, 38, 40, 43, 45]; // machine two-stage levels, M2 auto-fed
const only = +(process.argv.find((x) => x.startsWith('--level=')) || ' --level=0').split('=')[1] || 0;
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); ok ? pass++ : fail++; };

function buyTile(w, id, bought = new Set()) {
  const t = w.tiles.find((x) => x.id === id);
  if (!t || t.done || bought.has(id)) return;
  bought.add(id);
  for (const r of (t.req || [])) buyTile(w, r, bought);
  w.updateTileVis(true);
  const t2 = w.tiles.find((x) => x.id === id);
  if (t2 && !t2.done) w.completeTile(t2, true);
}
function buyAll(w, skip = new Set()) {
  let changed = true, loops = 0;
  while (changed && loops++ < 200) {
    changed = false;
    for (const t of w.tiles) if (t.visible && !t.done && !skip.has(t.id)) { w.completeTile(t, true); changed = true; }
  }
}

// ---------- 1. tile existence + price ----------
console.log('1. chain tile (food two-stage levels)');
for (const li of FOOD_CHAIN) {
  if (only && only !== li) continue;
  const w = new World(li - 1, { quiet: true });
  const chain = w.tiles.find((t) => t.id === 'food_chain_M1');
  const m1 = w.tiles.find((t) => t.id === 'food_machine_M1');
  const m2 = w.tiles.find((t) => t.id === 'food_machine_M2');
  const tally = w.tiles.find((t) => t.id === 'food_tally'); // price is hirePrice
  const hasM34 = w.procs.some((p) => p.id === 'M3' || p.id === 'M4');
  check(`L${li} chain tile exists`, !!chain);
  if (chain) {
    check(`L${li} chain price = single x1.5`, tally && chain.price === Math.round(tally.price * 1.5 / 10) * 10, `chain=${chain.price} single(hirePrice)=${tally ? tally.price : '?'}`);
    check(`L${li} chain label`, chain.label === '链式专员', chain.label);
    check(`L${li} chain feeds [M1,M2]`, Array.isArray(chain.effect.worker.feeder) && chain.effect.worker.feeder.join() === 'M1,M2', JSON.stringify(chain.effect.worker.feeder));
    check(`L${li} chain from both stands`, chain.effect.worker.from.length === 2, chain.effect.worker.from.join());
    check(`L${li} chain fullBatch`, !!chain.effect.worker.fullBatch);
    check(`L${li} chain req has both machine unlocks`, (chain.req || []).length >= 2, (chain.req || []).join());
  }
  check(`L${li} food_machine_M1 removed`, !m1);
  check(`L${li} food_machine_M2 removed`, !m2);
  if (hasM34) check(`L${li} other singles stay (M3/M4)`, !!w.tiles.find((t) => /^food_machine_M[34]$/.test(t.id)), w.tiles.filter((t) => /^food_machine_M/.test(t.id)).map((t) => t.id).join(','));
}
console.log('1b. machine two-stage levels (no chain tile — M2 auto-fed by M1)');
for (const li of MACHINE_CHAIN) {
  if (only && only !== li) continue;
  const w = new World(li - 1, { quiet: true });
  check(`L${li} no chain tile (M2 auto-fed)`, !w.tiles.some((t) => /chain/.test(t.id)));
  check(`L${li} no M2 feeder tile`, !w.tiles.some((t) => t.effect && t.effect.worker && t.effect.worker.feeder === 'M2'));
}

// ---------- 2. one task at a time + rotation ----------
console.log('2. chain worker: one task at a time, primary/secondary + emergency');
for (const li of FOOD_CHAIN) {
  if (only && only !== li) continue;
  const w = new World(li - 1, { quiet: true });
  buyTile(w, 'food_chain_M1');
  const cw = w.workers.find((x) => x.chainFor);
  check(`L${li} chain worker hired`, !!cw);
  if (!cw) continue;
  check(`L${li} feedFor is a single id`, typeof cw.feedFor === 'string' && cw.feedFor === 'M1', `feedFor=${JSON.stringify(cw.feedFor)}`);
  check(`L${li} chainFor is [M1,M2]`, Array.isArray(cw.chainFor) && cw.chainFor.join() === 'M1,M2', JSON.stringify(cw.chainFor));
  check(`L${li} starts on primary M1`, cw.feedFor === 'M1');
  const m1 = w.procs.find((p) => p.id === 'M1'), m2 = w.procs.find((p) => p.id === 'M2');
  // M2 dry + M1 safe -> go help M2 (M2's source stand holds a batch of input)
  cw.state = 'collect'; cw.stack = []; cw.incoming = 0;
  m1.buf = m1.ratio; m1.inc = 0; m2.buf = 0; m2.inc = 0;
  const src2 = cw.from.map((id) => w.objs[id]).find((o) => o && o.item === m2.inItem);
  if (src2 && src2.pile) src2.pile.total = cw.cap; // a full batch on M2's source stand
  w.updateChainTarget(cw);
  check(`L${li} M2 dry + M1 safe -> help M2`, cw.feedFor === 'M2', `feedFor=${cw.feedFor}`);
  // M2 fed -> back to M1
  m2.buf = m2.ratio;
  w.updateChainTarget(cw);
  check(`L${li} M2 fed -> back to M1`, cw.feedFor === 'M1', `feedFor=${cw.feedFor}`);
  // M2 dry + M1 dry -> stay/return to M1 (M1 stopping cuts the whole chain)
  cw.feedFor = 'M2'; m1.buf = 0; m2.buf = 0;
  w.updateChainTarget(cw);
  check(`L${li} M1 dry pulls worker back`, cw.feedFor === 'M1', `feedFor=${cw.feedFor}`);
  // No switch while carrying
  cw.feedFor = 'M1'; cw.state = 'collect'; cw.stack = ['wheat']; cw.incoming = 0;
  m1.buf = m1.ratio; m2.buf = 0;
  w.updateChainTarget(cw);
  check(`L${li} no switch while carrying (stack)`, cw.feedFor === 'M1', `feedFor=${cw.feedFor}`);
  cw.stack = []; cw.incoming = 5;
  w.updateChainTarget(cw);
  check(`L${li} no switch while carrying (incoming)`, cw.feedFor === 'M1', `feedFor=${cw.feedFor}`);
  // No switch while delivering
  cw.incoming = 0; cw.state = 'deliver';
  w.updateChainTarget(cw);
  check(`L${li} no switch while delivering`, cw.feedFor === 'M1', `feedFor=${cw.feedFor}`);
  // Target and carried items are independent: carrying flour for M2 must not
  // be lost/reset by a target change (target only changes when empty).
  cw.state = 'collect'; cw.stack = ['flour']; cw.incoming = 0; cw.feedFor = 'M2';
  m1.buf = 0; m2.buf = 0;
  w.updateChainTarget(cw);
  check(`L${li} carrying flour keeps M2 target + load`, cw.feedFor === 'M2' && cw.stack[0] === 'flour', `feedFor=${cw.feedFor} stack=${cw.stack.join()}`);
}

// ---------- 3. machine close/remove does not crash ----------
console.log('3. machine close/remove (hidden) does not crash');
for (const li of FOOD_CHAIN) {
  if (only && only !== li) continue;
  const w = new World(li - 1, { quiet: true });
  buyTile(w, 'food_chain_M1');
  const cw = w.workers.find((x) => x.chainFor);
  const m1 = w.procs.find((p) => p.id === 'M1'), m2 = w.procs.find((p) => p.id === 'M2');
  let ok = true;
  try {
    m2.hidden = true;
    w.updateChainTarget(cw);
    for (let i = 0; i < 5 * 30; i++) w.update(1 / 30, 0, 0);
    m2.hidden = false; m1.hidden = true;
    w.updateChainTarget(cw);
    for (let i = 0; i < 5 * 30; i++) w.update(1 / 30, 0, 0);
    m1.hidden = false;
    for (let i = 0; i < 5 * 30; i++) w.update(1 / 30, 0, 0);
  } catch (e) { ok = false; console.log('    error:', e.message); }
  check(`L${li} hide M1/M2 + run 15s: no crash`, ok);
}

// ---------- 4. save compatibility ----------
console.log('4. save compatibility (old saves)');
for (const li of FOOD_CHAIN) {
  if (only && only !== li) continue;
  // (a) old save that bought BOTH singles -> chain granted (one purchase)
  let ok = true, detail = '';
  try {
    const w = new World(li - 1, { quiet: true });
    w.restore({ tiles: [
      { id: 'b', paid: 0, bought: 1 }, { id: 'c', paid: 0, bought: 1 },
      { id: 'food_machine_M1', paid: 0, bought: 1 }, { id: 'food_machine_M2', paid: 0, bought: 1 },
    ] });
    const cw = w.workers.filter((x) => x.chainFor);
    const chainTile = w.tiles.find((t) => t.id === 'food_chain_M1');
    ok = cw.length === 1 && chainTile && chainTile.done;
    detail = `chain workers=${cw.length} chain done=${!!(chainTile && chainTile.done)}`;
  } catch (e) { ok = false; detail = 'error: ' + e.message; }
  check(`L${li} old save (both singles bought) -> 1 chain worker`, ok, detail);
  // (b) old save that bought ONE single -> chain granted
  try {
    const w = new World(li - 1, { quiet: true });
    w.restore({ tiles: [
      { id: 'b', paid: 0, bought: 1 }, { id: 'c', paid: 0, bought: 1 },
      { id: 'food_machine_M2', paid: 0, bought: 1 },
    ] });
    const cw = w.workers.filter((x) => x.chainFor);
    ok = cw.length === 1;
    detail = `chain workers=${cw.length}`;
  } catch (e) { ok = false; detail = 'error: ' + e.message; }
  check(`L${li} old save (one single bought) -> 1 chain worker`, ok, detail);
  // (c) old save that bought NEITHER single -> no chain worker
  try {
    const w = new World(li - 1, { quiet: true });
    w.restore({ tiles: [{ id: 'b', paid: 0, bought: 1 }, { id: 'c', paid: 0, bought: 1 }] });
    const cw = w.workers.filter((x) => x.chainFor);
    ok = cw.length === 0;
    detail = `chain workers=${cw.length}`;
  } catch (e) { ok = false; detail = 'error: ' + e.message; }
  check(`L${li} old save (neither single) -> no chain worker`, ok, detail);
  // (d) new save round-trip: chain worker survives snapshot -> restore, not doubled
  try {
    const w1 = new World(li - 1, { quiet: true });
    buyTile(w1, 'food_chain_M1');
    const snap = w1.snapshot();
    const w2 = new World(li - 1, { quiet: true });
    w2.restore(snap);
    const cw = w2.workers.filter((x) => x.chainFor);
    ok = cw.length === 1;
    detail = `chain workers after round-trip=${cw.length}`;
  } catch (e) { ok = false; detail = 'error: ' + e.message; }
  check(`L${li} new save round-trip keeps exactly 1 chain worker`, ok, detail);
  // (e) already-bought singles on OTHER machines unaffected (M3/M4 still hire)
  // (only levels that have M3/M4)
  if (new World(li - 1, { quiet: true }).procs.some((p) => p.id === 'M3' || p.id === 'M4')) {
    try {
      const w = new World(li - 1, { quiet: true });
      w.restore({ tiles: [
        { id: 'g', paid: 0, bought: 1 }, { id: 'h', paid: 0, bought: 1 },
        { id: 'food_machine_M3', paid: 0, bought: 1 }, { id: 'food_machine_M4', paid: 0, bought: 1 },
      ] });
      const singles = w.workers.filter((x) => x.feedFor === 'M3' || x.feedFor === 'M4');
      ok = singles.length === 2;
      detail = `M3/M4 singles=${singles.length}`;
    } catch (e) { ok = false; detail = 'error: ' + e.message; }
    check(`L${li} old save M3/M4 singles unaffected`, ok, detail);
  }
}

// ---------- 5. four scenarios (food chain levels) ----------
// S0 buy nothing (no chain, no upgrades) · S1 chain only · S2 chain + M1/M2 Lv2
// S3 buy all (B+A+C combined: chain + upgrades + salesperson + full staff).
// Other tiles are bought in every scenario (full-staff background), so only the
// chain tile and the M1/M2 procUp tiles vary — same pattern as probe-508.
console.log('5. four scenarios (M1/M2 starvation, counter service)');
const pct = (a, b) => Math.round((a / Math.max(1, b)) * 100);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
function runScenario(li, scenario, seed) {
  const w = new World(li - 1, { quiet: true, seed: 31 + (li - 1) + seed * 7919 });
  const upTile = (mid) => w.tiles.find((t) => t.effect.procUp === mid);
  const chainTile = w.tiles.find((t) => t.id === 'food_chain_M1');
  const skip = new Set();
  if (scenario === 'S0') { if (chainTile) skip.add(chainTile.id); for (const m of ['M1', 'M2']) { const t = upTile(m); if (t) skip.add(t.id); } }
  if (scenario === 'S1') { for (const m of ['M1', 'M2']) { const t = upTile(m); if (t) skip.add(t.id); } }
  buyAll(w, skip);
  const buyLv2 = (mid) => { const t = upTile(mid); if (t) { w.completeTile(t, true); w.completeTile(t, true); } };
  if (scenario === 'S2' || scenario === 'S3') { buyLv2('M1'); buyLv2('M2'); }
  const fed = w.procs.filter((p) => !p.hidden);
  const starve = new Map(fed.map((p) => [p, 0]));
  const chainIdle = new Map();
  for (const x of w.workers) if (x.chainFor) chainIdle.set(x, 0);
  let frames = 0;
  const m1 = w.procs.find((p) => p.id === 'M1'), m2 = w.procs.find((p) => p.id === 'M2');
  for (let i = 0; i < 150 * 30; i++) {
    const pos = w.workers.map((x) => [x.x, x.y]);
    w.update(1 / 30, 0, 0);
    if (w.t < 25) continue;
    frames++;
    for (const p of fed) {
      if (p.buf + p.inc === 0 && !(p.work > 0) && w.procSells(p) && !(p.pile && p.pile.full && p.pile.full())) starve.set(p, starve.get(p) + 1);
    }
    w.workers.forEach((x, k) => {
      if (chainIdle.has(x) && x.stack.length + x.incoming === 0 && Math.hypot(x.x - pos[k][0], x.y - pos[k][1]) < 0.05) chainIdle.set(x, chainIdle.get(x) + 1);
    });
  }
  const log = (w.waitLog || []).filter((e) => e.t > 25);
  const counters = w.counters.filter((c) => !c.hidden).map((c) => {
    const e = log.filter((x) => x.c === c.id);
    return `${c.id}:n${e.length}/svc${e.length ? avg(e.map((x) => x.svc)).toFixed(1) : '-'}s`;
  });
  const idle = [...chainIdle.values()].map((v) => pct(v, frames)).join('/') || '-';
  return { m1Starve: pct(starve.get(m1) || 0, frames), m2Starve: pct(starve.get(m2) || 0, frames), chainIdle: idle, counters: counters.join(' ') };
}
for (const li of FOOD_CHAIN) {
  if (only && only !== li) continue;
  const w0 = new World(li - 1, { quiet: true });
  console.log(`\n  L${li} ${w0.L.name}`);
  for (const sc of ['S0', 'S1', 'S2', 'S3']) {
    const rs = [0, 1, 2].map((s) => runScenario(li, sc, s));
    console.log(`    ${sc} ${sc === 'S0' ? '(neither)      ' : sc === 'S1' ? '(chain only)   ' : sc === 'S2' ? '(chain + Lv2)  ' : '(buy all)      '}: M1 starve ${med(rs.map((r) => r.m1Starve))}% · M2 starve ${med(rs.map((r) => r.m2Starve))}% · chain idle ${rs[0].chainIdle}% · ${rs[0].counters}`);
  }
}
console.log('\nRead: S1 vs S0 shows what one chain worker adds over no chain feeder;');
console.log('S2 vs S1 shows the upgrade effect on the chain; S3 is the B+A+C combined state.');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
