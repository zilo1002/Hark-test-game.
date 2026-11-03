// 半亩·丰收 — game logic for one level. Pure JS, no DOM: the browser game and the
// headless balance sim (sim/balance.mjs) both run exactly this code.
import { CFG } from './config.js';

export function rng32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const rectAt = (cx, cy, w, h) => ({ x: cx - w / 2, y: cy - h / 2, w, h, cx, cy });

// ---------------------------------------------------------------------------
// Pile: a sandpile heightfield. Each cell holds a count of stacked items; items
// slide to a lower neighbour when the slope gets too steep, so piles grow as
// mounds and collapse a little into holes you carve.
export class Pile {
  constructor(type, x, y, w, h, cap) {
    const c = CFG.pile.cell;
    this.type = type; this.x = x; this.y = y; this.w = w; this.h = h;
    this.cols = Math.max(1, Math.floor(w / c)); this.rows = Math.max(1, Math.floor(h / c));
    this.cw = w / this.cols; this.ch = h / this.rows;
    const n = this.cols * this.rows;
    this.hs = new Uint16Array(n); this.bump = new Float32Array(n);
    this.total = 0; this.cap = cap || CFG.pile.cap; this.pending = 0;
    this._hot = -1; this._hotT = -1;
  }
  ix(x) { return Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.x) / this.cw))); }
  iy(y) { return Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.y) / this.ch))); }
  cx(i) { return this.x + ((i % this.cols) + 0.5) * this.cw; }
  cy(i) { return this.y + (((i / this.cols) | 0) + 0.5) * this.ch; }
  // a walkable point near cell i (keeps clear of the yard fences)
  safe(i) {
    const m = 16;
    return { x: Math.min(this.x + this.w - m, Math.max(this.x + m, this.cx(i))), y: Math.min(this.y + this.h - 6, Math.max(this.y + m, this.cy(i))) };
  }
  full() { return this.total + this.pending >= this.cap; }
  add(x, y, rnd) {
    const hs = this.hs, C = this.cols, R = this.rows, s = CFG.pile.slope;
    let i = this.iy(y) * C + this.ix(x);
    for (let step = 0; step < 48; step++) {
      const c = i % C, r = (i / C) | 0; let best = -1, bh = hs[i] - s + 1;
      const o = (rnd() * 4) | 0;
      for (let k = 0; k < 4; k++) {
        const dd = (k + o) & 3; let j = -1;
        if (dd === 0 && c > 0) j = i - 1; else if (dd === 1 && c < C - 1) j = i + 1;
        else if (dd === 2 && r > 0) j = i - C; else if (dd === 3 && r < R - 1) j = i + C;
        if (j >= 0 && hs[j] < bh) { bh = hs[j]; best = j; }
      }
      if (best < 0) break;
      i = best;
    }
    hs[i]++; this.total++; this.bump[i] = 1;
    return i;
  }
  // remove the highest item within radius r of (x,y). Returns the cell index or -1.
  take(x, y, r) {
    if (this.total <= 0) return -1;
    if (x + r < this.x || x - r > this.x + this.w || y + r < this.y || y - r > this.y + this.h) return -1;
    const hs = this.hs, C = this.cols;
    const c0 = this.ix(x - r), c1 = this.ix(x + r), r0 = this.iy(y - r), r1 = this.iy(y + r), r2 = r * r;
    let best = -1, bh = 0;
    for (let rr = r0; rr <= r1; rr++) {
      const py = this.y + (rr + 0.5) * this.ch - y;
      for (let cc = c0; cc <= c1; cc++) {
        const i = rr * C + cc;
        if (hs[i] > bh) {
          const px = this.x + (cc + 0.5) * this.cw - x;
          if (px * px + py * py <= r2) { bh = hs[i]; best = i; }
        }
      }
    }
    if (best < 0) return -1;
    hs[best]--; this.total--; this.bump[best] = 1;
    this.relax(best);
    return best;
  }
  relax(i) {
    const hs = this.hs, C = this.cols, R = this.rows, s = CFG.pile.slope;
    const c = i % C, r = (i / C) | 0;
    const nb = [c > 0 ? i - 1 : -1, c < C - 1 ? i + 1 : -1, r > 0 ? i - C : -1, r < R - 1 ? i + C : -1];
    for (const j of nb) if (j >= 0 && hs[j] - hs[i] > s) { hs[j]--; hs[i]++; this.bump[j] = 1; this.bump[i] = 1; }
  }
  // best cell to walk into from (px,py): tall and near. Cached briefly.
  hottest(px, py, t) {
    if (this.total <= 0) return -1;
    if (t - this._hotT < 0.35 && this._hot >= 0 && this.hs[this._hot] > 0) return this._hot;
    let best = -1, bs = -1e9; const hs = this.hs, n = hs.length;
    for (let i = 0; i < n; i += 1) {
      const h = hs[i]; if (!h) continue;
      const s = Math.min(h, 8) * 30 - Math.sqrt(d2(this.cx(i), this.cy(i), px, py));
      if (s > bs) { bs = s; best = i; }
    }
    this._hot = best; this._hotT = t;
    return best;
  }
  prefill(n, rnd, biasTop) {
    for (let k = 0; k < n && this.total < this.cap; k++) {
      const x = this.x + rnd() * this.w;
      const y = this.y + (biasTop ? Math.pow(rnd(), 2.2) : rnd()) * this.h;
      this.add(x, y, rnd);
    }
    this.bump.fill(0);
  }
}

// ---------------------------------------------------------------------------
function makeCollector(kind, x, y) {
  return { kind, x, y, vx: 0, vy: 0, face: 1, moving: false, walk: 0,
           speed: 0, cap: 0, pickR: 0, harvestR: 0, pickRate: 0, dropRate: 0,
           stack: [], incoming: 0, pickAcc: 0, dropAcc: 0, sway: 0, fullFlag: false, vehicle: false,
           sources: null, canPick: true, canDrop: true, only: null };
}

export class World {
  constructor(levelIndex, opts = {}) {
    this.li = levelIndex;
    this.L = CFG.levels[levelIndex];
    this.W = this.L.W; this.H = this.L.H;
    this.rnd = rng32(opts.seed ?? (levelIndex + 1) * 7919);
    this.quiet = !!opts.quiet;      // sim: skip render-only events
    this.t = 0; this.money = 0; this.won = false; this.winT = 0;
    this.events = [];
    this.stats = { collected: {}, sold: {}, produced: {}, earned: 0, unlocks: 0 };
    this.upg = { cap: 0, speed: 0, radius: 0, wcap: 0, wspeed: 0 };
    this.objs = {}; this.fields = []; this.coops = []; this.counters = []; this.procs = [];
    this.piles = []; this.tiles = []; this.workers = []; this.customers = []; this.solids = [];
    this.fly = []; this.flyFree = [];
    this.gmode = 'collect';
    for (const o of this.L.objects) this.build(o);
    this.L.tiles.forEach((t, i) => this.tiles.push({ ...t, order: i, paid: 0, bought: 0, done: false, visible: false,
      price0: t.price, payFx: 0, appearT: -9, cool: 0 }));
    this.player = makeCollector('player', this.L.start[0], this.L.start[1]);
    this.refreshStats();
    this.rebuildSolids();
    this.updateTileVis(true);
  }

  emit(type, data) { if (!this.quiet) { if (this.events.length < 800) this.events.push({ type, ...data }); } }

  // ---- construction ------------------------------------------------------
  build(o) {
    const base = { ...o, hidden: !!o.hidden, appearT: -9 };
    if (o.type === 'field') {
      const cr = CFG.crops[o.crop];
      const f = { ...base, kind: 'field', w: o.cols * o.gap, h: o.rows * o.gap, plants: [], spill: cr.spill || 0,
                  grow: cr.grow, yieldN: cr.yield || 0, item: o.crop, pile: null };
      for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++) {
        f.plants.push({ x: o.x + (c + 0.5) * o.gap + (this.rnd() - 0.5) * 4, y: o.y + (r + 0.5) * o.gap + (this.rnd() - 0.5) * 4,
                        g: 1, pop: 0, ph: this.rnd() * 6.28 });
      }
      if (f.spill) {
        f.pile = new Pile(o.crop, o.x, o.y, f.w, f.h);
        if (o.prefill) f.pile.prefill(o.prefill, this.rnd, false);
        this.piles.push(f.pile); f.pile.owner = f;
      }
      this.fields.push(f); this.objs[o.id] = f;
    } else if (o.type === 'coop') {
      const pr = CFG.producers[o.producer];
      const c = { ...base, kind: 'coop', period: pr.period, burst: pr.burst, slots: [], pile: new Pile(o.item, o.x, o.y, o.w, o.h, o.cap) };
      // slots along the top fence, then down both sides (outside the fence)
      const topN = Math.floor((o.w - 24) / 36) + 1, sp = (o.w - 24) / Math.max(1, topN - 1);
      for (let i = 0; i < topN; i++) c.slots.push({ x: o.x + 12 + i * sp, y: o.y - 22, side: 0 });
      for (let i = 0; ; i++) {
        const y = o.y + 26 + i * 40; if (y > o.y + o.h - 30) break;
        c.slots.push({ x: o.x - 26, y, side: -1 }); c.slots.push({ x: o.x + o.w + 26, y, side: 1 });
      }
      c.max = Math.min(o.max, c.slots.length);
      c.n = Math.min(o.n, c.max);
      c.hens = c.slots.map((s) => ({ ...s, t: this.rnd() * pr.period, lay: 0, appearT: -9 }));
      if (o.prefill) c.pile.prefill(o.prefill, this.rnd, true);
      c.pile.owner = c;
      this.piles.push(c.pile); this.coops.push(c); this.objs[o.id] = c;
    } else if (o.type === 'counter') {
      const K = CFG.counter, f = o.flip ? -1 : 1;
      const cu = CFG.customer;
      const c = { ...base, kind: 'counter', f, stock: 0, incoming: 0, queue: [], cash: 0, cashier: false, spawnT: 0.5,
                  price: o.price ?? CFG.items[o.item].price, interval: cu.interval, serveRate: cu.serveRate, buyAcc: 0,
                  zone: rectAt(o.x + f * K.zoneDx, o.y + K.zoneDy, K.zoneW, K.zoneH),
                  serve: { x: o.x + f * K.serveDx, y: o.y + K.serveDy },
                  cashPos: { x: o.x + f * K.cashDx, y: o.y + K.cashDy },
                  spawn: { x: f > 0 ? this.W + 40 : -40, y: o.y - 70 },
                  exit: { x: f > 0 ? this.W + 40 : -40, y: o.y + 110 }, bumpT: 0 };
      this.counters.push(c); this.objs[o.id] = c;
    } else if (o.type === 'proc') {
      const P = CFG.proc;
      const p = { ...base, kind: 'proc', inItem: o.in, outItem: o.out, buf: 0, inc: 0, out: 0, outInc: 0, timer: 0, work: 0,
                  inZone: rectAt(o.x - P.zoneDx, o.y + P.zoneDy, P.zoneW, P.zoneH),
                  outZone: rectAt(o.x + P.zoneDx, o.y + P.zoneDy, P.zoneW, P.zoneH) };
      this.procs.push(p); this.objs[o.id] = p;
    }
  }

  rebuildSolids() {
    const s = [];
    const K = CFG.counter, P = CFG.proc;
    for (const c of this.counters) if (!c.hidden) s.push(rectAt(c.x, c.y, K.standW, K.standH));
    for (const p of this.procs) if (!p.hidden) s.push(rectAt(p.x, p.y, P.bodyW, P.bodyH));
    for (const c of this.coops) if (!c.hidden) {
      s.push({ x: c.x - 10, y: c.y - 44, w: c.w + 20, h: 32 });           // top fence + nests
      s.push({ x: c.x - 10, y: c.y - 10, w: 10, h: c.h + 10 });           // left fence
      s.push({ x: c.x + c.w, y: c.y - 10, w: 10, h: c.h + 10 });          // right fence
    }
    this.solids = s;
  }

  refreshStats() {
    const p = this.player, u = this.upg;
    if (p.vehicle) {
      const V = CFG.vehicle;
      p.speed = V.speed + u.speed; p.cap = V.cap + u.cap * V.capMul; p.pickR = V.pickR + u.radius;
      p.harvestR = V.harvestR + u.radius * 0.6; p.pickRate = V.pickRate; p.dropRate = V.dropRate;
    } else {
      const P = CFG.player;
      p.speed = P.speed + u.speed; p.cap = P.cap + u.cap; p.pickR = P.pickR + u.radius;
      p.harvestR = P.harvestR + u.radius * 0.6; p.pickRate = P.pickRate + u.radius; p.dropRate = P.dropRate + u.cap * 0.2;
    }
    for (const w of this.workers) {
      const Wk = CFG.worker;
      w.speed = Wk.speed + u.wspeed; w.cap = Wk.cap + u.wcap; w.pickR = Wk.pickR; w.harvestR = Wk.harvestR;
      w.pickRate = Wk.pickRate; w.dropRate = Wk.dropRate;
    }
  }

  // ---- flying items ------------------------------------------------------
  launch(type, kind, x0, y0, z0, ref, tx, ty, tz, dur) {
    const f = this.flyFree.pop() || {};
    f.type = type; f.kind = kind; f.x0 = x0; f.y0 = y0; f.z0 = z0; f.ref = ref; f.tx = tx; f.ty = ty; f.tz = tz;
    f.t = 0; f.dur = dur * (0.85 + this.rnd() * 0.3); f.active = true;
    this.fly.push(f);
    return f;
  }
  landFly(f) {
    const r = f.ref;
    switch (f.kind) {
      case 'stack': r.incoming--; r.stack.push(f.type); break;
      case 'pile': r.pending--; r.add(f.tx, f.ty, this.rnd); break;
      case 'counter': r.incoming--; r.stock++; r.bumpT = 1; break;
      case 'cust': r.incoming--; r.got++; break;
      case 'procIn': r.inc--; r.buf++; break;
      case 'procOut': r.outInc--; r.out++; break;
    }
  }

  // ---- tiles ---------------------------------------------------------------
  tileReady(id) { const t = this.tiles.find((x) => x.id === id); return t && t.bought > 0; }
  updateTileVis(silent) {
    for (const t of this.tiles) {
      const v = !t.done && (!t.req || t.req.every((r) => this.tileReady(r)));
      if (v && !t.visible && !silent) { t.appearT = this.t; this.emit('tileAppear', { x: t.x, y: t.y }); }
      t.visible = v;
    }
  }
  completeTile(t, silent) {
    t.bought++; t.paid = 0;
    this.applyEffect(t.effect, t, silent);
    if (!silent) { this.stats.unlocks++; this.emit('unlock', { x: t.x, y: t.y, icon: t.icon }); }
    t.cool = 1.0;
    if (t.repeat && t.bought < t.repeat.times) t.price = Math.round(t.price0 * Math.pow(t.repeat.mul, t.bought));
    else t.done = true;
    this.updateTileVis(silent);
  }
  applyEffect(e, t, silent) {
    if (e.show) for (const id of e.show) { const o = this.objs[id]; if (o) { o.hidden = false; o.appearT = this.t; } }
    if (e.show) { this.rebuildSolids(); if (!silent) this.emit('ground', {}); }
    if (e.hens) {
      const c = this.objs[e.hens.coop];
      const before = c.n; c.n = Math.min(c.max, c.n + e.hens.n);
      for (let i = before; i < c.n; i++) c.hens[i].appearT = this.t + (i - before) * 0.12;
    }
    if (e.up) { this.upg[e.up.key] += e.up.v; this.refreshStats(); }
    if (e.worker) {
      const w = makeCollector('worker', t.x, t.y);
      w.from = e.worker.from; w.to = e.worker.to; w.state = 'collect'; w.wait = 0; w.tgt = null; w.retarget = 0;
      w.stuck = 0; w.lastX = t.x; w.lastY = t.y; w.cart = t.icon === 'cart'; w.appearT = this.t;
      this.workers.push(w); this.refreshStats();
    }
    if (e.vehicle) { this.player.vehicle = true; this.player.appearT = this.t; this.refreshStats(); }
    if (e.cashier) for (const id of e.cashier) { const c = this.objs[id]; c.cashier = true; if (c.cash > 0) { this.money += c.cash; c.cash = 0; } }
    const procs = [].concat(e.proc || [], e.proc2 || []);
    for (const pe of procs) { const p = this.objs[pe.id]; p.time *= pe.mul; }
  }

  // ---- goal ------------------------------------------------------------------
  progress() {
    const g = this.L.goal, s = this.stats;
    let v = 0;
    if (g.type === 'earn') v = s.earned; else if (g.type === 'collect') v = s.collected[g.item] || 0;
    else if (g.type === 'unlock') v = s.unlocks; else if (g.type === 'produce') v = s.produced[g.item] || 0;
    else if (g.type === 'sell') v = s.sold[g.item] || 0;
    return { v: Math.min(v, g.n), n: g.n, f: Math.min(1, v / g.n) };
  }
  stars() {
    if (!this.won) return 0;
    const par = this.L.par;
    return this.winT <= par ? 3 : this.winT <= par * CFG.stars.twoMul ? 2 : 1;
  }

  // ---- main update ---------------------------------------------------------------
  update(dt, ix, iy) {
    if (!this.won) this.t += dt;
    const T = this.t;
    this.movePlayer(dt, ix, iy);
    for (const w of this.workers) this.workerAI(w, dt);
    // fields regrow
    for (const f of this.fields) {
      if (f.hidden) continue;
      for (const p of f.plants) { if (p.g < 1) { p.g = Math.min(1, p.g + dt / f.grow); if (p.g >= 1) p.pop = 1; } if (p.pop > 0) p.pop = Math.max(0, p.pop - dt * 3); }
    }
    // producers lay
    for (const c of this.coops) {
      if (c.hidden) continue;
      for (let i = 0; i < c.n; i++) {
        const h = c.hens[i]; if (T < h.appearT) continue;
        h.lay = Math.max(0, h.lay - dt * 4);
        h.t += dt;
        if (h.t >= c.period) {
          h.t -= c.period * (0.8 + this.rnd() * 0.4);
          if (c.pile.full()) continue;
          h.lay = 1;
          for (let b = 0; b < c.burst; b++) {
            let tx, ty;
            if (h.side === 0) { tx = h.x + (this.rnd() - 0.5) * 120; ty = c.y + Math.pow(this.rnd(), 1.6) * c.h; }
            else { tx = h.side < 0 ? c.x + Math.pow(this.rnd(), 1.5) * c.w : c.x + c.w - Math.pow(this.rnd(), 1.5) * c.w; ty = h.y + (this.rnd() - 0.5) * 120; }
            tx = Math.min(c.x + c.w - 2, Math.max(c.x + 2, tx)); ty = Math.min(c.y + c.h - 2, Math.max(c.y + 2, ty));
            c.pile.pending++;
            this.launch(c.item, 'pile', h.x, h.y, h.side === 0 && c.producer === 'hen' ? 26 : 10, c.pile, tx, ty, 0, CFG.fly.lay);
          }
          this.emit('lay', { x: h.x, y: h.y, item: c.item });
        }
      }
    }
    // collectors interact
    this.interact(this.player, dt, true);
    for (const w of this.workers) this.interact(w, dt, false);
    this.playerExtras(dt);
    // counters & customers
    for (const c of this.counters) if (!c.hidden) this.updateCounter(c, dt);
    this.updateCustomers(dt);
    // processors
    for (const p of this.procs) {
      if (p.hidden) continue;
      p.work = Math.max(0, p.work - dt * 2);
      if (p.buf >= p.ratio && p.out + p.outInc < CFG.proc.outCap) {
        p.timer += dt; p.work = 1;
        if (p.timer >= p.time) {
          p.timer = 0; p.buf -= p.ratio; p.outInc++;
          this.stats.produced[p.outItem] = (this.stats.produced[p.outItem] || 0) + 1;
          this.launch(p.outItem, 'procOut', p.x, p.y, 30, p, p.outZone.cx, p.outZone.cy, 0, CFG.fly.produce);
          this.emit('produce', { x: p.x, y: p.y, item: p.outItem });
        }
      } else p.timer = Math.min(p.timer, p.time);
    }
    // flying items
    for (let i = this.fly.length - 1; i >= 0; i--) {
      const f = this.fly[i]; f.t += dt;
      if (f.t >= f.dur) { this.landFly(f); f.active = false; this.fly[i] = this.fly[this.fly.length - 1]; this.fly.pop(); this.flyFree.push(f); }
    }
    for (const pl of this.piles) { const b = pl.bump; for (let i = 0; i < b.length; i++) if (b[i] > 0) b[i] = Math.max(0, b[i] - dt * 5); }
    // goal
    if (!this.won && this.progress().f >= 1) { this.won = true; this.winT = this.t; this.emit('win', {}); }
  }

  collide(c, nx, ny, r) {
    const W = this.W, H = this.H;
    nx = Math.min(W - 20, Math.max(20, nx)); ny = Math.min(H - 20, Math.max(60, ny));
    for (const s of this.solids) {
      if (nx > s.x - r && nx < s.x + s.w + r && ny > s.y - r && ny < s.y + s.h + r) {
        // push out along the smaller penetration
        const pl = nx - (s.x - r), pr = s.x + s.w + r - nx, pt = ny - (s.y - r), pb = s.y + s.h + r - ny;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = s.x - r; else if (m === pr) nx = s.x + s.w + r; else if (m === pt) ny = s.y - r; else ny = s.y + s.h + r;
      }
    }
    c.x = nx; c.y = ny;
  }

  // direction from c toward (tx,ty) that walks around solid rects (corner waypoints).
  segHits(ax, ay, bx, by, s, r) {
    const x0 = s.x - r, x1 = s.x + s.w + r, y0 = s.y - r, y1 = s.y + s.h + r;
    const dx = bx - ax, dy = by - ay; let t0 = 0, t1 = 1;
    for (const [p, d, lo, hi] of [[ax, dx, x0, x1], [ay, dy, y0, y1]]) {
      if (Math.abs(d) < 1e-6) { if (p <= lo || p >= hi) return -1; }
      else { let a = (lo - p) / d, b = (hi - p) / d; if (a > b) { const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 >= t1) return -1; }
    }
    return t0;
  }
  steer(c, tx, ty, r = 12) {
    let best = null, bt = 2;
    for (const s of this.solids) {
      if (tx > s.x - r && tx < s.x + s.w + r && ty > s.y - r && ty < s.y + s.h + r) continue;
      const t = this.segHits(c.x, c.y, tx, ty, s, r);
      if (t >= 0 && t < bt) { bt = t; best = s; }
    }
    if (!best) return { x: tx, y: ty };
    const m = r + 6, s = best;
    const cs = [[s.x - m, s.y - m], [s.x + s.w + m, s.y - m], [s.x - m, s.y + s.h + m], [s.x + s.w + m, s.y + s.h + m]];
    let bc = null, bd = 1e18;
    for (const [x, y] of cs) {
      if (this.segHits(c.x, c.y, x, y, s, r - 4) >= 0) continue;           // can't reach this corner directly
      const dd = Math.hypot(x - c.x, y - c.y) + Math.hypot(tx - x, ty - y) + (this.segHits(x, y, tx, ty, s, r - 4) >= 0 ? 400 : 0);
      if (dd < bd) { bd = dd; bc = { x, y }; }
    }
    return bc || { x: tx, y: ty };
  }

  movePlayer(dt, ix, iy) {
    const p = this.player;
    let m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; m = 1; }
    const tvx = ix * p.speed, tvy = iy * p.speed, k = Math.min(1, dt * 14);
    p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
    this.stepMove(p, dt, CFG.player.body + (p.vehicle ? 8 : 0));
  }
  stepMove(c, dt, r) {
    const sp = Math.hypot(c.vx, c.vy);
    c.moving = sp > 8;
    if (c.moving) { c.walk += dt * (6 + sp * 0.04); if (Math.abs(c.vx) > 4) c.face = c.vx > 0 ? 1 : -1; c.dirY = c.vy; }
    this.collide(c, c.x + c.vx * dt, c.y + c.vy * dt, r);
    c.sway += ((-c.vx * 0.0045) - c.sway) * Math.min(1, dt * 5);
  }

  // ---- harvesting / picking / dropping (player, vehicle, workers share this) ----
  interact(c, dt, isPlayer) {
    const space = () => c.cap - c.stack.length - c.incoming;
    const srcs = c.sources;                      // workers: restricted source list
    if (c.canPick) {
      // crop fields: touch ripe plants
      for (const f of this.fields) {
        if (f.hidden || (srcs && !srcs.includes(f))) continue;
        const hr = c.harvestR;
        if (c.x < f.x - hr || c.x > f.x + f.w + hr || c.y < f.y - hr || c.y > f.y + f.h + hr) continue;
        let n = 0;
        for (const p of f.plants) {
          if (p.g < 1 || d2(p.x, p.y, c.x, c.y) > hr * hr) continue;
          if (f.spill) {
            if (f.pile.full()) break;
            p.g = 0; n++;
            for (let k = 0; k < f.spill; k++) {
              const tx = p.x + (this.rnd() - 0.5) * 34, ty = p.y + (this.rnd() - 0.5) * 34;
              f.pile.pending++;
              this.launch(f.item, 'pile', p.x, p.y, 4, f.pile, tx, ty, 0, CFG.fly.harvest * 1.3);
            }
          } else {
            if (space() < f.yieldN) break;
            p.g = 0; n++;
            for (let k = 0; k < f.yieldN; k++) { c.incoming++; this.launch(f.item, 'stack', p.x, p.y, 8, c, 0, 0, 0, CFG.fly.harvest); }
            this.stats.collected[f.item] = (this.stats.collected[f.item] || 0) + f.yieldN;
          }
          this.emit('harvest', { x: p.x, y: p.y, item: f.item, who: c.kind });
          if (n >= 4) break;
        }
      }
      // piles
      if (space() > 0) {
        c.pickAcc = Math.min(c.pickAcc + c.pickRate * dt, Math.max(1, c.pickRate * 0.1));
        let took = false;
        for (const pl of this.piles) {
          if (pl.owner.hidden || (srcs && !srcs.includes(pl.owner))) continue;
          if (c.only && pl.type !== c.only) continue;
          while (c.pickAcc >= 1 && space() > 0) {
            const i = pl.take(c.x, c.y, c.pickR);
            if (i < 0) break;
            c.pickAcc--; took = true; c.incoming++;
            this.launch(pl.type, 'stack', pl.cx(i), pl.cy(i), pl.hs[i] * CFG.pile.layer, c, 0, 0, 0, CFG.fly.pick);
            this.stats.collected[pl.type] = (this.stats.collected[pl.type] || 0) + 1;
            if (isPlayer) this.emit('pick', { item: pl.type });
          }
        }
        // processor outputs
        for (const p of this.procs) {
          if (p.hidden || p.out <= 0 || (srcs && !srcs.includes(p))) continue;
          if (!inRect(c.x, c.y, p.outZone)) continue;
          while (c.pickAcc >= 1 && space() > 0 && p.out > 0) {
            p.out--; c.pickAcc--; took = true; c.incoming++;
            this.launch(p.outItem, 'stack', p.outZone.cx, p.outZone.cy, 6, c, 0, 0, 0, CFG.fly.pick);
            if (isPlayer) this.emit('pick', { item: p.outItem });
          }
        }
        if (!took) c.pickAcc = Math.min(c.pickAcc, 1);
      }
      const full = space() <= 0 && c.stack.length > 0;
      if (full && !c.fullFlag && isPlayer) this.emit('full', {});
      c.fullFlag = full;
    }
    // drop into sinks
    if (c.canDrop && c.stack.length > 0) {
      let sink = null, item = null;
      for (const k of this.counters) if (!k.hidden && inRect(c.x, c.y, k.zone) && c.stack.includes(k.item) && (!c.toObjs || c.toObjs.includes(k))) { sink = k; item = k.item; break; }
      if (!sink) for (const p of this.procs) if (!p.hidden && inRect(c.x, c.y, p.inZone) && c.stack.includes(p.inItem) && (!c.toObjs || c.toObjs.includes(p))) { sink = p; item = p.inItem; break; }
      if (sink) {
        c.dropAcc = Math.min(c.dropAcc + c.dropRate * dt, Math.max(1, c.dropRate * 0.1));
        while (c.dropAcc >= 1) {
          const idx = c.stack.lastIndexOf(item); if (idx < 0) break;
          c.stack.splice(idx, 1); c.dropAcc--;
          const z = 44 + idx * CFG.items[item].step;
          if (sink.kind === 'counter') { sink.incoming++; this.launch(item, 'counter', c.x, c.y, z, sink, sink.x, sink.y - 4, 22, CFG.fly.drop); }
          else { sink.inc++; this.launch(item, 'procIn', c.x, c.y, z, sink, sink.x - 20, sink.y, 34, CFG.fly.drop); }
          if (isPlayer) this.emit('drop', { item });
        }
      } else c.dropAcc = 0;
    }
  }

  playerExtras(dt) {
    const p = this.player, R = CFG.player.cashR;
    // vacuum cash piles
    for (const c of this.counters) {
      if (c.hidden || c.cash <= 0.01) continue;
      if (d2(p.x, p.y, c.cashPos.x, c.cashPos.y) > R * R) continue;
      const take = Math.min(c.cash, Math.max(c.cash * dt * 5, 80 * dt));
      c.cash -= take; this.money += take;
      if (c.cash < 0.01) { this.money += c.cash; c.cash = 0; }
      this.emit('cash', { x: c.cashPos.x, y: c.cashPos.y, amount: take });
    }
    // pay into unlock tiles
    const half = CFG.tile.size / 2;
    for (const t of this.tiles) if (t.cool > 0) t.cool -= dt;
    for (const t of this.tiles) {
      if (!t.visible) continue;
      if (Math.abs(p.x - t.x) > half || Math.abs(p.y - t.y) > half) { continue; }
      if (t.cool > 0) break;
      if (this.money < 0.5) continue;
      const rate = Math.max(t.price / CFG.player.payTime, CFG.player.payMin);
      const pay = Math.min(rate * dt, this.money, t.price - t.paid);
      this.money -= pay; t.paid += pay; t.payFx += pay;
      if (t.payFx >= t.price / 24) { this.emit('payTick', { x: t.x, y: t.y }); t.payFx = 0; }
      if (t.paid >= t.price - 1e-6) this.completeTile(t);
      break;
    }
  }

  updateCounter(c, dt) {
    const C = CFG.customer;
    c.bumpT = Math.max(0, c.bumpT - dt * 4);
    c.spawnT -= dt;
    if (c.spawnT <= 0 && c.queue.length < C.queue) {
      c.spawnT = c.interval * (0.7 + this.rnd() * 0.6);
      const cu = { x: c.spawn.x, y: c.spawn.y + (this.rnd() - 0.5) * 40, counter: c, state: 'in', want: C.buyMin + Math.floor(this.rnd() * (C.buyMax - C.buyMin + 1)),
                   got: 0, incoming: 0, wait: 0, hue: Math.floor(this.rnd() * 6), walk: this.rnd() * 6, face: -c.f, vx: 0, vy: 0, item: c.item };
      c.queue.push(cu); this.customers.push(cu);
    }
    // front customer buys
    const front = c.queue[0];
    if (front && front.state === 'wait') {
      c.buyAcc = Math.min(c.buyAcc + c.serveRate * dt, 2);
      while (c.buyAcc >= 1 && c.stock > 0 && front.got + front.incoming < front.want) {
        c.buyAcc--; c.stock--; front.incoming++;
        this.launch(c.item, 'cust', c.x, c.y - 4, 22, front, 0, 0, 0, CFG.fly.serve);
      }
      if (c.stock <= 0) c.buyAcc = 0;
      const done = front.got >= front.want || (front.incoming === 0 && front.got > 0 && c.stock <= 0 && (front.wait += dt) > C.patience);
      if (done && front.incoming === 0) {
        const amount = front.got * c.price;
        this.stats.sold[c.item] = (this.stats.sold[c.item] || 0) + front.got;
        this.stats.earned += amount;
        if (c.cashier) { this.money += amount; this.emit('cashierPay', { x: c.x, y: c.y, amount }); }
        else { c.cash += amount; this.emit('pay', { x: front.x, y: front.y, tx: c.cashPos.x, ty: c.cashPos.y, amount }); }
        this.emit('sale', { x: c.x, y: c.y, amount });
        front.state = 'out'; c.queue.shift();
      }
    }
  }

  updateCustomers(dt) {
    const C = CFG.customer;
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const cu = this.customers[i], c = cu.counter;
      let tx, ty;
      if (cu.state === 'out') { tx = c.exit.x; ty = c.exit.y; }
      else { const qi = c.queue.indexOf(cu); tx = c.serve.x + qi * CFG.counter.queueGap * c.f; ty = c.serve.y; }
      const dx = tx - cu.x, dy = ty - cu.y, dd = Math.hypot(dx, dy);
      if (dd > 2) {
        const s = Math.min(dd, C.speed * dt);
        cu.vx = dx / dd * C.speed; cu.vy = dy / dd * C.speed;
        cu.x += dx / dd * s; cu.y += dy / dd * s; cu.walk += dt * 10; cu.moving = true;
        if (Math.abs(dx) > 1) cu.face = dx > 0 ? 1 : -1;
      } else {
        cu.moving = false; cu.vx = cu.vy = 0;
        if (cu.state === 'in' && c.queue[0] === cu) { cu.state = 'wait'; cu.face = -c.f; }
        if (cu.state === 'out') { this.customers.splice(i, 1); }
      }
      if (cu.state === 'in' && c.queue[0] === cu && dd <= 2) cu.state = 'wait';
    }
  }

  // ---- workers ---------------------------------------------------------------------
  workerAI(w, dt) {
    const T = this.t;
    const srcs = w.from.map((id) => this.objs[id]).filter((o) => o && !o.hidden);
    const sinks = w.to.map((id) => this.objs[id]).filter((o) => o && !o.hidden);
    w.sources = srcs; w.toObjs = sinks;
    const space = w.cap - w.stack.length - w.incoming;
    if (w.state === 'collect' && space <= 0) w.state = 'deliver';
    if (w.state === 'deliver' && w.stack.length === 0 && w.incoming === 0) { w.state = 'collect'; w.wait = 0; }
    w.canPick = w.state === 'collect';
    // which sink objects the generic drop accepts
    let tx = w.x, ty = w.y;
    if (w.state === 'collect') {
      // pick the richest source
      let best = null, bv = 0;
      for (const s of srcs) {
        let v = 0;
        if (s.kind === 'coop') v = s.pile.total;
        else if (s.kind === 'field') v = (s.pile ? s.pile.total : 0) + s.plants.reduce((a, p) => a + (p.g >= 1 ? 1 : 0), 0);
        else if (s.kind === 'proc') v = s.out * 3;
        if (v > bv) { bv = v; best = s; }
      }
      if (!best) {
        w.wait += dt;
        if (w.stack.length > 0 && w.wait > 1.5) w.state = 'deliver';
      } else {
        w.retarget -= dt;
        if (w.retarget <= 0 || !w.tgt) {
          w.retarget = 0.4;
          if (best.kind === 'proc') w.tgt = { x: best.outZone.cx, y: best.outZone.cy };
          else {
            const pl = best.pile;
            const i = pl && pl.total > 0 ? pl.hottest(w.x, w.y, T) : -1;
            if (i >= 0) w.tgt = pl.safe(i);
            else { // nearest ripe plant
              let bp = null, bd = 1e18;
              for (const p of best.plants) if (p.g >= 1) { const dd = d2(p.x, p.y, w.x, w.y); if (dd < bd) { bd = dd; bp = p; } }
              if (bp) w.tgt = { x: bp.x, y: bp.y };
            }
          }
        }
        if (w.tgt) { tx = w.tgt.x; ty = w.tgt.y; }
        // partly-filled worker with an emptied source goes to deliver
        if (bv === 0 && w.stack.length > 0) w.state = 'deliver';
      }
    }
    if (w.state === 'deliver') {
      let bs = null, bd = 1e18;
      for (const s of sinks) { const z = s.kind === 'counter' ? s.zone : s.inZone; const dd = d2(z.cx, z.cy, w.x, w.y); if (dd < bd) { bd = dd; bs = z; } }
      if (bs) { tx = bs.cx; ty = bs.cy; }
    }
    const goal = Math.hypot(tx - w.x, ty - w.y);
    const wp = this.steer(w, tx, ty);
    const dx = wp.x - w.x, dy = wp.y - w.y, dd = Math.hypot(dx, dy);
    const sp = goal > 3 ? w.speed : 0;
    let vx = dd > 0 ? dx / dd * sp : 0, vy = dd > 0 ? dy / dd * sp : 0;
    // unstick: if barely moving while far from target, slide sideways
    if (sp > 0) {
      w.stuck = Math.hypot(w.x - w.lastX, w.y - w.lastY) < w.speed * dt * 0.2 ? w.stuck + dt : Math.max(0, w.stuck - dt);
      if (w.stuck > 0.4) { const s = (Math.floor(T) % 2 ? 1 : -1); const ox = vx; vx = -vy * s; vy = ox * s; }
    }
    w.lastX = w.x; w.lastY = w.y;
    const k = Math.min(1, dt * 10);
    w.vx += (vx - w.vx) * k; w.vy += (vy - w.vy) * k;
    this.stepMove(w, dt, 10);
  }

  // ---- guide: what should the player do next (arrow + sim bot) -----------------------
  sinksFor(item) {
    const out = [];
    for (const k of this.counters) if (!k.hidden && k.item === item) out.push(k.zone);
    for (const p of this.procs) if (!p.hidden && p.inItem === item) out.push(p.inZone);
    return out;
  }
  guide() {
    if (this.won) return null;
    const p = this.player;
    const free = p.cap - p.stack.length - p.incoming;
    let cash = 0, cashPos = null, cd = 1e18;
    for (const c of this.counters) if (!c.hidden && c.cash > 0.5) {
      cash += c.cash; const dd = d2(c.cashPos.x, c.cashPos.y, p.x, p.y); if (dd < cd) { cd = dd; cashPos = c.cashPos; }
    }
    let tile = null;
    for (const t of this.tiles) if (t.visible && t.price - t.paid <= this.money + 0.01) { tile = t; break; }
    if (tile) return { x: tile.x, y: tile.y, kind: 'tile', obj: tile };
    if (cashPos) for (const t of this.tiles) if (t.visible && t.price - t.paid <= this.money + cash) return { x: cashPos.x, y: cashPos.y, kind: 'cash' };
    if (free <= 0 && p.stack.length > 0) this.gmode = 'deliver';
    if (this.gmode === 'deliver') {
      if (p.stack.length === 0 && p.incoming === 0) this.gmode = 'collect';
      else { const s = this.sinkTarget(p); if (s) return s; this.gmode = 'collect'; }
    }
    if (free > 0) { const src = this.sourceTarget(p, free); if (src) return src; }
    if (p.stack.length > 0) { const s = this.sinkTarget(p); if (s) { this.gmode = 'deliver'; return s; } }
    if (cashPos) return { x: cashPos.x, y: cashPos.y, kind: 'cash' };
    return null;
  }
  sinkTarget(p) {
    let best = null, bd = 1e18;
    const seen = new Set(p.stack);
    for (const item of seen) for (const z of this.sinksFor(item)) { const dd = d2(z.cx, z.cy, p.x, p.y); if (dd < bd) { bd = dd; best = z; } }
    return best ? { x: best.cx, y: best.cy, kind: 'sink' } : null;
  }
  sourceTarget(p, free) {
    let best = null, bs = -1;
    const has = (item) => this.sinksFor(item).length > 0;
    for (const pr of this.procs) if (!pr.hidden && pr.out > 0 && has(pr.outItem)) {
      const v = Math.min(free, pr.out) * CFG.items[pr.outItem].price * 1.5;
      const s = v / (Math.sqrt(d2(pr.outZone.cx, pr.outZone.cy, p.x, p.y)) + 80);
      if (s > bs) { bs = s; best = { x: pr.outZone.cx, y: pr.outZone.cy, kind: 'out' }; }
    }
    for (const pl of this.piles) if (!pl.owner.hidden && pl.total > 0 && has(pl.type)) {
      const i = pl.hottest(p.x, p.y, this.t); if (i < 0) continue;
      const { x, y } = pl.safe(i);
      const v = Math.min(free, pl.total) * CFG.items[pl.type].price;
      const s = v / (Math.sqrt(d2(x, y, p.x, p.y)) + 80);
      if (s > bs) { bs = s; best = { x, y, kind: 'pile' }; }
    }
    for (const f of this.fields) if (!f.hidden && has(f.item) && (!f.spill || f.pile.total < 20)) {
      let bp = null, bd = 1e18, n = 0;
      for (const pl of f.plants) if (pl.g >= 1) { n++; const dd = d2(pl.x, pl.y, p.x, p.y); if (dd < bd) { bd = dd; bp = pl; } }
      if (!bp) continue;
      const v = Math.min(free, n * (f.yieldN || f.spill)) * CFG.items[f.item].price;
      const s = v / (Math.sqrt(bd) + 80);
      if (s > bs) { bs = s; best = { x: bp.x, y: bp.y, kind: 'field' }; }
    }
    return best;
  }

  // ---- save/restore of a level in progress (piles are rebuilt from prefill) ---------
  snapshot() {
    return { li: this.li, t: this.t, money: this.money, stats: this.stats, upgDone: true,
             tiles: this.tiles.map((t) => ({ id: t.id, paid: t.paid, bought: t.bought })),
             stack: this.player.stack.slice(0, 600),
             cash: this.counters.map((c) => c.cash), stock: this.counters.map((c) => c.stock) };
  }
  restore(s) {
    for (const ts of s.tiles || []) {
      const t = this.tiles.find((x) => x.id === ts.id); if (!t) continue;
      for (let k = 0; k < ts.bought && !t.done; k++) this.completeTile(t, true);
      t.paid = Math.min(ts.paid || 0, t.price - 1);
    }
    this.t = s.t || 0; this.money = s.money || 0;
    if (s.stats) this.stats = { collected: {}, sold: {}, produced: {}, earned: 0, unlocks: 0, ...s.stats };
    if (Array.isArray(s.stack)) this.player.stack = s.stack.filter((x) => CFG.items[x]).slice(0, this.player.cap);
    (s.cash || []).forEach((v, i) => { if (this.counters[i]) this.counters[i].cash = v || 0; });
    (s.stock || []).forEach((v, i) => { if (this.counters[i]) this.counters[i].stock = v || 0; });
    this.updateTileVis(true);
  }
}
