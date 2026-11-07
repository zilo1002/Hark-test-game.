// v4.2 二次加工 second counter (DOM-free, shared with the sims).
// v4.3: NOTHING is free in a machine level. At the start there is only the raw counter; every machine, the 「加工品」
// counter (id PS), its 店员, two raw carriers (fields → raw counter), two 加工品 porters (trays → PS), a 收银升级 per
// counter and a per-machine upgrade path are buyable tiles generated here from each level's layout.
// Levels that only sold machine goods (7 / 9 / 19) now open with a raw counter too, so the first coins come from raw sales.
// In every level with a processing machine, the machine's goods no longer fly straight onto the sale desk:
// they heap up on an output tray beside the machine, and two 搬运工 carry them to a SECOND sale counter
// (店员 ×2, sales go straight into the wallet). Raw crops keep their own counter. The second counter's spot
// is found automatically (nearest free stretch of the east side next to the raw counter); a level may pin it
// with `sale2: [x, y]` and a machine may pin its tray with `tray: [x, y, w, h]`.
// v4.5: ONE dedicated feeder per machine (the first hire that fed it; it carries small batches, see world.js), any further
// hire that used to feed the same machine becomes a farm hand for the raw counter (so fewer generated raw carriers).
// A level with `oneCounter: true` (32 面包房, 43 早市面包摊) gets no 「加工品」 counter: its goods sell from the raw counter,
// carried there from the tray by ONE porter (no second register, no 加工品店员).
// v4.7 FIXED ROLES (user's design after the 熏鱼房 phone video): 原料搬运工 only fields → raw counter; 机器专员 only that
// machine's crop → that machine (one tile, plus a paid tile for a 2nd per machine); 加工品搬运工 only tray → goods counter,
// one per machine (at least two on a single-machine 加工品 counter). The goods counter's porter + 店员 come right after
// its machine in the purchase order, so customers there never stand at an empty desk for long.
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
const MNAME = { bouquet: '花束机', crate: '蛋箱机', ketchup: '番茄酱机', basket: '花篮机', perfume: '香水机', plank: '锯木机', chair: '木椅机',
  cheese: '奶酪机', icecream: '冰淇淋机', popcorn: '爆米花机', jam: '果酱机', pie: '南瓜派烤炉', yarn: '毛线机', juice: '榨汁机', flour: '磨坊',
  bread: '面包烤炉', smoked: '熏鱼房', gjuice: '葡萄榨汁机', wine: '橡木酒桶', chips: '薯条炸锅' };
const r10 = (v) => Math.max(10, Math.round(v / 10) * 10);
// nearest free spot for a tile around (px, py): clear of every object, tile, queue lane and wall
function spot(L, px, py) {
  const bl = blockers(L, null), S = CFG.tile.size + 6;
  let best = null, bs = 1e18;
  for (let x = 40; x <= L.W - 40; x += 10) for (let y = 40; y <= L.H - 40; y += 10) {
    const r = R(x, y, S, S);
    if (!inside(L, r, 22) || bl.some((b) => ov(r, b, 5))) continue;
    const d = Math.hypot(x - px, y - py); if (d < bs) { bs = d; best = [x, y]; }
  }
  if (!best) console.warn(`[sales] ${L.name}: no room for a tile near ${px},${py}`);
  return best || [px, py];
}
function splitSales0(L0) {
  const procs0 = L0.objects.filter((o) => o.type === 'proc');
  if (!procs0.length) return L0;
  const L = { ...L0, objects: L0.objects.map((o) => ({ ...o, items: o.items ? o.items.slice() : o.items })),
              tiles: L0.tiles.map((t) => ({ ...t, effect: { ...t.effect }, req: t.req ? t.req.slice() : t.req })) };
  const obj = Object.fromEntries(L.objects.map((o) => [o.id, o]));
  const procs = L.objects.filter((o) => o.type === 'proc');
  const T = procs.filter((p) => obj[p.outTo] && obj[p.outTo].type === 'counter');
  if (!T.length) return L0;
  const made = new Set(T.map((p) => p.out));
  const V = CFG.v43;
  // the level's price scale: median hire price
  const hires = L0.tiles.filter((t) => t.effect.worker).map((t) => t.price).sort((a, b) => a - b);
  const s = hires.length ? hires[hires.length >> 1] : 200;
  // 0) a level that only sold machine goods: its counter takes the raw input too (the first coins come from raw sales)
  let main = L.objects.filter((o) => o.type === 'counter').find((c) => c.items.some((it) => made.has(it))) || obj[T[0].outTo];
  if (!main.items.some((it) => !made.has(it))) {
    const rawIn = [...new Set(procs.filter((p) => !procs.some((q) => q.outTo === p.id)).map((p) => p.in))];
    main.items = [...rawIn, ...main.items];
  }
  // 1) output trays beside each terminal machine (east, then south, then north side; west is the input zone)
  for (const p of T) {
    if (p.tray) continue;
    const P = CFG.proc, hw = P.bodyW / 2, hd = P.bodyD / 2;
    const cand = [[p.x + hw + 6, p.y - 22, 40, 44], [p.x - 22, p.y + hd + 6, 44, 38], [p.x - 22, p.y - hd - 44, 44, 38], [p.x + hw + 6, p.y - 8, 34, 34]];
    const bl = blockers(L, p);
    let pick = cand.find((c) => { const r = { x: c[0], y: c[1], w: c[2], h: c[3] }; return inside(L, r, 16) && !bl.some((b) => ov(r, b, 3)); });
    p.tray = pick || cand[0];
  }
  // 2) the 「加工品」 counter PS: not built at the start, bought from a tile once a machine is there
  const one = !!L0.oneCounter;
  let pos = L0.sale2;
  if (one) { for (const it of made) if (!main.items.includes(it)) main.items.push(it); for (const p of T) p.outTo = main.id; pos = [main.x, main.y]; }
  else if (!pos) {
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
      const sc = Math.abs(y - main.y) + Math.abs(dx) * 2 + dp * 0.5;
      if (sc < bs) { bs = sc; best = [x, y]; }
    } }
    pos = best;
  }
  if (!pos) { console.warn(`[sales] ${L0.name}: no room for a second counter`); return L0; }
  const sale = one ? main : { id: 'PS', type: 'counter', items: [...made], x: pos[0], y: pos[1], hidden: true, sale2: true };
  if (!one) {
    L.objects.push(sale); obj.PS = sale;
    for (const c of L.objects) if (c.type === 'counter' && c !== sale) c.items = c.items.filter((it) => !made.has(it));
    for (const p of T) p.outTo = 'PS';
  }
  const dead = new Set(L.objects.filter((c) => c.type === 'counter' && !c.items.length).map((c) => c.id));
  if (dead.size) {
    L.objects = L.objects.filter((o) => !dead.has(o.id));
    for (const t of L.tiles) {
      const e = t.effect;
      if (e.cashier) e.cashier = e.cashier.filter((id) => !dead.has(id));
      if (e.show) e.show = e.show.filter((id) => !dead.has(id));
      if (e.worker) e.worker = { ...e.worker, to: e.worker.to.filter((id) => !dead.has(id)) };
    }
  }
  const rawC = L.objects.filter((o) => o.type === 'counter' && (one || o !== sale));
  const rawItems = new Set(rawC.flatMap((c) => c.items));
  const rawSrc = L.objects.filter((o) => (o.type === 'field' || o.type === 'coop') && rawItems.has(o.type === 'field' ? o.crop : o.item)).map((o) => o.id);
  const first = L.tiles[0];
  const gen = [];                     // generated tiles, pushed into L.tiles as they are placed (so spots never collide)
  const add = (t) => { L.tiles.push(t); gen.push(t); return t; };
  // 2b) v4.5 one dedicated feeder per machine fed from the farm (a machine fed by another machine needs none)
  const srcOf = (item) => L.objects.filter((o) => (o.type === 'field' && o.crop === item) || (o.type === 'coop' && o.item === item)).map((o) => o.id);
  const chained = new Set(procs.filter((p) => procs.some((q) => q.outTo === p.id)).map((p) => p.id));
  const needFeeder = [], feedTile = {};
  for (const p of procs) {
    if (chained.has(p.id)) continue;
    const hires = L.tiles.filter((t) => t.effect.worker && t.effect.worker.to.includes(p.id));
    const src = srcOf(p.in);
    if (hires.length) feedTile[p.id] = hires[0];
    hires.forEach((t, k) => {
      const w0 = t.effect.worker;
      t.effect = { ...t.effect, worker: k === 0 ? { from: src.length ? src : w0.from, to: [p.id], feeder: p.id }
                                                : { from: rawSrc.length ? rawSrc : w0.from, to: rawC.map((c) => c.id), raw: true } };
    });
    if (!hires.length && src.length) needFeeder.push([p, src]);
  }
  // 3) machines: every machine is hidden until bought; a machine without a tile gets one on its own spot
  const mTile = {};
  for (const p of procs) {
    const st = L.tiles.find((t) => t.effect.show && t.effect.show.includes(p.id));
    if (st) { mTile[p.id] = st; continue; }
    p.hidden = true;
    const feeder = procs.find((q) => q.outTo === p.id);
    const prebuilt = Object.values(mTile).filter((t) => t.id.startsWith('m_')).length;
    mTile[p.id] = add({ id: 'm_' + p.id, x: p.x, y: p.y, price: r10(s * (prebuilt ? V.machine2 : V.machine)), icon: p.out, label: MNAME[p.out] || '加工机',
                        req: feeder ? [mTile[feeder.id].id] : [first.id], effect: { show: [p.id] } });
  }
  for (const p of procs) p.hidden = true;
  for (const [p, src] of needFeeder) {
    const sp = spot(L, p.x - 90, p.y + 60);
    feedTile[p.id] = add({ id: 'x_f' + p.id, x: sp[0], y: sp[1], price: r10(s * V.raw[0]), icon: 'worker', label: '机器专员', req: [mTile[p.id].id],
          effect: { worker: { from: src, to: [p.id], feeder: p.id } } });
  }
  // v4.7 every other farm hire is a 原料搬运工: it only harvests what the raw counter sells and only drops there
  const rawIds = rawC.map((c) => c.id);
  for (const t of L.tiles) {
    const wk = t.effect.worker; if (!wk || wk.feeder || wk.porter) continue;
    const from = wk.from.filter((id) => rawSrc.includes(id));
    t.effect = { ...t.effect, worker: { from: from.length ? from : rawSrc.length ? rawSrc : wk.from, to: rawIds, raw: true } };
  }
  // v4.7 a paid tile for a 2nd 机器专员 per farm-fed machine (waits for the first)
  const feed2 = [];
  for (const p of procs) {
    const ft = feedTile[p.id]; if (!ft) continue;
    const sp = spot(L, p.x - 90, p.y + 100);
    feed2.push(add({ id: 'x_g' + p.id, x: sp[0], y: sp[1], price: r10(s * CFG.v47.feeder2), icon: 'worker', label: '机器专员',
                     req: [ft.id], effect: { worker: { ...ft.effect.worker, to: [p.id], feeder: p.id } } }));
  }
  // hires feeding a machine, and every upgrade of it, wait for that machine
  const needM = (t, ids) => { for (const id of ids) { const mt = mTile[id]; if (mt && mt !== t && !(t.req || []).includes(mt.id)) t.req = [...(t.req || []), mt.id]; } };
  for (const t of L.tiles) if (t.effect.worker) needM(t, t.effect.worker.to.filter((id) => obj[id] && obj[id].type === 'proc').slice(0, 1));
  // 4) per-machine upgrade paths (a 快机器 tile that sped up several machines becomes one path per machine)
  const upgraded = new Set();
  for (const t of L.tiles.slice()) {
    if (!t.effect.proc) continue;
    const ids = t.effect.proc.map((pe) => pe.id), price = Math.round(t.price * CFG.procUp.price / Math.sqrt(ids.length));
    ids.forEach((id, k) => {
      upgraded.add(id);
      let u = t;
      if (k > 0) { const p = obj[id], sp = spot(L, p.x + 10, p.y + 80); u = add({ id: 'u_' + id, x: sp[0], y: sp[1], icon: t.icon, label: t.label }); }
      u.price = price; u.effect = { procUp: id }; u.repeat = { times: V.mup.times, mul: V.mup.mul }; u.req = (u.req || []).filter((r) => r !== t.id || u === t);
      if (k > 0) u.req = [];
      needM(u, [id]);
    });
  }
  // 5) the 加工品 counter tile, raw carriers, porters
  const termTiles = T.map((p) => mTile[p.id].id);
  const ps = one ? null : add({ id: 'x_ps', x: sale.x, y: sale.y, price: r10(s * V.sale), icon: 'counter', label: '加工品出售台', reqAny: termTiles, effect: { show: ['PS'] } });
  const isRawHire = (t) => t.effect.worker && t.effect.worker.to.length && t.effect.worker.to.every((id) => rawC.some((c) => c.id === id));
  const rawHires = L.tiles.filter(isRawHire).length;
  const rawT = [];
  if (rawSrc.length && rawHires < 2) {
    const c0 = rawC[0], sp = spot(L, c0.x - 120, c0.y + 40);
    const coop = rawSrc.every((id) => obj[id].type === 'coop');
    for (let k = rawHires; k < 2; k++) {
      rawT.push(add({ id: 'x_r' + (k + 1), x: sp[0], y: sp[1], price: r10(s * V.raw[k - rawHires]), icon: coop ? 'cart' : 'worker', label: '原料搬运工',
                      req: rawT.length ? [rawT[rawT.length - 1].id] : [first.id], effect: { worker: { from: rawSrc, to: rawC.map((c) => c.id), raw: true } } }));
    }
  }
  // v4.7 人员适配: exactly one 加工品搬运工 per finished-goods machine, tied to its own tray (it helps a heaping tray of the same counter when its own is empty)
  const nP = T.length;
  const por = [];
  for (let k = 0; k < nP; k++) {
    const p = T[k % T.length], sp = spot(L, p.tray[0] + p.tray[2] / 2 + 10, p.tray[1] + p.tray[3] + 40);
    const req = k >= T.length ? [por[k - T.length].id] : [mTile[p.id].id, ...(one ? [] : ['x_ps'])];
    por.push(add({ id: 'x_p' + (k + 1), x: sp[0], y: sp[1], price: r10(s * V.porter[k < T.length ? 0 : 1]), icon: 'porter', label: '加工品搬运工',
                   req, effect: { worker: { from: [p.id, ...T.filter((q) => q !== p).map((q) => q.id)], to: [sale.id], porter: true, tray: p.id } } }));
  }
  // 6) 店员 + 收银升级 (the upgrade waits on the clerk, on the same spot)
  const cup = (id, at, ids, clerk) => add({ id, x: at.x, y: at.y, price: r10(s * V.cup.base), icon: 'register', label: '收银升级', req: [clerk],
                                            repeat: { times: V.cup.times, mul: V.cup.mul }, effect: { counterUp: ids } });
  let pc = null, pu = null;
  if (!one) {
    const spC = spot(L, sale.x + CFG.counter.cashDx - 30, sale.y + CFG.counter.cashDy + 50);
    pc = add({ id: 'x_pc', x: spC[0], y: spC[1], price: r10(s * V.clerk), icon: 'cashier', label: '加工品店员', req: ['x_ps'], effect: { cashier: ['PS'] } });
    pu = cup('x_pu', pc, ['PS'], 'x_pc');
  }
  const ups = [];
  for (const t of L.tiles.slice()) if (t.effect.cashier && t !== pc && t.effect.cashier.length) ups.push(cup('x_cu' + t.id, t, t.effect.cashier.slice(), t.id));
  // 7) machines that never had an upgrade get their own path
  const mups = [];
  for (const p of procs) if (!upgraded.has(p.id)) {
    const sp = spot(L, p.x + 10, p.y + 80);
    mups.push(add({ id: 'u_' + p.id, x: sp[0], y: sp[1], price: r10(s * V.mup.base), icon: 'gear', label: '快' + (MNAME[p.out] || '机器'),
                    req: [mTile[p.id].id], repeat: { times: V.mup.times, mul: V.mup.mul }, effect: { procUp: p.id } }));
  }
  // 8) purchase order (the guide arrow / balance bot buys the first affordable tile in this order):
  //    first tile → machines without a tile of their own → [加工品 counter, raw carrier 1, porter 1] right after the first
  //    finished-goods machine → the level's own tiles → clerk, 2nd carrier, 2nd porter → 收银升级 → new machine upgrades
  const genSet = new Set(gen);
  const orig = L.tiles.filter((t) => !genSet.has(t));
  const mGen = gen.filter((t) => t.id.startsWith('m_'));
  let order = [orig[0], ...mGen, ...orig.slice(1)];
  const firstTerm = order.findIndex((t) => termTiles.includes(t.id));
  // v4.7: right after the first finished-goods machine: [加工品 counter, its porter, its 店员, raw carrier 1]; every later
  // finished-goods machine is followed by its own porter
  order.splice(firstTerm + 1, 0, ...(ps ? [ps] : []), por[0], ...(pc ? [pc] : []), ...(rawT[0] ? [rawT[0]] : []));
  T.forEach((p, k) => { if (!k) return; const i = order.indexOf(mTile[p.id]); if (i >= 0) order.splice(i + 1, 0, por[k]); else order.push(por[k]); });
  order.push(...gen.filter((t) => t.id.startsWith('x_f')), ...rawT.slice(1), ...por.slice(T.length), ...feed2, ...(pu ? [pu] : []), ...ups, ...gen.filter((t) => t.id.startsWith('u_')));
  const seen = new Set(); L.tiles = order.filter((t) => t && !seen.has(t) && seen.add(t));
  for (const t of gen) if (!seen.has(t)) L.tiles.push(t);
  L.sale2 = one ? null : 'PS';
  return L;
}
