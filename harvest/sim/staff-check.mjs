// v4.3 / v4.5 staff check, every machine level:
//  · nothing is free at the start (no workers, clerks, machines or 加工品 counter)
//  · v4.5 exactly ONE dedicated feeder per machine fed from the farm; it delivers small batches (never a full stack)
//  · 原料搬运工 deliver raw crops to the raw counter; 加工品搬运工 carry machine goods to the 「加工品」 counter
//    (or, in a oneCounter level, to the single counter)
//  · v4.5 idle staff help on the farm: with no 加工品 counter yet the machine fills up and its feeder brings crops to the
//    raw counter instead of standing by; nobody (feeder / porter) stands idle for long
//  · v4.5 levels 32 面包房 / 43 早市面包摊 have ONE counter (raw + bread) with ONE 店员 tile, no 加工品 counter
//   node sim/staff-check.mjs [--level=N] [--secs=120]
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
const only = process.argv.find((a) => a.startsWith('--level='));
const SECS = +((process.argv.find((a) => a.startsWith('--secs=')) || '--secs=120').split('=')[1]);
const ONE = ['面包房', '早市面包摊', '葡萄酒庄'];
let bad = 0, n = 0;
const buyAll = (w, skip = () => false) => { let more = true; while (more) { more = false; for (const t of w.tiles) if (t.visible && !t.done && !skip(t)) { w.completeTile(t, true); more = true; } } };
function run(w, secs, watch) {
  const st = new Map();
  for (let i = 0; i < secs * 30; i++) {
    const before = new Map(w.workers.map((x) => [x, { s: x.state, h: x.helping, x: x.x, y: x.y }]));
    w.update(1 / 30, 0, 0);
    for (const x of w.workers) {
      if (!x.feedFor && !x.porter) continue;
      let s = st.get(x); if (!s) st.set(x, (s = { loads: [], idle: 0, t: 0, helpDrops: 0 }));
      const b = before.get(x); if (!b) continue;
      s.t += 1 / 30;
      const load = x.stack.length + x.incoming;
      if (x.feedFor && b.s === 'collect' && x.state === 'deliver' && !x.helping && !b.h) s.loads.push(load);
      if (load === 0 && Math.hypot(x.x - b.x, x.y - b.y) < 0.05) s.idle += 1 / 30;
    }
  }
  return st;
}
CFG.levels.forEach((L, li) => {
  if (only && +only.split('=')[1] !== li + 1) return;
  if (!L.objects.some((o) => o.type === 'proc')) return;
  n++;
  const errs = [];
  const w = new World(li, { quiet: true, seed: 77 + li });
  const ps = w.objs.PS, one = !!L.oneCounter;
  const FIN = (() => { const m = L.objects.filter((o) => o.type === 'proc'); const last = m.find((o) => !m.some((q) => q.in === o.out)); return last ? last.out : 'bread'; })();   // the chain's final product
  const sale = one ? w.counters[0] : ps;
  if (!sale) { errs.push('no 加工品 counter'); }
  if (ONE.includes(L.name)) {
    if (!one || ps) errs.push('should have ONE counter');
    if (w.counters.length !== 1) errs.push(`${w.counters.length} counters`);
    const clerks = w.tiles.filter((t) => t.effect.cashier).length;
    if (clerks !== 1) errs.push(`${clerks} 店员 tiles`);
    if (!w.counters[0].items.includes(FIN)) errs.push(`counter does not sell ${FIN}`);
  }
  const free = [];
  if (w.workers.length) free.push(`${w.workers.length} workers`);
  if (w.counters.some((c) => c.cashier)) free.push('a clerk');
  if (w.procs.some((p) => !p.hidden)) free.push('a machine');
  if (ps && !ps.hidden) free.push('the 加工品 counter');
  if (free.length) errs.push('FREE AT START: ' + free.join(', '));
  // A) every tile bought
  buyAll(w);
  const st = run(w, SECS);
  const farmFed = w.procs.filter((p) => !w.procs.some((q) => q.outObj === p));
  for (const p of farmFed) {
    const f = w.workers.filter((x) => x.feedFor === p.id);
    if (f.length !== 1) errs.push(`${p.id} has ${f.length} feeders`);
    for (const x of f) {
      const s = st.get(x) || { loads: [] };
      if (!(x.drops || {})[p.id]) errs.push(`${p.id} feeder never delivered`);
      const mx = s.loads.length ? Math.max(...s.loads) : 0;
      if (s.loads.length && mx >= x.cap) errs.push(`${p.id} feeder waited for a full stack (${mx}/${x.cap})`);
      x._mx = mx; x._trips = s.loads.length;
    }
  }
  if (w.workers.some((x) => x.to.some((id) => w.objs[id] && w.objs[id].kind === 'proc') && !x.feedFor)) errs.push('a non-feeder hire feeds a machine');
  const raw = w.workers.filter((x) => x.rawCarrier), por = w.workers.filter((x) => x.porter);
  const rawIds = new Set(w.counters.filter((c) => c !== ps).map((c) => c.id));
  if (!raw.every((x) => Object.keys(x.drops || {}).some((id) => rawIds.has(id)) && !(x.drops || {}).PS)) errs.push('a raw carrier missed the raw counter');
  // (a porter that is not needed at the tray right now may be out on the farm: at least one must have carried goods)
  if (por.length !== (one ? 1 : 2) || !por.some((x) => (x.drops || {})[sale.id] > 0)) errs.push('porters did not deliver goods');
  if (one && !(w.stats.sold[FIN] > 0)) errs.push(`no ${FIN} sold`);
  const staff = w.workers.filter((x) => x.feedFor || x.porter);
  for (const x of staff) { const s = st.get(x); if (s && s.idle / s.t > 0.25) errs.push(`${x.feedFor ? 'feeder ' + x.feedFor : 'porter'} idle ${Math.round(s.idle / s.t * 100)}%`); }
  const helpedA = staff.filter((x) => x.helpN > 0).length;
  // B) no 加工品 counter yet: tray and input fill up, its feeder must go and farm for the raw counter
  let helpB = '-';
  if (ps) {
    const w2 = new World(li, { quiet: true, seed: 177 + li });
    buyAll(w2, (t) => t.id === 'x_ps');
    run(w2, 300);   // the tray (no porters yet) fills, the machine stops, its input fills up
    const fs = w2.workers.filter((x) => x.feedFor);
    let ok = fs.some((x) => x.helpN > 0 && Object.keys(x.drops || {}).some((id) => rawIds.has(id)));
    // v4.6 分工 (smartStaff): a feeder only farms when the raw counter runs low; otherwise it waits at its post with a batch
    const held = L.smartStaff && fs.some((x) => x.holding && x.stack.length > 0 && w2.objs[x.feedFor].buf + w2.objs[x.feedFor].inc >= CFG.proc.inMax);
    const busy = L.smartStaff && fs.every((x) => (x.drops || {})[x.feedFor] > 0 && w2.objs[x.feedFor].buf + w2.objs[x.feedFor].inc < CFG.proc.inMax);   // its machine never filled: it kept feeding
    helpB = ok ? 'feeder farmed' : held ? 'feeder waits at its post' : busy ? 'feeder kept feeding' : 'NO';
    ok = ok || held || busy;
    if (!ok) errs.push('feeders never helped on the farm while the machine was full');
  }
  const fsum = w.workers.filter((x) => x.feedFor).map((x) => `${x.feedFor}:${x._trips || 0}趟≤${x._mx || 0}/${x.cap}`).join(' ');
  const ok = !errs.length; if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} 第${li + 1}关 ${L.name}: 专员 ${fsum} · 原料搬运工 ×${raw.length} · 加工品搬运工 ×${por.length}→${sale ? sale.id : '?'} · 帮农活 ${helpedA}/${staff.length}${ps ? ' · 无加工品台时 ' + helpB : ' · 单收银台'}${errs.length ? ' · ' + errs.join('; ') : ''}`);
});
console.log(bad ? `${bad} of ${n} machine levels failed` : `all ${n} machine levels: one feeder per machine, small batches, idle staff farm, porters → goods counter, nothing free at start`);
