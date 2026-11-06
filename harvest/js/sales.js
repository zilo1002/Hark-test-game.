// v4.2 二次加工 second counter (DOM-free, shared with the sims).
// In every level with a processing machine, the machine's goods no longer fly straight onto the sale desk:
// they heap up on an output tray beside the machine, and two 搬运工 carry them to a SECOND sale counter
// (店员 ×2, sales go straight into the wallet). Raw crops keep their own counter. The second counter's spot
// is found automatically (nearest free stretch of the east side next to the raw counter); a level may pin it
// with `sale2: [x, y]` and a machine may pin its tray with `tray: [x, y, w, h]`.
import { CFG } from './config.js';

const cache = new WeakMap();
const ov = (a, b, m = 0) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;
const R = (cx, cy, w, h) => ({ x: cx - w / 2, y: cy - h / 2, w, h });

// every rect a counter at (x, y) occupies (desk, unload zone, cash spot, customer queue to the east wall)
export function counterRects(x, y, W) {
  const K = CFG.counter;
  return [R(x, y, K.deskW, K.deskD), R(x + K.zoneDx, y + K.zoneDy, K.zoneW, K.zoneH), R(x + K.cashDx, y + K.cashDy, 40, 40),
          { x: x + K.serveDx - 8, y: y - 14, w: W - (x + K.serveDx) + 8, h: 28 }];
}
export function procRects(o) {
  const P = CFG.proc;
  return [R(o.x, o.y, P.bodyW, P.bodyD), R(o.x + P.zoneDx, o.y, P.zoneW, P.zoneH)];
}
function objRects(L, o) {
  if (o.type === 'counter') return counterRects(o.x, o.y, L.W);
  if (o.type === 'proc') return procRects(o).concat(o.tray ? [{ x: o.tray[0], y: o.tray[1], w: o.tray[2], h: o.tray[3] }] : []);
  if (o.type === 'field') return [{ x: o.x, y: o.y, w: o.w, h: o.h }];
  if (o.type === 'coop') return [{ x: o.x - 30, y: o.y - 30, w: o.w + 30, h: o.h + 30 }];
  return [];
}
function blockers(L, skip) {
  const out = [];
  for (const o of L.objects) if (o !== skip) for (const r of objRects(L, o)) out.push(r);
  const S = CFG.tile.size;
  for (const t of L.tiles) out.push(R(t.x, t.y, S + 6, S + 6));
  const d = L.deco || {};
  for (const h of d.hedges || []) out.push({ x: h[0], y: h[1], w: h[2], h: h[3] });
  for (const t of d.trees || []) out.push(R(t[0], t[1], 22, 22));
  if (d.barn) out.push(R(d.barn[0], d.barn[1], 80, 60));
  out.push(R(L.start[0], L.start[1], 24, 24));
  return out;
}
const inside = (L, r, m = 18) => r.x >= m && r.y >= m && r.x + r.w <= L.W - m && r.y + r.h <= L.H - m;

export function splitSales(L) {
  if (cache.has(L)) return cache.get(L);
  const out = splitSales0(L); cache.set(L, out); return out;
}
function splitSales0(L0) {
  const procs = L0.objects.filter((o) => o.type === 'proc');
  const counters = L0.objects.filter((o) => o.type === 'counter');
  const byId = Object.fromEntries(L0.objects.map((o) => [o.id, o]));
  const term = procs.filter((p) => byId[p.outTo] && byId[p.outTo].type === 'counter');
  if (!term.length) return L0;
  const L = { ...L0, objects: L0.objects.map((o) => ({ ...o, items: o.items ? o.items.slice() : o.items })) };
  const obj = Object.fromEntries(L.objects.map((o) => [o.id, o]));
  const T = term.map((p) => obj[p.id]);
  const made = new Set(T.map((p) => p.out));
  // 1) output trays beside each machine (east, then south, then north side; west is the input zone)
  for (const p of T) {
    if (p.tray) continue;
    const P = CFG.proc, hw = P.bodyW / 2, hd = P.bodyD / 2;
    const cand = [[p.x + hw + 6, p.y - 22, 40, 44], [p.x - 22, p.y + hd + 6, 44, 38], [p.x - 22, p.y - hd - 44, 44, 38], [p.x + hw + 6, p.y - 8, 34, 34]];
    const bl = blockers(L, p);
    let pick = cand.find((c) => { const r = { x: c[0], y: c[1], w: c[2], h: c[3] }; return inside(L, r, 16) && !bl.some((b) => ov(r, b, 3)); });
    p.tray = pick || cand[0];
  }
  // 2) one processed-goods counter: an existing counter that only sells machine goods, else a new one
  const main = counters.map((c) => obj[c.id]).find((c) => c.items.some((it) => made.has(it))) || obj[T[0].outTo];
  const raw = main.items.filter((it) => !made.has(it));
  let sale;
  if (!raw.length) { sale = main; }
  else {
    let pos = L0.sale2;
    if (!pos) {
      const bl = blockers(L, null), K = CFG.counter;
      let best = null, bs = 1e18;
      for (const gap of [34, 22, 12]) { if (best) break;
      for (let dx = -80; dx <= 80; dx += 10) for (let y = 60; y <= L.H - 100; y += 10) {
        const x = main.x + dx;
        if (x + K.serveDx > L.W - 40 || x + K.cashDx - 20 < 20) continue;
        const rs = counterRects(x, y, L.W);
        if (!rs.slice(0, 3).every((r) => inside(L, r, 20))) continue;
        if (rs.some((r, k) => bl.some((b) => ov(r, b, k === 0 ? gap : 8)))) continue;   // keep a walkway round the desk
        const dp = Math.min(...T.map((p) => Math.hypot(p.x - x, p.y - y)));
        const s = Math.abs(y - main.y) + Math.abs(dx) * 2 + dp * 0.5;
        if (s < bs) { bs = s; best = [x, y]; }
      } }
      pos = best;
    }
    if (!pos) { console.warn(`[sales] ${L0.name}: no room for a second counter`); sale = main; }
    else {
      sale = { id: 'S1', type: 'counter', items: [...made].filter((it) => main.items.includes(it) || T.some((p) => p.out === it)), x: pos[0], y: pos[1],
               hidden: T.every((p) => p.hidden), sale2: true };
      L.objects.push(sale); obj.S1 = sale;
    }
  }
  // processed goods leave every other counter's list; raw crops leave the processed counter
  for (const c of L.objects) if (c.type === 'counter' && c !== sale) c.items = c.items.filter((it) => !made.has(it));
  if (sale !== main || !raw.length) sale.items = [...new Set([...sale.items.filter((it) => made.has(it)), ...T.map((p) => p.out)])];
  sale.sale2 = true; sale.clerks = 2;
  for (const p of T) p.outTo = sale.id;
  // a counter left with nothing to sell is dropped (and so is every reference to it)
  const dead = new Set(L.objects.filter((c) => c.type === 'counter' && !c.items.length).map((c) => c.id));
  if (dead.size) {
    L.objects = L.objects.filter((o) => !dead.has(o.id));
    L.tiles = L.tiles.map((t) => {
      const e = { ...t.effect };
      if (e.cashier) e.cashier = e.cashier.filter((id) => !dead.has(id));
      if (e.show) e.show = e.show.filter((id) => !dead.has(id));
      if (e.worker) e.worker = { ...e.worker, to: e.worker.to.filter((id) => !dead.has(id)) };
      return { ...t, effect: e };
    });
  }
  L.sale2 = sale.id;
  return L;
}
