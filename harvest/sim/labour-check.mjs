// v4.6 分工 check (levels with smartStaff, i.e. the 四季山谷): every tile bought, 180 s with the player idle.
//  · raw counters in machine levels never pile up past CFG.v46.rawFull raw items from staff
//  · no misallocation while a machine is starved (input empty, its crop ripe in the field): no non-feeder is then carrying
//    that crop to a raw counter that is already stocked (≥ rawLow), or standing at a post holding it — ≤ 10% of the frames (re-path lag and a counter that just ran low count too).
//    (Plain starvation is reported too; it is mostly the harvest rate of one feeder vs a fully upgraded machine.)
//  · staff don't crowd: frames where 3+ workers stand within 10 px of each other ≤ 5%
//   BANMU_SEASON=0..3 node sim/labour-check.mjs [--level=N]
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
const only = process.argv.find((a) => a.startsWith('--level='));
let bad = 0;
CFG.levels.forEach((L, li) => {
  if (!L.smartStaff || (only && +only.split('=')[1] !== li + 1)) return;
  const w = new World(li, { quiet: true, seed: 55 + li });
  let more = true; while (more) { more = false; for (const t of w.tiles) if (t.visible && !t.done) { w.completeTile(t, true); more = true; } }
  const raw = w.counters.filter((c) => !c.sale2), fed = w.procs.filter((p) => !w.procs.some((q) => q.outObj === p));
  let maxRaw = 0, crowd = 0, frames = 0, mis = 0; const starve = new Map(fed.map((p) => [p, 0]));
  for (let i = 0; i < 180 * 30; i++) {
    w.update(1 / 30, 0, 0); if (w.t < 20) continue;   // first 20 s: everyone just hired
    frames++;
    for (const c of raw) maxRaw = Math.max(maxRaw, w.rawStock(c));
    for (const p of fed) { const ripe = w.fields.concat(w.ponds).some((f) => !f.hidden && f.item === p.inItem && (f.ripe || (f.fish && f.fish.length))); if (ripe && p.buf + p.inc === 0 && !(p.work > 0)) {
      starve.set(p, starve.get(p) + 1);
      if (w.workers.some((x) => !x.feedFor && x.stack.includes(p.inItem) && (x.holding || (x.state === 'deliver' && !x.assist && raw.some((c) => x.toObjs.includes(c) && w.rawStock(c) >= CFG.v46.rawLow))))) mis++;
    } }
    const ws = w.workers;
    if (ws.some((a) => ws.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 10).length >= 3)) crowd++;
  }
  const errs = [];
  // (+4: a carrier mid-drop can land one or two past the cap)
  if (w.procs.length && maxRaw > CFG.v46.rawFull + 4) errs.push(`raw counter ${maxRaw} > ${CFG.v46.rawFull}`);
  const st = fed.map((p) => `${p.id} ${Math.round(starve.get(p) / frames * 100)}%`);
  if (mis / frames > 0.1) errs.push(`misallocated ${Math.round(mis / frames * 100)}%`);
  if (crowd / frames > 0.05) errs.push(`crowding ${Math.round(crowd / frames * 100)}%`);
  if (errs.length) bad++;
  console.log(`${errs.length ? 'FAIL' : 'OK  '} 第${li + 1}关 ${L.name}: 原料台最高 ${maxRaw} · 机器空转 ${st.join(' ') || '-'} · 机器空转时分工错 ${Math.round(mis / Math.max(1, frames) * 100)}% · 扎堆 ${Math.round(crowd / frames * 100)}% · 工人 ${w.workers.length}${errs.length ? ' · ' + errs.join('; ') : ''}`);
});
console.log(bad ? `${bad} levels failed` : 'division of labour OK');
if (bad) process.exitCode = 1;
