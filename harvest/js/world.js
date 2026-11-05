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
  safe(i) {
    const m = 16;
    return { x: Math.min(this.x + this.w - 6, Math.max(this.x + m, this.cx(i))), y: Math.min(this.y + this.h - 6, Math.max(this.y + m, this.cy(i))) };
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
  prefill(n, rnd, biasFar) {
    for (let k = 0; k < n && this.total < this.cap; k++) {
      // biasFar: heap up toward the nests on the north and west sides
      const u = biasFar ? Math.pow(rnd(), 1.8) : rnd(), v = biasFar ? Math.pow(rnd(), 1.8) : rnd();
      this.add(this.x + u * this.w, this.y + v * this.h, rnd);
    }
    this.bump.fill(0);
  }
}

// ---------------------------------------------------------------------------
// Field: a dense grid of individual plants (thousands). g[i] is growth 0..1;
// 1 = in bloom and cuttable. Cut plants drop to 0 (stubble) and regrow.
export class Field {
  constructor(o, rnd) {
    const cr = CFG.crops[o.crop];
    Object.assign(this, o);
    this.kind = 'field'; this.item = o.crop; this.hidden = !!o.hidden; this.appearT = -9;
    // gy: row spacing (v3.7 grape trellis rows use gapY > gap; every other field is a square grid)
    this.gy = o.gapY || o.gap;
    this.cols = Math.max(1, Math.floor(o.w / o.gap)); this.rows = Math.max(1, Math.floor(o.h / this.gy));
    this.w = this.cols * o.gap; this.h = this.rows * this.gy;
    const n = this.n = this.cols * this.rows;
    this.g = new Float32Array(n).fill(1);
    this.jx = new Int8Array(n); this.jy = new Int8Array(n); this.v = new Uint8Array(n); this.pop = new Float32Array(n); this.cutAt = new Float32Array(n).fill(-9);
    for (let i = 0; i < n; i++) { this.jx[i] = Math.round((rnd() - 0.5) * 60); this.jy[i] = Math.round((rnd() - 0.5) * 60); this.v[i] = (rnd() * 4) | 0; }
    // 金色作物: a few sparkling golden plants; a cut golden plant re-rolls when it regrows
    // v4.0 每日挑战 金色日: a field object may carry goldMul (×chance); every normal level keeps CFG.golden.chance
    this.goldChance = CFG.golden.chance * (o.goldMul || 1);
    this.gold = new Uint8Array(n); for (let i = 0; i < n; i++) this.gold[i] = rnd() < this.goldChance ? 1 : 0;
    this.ripe = n; this.grow = cr.grow; this.yield = cr.yield || 1; this.growMul = 1; this.envMul = 1; this.sprinkler = false; this.spill = cr.spill || 0; this.pile = null;
  }
  px(i) { return this.x + ((i % this.cols) + 0.5 + this.jx[i] / 300) * this.gap; }
  py(i) { return this.y + (((i / this.cols) | 0) + 0.5 + this.jy[i] / 300) * this.gy; }
  // nearest ripe plant (coarse stride for speed on big fields)
  nearestRipe(x, y) {
    if (this.ripe <= 0) return -1;
    const C = this.cols, R = this.rows, s = this.n > 1500 ? 2 : 1;
    let best = -1, bd = 1e18;
    for (let r = 0; r < R; r += s) for (let c = (r / s) & 1 ? 1 : 0; c < C; c += s) {
      const i = r * C + c; if (this.g[i] < 1) continue;
      const dx = this.x + (c + 0.5) * this.gap - x, dy = this.y + (r + 0.5) * this.gy - y, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best < 0) for (let i = 0; i < this.n; i++) if (this.g[i] >= 1) { const dd = d2(this.px(i), this.py(i), x, y); if (dd < bd) { bd = dd; best = i; } }
    return best;
  }
  sprout(rnd, t) {
    // a freshly planted plot: everything pops in as seedlings and blooms in a wave
    for (let i = 0; i < this.n; i++) { const c = i % this.cols, r = (i / this.cols) | 0; this.g[i] = 0.25 + 0.45 * (1 - (c + r) / (this.cols + this.rows)) + rnd() * 0.08; }
    this.ripe = 0; this.appearT = t;
  }
}

// ---------------------------------------------------------------------------
function makeCollector(kind, x, y) {
  return { kind, x, y, vx: 0, vy: 0, face: 1, moving: false, walk: 0, dirY: 0,
           speed: 0, cap: 0, pickR: 0, harvestR: 0, cutRate: 0, pickRate: 0, dropRate: 0,
           stack: [], incoming: 0, pickAcc: 0, dropAcc: 0, cutAcc: 0, cutT: -9, sway: 0, fullFlag: false, vehicle: false,
           sources: null, canPick: true, canDrop: true, only: null };
}
const itemPrice = (t) => CFG.items[t].price;

export class World {
  constructor(levelIndex, opts = {}) {
    this.li = levelIndex;
    // v4.0: opts.level = a remixed level object (每日挑战); otherwise the level from CFG
    this.L = opts.level || CFG.levels[levelIndex];
    this.daily = opts.level ? (opts.daily || {}) : null;
    this.timeLimit = opts.timeLimit || 0;     // 每日挑战: the run ends at this many seconds (score = money earned)
    this.vipMul = opts.vipMul || 1;
    // v4.0 四季与天气: season index 0–3 (春夏秋冬) or null = neutral; rain = this run is rainy.
    // Neutral (the sims' default) leaves every growth rate exactly as before.
    this.season = Number.isInteger(opts.season) ? opts.season : null;
    this.rain = !!opts.rain;
    this.W = this.L.W; this.H = this.L.H;
    this.rnd = rng32(opts.seed ?? (levelIndex + 1) * 7919);
    this.quiet = !!opts.quiet;      // sim: skip render-only events
    this.crew = Array.isArray(opts.crew) ? opts.crew : null;   // v3.6 雇工: [{ id, name, trait, lv, mul }] by hire slot
    this.t = 0; this.money = 0; this.won = false; this.winT = 0;
    this.events = [];
    this.stats = { collected: {}, sold: {}, produced: {}, earned: 0, unlocks: 0 };
    this.upg = { cap: 0, speed: 0, radius: 0, wcap: 0, wspeed: 0 };
    this.objs = {}; this.fields = []; this.coops = []; this.counters = []; this.procs = [];
    this.piles = []; this.tiles = []; this.workers = []; this.customers = []; this.solids = [];
    this.fly = []; this.flyFree = [];
    this.gmode = 'collect';
    this.combo = 0; this.comboIdle = 0; this.feverT = 0; this.comboGain = 0; this.loaders = false;
    this.deco = this.L.deco || {};
    for (const o of this.L.objects) this.build(o);
    for (const p of this.procs) p.outObj = p.outTo ? this.objs[p.outTo] : null;
    this.L.tiles.forEach((t, i) => this.tiles.push({ ...t, order: i, paid: 0, bought: 0, done: false, visible: false,
      price0: t.price, payFx: 0, appearT: -9, cool: 0 }));
    this.player = makeCollector('player', this.L.start[0], this.L.start[1]);
    this.applyEnv();
    if (opts.money) this.money = opts.money;
    if (opts.speedUp) this.upg.speed += opts.speedUp;
    this.refreshStats();
    this.rebuildSolids();
    this.updateTileVis(true);
  }

  // season crops grow +CFG.season.bonus, rain +CFG.rain.bonus (fields regrow faster, coop producers of
  // that item lay faster). Returns the multiplier for an item.
  envMul(item) {
    let m = 1;
    if (this.season !== null && CFG.seasons[this.season].crops.includes(item)) m *= 1 + CFG.season.bonus;
    if (this.rain) m *= 1 + CFG.rain.bonus;
    return m;
  }
  applyEnv() {
    for (const f of this.fields) f.envMul = this.envMul(f.item);
    for (const c of this.coops) { const m = this.envMul(c.item); if (m !== 1) c.period = CFG.producers[c.producer].period / m; }
  }
  // crops in this level that the season favours (for the HUD)
  seasonCrops() {
    if (this.season === null) return [];
    const S = CFG.seasons[this.season].crops, out = [];
    for (const f of this.fields) if (S.includes(f.item) && !out.includes(f.item)) out.push(f.item);
    for (const c of this.coops) if (S.includes(c.item) && !out.includes(c.item)) out.push(c.item);
    return out;
  }

  emit(type, data) { if (!this.quiet) { if (this.events.length < 800) this.events.push({ type, ...data }); } }

  // ---- construction ------------------------------------------------------
  build(o) {
    const base = { ...o, hidden: !!o.hidden, appearT: -9 };
    if (o.type === 'field') {
      const f = new Field(o, this.rnd);
      if (f.spill) {
        f.pile = new Pile(o.crop, f.x, f.y, f.w, f.h);
        if (o.prefill) f.pile.prefill(o.prefill, this.rnd, false);
        this.piles.push(f.pile); f.pile.owner = f;
      }
      this.fields.push(f); this.objs[o.id] = f;
    } else if (o.type === 'coop') {
      const pr = CFG.producers[o.producer];
      const c = { ...base, kind: 'coop', period: pr.period, burst: pr.burst, slots: [], pile: new Pile(o.item, o.x, o.y, o.w, o.h, o.cap) };
      // nest boxes along the north fence (side 0) and the west fence (side -1)
      // cows, sheep, hives and apple trees are bigger than hens: wider slot spacing (pr.gap)
      const gp = pr.gap || 34;
      const topN = Math.floor((o.w - 20) / gp) + 1, sp = (o.w - 20) / Math.max(1, topN - 1);
      for (let i = 0; i < topN; i++) c.slots.push({ x: o.x + 10 + i * sp, y: o.y - 16, side: 0 });
      for (let i = 0; ; i++) { const y = o.y + 30 + i * gp; if (y > o.y + o.h - 16) break; c.slots.push({ x: o.x - 16, y, side: -1 }); }
      c.max = Math.min(o.max, c.slots.length);
      c.n = Math.min(o.n, c.max);
      c.hens = c.slots.map((s) => ({ ...s, t: this.rnd() * pr.period, lay: 0, appearT: -9 }));
      if (o.prefill) c.pile.prefill(o.prefill, this.rnd, true);
      c.pile.owner = c;
      this.piles.push(c.pile); this.coops.push(c); this.objs[o.id] = c;
    } else if (o.type === 'counter') {
      const K = CFG.counter, cu = CFG.customer;
      const c = { ...base, kind: 'counter', stock: [], incoming: 0, queue: [], cash: 0, cashier: false, spawnT: 0.5,
                  interval: cu.interval, serveRate: cu.serveRate, buyAcc: 0,
                  desk: rectAt(o.x, o.y, K.deskW, K.deskD),
                  zone: rectAt(o.x + K.zoneDx, o.y + K.zoneDy, K.zoneW, K.zoneH),
                  serve: { x: o.x + K.serveDx, y: o.y },
                  cashPos: { x: o.x + K.cashDx, y: o.y + K.cashDy },
                  spawn: { x: this.W + 70, y: o.y },
                  exitA: { x: o.x + K.serveDx + 30, y: o.y + 40 },
                  exit: { x: this.W + 70, y: o.y + 40 }, bumpT: 0 };
      this.counters.push(c); this.objs[o.id] = c;
    } else if (o.type === 'proc') {
      const P = CFG.proc;
      const p = { ...base, kind: 'proc', inItem: o.in, outItem: o.out, buf: 0, inc: 0, timer: 0, work: 0, outInc: 0,
                  body: rectAt(o.x, o.y, P.bodyW, P.bodyD),
                  inZone: rectAt(o.x + P.zoneDx, o.y, P.zoneW, P.zoneH) };
      this.procs.push(p); this.objs[o.id] = p;
    }
  }

  // customer gates in the east wall (render draws the openings, logic keeps customers in lanes)
  gates() { return this.counters.filter((c) => !c.hidden || this.tiles.some((t) => t.effect.show && t.effect.show.includes(c.id))).map((c) => [c.y - 34, c.y + 66]); }

  rebuildSolids() {
    const s = [];
    for (const c of this.counters) if (!c.hidden) s.push(c.desk);
    for (const p of this.procs) if (!p.hidden) s.push(p.body);
    for (const c of this.coops) if (!c.hidden) {
      s.push({ x: c.x - 26, y: c.y - 30, w: c.w + 32, h: 22 });           // north fence + nests
      s.push({ x: c.x - 30, y: c.y - 30, w: 22, h: c.h + 30 });           // west fence + nests
    }
    for (const h of this.deco.hedges || []) s.push({ x: h[0], y: h[1], w: h[2], h: h[3] });
    for (const t of this.deco.trees || []) s.push(rectAt(t[0], t[1], 18, 18));
    if (this.deco.barn) s.push(rectAt(this.deco.barn[0], this.deco.barn[1], 76, 56));
    this.solids = s;
    this.nav = {};          // grid pathfinding caches (per body radius), rebuilt lazily
  }

  // ---- grid pathfinding (workers) -------------------------------------------------
  // The old corner-steer only looks at the first obstacle on the straight line, so two
  // fences meeting in an L (a coop's north + west fence) with a barn behind them made it
  // pick the corner it was already standing on, forever (L30's lumberjack). Workers now
  // plan an A* path on a 10-unit grid with obstacles inflated by their body radius, and
  // walk it with line-of-sight shortcuts.
  navGrid(r) {
    const key = Math.round(r);
    if (this.nav[key]) return this.nav[key];
    const S = 10, C = Math.ceil(this.W / S), R = Math.ceil(this.H / S), blk = new Uint8Array(C * R), rr = r + 1;
    for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
      const x = (i + 0.5) * S, y = (j + 0.5) * S;
      let b = x < 18 || y < 18 || x > this.W - 18 || y > this.H - 18;
      if (!b) for (const o of this.solids) if (x > o.x - rr && x < o.x + o.w + rr && y > o.y - rr && y < o.y + o.h + rr) { b = true; break; }
      blk[j * C + i] = b ? 1 : 0;
    }
    return (this.nav[key] = { S, C, R, blk, r });
  }
  // line of sight for a body of radius r (solids the body already touches are ignored, like steer)
  clearLine(ax, ay, bx, by, r) {
    for (const o of this.solids) {
      if (ax > o.x - r && ax < o.x + o.w + r && ay > o.y - r && ay < o.y + o.h + r) continue;
      if (this.segHits(ax, ay, bx, by, o, r) >= 0) return false;
    }
    return true;
  }
  findPath(sx, sy, tx, ty, r) {
    const N = this.navGrid(r), { S, C, R, blk } = N;
    const cell = (x, y) => Math.min(R - 1, Math.max(0, Math.floor(y / S))) * C + Math.min(C - 1, Math.max(0, Math.floor(x / S)));
    const free = (k) => {   // nearest free cell (ring search)
      if (!blk[k]) return k;
      const ci = k % C, cj = (k / C) | 0;
      for (let d = 1; d < 30; d++) for (let dj = -d; dj <= d; dj++) for (let di = -d; di <= d; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== d) continue;
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= C || j >= R) continue;
        if (!blk[j * C + i]) return j * C + i;
      }
      return -1;
    };
    const s = free(cell(sx, sy)), g = free(cell(tx, ty));
    if (s < 0 || g < 0) return null;
    if (s === g) return [{ x: tx, y: ty }];
    const n = C * R;
    if (!N.gs || N.gs.length !== n) { N.gs = new Float32Array(n); N.from = new Int32Array(n); N.seen = new Uint32Array(n); N.closed = new Uint32Array(n); N.stamp = 0; }
    const gs = N.gs, from = N.from, seen = N.seen, closed = N.closed, st = ++N.stamp;
    const gi = g % C, gj = (g / C) | 0, hh = (k) => { const dx = Math.abs(k % C - gi), dy = Math.abs(((k / C) | 0) - gj); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, rr = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    gs[s] = 0; from[s] = -1; seen[s] = st; push(s, hh(s));
    let found = false, it = 0;
    while (heap.length && it++ < n * 2) {
      const [, k] = pop(); if (closed[k] === st) continue; closed[k] = st;
      if (k === g) { found = true; break; }
      const ci = k % C, cj = (k / C) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= C || j >= R) continue;
        const q = j * C + i; if (blk[q] || closed[q] === st) continue;
        if (di && dj && (blk[cj * C + i] || blk[j * C + ci])) continue;   // no corner cutting
        const ng = gs[k] + (di && dj ? Math.SQRT2 : 1);
        if (seen[q] !== st || ng < gs[q]) { seen[q] = st; gs[q] = ng; from[q] = k; push(q, ng + hh(q)); }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let k = g; k !== s && k >= 0; k = from[k]) pts.push({ x: (k % C + 0.5) * S, y: (((k / C) | 0) + 0.5) * S });
    pts.reverse();
    pts.push({ x: tx, y: ty });
    return pts;
  }
  // next point to walk toward for a worker: straight if clear, else along a cached A* path
  navigate(w, tx, ty, r, force) {
    if (!force && this.clearLine(w.x, w.y, tx, ty, r)) { w.path = null; return { x: tx, y: ty }; }
    const goalMoved = !w.path || Math.hypot(w.pathGoal.x - tx, w.pathGoal.y - ty) > 30;
    if (force || goalMoved || this.t - w.pathT > 2) {
      w.path = this.findPath(w.x, w.y, tx, ty, r); w.pathI = 0; w.pathT = this.t; w.pathGoal = { x: tx, y: ty };
      if (!w.path) { w.path = null; return this.steer(w, tx, ty, r); }
    }
    const P = w.path;
    // skip waypoints already reached or visible further on (string pulling)
    while (w.pathI < P.length - 1 && Math.hypot(P[w.pathI].x - w.x, P[w.pathI].y - w.y) < 7) w.pathI++;
    for (let k = Math.min(P.length - 1, w.pathI + 8); k > w.pathI; k--) if (this.clearLine(w.x, w.y, P[k].x, P[k].y, r)) { w.pathI = k; break; }
    return P[w.pathI];
  }

  refreshStats() {
    const p = this.player, u = this.upg;
    if (p.vehicle) {
      const V = CFG.vehicle;
      p.speed = V.speed + u.speed; p.cap = V.cap + u.cap * V.capMul; p.pickR = V.pickR + u.radius;
      p.harvestR = V.harvestR + u.radius * 0.6; p.cutRate = V.cutRate; p.pickRate = V.pickRate; p.dropRate = V.dropRate;
    } else {
      const P = CFG.player;
      p.speed = P.speed + u.speed; p.cap = P.cap + u.cap * P.capUp; p.pickR = P.pickR + u.radius;
      p.harvestR = P.harvestR + u.radius; p.cutRate = P.cutRate + u.radius * 6;
      p.pickRate = P.pickRate + u.radius; p.dropRate = P.dropRate + u.cap * 0.5;
    }
    if (this.feverT > 0) {   // 丰收狂热: faster, wider swath (the stack cap is untouched)
      const F = CFG.fever; p.speed *= F.speedMul; p.harvestR *= F.radiusMul; p.pickR *= 1 + (F.radiusMul - 1) * 0.5; p.pickRate *= 1.4;
    }
    for (const w of this.workers) {
      const Wk = w.loader ? CFG.loader : CFG.worker, Lv = CFG.workerLv, k = (w.lv || 1) - 1;
      w.speed = (Wk.speed + u.wspeed) * (1 + Lv.speed * k); w.cap = Math.round((Wk.cap + u.wcap) * (1 + Lv.cap * k));
      w.pickR = Wk.pickR; w.harvestR = Wk.harvestR;
      w.cutRate = Wk.cutRate || 0; w.pickRate = Wk.pickRate; w.dropRate = Wk.dropRate;
      const cm = w.crewMul;   // 雇工特长 (persistent roster level), at most +30%
      if (cm) { w.speed *= cm.speed; w.cap = Math.round(w.cap * cm.cap); w.pickRate *= cm.rate; w.dropRate *= cm.rate; w.cutRate *= cm.rate; w.pickR *= cm.reach; w.harvestR *= cm.reach; }
    }
  }

  // ---- flying items ------------------------------------------------------
  launch(type, kind, x0, y0, z0, ref, tx, ty, tz, dur, spray) {
    const f = this.flyFree.pop() || {};
    f.type = type; f.kind = kind; f.x0 = x0; f.y0 = y0; f.z0 = z0; f.ref = ref; f.tx = tx; f.ty = ty; f.tz = tz;
    f.t = 0; f.dur = dur * (0.85 + this.rnd() * 0.3); f.active = true;
    // spray: blooms burst up and sideways before arcing onto the stack (render-only shape, deterministic here)
    f.sx = spray ? (this.rnd() - 0.5) * spray : 0; f.sy = spray ? (this.rnd() - 0.5) * spray : 0; f.arc = spray ? 50 + this.rnd() * 60 : 34;
    this.fly.push(f);
    return f;
  }
  landFly(f) {
    const r = f.ref;
    switch (f.kind) {
      case 'stack': r.incoming--; r.stack.push(f.type); break;
      case 'pile': r.pending--; r.add(f.tx, f.ty, this.rnd); break;
      case 'counter': r.incoming--; r.stock.push(f.type); r.bumpT = 1; break;
      case 'cust': r.incoming--; r.bag.push(f.type); break;
      case 'procIn': r.inc--; r.buf++; break;
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
    if (e.show) {
      for (const id of e.show) {
        const o = this.objs[id]; if (!o) continue;
        o.hidden = false; o.appearT = this.t;
        if (o.kind === 'field') { if (silent) { o.g.fill(1); o.ripe = o.n; } else o.sprout(this.rnd, this.t); }
      }
      this.rebuildSolids(); if (!silent) this.emit('ground', {});
    }
    if (e.hens) {
      const c = this.objs[e.hens.coop];
      const before = c.n; c.n = Math.min(c.max, c.n + e.hens.n);
      for (let i = before; i < c.n; i++) c.hens[i].appearT = this.t + (i - before) * 0.12;
    }
    if (e.up) { this.upg[e.up.key] += e.up.v; this.refreshStats(); }
    if (e.worker) {
      const w = makeCollector('worker', t.x, t.y);
      w.from = e.worker.from; w.to = e.worker.to; w.state = 'collect'; w.wait = 0; w.tgt = null; w.retarget = 0;
      w.stuck = 0; w.lastX = t.x; w.lastY = t.y; w.appearT = this.t; w.seed = this.workers.length; w.cart = t.icon === 'cart' || t.icon === 'milker';
      w.lumber = w.from.some((id) => this.objs[id] && this.objs[id].item === 'log');
      w.fisher = w.from.some((id) => this.objs[id] && this.objs[id].item === 'fish');   // v3.7 渔夫 (render: net + rain hat)
      w.lv = 1; w.trips = 0; w.lvT = -9; w.loader = this.loaders && !w.cart;
      w.done = 0; const cm = this.crew && this.crew[this.workers.length];
      if (cm) { w.crewId = cm.id; w.crewName = cm.name; w.crewMul = cm.mul; }
      this.workers.push(w); this.refreshStats();
    }
    if (e.upgradeWorkers === 'loader') {
      this.loaders = true;
      for (const w of this.workers) if (!w.cart && !w.loader) { w.loader = true; w.appearT = this.t; if (!silent) this.emit('loaderUp', { x: w.x, y: w.y }); }
      this.refreshStats();
    }
    if (e.sprinkler) for (const id of e.sprinkler) { const f = this.objs[id]; if (f && f.kind === 'field') { f.growMul = CFG.sprinkler.growMul; f.sprinkler = true; f.sprinklerT = this.t; } }
    if (e.vehicle) { this.player.vehicle = true; this.player.appearT = this.t; this.refreshStats(); }
    if (e.cashier) for (const id of e.cashier) { const c = this.objs[id]; c.cashier = true; if (c.cash > 0) { this.money += c.cash; c.cash = 0; } }
    if (e.proc) for (const pe of e.proc) { const p = this.objs[pe.id]; p.time *= pe.mul; }
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
      if (f.hidden || f.ripe >= f.n) continue;
      const g = f.g, pop = f.pop, k = dt * f.growMul * f.envMul / f.grow;
      for (let i = 0, n = f.n; i < n; i++) {
        const v = g[i];
        if (v < 1) { const nv = v + k; if (nv >= 1) { g[i] = 1; f.ripe++; pop[i] = 1; } else g[i] = nv; }
      }
    }
    if (!this.quiet) for (const f of this.fields) { const pop = f.pop; for (let i = 0, n = f.n; i < n; i++) if (pop[i] > 0) pop[i] = Math.max(0, pop[i] - dt * 3); }
    // hens lay
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
            else { tx = c.x + Math.pow(this.rnd(), 1.5) * c.w; ty = h.y + (this.rnd() - 0.5) * 120; }
            tx = Math.min(c.x + c.w - 2, Math.max(c.x + 2, tx)); ty = Math.min(c.y + c.h - 2, Math.max(c.y + 2, ty));
            c.pile.pending++;
            this.launch(c.item, 'pile', h.x, h.y, 18, c.pile, tx, ty, 0, CFG.fly.lay);
          }
          this.emit('lay', { x: h.x, y: h.y, item: c.item });
        }
      }
    }
    // collectors interact
    this.comboGain = 0;
    this.interact(this.player, dt, true);
    for (const w of this.workers) this.interact(w, dt, false);
    this.updateFever(dt);
    this.playerExtras(dt);
    // counters & customers
    for (const c of this.counters) if (!c.hidden) this.updateCounter(c, dt);
    this.updateCustomers(dt);
    // machines: output goes straight onto their counter
    for (const p of this.procs) {
      if (p.hidden) continue;
      p.work = Math.max(0, p.work - dt * 2);
      // room on the counter: raw produce dumped there never blocks the machine's own goods
      const out = p.outObj, chain = out && out.kind === 'proc';
      // a machine can feed another machine (logs → planks → chairs)
      let room = !out || (chain ? out.buf + out.inc < CFG.proc.chainMax : out.stock.length + out.incoming < CFG.counter.stockMax);
      if (!room && !chain) { let k = 0; for (const it of out.stock) if (it === p.outItem) k++; room = k + out.incoming < CFG.counter.stockMax * 0.5; }
      if (p.buf >= p.ratio && room) {
        p.timer += dt; p.work = 1;
        if (p.timer >= p.time) {
          p.timer = 0; p.buf -= p.ratio;
          this.stats.produced[p.outItem] = (this.stats.produced[p.outItem] || 0) + 1;
          if (chain) { out.inc++; this.launch(p.outItem, 'procIn', p.x, p.y, 36, out, out.x - 14, out.y, CFG.proc.bodyH + 10, CFG.fly.produce * 1.6, 40); }
          else if (out) { out.incoming++; this.launch(p.outItem, 'counter', p.x, p.y, 36, out, out.x, out.y, CFG.counter.deskH + 4, CFG.fly.produce); }
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
    if (this.timeLimit) { if (!this.won && this.t >= this.timeLimit) { this.won = true; this.winT = this.timeLimit; this.score = Math.floor(this.stats.earned); this.emit('win', {}); } }
    else if (!this.won && this.progress().f >= 1) { this.won = true; this.winT = this.t; this.emit('win', {}); }
  }

  collide(c, nx, ny, r) {
    const W = this.W, H = this.H;
    nx = Math.min(W - 18, Math.max(18, nx)); ny = Math.min(H - 18, Math.max(18, ny));
    for (const s of this.solids) {
      if (nx > s.x - r && nx < s.x + s.w + r && ny > s.y - r && ny < s.y + s.h + r) {
        const pl = nx - (s.x - r), pr = s.x + s.w + r - nx, pt = ny - (s.y - r), pb = s.y + s.h + r - ny;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = s.x - r; else if (m === pr) nx = s.x + s.w + r; else if (m === pt) ny = s.y - r; else ny = s.y + s.h + r;
      }
    }
    c.x = nx; c.y = ny;
  }

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
      const inside = c.x > s.x - r && c.x < s.x + s.w + r && c.y > s.y - r && c.y < s.y + s.h + r;
      const t = this.segHits(c.x, c.y, tx, ty, s, inside ? 2 : r);   // already touching: only care if we walk into it
      if (t >= 0 && t < bt) { bt = t; best = s; }
    }
    if (!best) return { x: tx, y: ty };
    const m = r + 6, s = best;
    const cs = [[s.x - m, s.y - m], [s.x + s.w + m, s.y - m], [s.x - m, s.y + s.h + m], [s.x + s.w + m, s.y + s.h + m]];
    let bc = null, bd = 1e18;
    const blocked = (ax, ay, bx, by, rr) => {
      for (const o of this.solids) {
        if (ax > o.x - rr && ax < o.x + o.w + rr && ay > o.y - rr && ay < o.y + o.h + rr) continue;   // touching: ignore
        if (this.segHits(ax, ay, bx, by, o, rr) >= 0) return true;
      }
      return false;
    };
    const insideAny = (x, y, rr) => this.solids.some((o) => x > o.x - rr && x < o.x + o.w + rr && y > o.y - rr && y < o.y + o.h + rr);
    for (const [x, y] of cs) {
      if (x < 18 || y < 18 || x > this.W - 18 || y > this.H - 18) continue;
      if (insideAny(x, y, r - 4) || blocked(c.x, c.y, x, y, r - 4)) continue;
      const dd = Math.hypot(x - c.x, y - c.y) + Math.hypot(tx - x, ty - y) + (blocked(x, y, tx, ty, r - 4) ? 400 : 0);
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
    // facing is in screen terms: screen-x velocity ∝ (vx - vy), screen-y ∝ (vx + vy)
    const sx = c.vx - c.vy, sy = c.vx + c.vy;
    if (c.moving) { c.walk += dt * (6 + sp * 0.04); if (Math.abs(sx) > 5) c.face = sx > 0 ? 1 : -1; c.dirY = sy; }
    this.collide(c, c.x + c.vx * dt, c.y + c.vy * dt, r);
    c.sway += ((-sx * 0.0035) - c.sway) * Math.min(1, dt * 5);
  }

  // ---- harvesting / picking / dropping (player, mower, gardeners share this) ----
  interact(c, dt, isPlayer) {
    const space = () => c.cap - c.stack.length - c.incoming;
    const srcs = c.sources;
    if (c.canPick) {
      // Clean, deterministic cut: every ripe plant whose (visual) position lies inside the
      // harvest radius is cut this frame. Only a full stack / full pile limits it, and then the
      // nearest plants go first so the swath edge stays round instead of patchy.
      const cand = this._cand || (this._cand = []), cd = this._cd || (this._cd = []);
      for (const f of this.fields) {
        if (f.hidden || f.ripe <= 0 || (srcs && !srcs.includes(f)) || !this.hasSink(f.item)) continue;
        const hr = c.harvestR;
        if (c.x < f.x - hr || c.x > f.x + f.w + hr || c.y < f.y - hr || c.y > f.y + f.h + hr) continue;
        const gp = f.gap, gy = f.gy, C = f.cols;
        const c0 = Math.max(0, Math.floor((c.x - hr - f.x) / gp) - 1), c1 = Math.min(C - 1, Math.floor((c.x + hr - f.x) / gp) + 1);
        const r0 = Math.max(0, Math.floor((c.y - hr - f.y) / gy) - 1), r1 = Math.min(f.rows - 1, Math.floor((c.y + hr - f.y) / gy) + 1);
        const hr2 = hr * hr;
        cand.length = 0; cd.length = 0;
        for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) {
          const i = r * C + col;
          if (f.g[i] < 1) continue;
          const dx = f.px(i) - c.x, dy = f.py(i) - c.y, dd = dx * dx + dy * dy;
          if (dd <= hr2) { cand.push(i); cd.push(dd); }
        }
        if (!cand.length) continue;
        // Everything inside the radius is cut while there is room. At max capacity cutting STOPS
        // (plants stay standing); with only a little room left, the nearest plants go first so the
        // swath edge stays round.
        const allow = f.spill ? Math.floor((f.pile.cap - f.pile.total - f.pile.pending) / f.spill) : Math.ceil(space() / f.yield);
        if (allow <= 0) continue;
        let list = cand;
        if (allow < cand.length) {
          const ord = cand.map((i, k) => k).sort((a, b) => cd[a] - cd[b] || cand[a] - cand[b]);
          list = ord.slice(0, allow).map((k) => cand[k]);
        }
        let cut = 0, cx = 0, cy = 0;
        for (const i of list) {
          const px = f.px(i), py = f.py(i);
          if (f.gold[i]) {   // 金色作物: pays straight into the wallet
            const amount = itemPrice(f.item) * CFG.golden.mul;
            this.money += amount; this.stats.earned += amount;
            this.emit('golden', { x: px, y: py, amount, who: c.kind });
          }
          f.gold[i] = this.rnd() < f.goldChance ? 1 : 0;
          if (f.spill) {
            for (let k = 0; k < f.spill; k++) {
              const tx = px + (this.rnd() - 0.5) * 34, ty = py + (this.rnd() - 0.5) * 34;
              f.pile.pending++;
              this.launch(f.item, 'pile', px, py, 4, f.pile, Math.min(f.x + f.w - 2, Math.max(f.x + 2, tx)), Math.min(f.y + f.h - 2, Math.max(f.y + 2, ty)), 0, CFG.fly.harvest);
            }
          } else {
            // a chopped tree drops several logs (yield), every other plant one item
            // (the last tree that tops the stack off only drops what still fits)
            const n = Math.max(1, Math.min(f.yield, space()));
            for (let k = 0; k < n; k++) {
              c.incoming++;
              this.launch(f.item, 'stack', px, py, 8 + k * 10, c, 0, 0, 0, CFG.fly.harvest + k * 0.06, 70);
            }
            this.stats.collected[f.item] = (this.stats.collected[f.item] || 0) + n;
          }
          f.g[i] = 0; f.ripe--; f.cutAt[i] = this.t; cut++; cx += px; cy += py;
        }
        if (isPlayer) this.comboGain += cut;
        if (cut) { c.cutT = this.t; c.cutItem = f.item; this.emit('harvest', { x: cx / cut, y: cy / cut, n: cut, item: f.item, who: c.kind }); }
      }
      // piles
      if (space() > 0) {
        c.pickAcc = Math.min(c.pickAcc + c.pickRate * dt, Math.max(1, c.pickRate * 0.1));
        let took = false;
        for (const pl of this.piles) {
          if (pl.owner.hidden || (srcs && !srcs.includes(pl.owner)) || !this.hasSink(pl.type)) continue;
          while (c.pickAcc >= 1 && space() > 0) {
            const i = pl.take(c.x, c.y, c.pickR);
            if (i < 0) break;
            c.pickAcc--; took = true; c.incoming++;
            this.launch(pl.type, 'stack', pl.cx(i), pl.cy(i), pl.hs[i] * CFG.pile.layer, c, 0, 0, 0, CFG.fly.pick);
            this.stats.collected[pl.type] = (this.stats.collected[pl.type] || 0) + 1;
            if (isPlayer) { this.emit('pick', { item: pl.type }); this.comboGain++; }
          }
        }
        if (!took) c.pickAcc = Math.min(c.pickAcc, 1);
      }
      const full = space() <= 0 && c.stack.length > 0;
      if (full && !c.fullFlag && isPlayer) this.emit('full', {});
      c.fullFlag = full;
    } else c.fullFlag = space() <= 0 && c.stack.length > 0;
    // drop into sinks
    if (c.canDrop && c.stack.length > 0) {
      let sink = null, accepts = null;
      for (const k of this.counters) if (!k.hidden && inRect(c.x, c.y, k.zone) && (!c.toObjs || c.toObjs.includes(k)) && c.stack.some((t) => k.items.includes(t))) { sink = k; accepts = (t) => k.items.includes(t); break; }
      if (!sink) for (const p of this.procs) if (!p.hidden && inRect(c.x, c.y, p.inZone) && (!c.toObjs || c.toObjs.includes(p)) && c.stack.includes(p.inItem)) { sink = p; accepts = (t) => t === p.inItem; break; }
      c.dropping = !!sink;
      if (sink) {
        c.dropAcc = Math.min(c.dropAcc + c.dropRate * dt, Math.max(1, c.dropRate * 0.1));
        while (c.dropAcc >= 1) {
          let idx = -1; for (let j = c.stack.length - 1; j >= 0; j--) if (accepts(c.stack[j])) { idx = j; break; }
          if (idx < 0) break;
          const item = c.stack[idx];
          c.stack.splice(idx, 1); c.dropAcc--;
          if (!isPlayer) c.done = (c.done || 0) + 1;   // 雇工 XP
          const z = 44 + idx * CFG.items[item].step;
          if (sink.kind === 'counter') { sink.incoming++; this.launch(item, 'counter', c.x, c.y, z, sink, sink.x, sink.y, CFG.counter.deskH + 4, CFG.fly.drop); }
          else { sink.inc++; this.launch(item, 'procIn', c.x, c.y, z, sink, sink.x - 14, sink.y, CFG.proc.bodyH + 10, CFG.fly.drop); }
          if (isPlayer) this.emit('drop', { item });
        }
      } else c.dropAcc = 0;
    } else c.dropping = false;
  }

  // 丰收狂热 meter (player only)
  updateFever(dt) {
    const F = CFG.fever, p = this.player;
    if (this.feverT > 0) {
      this.feverT -= dt;
      if (this.feverT <= 0) { this.feverT = 0; this.combo = 0; this.refreshStats(); this.emit('feverEnd', {}); }
      return;
    }
    if (this.comboGain > 0) { this.combo = Math.min(1, this.combo + this.comboGain * F.perItem); this.comboIdle = 0; }
    else if (p.stack.length + p.incoming > 0 || p.dropping) this.comboIdle = 0;          // carrying a load: frozen
    else if ((this.comboIdle += dt) > F.grace) this.combo = Math.max(0, this.combo - F.drain * dt);
    if (this.combo >= 1) { this.feverT = F.dur; this.combo = 1; this.refreshStats(); this.emit('fever', { x: p.x, y: p.y }); }
  }

  playerExtras(dt) {
    const p = this.player, R = CFG.player.cashR;
    for (const c of this.counters) {
      if (c.hidden || c.cash <= 0.01) continue;
      if (d2(p.x, p.y, c.cashPos.x, c.cashPos.y) > R * R) continue;
      const take = Math.min(c.cash, Math.max(c.cash * dt * 5, 80 * dt));
      c.cash -= take; this.money += take;
      if (c.cash < 0.01) { this.money += c.cash; c.cash = 0; }
      this.emit('cash', { x: c.cashPos.x, y: c.cashPos.y, amount: take });
    }
    const half = CFG.tile.size / 2;
    for (const t of this.tiles) if (t.cool > 0) t.cool -= dt;
    for (const t of this.tiles) {
      if (!t.visible) continue;
      if (Math.abs(p.x - t.x) > half || Math.abs(p.y - t.y) > half) continue;
      if (t.cool > 0) break;
      // (v4.0 fix: a last fraction of a coin still pays when the wallet covers it — it used to stall the tile forever)
      if (this.money < 0.5 && this.money + 1e-6 < t.price - t.paid) continue;
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
      const cu = { x: c.spawn.x + this.rnd() * 30, y: c.spawn.y + (this.rnd() - 0.5) * 20, counter: c, state: 'in',
                   want: C.buyMin + Math.floor(this.rnd() * (C.buyMax - C.buyMin + 1)),
                   bag: [], incoming: 0, wait: 0, hue: Math.floor(this.rnd() * 8), walk: this.rnd() * 6, face: -1, vx: 0, vy: 0, leg: 0 };
      if (this.rnd() < CFG.vip.chance * this.vipMul) { cu.vip = true; cu.wish = c.items.reduce((a, b) => (itemPrice(b) > itemPrice(a) ? b : a), c.items[0]); }
      c.queue.push(cu); this.customers.push(cu);
    }
    const front = c.queue[0];
    if (front && front.state === 'wait') {
      c.buyAcc = Math.min(c.buyAcc + c.serveRate * dt, 2);
      while (c.buyAcc >= 1 && c.stock.length > 0 && front.bag.length + front.incoming < front.want) {
        c.buyAcc--; const it = c.stock.pop(); front.incoming++;
        this.launch(it, 'cust', c.x, c.y, CFG.counter.deskH + 4, front, 0, 0, 0, CFG.fly.serve);
      }
      if (c.stock.length <= 0) c.buyAcc = 0;
      const got = front.bag.length;
      const done = got >= front.want || (front.incoming === 0 && got > 0 && c.stock.length <= 0 && (front.wait += dt) > C.patience);
      if (done && front.incoming === 0) {
        let amount = 0;
        for (const it of front.bag) { amount += itemPrice(it); this.stats.sold[it] = (this.stats.sold[it] || 0) + 1; }
        if (front.vip) { amount *= CFG.vip.mul; this.emit('vipPay', { x: c.x, y: c.y, tx: c.cashPos.x, ty: c.cashPos.y, amount, cashier: c.cashier }); }
        this.stats.earned += amount;
        if (c.cashier) { this.money += amount; this.emit('cashierPay', { x: c.x, y: c.y, amount }); }
        else { c.cash += amount; this.emit('pay', { x: front.x, y: front.y, tx: c.cashPos.x, ty: c.cashPos.y, amount }); }
        this.emit('sale', { x: c.x, y: c.y, amount });
        front.state = 'out'; front.leg = 0; c.queue.shift();
      }
    }
  }

  updateCustomers(dt) {
    const C = CFG.customer;
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const cu = this.customers[i], c = cu.counter;
      let tx, ty;
      if (cu.state === 'out') { const wp = cu.leg === 0 ? c.exitA : c.exit; tx = wp.x; ty = wp.y; }
      else { const qi = c.queue.indexOf(cu); tx = c.serve.x + qi * CFG.counter.queueGap; ty = c.serve.y; }
      const dx = tx - cu.x, dy = ty - cu.y, dd = Math.hypot(dx, dy);
      if (dd > 2) {
        const s = Math.min(dd, C.speed * dt);
        cu.vx = dx / dd * C.speed; cu.vy = dy / dd * C.speed;
        cu.x += dx / dd * s; cu.y += dy / dd * s; cu.walk += dt * 10; cu.moving = true;
        const sx = dx - dy; if (Math.abs(sx) > 1) cu.face = sx > 0 ? 1 : -1;
      } else {
        cu.moving = false; cu.vx = cu.vy = 0;
        if (cu.state === 'in' && c.queue[0] === cu) { cu.state = 'wait'; cu.face = -1; }
        if (cu.state === 'out') { if (cu.leg === 0) cu.leg = 1; else this.customers.splice(i, 1); }
      }
    }
  }

  // ---- gardeners ---------------------------------------------------------------------
  workerAI(w, dt) {
    const T = this.t;
    const srcs = w.from.map((id) => this.objs[id]).filter((o) => o && !o.hidden);
    const sinks = w.to.map((id) => this.objs[id]).filter((o) => o && !o.hidden);
    w.sources = srcs; w.toObjs = sinks;
    const space = w.cap - w.stack.length - w.incoming;
    if (w.state === 'collect' && space <= 0) w.state = 'deliver';
    if (w.state === 'deliver' && w.stack.length === 0 && w.incoming === 0) {
      w.state = 'collect'; w.wait = 0;
      // 园丁成长: level up every few delivery trips
      w.trips++;
      const Lv = CFG.workerLv, nl = Math.min(Lv.max, 1 + Math.floor(w.trips / Lv.per));
      if (nl > w.lv) { w.lv = nl; w.lvT = T; this.refreshStats(); this.emit('workerLevel', { x: w.x, y: w.y, lv: nl }); }
    }
    w.canPick = w.state === 'collect';
    let tx = w.x, ty = w.y;
    if (w.state === 'collect') {
      let best = null, bv = 0;
      for (const s of srcs) {
        const v = s.kind === 'coop' ? s.pile.total : (s.pile ? s.pile.total : 0) + s.ripe;
        if (v > bv) { bv = v; best = s; }
      }
      if (!best) {
        w.wait += dt;
        if (w.stack.length > 0 && w.wait > 1.5) w.state = 'deliver';
      } else {
        w.retarget -= dt;
        if (w.retarget <= 0 || !w.tgt) {
          w.retarget = 0.4;
          const pl = best.pile;
          const i = pl && pl.total > 0 ? pl.hottest(w.x, w.y, T) : -1;
          if (i >= 0) w.tgt = pl.safe(i);
          else if (best.kind === 'field') { const j = best.nearestRipe(w.x, w.y); if (j >= 0) w.tgt = { x: best.px(j), y: best.py(j) }; }
        }
        if (w.tgt) { tx = w.tgt.x; ty = w.tgt.y; }
        if (bv === 0 && w.stack.length > 0) w.state = 'deliver';
      }
    }
    if (w.state === 'deliver') {
      let bs = null, bd = 1e18;
      for (const s of sinks) {
        const ok = s.kind === 'counter' ? w.stack.some((t) => s.items.includes(t)) : w.stack.includes(s.inItem);
        if (!ok) continue;
        const z = s.kind === 'counter' ? s.zone : s.inZone; const dd = d2(z.cx, z.cy, w.x, w.y); if (dd < bd) { bd = dd; bs = z; }
      }
      if (bs) { const k = (w.seed + (w.sinkRot || 0)) | 0; tx = bs.cx + ((k % 3) - 1) * 8; ty = bs.cy + ((k % 2) ? 6 : -6); }
      else if (w.stack.length) w.stack.length = 0;   // nothing takes these any more
    }
    const goal = Math.hypot(tx - w.x, ty - w.y), body = w.loader ? CFG.loader.body : 9;
    // stuck detection: no real progress for a while while trying to move → force a fresh
    // path; still nothing → give up on this target (pick another plant/pile cell / sink spot)
    const wantMove = goal > 3;
    if (!w.prog) w.prog = { x: w.x, y: w.y, n: w.stack.length + w.incoming, t: T };
    const pg = w.prog, load = w.stack.length + w.incoming;
    if (!wantMove || Math.hypot(w.x - pg.x, w.y - pg.y) > 16 || load !== pg.n) { pg.x = w.x; pg.y = w.y; pg.n = load; pg.t = T; w.unstick = 0; }
    let force = false;
    if (wantMove && T - pg.t > 1.2 && w.unstick === 0) { w.unstick = 1; force = true; }
    else if (wantMove && T - pg.t > 2.5 && w.unstick === 1) {
      w.unstick = 2; w.tgt = null; w.retarget = 0; w.path = null;
      w.dodge = { x: w.x + (this.rnd() - 0.5) * 80, y: w.y + (this.rnd() - 0.5) * 80, t: T + 0.8 };
      if (w.state === 'deliver' && w.stack.length) w.sinkRot = (w.sinkRot || 0) + 1;
    } else if (wantMove && T - pg.t > 5) { pg.t = T; w.unstick = 0; }
    if (w.dodge && T < w.dodge.t) { tx = w.dodge.x; ty = w.dodge.y; } else w.dodge = null;
    const wp = this.navigate(w, tx, ty, body, force);
    const dx = wp.x - w.x, dy = wp.y - w.y, dd = Math.hypot(dx, dy);
    const sp = wantMove || w.dodge ? w.speed : 0;
    const vx = dd > 0 ? dx / dd * sp : 0, vy = dd > 0 ? dy / dd * sp : 0;
    w.lastX = w.x; w.lastY = w.y;
    const k = Math.min(1, dt * 10);
    w.vx += (vx - w.vx) * k; w.vy += (vy - w.vy) * k;
    this.stepMove(w, dt, w.loader ? CFG.loader.body : 9);
  }

  // ---- guide: what should the player do next (arrow + sim bot) -----------------------
  // machines first (they turn raw flowers into pricier goods), then counters
  // produce nobody buys yet (no counter or machine takes it) is left in the field
  hasSink(item) {
    for (const p of this.procs) if (!p.hidden && p.inItem === item) return true;
    for (const k of this.counters) if (!k.hidden && k.items.includes(item)) return true;
    return false;
  }
  sinksFor(item) {
    const out = [];
    for (const p of this.procs) if (!p.hidden && p.inItem === item) out.push({ z: p.inZone, w: 0.5 });
    for (const k of this.counters) if (!k.hidden && k.items.includes(item)) out.push({ z: k.zone, w: 1 });
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
    // at max capacity the arrow always points at the counter / machine that takes the load
    if (free <= 0 && p.stack.length > 0) { this.gmode = 'deliver'; const s = this.sinkTarget(p); if (s) return { ...s, full: true }; }
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
    for (const item of seen) for (const s of this.sinksFor(item)) { const dd = Math.sqrt(d2(s.z.cx, s.z.cy, p.x, p.y)) * s.w; if (dd < bd) { bd = dd; best = s.z; } }
    return best ? { x: best.cx, y: best.cy, kind: 'sink' } : null;
  }
  sourceTarget(p, free) {
    let best = null, bs = -1;
    const value = (item) => { let v = 0; for (const pr of this.procs) if (!pr.hidden && pr.inItem === item) v = Math.max(v, itemPrice(pr.outItem) / pr.ratio); for (const k of this.counters) if (!k.hidden && k.items.includes(item)) v = Math.max(v, itemPrice(item)); return v; };
    for (const pl of this.piles) if (!pl.owner.hidden && pl.total > 0) {
      const val = value(pl.type); if (!val) continue;
      const i = pl.hottest(p.x, p.y, this.t); if (i < 0) continue;
      const { x, y } = pl.safe(i);
      const s = Math.min(free, pl.total) * val / (Math.sqrt(d2(x, y, p.x, p.y)) + 80);
      if (s > bs) { bs = s; best = { x, y, kind: 'pile' }; }
    }
    for (const f of this.fields) if (!f.hidden && f.ripe > 0 && (!f.spill || f.pile.total < 20)) {
      const val = value(f.item); if (!val) continue;
      const i = f.nearestRipe(p.x, p.y); if (i < 0) continue;
      const x = f.px(i), y = f.py(i);
      const s = Math.min(free, f.ripe * (f.spill || f.yield)) * val / (Math.sqrt(d2(x, y, p.x, p.y)) + 80);
      if (s > bs) { bs = s; best = { x, y, kind: 'field' }; }
    }
    return best;
  }

  // ---- save/restore of a level in progress ---------
  snapshot() {
    return { li: this.li, t: this.t, money: this.money, stats: this.stats, env: { season: this.season, rain: this.rain },
             tiles: this.tiles.map((t) => ({ id: t.id, paid: t.paid, bought: t.bought })),
             stack: this.player.stack.slice(0, 600),
             cash: this.counters.map((c) => c.cash), stock: this.counters.map((c) => c.stock.slice(0, 300)),
             buf: this.procs.map((p) => p.buf) };
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
    (s.stock || []).forEach((v, i) => { if (this.counters[i] && Array.isArray(v)) this.counters[i].stock = v.filter((x) => CFG.items[x]); });
    (s.buf || []).forEach((v, i) => { if (this.procs[i]) this.procs[i].buf = v || 0; });
    this.updateTileVis(true);
  }
}
