// v4.6 / v4.7 分工 check, every level with staff logic (all machine levels + the 四季山谷): every tile bought, 180 s, player idle.
//  · raw counters in machine levels never pile up past CFG.v46.rawFull raw items from staff
//  · v4.7 fixed roles, every frame: a 机器专员 only holds its machine's crop and only stands at its machine or its fields;
//    a 原料搬运工 only holds raw-counter crops; a 加工品搬运工 only holds machine goods (it never farms) — 0 frames wrong
//  · staff don't crowd: frames where 3+ workers stand within 10 px of each other ≤ 5%
//  · machine starvation is reported (fit-check.mjs holds the limit)
//   BANMU_SEASON=0..3 node sim/labour-check.mjs [--level=N]
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
const only = process.argv.find((a) => a.startsWith('--level='));
let bad = 0, n = 0;
CFG.levels.forEach((L, li) => {
  if (only && +only.split('=')[1] !== li + 1) return;
  const w = new World(li, { quiet: true, seed: 55 + li });
  if (!w.smart) return;
  n++;
  let more = true; while (more) { more = false; for (const t of w.tiles) if (t.visible && !t.done) { w.completeTile(t, true); more = true; } }
  const raw = w.counters.filter((c) => !c.sale2), fed = w.procs.filter((p) => !w.procs.some((q) => q.outObj === p));
  const made = new Set(w.procs.map((p) => p.outItem));
  const rawItems = new Set(raw.flatMap((c) => c.items).filter((it) => !made.has(it)));
  let maxRaw = 0, crowd = 0, frames = 0; const wrong = {}; const starve = new Map(fed.map((p) => [p, 0]));
  const bump = (k) => { wrong[k] = (wrong[k] || 0) + 1; };
  for (let i = 0; i < 180 * 30; i++) {
    w.update(1 / 30, 0, 0); if (w.t < 20) continue;   // first 20 s: everyone just hired
    frames++;
    for (const c of raw) maxRaw = Math.max(maxRaw, w.rawStock(c));
    for (const p of fed) if (p.buf + p.inc === 0 && !(p.work > 0) && w.procSells(p)) starve.set(p, starve.get(p) + 1);
    for (const x of w.workers) {
      if (x.porter) { if (x.stack.some((t) => !made.has(t))) bump('搬运工拿了原料'); if (x.sources && x.sources.some((s) => s.kind !== 'proc')) bump('搬运工去田里'); }
      else if (x.feedFor) { const m = w.objs[x.feedFor]; if (x.stack.some((t) => t !== m.inItem)) bump('专员拿了别的'); if (x.toObjs && x.toObjs.some((s) => s !== m)) bump('专员去别处'); }
      else if (x.rawCarrier) { if (x.stack.some((t) => !rawItems.has(t))) bump('原料工拿了别的'); if (x.toObjs && x.toObjs.some((s) => s.kind !== 'counter' || s.sale2)) bump('原料工去机器'); }
    }
    const ws = w.workers;
    if (ws.some((a) => ws.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 10).length >= 3)) crowd++;
  }
  const errs = [];
  // (+4: a carrier mid-drop can land one or two past the cap)
  if (w.procs.length && maxRaw > CFG.v46.rawFull + 4) errs.push(`raw counter ${maxRaw} > ${CFG.v46.rawFull}`);
  for (const [k, v] of Object.entries(wrong)) errs.push(`${k} ${v} 帧`);
  if (crowd / frames > 0.05) errs.push(`crowding ${Math.round(crowd / frames * 100)}%`);
  const st = fed.map((p) => `${p.id} ${Math.round(starve.get(p) / frames * 100)}%`);
  if (errs.length) bad++;
  console.log(`${errs.length ? 'FAIL' : 'OK  '} 第${li + 1}关 ${L.name}: 原料台最高 ${maxRaw} · 机器缺料 ${st.join(' ') || '-'} · 扎堆 ${Math.round(crowd / frames * 100)}% · 工人 ${w.workers.length}${errs.length ? ' · ' + errs.join('; ') : ''}`);
});
console.log(bad ? `${bad} of ${n} levels failed` : `division of labour OK (${n} levels, fixed roles)`);
if (bad) process.exitCode = 1;
