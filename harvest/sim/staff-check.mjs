// v4.7 staff check (fixed roles), every machine level:
//  · nothing is free at the start (no workers, clerks, machines or 加工品 counter)
//  · 机器专员: one tile per farm-fed machine plus one paid tile for a 2nd (so 2 with everything bought), v4.8 plus a paid 3rd
//    tile (x_h<machine>, after the 2nd x_g, pricier) on the machines CFG.v48.feed3 lists; a feeder only
//    ever holds its machine's crop and only drops into its machine (never a counter); it brings small batches
//  · 原料搬运工: only hold raw-counter crops and only drop at a raw counter (never a machine, never the 加工品 counter)
//  · 加工品搬运工: exactly one per finished-goods machine; only ever hold machine goods (never harvest) and only drop at the
//    goods counter (the single counter in a oneCounter level); trays stay below CFG.v47.trayMax once porters are hired
//  · purchase order: the goods counter's porter and 店员 come within the guide window right after the 加工品 counter
//  · no 加工品 counter yet: the machine fills up and its feeders wait by it (they never carry crops anywhere else)
//  · levels 32 面包房 / 40 葡萄酒庄 / 43 早市面包摊 have ONE counter with ONE 店员 tile
//   node sim/staff-check.mjs [--level=N] [--secs=120]
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import { feed3Of } from '../js/sales.js';
const only = process.argv.find((a) => a.startsWith('--level='));
const SECS = +((process.argv.find((a) => a.startsWith('--secs=')) || '--secs=120').split('=')[1]);
const ONE = ['面包房', '早市面包摊', '葡萄酒庄'];
let bad = 0, n = 0;
const buyAll = (w, skip = () => false) => { let more = true; while (more) { more = false; for (const t of w.tiles) if (t.visible && !t.done && !skip(t)) { w.completeTile(t, true); more = true; } } };
// run, recording what every worker ever held, its feeder batch sizes, and the tray peak
function run(w, secs) {
  const st = new Map(); let trayMax = 0;
  for (let i = 0; i < secs * 30; i++) {
    const before = new Map(w.workers.map((x) => [x, x.state]));
    w.update(1 / 30, 0, 0);
    if (w.t > 20) for (const p of w.procs) if (p.pile && !p.hidden) trayMax = Math.max(trayMax, p.pile.total);
    for (const x of w.workers) {
      let s = st.get(x); if (!s) st.set(x, (s = { held: new Set(), loads: [] }));
      for (const it of x.stack) s.held.add(it);
      if (x.feedFor && before.get(x) === 'collect' && x.state === 'deliver') s.loads.push(x.stack.length + x.incoming);
    }
  }
  return { st, trayMax };
}
CFG.levels.forEach((L0, li) => {
  if (only && +only.split('=')[1] !== li + 1) return;
  const probe = new World(li, { quiet: true });
  if (!probe.procs.length) return;
  n++;
  const L = probe.L, errs = [];
  const w = new World(li, { quiet: true, seed: 77 + li });
  const ps = w.objs.PS, one = !!L.oneCounter;
  const made = new Set(w.procs.map((p) => p.outItem));
  const term = w.procs.filter((p) => p.pile);
  const FIN = term.length ? term[term.length - 1].outItem : null;
  const sale = one ? w.counters[0] : ps;
  if (!sale) errs.push('no 加工品 counter');
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
  // purchase order: porter + 店员 right behind the 加工品 counter (the guide looks CFG.guideWindow tiles ahead)
  if (ps) {
    const ids = w.tiles.map((t) => t.id), i = ids.indexOf('x_ps'), ip = ids.indexOf('x_p1'), ic = ids.indexOf('x_pc');
    if (!(ip > i && ip - i <= CFG.guideWindow && ic > i && ic - i <= CFG.guideWindow)) errs.push(`order: 加工品台 #${i}, 搬运工 #${ip}, 店员 #${ic}`);
  }
  // A) every tile bought
  buyAll(w);
  const { st, trayMax } = run(w, SECS);
  const rawIds = new Set(w.counters.filter((c) => c !== ps).map((c) => c.id));
  const rawItems = new Set(w.counters.filter((c) => c !== ps).flatMap((c) => c.items).filter((it) => !made.has(it)));
  const drops = (x) => Object.keys(x.drops || {});
  const farmFed = w.procs.filter((p) => !w.procs.some((q) => q.outObj === p));
  for (const p of farmFed) {
    const f = w.workers.filter((x) => x.feedFor === p.id);
    const want = feed3Of(L).includes(p.id) ? 3 : 2;
    if (f.length !== want) errs.push(`${p.id} has ${f.length} feeders (want ${want})`);
    if (want === 3) {
      const ids = w.tiles.map((t) => t.id), h = w.tiles.find((t) => t.id === 'x_h' + p.id), g = w.tiles.find((t) => t.id === 'x_g' + p.id);
      if (!h || !g) errs.push(`${p.id} 3rd feeder tile missing`);
      else {
        if (!(h.req || []).includes(g.id)) errs.push(`x_h${p.id} does not wait for x_g${p.id}`);
        if (ids.indexOf(h.id) < ids.indexOf(g.id)) errs.push(`x_h${p.id} ordered before x_g${p.id}`);
        if (!(h.price > g.price)) errs.push(`x_h${p.id} price ${h.price} ≤ 2nd ${g.price}`);
      }
    } else if (w.tiles.some((t) => t.id === 'x_h' + p.id)) errs.push(`unexpected x_h${p.id}`);
    if (!f.some((x) => (x.drops || {})[p.id] > 0)) errs.push(`${p.id} feeders never delivered`);
    for (const x of f) {
      const s = st.get(x);
      if (drops(x).some((id) => id !== p.id)) errs.push(`${p.id} feeder dropped at ${drops(x).join(',')}`);
      if ([...s.held].some((it) => it !== p.inItem)) errs.push(`${p.id} feeder held ${[...s.held].join(',')}`);
      const mx = s.loads.length ? Math.max(...s.loads) : 0;
      if (mx >= x.cap) errs.push(`${p.id} feeder waited for a full stack (${mx}/${x.cap})`);
      x._mx = mx; x._trips = s.loads.length;
    }
  }
  if (w.workers.some((x) => !x.feedFor && x.to.some((id) => w.objs[id] && w.objs[id].kind === 'proc'))) errs.push('a non-feeder hire feeds a machine');
  const raw = w.workers.filter((x) => x.rawCarrier), por = w.workers.filter((x) => x.porter);
  if (w.workers.some((x) => !x.rawCarrier && !x.porter && !x.feedFor)) errs.push('a hire without a role');
  for (const x of raw) {
    if (drops(x).some((id) => !rawIds.has(id))) errs.push(`raw carrier dropped at ${drops(x).join(',')}`);
    const h = [...st.get(x).held].filter((it) => !rawItems.has(it)); if (h.length) errs.push(`raw carrier held ${h.join(',')}`);
  }
  if (raw.length && !raw.some((x) => drops(x).length)) errs.push('raw carriers never delivered');
  if (por.length !== term.length) errs.push(`${por.length} porters for ${term.length} trays`);
  for (const x of por) {
    if (drops(x).some((id) => id !== sale.id)) errs.push(`porter dropped at ${drops(x).join(',')}`);
    const h = [...st.get(x).held].filter((it) => !made.has(it)); if (h.length) errs.push(`porter held (harvested?) ${h.join(',')}`);
  }
  if (!por.some((x) => (x.drops || {})[sale.id] > 0)) errs.push('porters did not deliver goods');
  if (trayMax > CFG.v47.trayMax) errs.push(`tray piled up to ${trayMax} (> ${CFG.v47.trayMax})`);
  if (one && !(w.stats.sold[FIN] > 0)) errs.push(`no ${FIN} sold`);
  // B) no 加工品 counter yet: the machines fill up, their feeders wait by them and never take crops anywhere else
  let waitB = '-';
  if (ps) {
    const w2 = new World(li, { quiet: true, seed: 177 + li });
    buyAll(w2, (t) => t.id === 'x_ps');
    run(w2, 200);
    const fs = w2.workers.filter((x) => x.feedFor);
    const wrong = fs.filter((x) => drops(x).some((id) => id !== x.feedFor));
    const waiting = fs.filter((x) => { const m = w2.objs[x.feedFor]; return m.buf + m.inc >= CFG.proc.inMax || x.holding || x.state === 'collect'; });
    waitB = wrong.length ? 'NO' : `${waiting.length}/${fs.length} 专员在机器旁等`;
    if (wrong.length) errs.push('a feeder took crops elsewhere while its machine was full');
  }
  const fsum = w.workers.filter((x) => x.feedFor).map((x) => `${x.feedFor}:${x._trips || 0}趟≤${x._mx || 0}/${x.cap}`).join(' ');
  const ok = !errs.length; if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} 第${li + 1}关 ${L.name}: 专员 ${fsum} · 原料搬运工 ×${raw.length} · 加工品搬运工 ×${por.length}→${sale ? sale.id : '?'} · 出货台最高 ${trayMax}${ps ? ' · 无加工品台时 ' + waitB : ' · 单收银台'}${errs.length ? ' · ' + errs.join('; ') : ''}`);
});
console.log(bad ? `${bad} of ${n} machine levels failed` : `all ${n} machine levels: fixed roles (raw carriers → raw counter, 2 (or 3) feeders per machine → that machine, one porter per tray → goods counter), nothing free at start`);
if (bad) process.exitCode = 1;
