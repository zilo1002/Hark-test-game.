// v4.7 staff check (fixed roles), every machine level:
//  · nothing is free at the start (no workers, clerks, machines or 加工品 counter)
//  · 机器专员: one tile per farm-fed machine plus one paid tile for a 2nd (so 2 with everything bought), v4.8 plus a paid 3rd
//    tile (x_h<machine>, after the 2nd x_g, pricier) on the machines CFG.v48.feed3 lists; a feeder only
//    ever holds its machine's crop and only drops into its machine (never a counter); it brings full carrying loads
//  · 原料搬运工: only hold raw-counter crops and only drop at a raw counter (never a machine, never the 加工品 counter)
//  · 加工品搬运工: one per finished-goods machine, at least two when using a separate goods counter; one on a oneCounter level;
//    only ever hold machine goods (never harvest) and only drop at the goods counter; trays stay within their actual `pile.cap` once hired
//  · one ordinary counter at start; the goods counter appears with the first processor unlock, and its porter then staffs delivery
//  · before that first porter is hired, the unlocked machine fills and its feeders wait by it (never carry crops elsewhere)
//  · every processing level keeps raw and processed goods on separate visible counters after its first processor unlock
//   node sim/staff-check.mjs [--level=N] [--secs=120]
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import { feed3Of } from '../js/sales.js';
const only = process.argv.find((a) => a.startsWith('--level='));
const SECS = +((process.argv.find((a) => a.startsWith('--secs=')) || '--secs=120').split('=')[1]);

let bad = 0, n = 0;
const buyAll = (w, skip = () => false) => { let more = true; while (more) { more = false; for (const t of w.tiles) if (t.visible && !t.done && !skip(t)) { w.completeTile(t, true); more = true; } } };
// run, recording what every worker ever held, its feeder batch sizes, and the tray peak
function run(w, secs) {
  const st = new Map(), batches = [], batchLaunches = []; let trayMax = 0, trayOverflow = null;
  const launch = w.launch.bind(w);
  w.launch = (...args) => {
    const f = launch(...args);
    if (args[1] === 'procBatch') batchLaunches.push({ f, sinkId: args[5].id });
    return f;
  };
  for (let i = 0; i < secs * 30; i++) {
    const before = new Map(w.workers.map((x) => [x, x.state]));
    const launchesBefore = batchLaunches.length;
    w.update(1 / 30, 0, 0);
    for (const { f, sinkId } of batchLaunches.slice(launchesBefore)) batches.push({ sinkId, count: f.count, cap: f.batchCap, by: f.by });
    if (w.t > 20) for (const p of w.procs) if (p.pile && !p.hidden) { trayMax = Math.max(trayMax, p.pile.total); if (p.pile.total > p.pile.cap) trayOverflow = `${p.id}:${p.pile.total}/${p.pile.cap}`; }
    for (const x of w.workers) {
      let s = st.get(x); if (!s) st.set(x, (s = { held: new Set(), loads: [] }));
      for (const it of x.stack) s.held.add(it);
      if (x.feedFor && before.get(x) === 'collect' && x.state === 'deliver') s.loads.push({ size: x.stack.length + x.incoming, cap: x.cap });
    }
  }
  return { st, batches, trayMax, trayOverflow };
}
CFG.levels.forEach((L0, li) => {
  if (L0.foodLines) return; // Dedicated food-level checks cover player collection tables rather than legacy sales porters.
  if (only && +only.split('=')[1] !== li + 1) return;
  const probe = new World(li, { quiet: true });
  if (!probe.procs.length) return;
  n++;
  const L = probe.L, errs = [];
  const w = new World(li, { quiet: true, seed: 77 + li });
  const ps = w.objs.PS;
  const made = new Set(w.procs.map((p) => p.outItem));
  const term = w.procs.filter((p) => p.pile);
  const FIN = term.length ? term[term.length - 1].outItem : null;
  const sale = ps;
  if (!sale) errs.push('no 加工品 counter');
  const ordinary = w.counters.find((c) => !c.sale2);
  const firstProc = w.procs.find((p) => !w.procs.some((q) => q.outObj === p));
  const firstMachineUnlock = w.tiles.find((t) => t.effect?.show?.includes(firstProc?.id));
  const firstTerminalProc = term[0];   // v4.9.7: a terminal machine's pile lives on its processed board (outObj is the stand, not a counter)
  const machineUnlock = w.tiles.find((t) => t.effect?.show?.includes(firstTerminalProc?.id));
  const psTile = w.tiles.find((t) => t.effect?.worker?.porter && t.effect.worker.to.includes('PS'));
  if (!ordinary || ordinary.hidden) errs.push('no visible ordinary counter at start');
  if (w.counters.filter((c) => !c.sale2 && !c.hidden).length !== 1) errs.push('should start with exactly one visible ordinary counter');
  if (!ps || !ps.sale2 || !ps.hidden) errs.push('processed counter should exist hidden until purchased');
  if (ordinary && ordinary.items.some((it) => made.has(it))) errs.push('processed goods still assigned to ordinary counter before unlock');
  if (!ps || !ps.items.includes(FIN)) errs.push(`processed counter does not sell ${FIN}`);
  if (!psTile || !machineUnlock || !(psTile.req || []).includes(machineUnlock.id)) errs.push('first processed-goods porter does not require a processing-machine unlock');
  const free = [];
  if (w.workers.length) free.push(`${w.workers.length} workers`);
  if (w.counters.some((c) => c.cashier)) free.push('a clerk');
  if (w.procs.some((p) => !p.hidden)) free.push('a machine');
  if (ps && !ps.hidden) free.push('the 加工品 counter');
  if (free.length) errs.push('FREE AT START: ' + free.join(', '));
  // The first processor unlock reveals the second desk; its first porter staffs the delivery route.
  if (ps && (!firstMachineUnlock || !firstMachineUnlock.effect.show.includes(ps.id))) errs.push('first processor unlock does not reveal the processed counter');
  // A) every tile bought
  buyAll(w);
  const { st, batches, trayMax, trayOverflow } = run(w, SECS);
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
    // v4.8.5: only feeder batches must be full loads — a player batch is a whole-stack
    // drop of whatever the player happens to carry, so it is exempt from count === cap
    const machineBatches = batches.filter((batch) => batch.sinkId === p.id && batch.by === 'feeder');
    const delivered = f.reduce((sum, x) => sum + ((x.drops || {})[p.id] || 0), 0);
    if (delivered && !machineBatches.length) errs.push(`${p.id} has no atomic batch deposits`);
    for (const batch of machineBatches) if (batch.count !== batch.cap) errs.push(`${p.id} deposited a partial batch (${batch.count}/${batch.cap})`);
    const deposited = machineBatches.reduce((sum, batch) => sum + batch.count, 0);
    if (deposited !== delivered) errs.push(`${p.id} batch deposits total ${deposited}, but workers reported ${delivered} items delivered`);
    for (const x of f) {
      const s = st.get(x);
      if (drops(x).some((id) => id !== p.id)) errs.push(`${p.id} feeder dropped at ${drops(x).join(',')}`);
      if ([...s.held].some((it) => it !== p.inItem)) errs.push(`${p.id} feeder held ${[...s.held].join(',')}`);
      const mx = s.loads.length ? Math.max(...s.loads.map((load) => load.size)) : 0;
      if (s.loads.some((load) => load.size !== load.cap)) errs.push(`${p.id} feeder left with a partial load (${s.loads.filter((load) => load.size !== load.cap).map((load) => `${load.size}/${load.cap}`).join(',')})`);
      if (mx > x.cap) errs.push(`${p.id} feeder exceeded its stack capacity (${mx}/${x.cap})`);
      x._mx = mx; x._trips = s.loads.length;
    }
  }
  if (w.workers.some((x) => !x.feedFor && x.to.some((id) => w.objs[id] && w.objs[id].kind === 'proc'))) errs.push('a non-feeder hire feeds a machine');
  const raw = w.workers.filter((x) => x.rawCarrier), por = w.workers.filter((x) => x.porter);
  if (w.workers.some((x) => !x.rawCarrier && !x.porter && !x.feedFor && !x.standCarrier && !x.tally)) errs.push('a hire without a role');
  // v4.9.9 田间采收工: one per field/co-op of each machine-feeding raw kind; it only
  // ever holds its board's kind and only drops on that raw board (never a counter, never a machine).
  const farm = w.workers.filter((x) => x.standCarrier);
  const stands = new Map(Object.values(w.objs).filter((o) => o.kind === 'stand').map((o) => [o.id, o]));
  // v4.9.9: one farmhand per field/co-op of the kind (see sales.js)
  const srcOf = (item) => L.objects.filter((o) => (o.type === 'field' && o.crop === item) || (o.type === 'coop' && o.item === item));
  const wantFarm = [...new Set(farmFed.map((p) => p.inItem))].reduce((n, item) => n + srcOf(item).length, 0);
  if (farm.length !== wantFarm) errs.push(`${farm.length} farmhands (want ${wantFarm}: one per field/co-op of each machine-feeding kind)`);
  for (const x of farm) {
    if (drops(x).some((id) => !stands.has(id))) errs.push(`farmhand dropped at ${drops(x).join(',')}`);
    const h = [...st.get(x).held].filter((it) => !x.to.some((id) => stands.get(id)?.item === it));
    if (h.length) errs.push(`farmhand held ${h.join(',')}`);
  }
  if (farm.length && !farm.some((x) => drops(x).length)) errs.push('farmhands never delivered');
  for (const x of raw) {
    if (drops(x).some((id) => !rawIds.has(id))) errs.push(`raw carrier dropped at ${drops(x).join(',')}`);
    const h = [...st.get(x).held].filter((it) => !rawItems.has(it)); if (h.length) errs.push(`raw carrier held ${h.join(',')}`);
  }
  if (raw.length && !raw.some((x) => drops(x).length)) errs.push('raw carriers never delivered');
  const wantPorters = Math.max(term.length, 2);
  if (por.length !== wantPorters) errs.push(`${por.length} porters for ${term.length} trays (want ${wantPorters})`);
  for (const x of por) {
    if (drops(x).some((id) => id !== sale.id)) errs.push(`porter dropped at ${drops(x).join(',')}`);
    const h = [...st.get(x).held].filter((it) => !made.has(it)); if (h.length) errs.push(`porter held (harvested?) ${h.join(',')}`);
  }
  if (!por.some((x) => (x.drops || {})[sale.id] > 0)) errs.push('porters did not deliver goods');
  // v4.9.9 理货员: one per level with two or more terminal machines; it only ever
  // holds machine goods and only drops at the goods counter.
  const tally = w.workers.filter((x) => x.tally);
  const wantTally = term.length >= 2 ? 1 : 0;
  const tallyTile = w.tiles.find((t) => t.effect?.worker?.tally);
  if (tally.length !== wantTally) errs.push(`${tally.length} tally clerks for ${term.length} terminal machines (want ${wantTally})`);
  if (term.length >= 2 && (!tallyTile || !machineUnlock || !(tallyTile.req || []).includes(machineUnlock.id))) errs.push('tally clerk tile missing or does not require a processing-machine unlock');
  if (term.length < 2 && tallyTile) errs.push('unexpected tally clerk tile');
  for (const x of tally) {
    if (drops(x).some((id) => id !== sale.id)) errs.push(`tally clerk dropped at ${drops(x).join(',')}`);
    const h = [...st.get(x).held].filter((it) => !made.has(it)); if (h.length) errs.push(`tally clerk held ${h.join(',')}`);
  }
  if (tally.length && !tally.some((x) => (x.drops || {})[sale.id] > 0)) errs.push('tally clerk never delivered goods');
  if (trayOverflow) errs.push(`tray exceeded its actual capacity (${trayOverflow})`);
  if (!(w.stats.sold[FIN] > 0)) errs.push(`no ${FIN} sold`);
  // B) processor unlocked but its first porter not hired: both desks are visible; feeders wait at the machine.
  let waitB = '-';
  if (ps) {
    const w2 = new World(li, { quiet: true, seed: 177 + li });
    const firstGoodsPorter = w2.tiles.find((t) => t.effect?.worker?.porter && t.effect.worker.to.includes('PS'));
    buyAll(w2, (t) => t === firstGoodsPorter);
    run(w2, 200);
    const fs = w2.workers.filter((x) => x.feedFor);
    const wrong = fs.filter((x) => drops(x).some((id) => id !== x.feedFor));
    if (w2.counters.filter((c) => !c.hidden).length !== 2) errs.push('both raw and processed desks are not visible after processor unlock');
    const waiting = fs.filter((x) => { const m = w2.objs[x.feedFor]; return m.buf + m.inc >= CFG.proc.inMax || x.holding || x.state === 'collect'; });
    waitB = wrong.length ? 'NO' : `${waiting.length}/${fs.length} 专员在机器旁等`;
    if (wrong.length) errs.push('a feeder took crops elsewhere while its machine was full');
  }
  const fsum = w.workers.filter((x) => x.feedFor).map((x) => `${x.feedFor}:${x._trips || 0}趟≤${x._mx || 0}/${x.cap}`).join(' ');
  const ok = !errs.length; if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} 第${li + 1}关 ${L.name}: 专员 ${fsum} · 原料搬运工 ×${raw.length}→普通台 · 加工品搬运工 ×${por.length}→${sale ? sale.id : '?'} · 出货台最高 ${trayMax}${ps ? ' · 无加工品搬运工时双台可见/专员等待: ' + waitB : ''}${errs.length ? ' · ' + errs.join('; ') : ''}`);
});
console.log(bad ? `${bad} of ${n} machine levels failed` : `all ${n} machine levels: fixed roles (raw carriers → raw counter, 2 (or 3) feeders per machine → that machine, one per tray / at least two for a separate goods counter → goods counter), nothing free at start`);
if (bad) process.exitCode = 1;
