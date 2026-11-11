// v4.7 人员适配 + 不能让客人干等, every machine level.
//  A) every tile bought, player idle, 150 s (first 25 s skipped): per machine starved % (no input, not working, while its goods
//     can be sold), per staff role idle % (empty-handed and standing still), every counter's customer queue wait and
//     "dry" wait (front customer at an empty desk), tray peak.
//  B) the sharp guide bot plays the level: from the moment a counter's supply staff (and its 店员) are hired, the average and
//     95th-percentile customer wait at that counter and the share of customers who met an empty desk.
//   node sim/fit-check.mjs [--level=N] [--season=0..3|all]    (exit code 1 on a failure; all = every season of a valley level)
// v4.8: machine starved limit 25% → 15% (machines that starved more got a paid 3rd 机器专员, CFG.v48.feed3)
// v4.9 排队不断: customers walk up all the time again, so the "no empty-desk arrival" check is replaced by: the line is rarely
// empty (share of time nobody stands in it ≤ qEmpty) and the front customer is served fast (avg ≤ svcA / svcB s, from reaching
// the desk to leaving) once the counter's staff are hired.
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import { playLevel } from './balance.mjs';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const only = arg('level', null), seaArg = arg('season', null);
export const LIM = { starve: 15, idle: 55, svcA: 2.5, svcB: 3, qEmpty: 10, tray: CFG.v47.trayMax };
const qEmptyPct = (c, from, to) => { let e = 0; for (let k = Math.ceil(from); k < Math.floor(to); k++) e += (c.qEmpty && c.qEmpty[k]) || 0; return pct(e, Math.max(1, Math.floor(to) - Math.ceil(from))); };
const pct = (a, b) => Math.round(a / Math.max(1, b) * 100);
const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const p95 = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };
const role = (x) => x.porter ? '搬运' : x.feedFor ? '专员' : '原料';

export function fitA(li, env = {}, seed = 31 + li) {
  const w = new World(li, { quiet: true, seed, ...env });
  let more = true; while (more) { more = false; for (const t of w.tiles) if (t.visible && !t.done) { w.completeTile(t, true); more = true; } }
  const fed = w.procs.filter((p) => !p.hidden);
  const starve = new Map(fed.map((p) => [p, 0])), idle = new Map(w.workers.map((x) => [x, 0]));
  let frames = 0, trayMax = 0;
  for (let i = 0; i < 150 * 30; i++) {
    const pos = w.workers.map((x) => [x.x, x.y]);
    w.update(1 / 30, 0, 0); if (w.t < 25) continue;
    frames++;
    for (const p of fed) {
      if (p.buf + p.inc === 0 && !(p.work > 0) && w.procSells(p) && !(p.pile && p.pile.full && p.pile.full())) starve.set(p, starve.get(p) + 1);
      if (p.pile && w.workers.some((x) => x.porter && x.trayOf === p.id)) trayMax = Math.max(trayMax, p.pile.total);
    }
    w.workers.forEach((x, k) => { if (x.stack.length + x.incoming === 0 && Math.hypot(x.x - pos[k][0], x.y - pos[k][1]) < 0.05) idle.set(x, idle.get(x) + 1); });
  }
  const log = (w.waitLog || []).filter((e) => e.t > 25);
  const counters = w.counters.filter((c) => !c.hidden).map((c) => { const e = log.filter((x) => x.c === c.id); return { id: c.id, n: e.length, wait: avg(e.map((x) => x.wait)), svc: avg(e.map((x) => x.svc)), empty: qEmptyPct(c, 25, w.t) }; });
  const roles = {};
  for (const [x, n] of idle) (roles[role(x)] || (roles[role(x)] = [])).push(pct(n, frames));
  return { starve: fed.map((p) => [p.id, pct(starve.get(p), frames)]), roles, counters, trayMax, staff: w.workers.length };
}

// v4.9: a machine's starved share swings ±10 points with the seed (fast machines run dry between 6-item batches, so whether
// one item is left over decides it), so A runs 7 seeds and takes the median starved % and tray peak per machine
export function fitA3(li, env = {}) {
  const R = [31 + li, 7 + li, 99 + li, 1234, 555, 77, 4242].map((sd) => fitA(li, env, sd)), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  return { ...R[0], starve: R[0].starve.map(([id], k) => [id, med(R.map((r) => r.starve[k][1]))]), trayMax: med(R.map((r) => r.trayMax)) };
}

export function fitB(li, env = {}) {
  // the sharp bot, seed 1: per counter, customers whose wait began after its staff were all hired
  const r = playLevel(li, { stick: 1, think: 0.1 }, 1000 + li, { ...env, keepWorld: true });
  const w = r.world, out = [];
  if (!w) return { out, time: r.time };
  for (const c of w.counters) {
    // staff of this counter: its 店员 and everyone who delivers to it
    const tiles = w.tiles.filter((t) => (t.effect.cashier || []).includes(c.id) || (t.effect.worker && t.effect.worker.to.includes(c.id)));
    if (!tiles.length || tiles.some((t) => !t.bought)) { out.push({ id: c.id, n: 0, note: 'staff not all hired' }); continue; }
    const at = Math.max(...tiles.map((t) => r.unlocks.find((u) => u.id === t.id && u.n === 1)?.t ?? 0));
    const e = (w.waitLog || []).filter((x) => x.c === c.id && x.frontAt > at);
    out.push({ id: c.id, n: e.length, from: Math.round(at), wait: avg(e.map((x) => x.wait)), svc: avg(e.map((x) => x.svc)), p95: p95(e.map((x) => x.svc)), empty: qEmptyPct(c, at + 3, w.t) });
  }
  return { out, time: r.time };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0, n = 0;
  CFG.levels.forEach((L, li) => {
    if (L.foodLines) return; // Food levels use player-managed collection stands; see food-levels-check.mjs.
    if (only && +only !== li + 1) return;
    const seas = !Number.isInteger(L.valley) ? [null] : seaArg === 'all' ? [0, 1, 2, 3] : [seaArg !== null ? +seaArg : L.season];
    for (const sea of seas) {
    const env = sea === null ? {} : { season: sea };
    const w0 = new World(li, { quiet: true, ...env });
    if (!w0.procs.length) continue;
    n++;
    const A = fitA3(li, env), B = fitB(li, env), errs = [];
    for (const [id, s] of A.starve) if (s > LIM.starve) errs.push(`${id} starved ${s}%`);
    for (const [k, v] of Object.entries(A.roles)) { const m = Math.max(...v); if (m > LIM.idle) errs.push(`${k} idle ${m}%`); }
    for (const c of A.counters) if (c.n && (c.svc > LIM.svcA || c.empty > LIM.qEmpty)) errs.push(`A ${c.id} front wait ${c.svc.toFixed(1)}s line empty ${c.empty}%`);
    if (A.trayMax > LIM.tray) errs.push(`tray ${A.trayMax} > ${LIM.tray}`);
    for (const c of B.out) if (c.n >= 5 && (c.svc > LIM.svcB || c.empty > LIM.qEmpty)) errs.push(`B ${c.id} front wait ${c.svc.toFixed(1)}s line empty ${c.empty}%`);
    if (errs.length) bad++;
    const fmtR = Object.entries(A.roles).map(([k, v]) => `${k}${v.length}人闲${v.join('/')}%`).join(' ');
    console.log(`${errs.length ? 'FAIL' : 'OK  '} 第${li + 1}关 ${L.name}${env.season !== undefined ? '(季' + env.season + ')' : ''}: 机器缺料 ${A.starve.map(([i, s]) => i + ' ' + s + '%').join(' ')} · ${fmtR} · 出货台最高 ${A.trayMax}`
      + ` · 全员时 ${A.counters.map((c) => `${c.id} 队空${c.empty}% 柜前${c.svc.toFixed(1)}s 排队${c.wait.toFixed(1)}s(${c.n}人)`).join(' ')}`
      + ` · 机器人局 ${B.out.map((c) => c.n ? `${c.id}@${c.from}s 队空${c.empty}% 柜前均${c.svc.toFixed(1)}s p95 ${c.p95.toFixed(1)}s 排队${c.wait.toFixed(1)}s(${c.n}人)` : `${c.id} -`).join(' ')}`
      + `${errs.length ? ' · ' + errs.join('; ') : ''}`);
    }
  });
  console.log(bad ? `${bad} of ${n} machine levels failed` : `all ${n} machine levels: staff fit the workload, line kept full, front customers served fast`);
  if (bad) process.exitCode = 1;
}
