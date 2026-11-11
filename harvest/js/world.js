// 半亩·丰收 — game logic for one level. Pure JS, no DOM: the browser game and the
// headless balance sim (sim/balance.mjs) both run exactly this code.
import { CFG, valleyLevel } from './config.js';
import { splitSales } from './sales.js';
import { collectWaitLimit } from './worker-policy.js';
import { isPackableCargo } from './cargo-crate.js';

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
  hottest(px, py, t, lane = null) {
    if (this.total <= 0) return -1;
    // Shared-source workers use separate pile lanes, avoiding a crowd at the same hottest cell.
    if (!lane && t - this._hotT < 0.35 && this._hot >= 0 && this.hs[this._hot] > 0) return this._hot;
    const hs = this.hs, n = hs.length;
    const find = (separated) => {
      let best = -1, bs = -1e9;
      for (let i = 0; i < n; i += 1) {
        if (separated && i % lane.count !== lane.index) continue;
        const h = hs[i]; if (!h) continue;
        const score = Math.min(h, 8) * 30 - Math.sqrt(d2(this.cx(i), this.cy(i), px, py));
        if (score > bs) { bs = score; best = i; }
      }
      return best;
    };
    let best = lane ? find(true) : -1;
    if (best < 0) best = find(false);
    if (!lane) { this._hot = best; this._hotT = t; }
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
// v4.2 Pond: fish swim freely as small schools (boids: cohesion, alignment, separation, a wandering school
// goal, bank avoidance). A farmer moving fast close by startles them: they dart away and regroup a moment
// later. Anything with a net (player, 渔夫) catches every fish inside its harvest radius while it has room.
// Level object stays { type: 'field', crop: 'fish', x, y, w, h } (= the full basin); the water grows with the
// pond level. `ripe` = fish in the water (so worker / guide code can treat it like a field's stock).
export class Pond {
  constructor(o, rnd) {
    Object.assign(this, o);
    this.kind = 'pond'; this.item = 'fish'; this.hidden = !!o.hidden; this.appearT = -9; this.rnd = rnd;
    this.X = o.x; this.Y = o.y; this.MW = o.w; this.MH = o.h;
    this.lv = 0; this.caught = 0; this.lvT = -9;
    this.growMul = 1; this.envMul = 1; this.sprinkler = false; this.goldMul = o.goldMul || 1;
    this.fish = []; this.schools = []; this.spawnAcc = 0; this.feeder = null; this.feedT = 0; this.feeding = 0; this.seq = 0;
    this.setLevel(1);
    if (!this.hidden) this.fill(1);
  }
  get ripe() { return this.fish.length; }
  get N() { const s = CFG.pond.levels[this.lv - 1]; return s.schools * s.size; }
  setLevel(lv) {
    const S = CFG.pond.levels[lv - 1]; this.lv = lv;
    this.w = this.MW * S.scale; this.h = this.MH * S.scale; this.x = this.X + (this.MW - this.w) / 2; this.y = this.Y + (this.MH - this.h) / 2;
    while (this.schools.length < S.schools) { const g = this.randPt(30); this.schools.push({ gx: g.x, gy: g.y, wt: 2 + this.rnd() * 3, cx: g.x, cy: g.y, vx: 0, vy: 0, n: 0 }); }
  }
  next() { const L = CFG.pond.levels; return this.lv < L.length ? L[this.lv].at : 0; }
  randPt(m) { return { x: this.x + m + this.rnd() * Math.max(1, this.w - 2 * m), y: this.y + m + this.rnd() * Math.max(1, this.h - 2 * m) }; }
  pickSpecies() {
    const mix = CFG.pond.levels[this.lv - 1].mix; let u = this.rnd(), k = 0;
    for (; k < mix.length - 1; k++) { if (u < mix[k]) break; u -= mix[k]; }
    return k;
  }
  spawn(atBank) {
    const P = CFG.pond; let sc = 0;
    for (let i = 1; i < this.schools.length; i++) if (this.schools[i].n < this.schools[sc].n) sc = i;
    const s = this.schools[sc]; let x, y;
    if (atBank) {   // a fish slips in from the bank and swims to its school
      const e = (this.rnd() * 4) | 0, u = this.rnd();
      x = e === 0 ? this.x + u * this.w : e === 1 ? this.x + this.w - 6 : e === 2 ? this.x + u * this.w : this.x + 6;
      y = e === 0 ? this.y + 6 : e === 1 ? this.y + u * this.h : e === 2 ? this.y + this.h - 6 : this.y + u * this.h;
    } else { x = s.cx + (this.rnd() - 0.5) * 30; y = s.cy + (this.rnd() - 0.5) * 30; }
    const sp = this.pickSpecies(), a = this.rnd() * Math.PI * 2;
    const f = { x, y, vx: Math.cos(a) * P.cruise, vy: Math.sin(a) * P.cruise, s: sc, sp, gold: sp === 2 && this.rnd() < P.goldChance * this.goldMul ? 1 : 0, sc: 0, al: 0, react: P.react[0] + this.rnd() * (P.react[1] - P.react[0]), ph: this.rnd() * 6.28, id: this.seq++ };
    s.n++; this.fish.push(f);
    return f;
  }
  fill(frac) { const n = Math.round(this.N * frac); while (this.fish.length < n) this.spawn(false); }
  remove(i) { const f = this.fish[i]; this.schools[f.s].n--; this.fish[i] = this.fish[this.fish.length - 1]; this.fish.pop(); return f; }
  update(dt, w) {
    if (this.hidden) return;
    const P = CFG.pond, S = CFG.pond.levels[this.lv - 1], fish = this.fish, sch = this.schools;
    // respawn
    if (fish.length < this.N) {
      this.spawnAcc += dt * S.rate * this.growMul * this.envMul;
      while (this.spawnAcc >= 1 && fish.length < this.N) { this.spawnAcc -= 1; const f = this.spawn(true); if (!w.quiet && this.rnd() < 0.35) w.emit('fishIn', { x: f.x, y: f.y }); }
    } else this.spawnAcc = 0;
    // 投喂器: every school swims to the feeder for a few seconds
    let fx = 0, fy = 0;
    if (this.feeder) {
      this.feedT += dt;
      if (this.feeding > 0) { this.feeding -= dt; }
      else if (this.feedT >= P.feeder.every) { this.feedT = 0; this.feeding = P.feeder.dur; const fp = this.feedPt(); w.emit('feed', { x: fp.x, y: fp.y }); }
      const fp = this.feedPt(); fx = fp.x; fy = fp.y;
    }
    // school centroids / headings
    for (const s of sch) { s.cx = 0; s.cy = 0; s.vx = 0; s.vy = 0; s.k = 0; }
    for (const f of fish) { const s = sch[f.s]; s.cx += f.x; s.cy += f.y; s.vx += f.vx; s.vy += f.vy; s.k++; }
    for (const s of sch) {
      if (s.k) { s.cx /= s.k; s.cy /= s.k; s.vx /= s.k; s.vy /= s.k; }
      s.wt -= dt;
      if (!s.k) { s.cx = s.gx; s.cy = s.gy; }
      if (s.wt <= 0 || (s.k && Math.hypot(s.gx - s.cx, s.gy - s.cy) < 20)) { const g = this.randPt(28); s.gx = g.x; s.gy = g.y; s.wt = 3 + this.rnd() * 4; }
    }
    // the farmer startles fish when moving fast close by
    const p = w.player, psp = Math.hypot(p.vx, p.vy), fast = psp > P.fastFrac * p.speed, fr = P.fleeR + p.harvestR * 0.5, fr2 = fr * fr;
    const near = fast && p.x > this.x - fr && p.x < this.x + this.w + fr && p.y > this.y - fr && p.y < this.y + this.h + fr;
    const x0 = this.x + P.edge, x1 = this.x + this.w - P.edge, y0 = this.y + P.edge, y1 = this.y + this.h - P.edge, sep2 = P.sep * P.sep;
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i], s = sch[f.s];
      let ax = 0, ay = 0;
      if (f.sc > 0) f.sc -= dt;
      const calm = f.sc <= 0;
      // cohesion + alignment (weak while darting) + school goal (or the feeder)
      const gx = this.feeding > 0 ? fx : s.gx, gy = this.feeding > 0 ? fy : s.gy;
      ax += (s.cx - f.x) * (calm ? 1.6 : 0.3); ay += (s.cy - f.y) * (calm ? 1.6 : 0.3);
      ax += (s.vx - f.vx) * (calm ? 1.2 : 0.2); ay += (s.vy - f.vy) * (calm ? 1.2 : 0.2);
      const gd = Math.hypot(gx - f.x, gy - f.y) || 1, gk = this.feeding > 0 ? 70 : 34;
      ax += (gx - f.x) / gd * gk; ay += (gy - f.y) / gd * gk;
      // separation inside the school
      for (let j = 0; j < fish.length; j++) {
        if (j === i) continue; const o = fish[j]; if (o.s !== f.s) continue;
        const dx = f.x - o.x, dy = f.y - o.y, dd = dx * dx + dy * dy;
        if (dd < sep2 && dd > 1e-4) { const d = Math.sqrt(dd), k = (P.sep - d) / P.sep * 260; ax += dx / d * k; ay += dy / d * k; }
      }
      // flee
      if (near) {
        const dx = f.x - p.x, dy = f.y - p.y, dd = dx * dx + dy * dy;
        // a startled fish reacts after a short, individual delay (so a quick sweep still nets part of a school)
        if (dd < fr2) { f.al += dt; if (f.al > f.react) { const d = Math.sqrt(dd) || 1; ax += dx / d * P.accel * 2.2; ay += dy / d * P.accel * 2.2; if (f.sc <= 0) { f.sc = P.scareT; if (!w.quiet && i % 5 === 0) w.emit('scatter', { x: f.x, y: f.y }); } } }
        else f.al = 0;
      } else f.al = 0;
      // banks
      if (f.x < x0) ax += (x0 - f.x) * 30; else if (f.x > x1) ax -= (f.x - x1) * 30;
      if (f.y < y0) ay += (y0 - f.y) * 30; else if (f.y > y1) ay -= (f.y - y1) * 30;
      const am = Math.hypot(ax, ay), amax = P.accel * (calm ? 1 : 2.5);
      if (am > amax) { ax *= amax / am; ay *= amax / am; }
      f.vx += ax * dt; f.vy += ay * dt;
      const sp = Math.hypot(f.vx, f.vy), vmax = calm ? P.cruise * (this.feeding > 0 ? 1.5 : 1) : P.dart, vmin = P.cruise * 0.45;
      if (sp > vmax) { f.vx *= vmax / sp; f.vy *= vmax / sp; } else if (sp < vmin && sp > 1e-3) { f.vx *= vmin / sp; f.vy *= vmin / sp; }
      f.x = Math.min(this.x + this.w - 3, Math.max(this.x + 3, f.x + f.vx * dt));
      f.y = Math.min(this.y + this.h - 3, Math.max(this.y + 3, f.y + f.vy * dt));
      f.ph += dt * (6 + sp * 0.12);
    }
  }
  feedPt() { const F = this.feeder; return { x: Math.min(this.x + this.w - 22, Math.max(this.x + 22, F.x)), y: Math.min(this.y + this.h - 22, Math.max(this.y + 22, F.y)) }; }
  // the school to chase from (x, y): most fish per distance; returns a lead point a little ahead of it
  bestSchool(x, y, lead = 0.25) {
    let best = null, bs = -1;
    for (const s of this.schools) { if (!s.n) continue; const v = s.n / (Math.hypot(s.cx - x, s.cy - y) + 60); if (v > bs) { bs = v; best = s; } }
    if (!best) return null;
    return { x: Math.min(this.x + this.w - 4, Math.max(this.x + 4, best.cx + best.vx * lead)), y: Math.min(this.y + this.h - 4, Math.max(this.y + 4, best.cy + best.vy * lead)), n: best.n };
  }
}

// ---------------------------------------------------------------------------
function makeCollector(kind, x, y) {
  return { kind, x, y, vx: 0, vy: 0, face: 1, moving: false, walk: 0, dirY: 0,
           speed: 0, cap: 0, pickR: 0, harvestR: 0, cutRate: 0, pickRate: 0, dropRate: 0,
           stack: [], incoming: 0, incomingItems: {}, packPulse: 0, pickAcc: 0, dropAcc: 0, cutAcc: 0, cutT: -9, sway: 0, fullFlag: false, vehicle: false,
           sources: null, canPick: true, canDrop: true, only: null };
}
const itemPrice = (t) => CFG.items[t].price;

export class World {
  constructor(levelIndex, opts = {}) {
    this.li = levelIndex;
    // v4.0: opts.level = a remixed level object (每日挑战); otherwise the level from CFG
    // v4.2: machine goods go to a second counter (js/sales.js adds it, plus an output tray per machine)
    // v4.6 四季山谷: a valley level is resolved for the chosen season (crops, machines, goal); its season is never neutral
    let L0 = opts.level || CFG.levels[levelIndex];
    if (!opts.level && Number.isInteger(L0.valley)) { L0 = valleyLevel(L0.valley, Number.isInteger(opts.season) ? opts.season : L0.season); opts = { ...opts, season: L0.season }; }
    this.valley = Number.isInteger(L0.valley);
    this.L = splitSales(L0);
    // v4.6 分工 (division of labour), on for levels with smartStaff (the 四季山谷): see sinkOpen / workerAI
    // v4.7: and in every machine level (fixed roles: no idle farm help, no role switching)
    this.smart = !!this.L.smartStaff || this.L.objects.some((o) => o.type === 'proc');
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
    this.stats = { collected: {}, sold: {}, produced: {}, golden: {}, earned: 0, unlocks: 0 };
    this.upg = { cap: 0, speed: 0, radius: 0, wcap: 0, wspeed: 0 };
    this.objs = {}; this.fields = []; this.ponds = []; this.coops = []; this.counters = []; this.procs = [];
    this.piles = []; this.tiles = []; this.workers = []; this.customers = []; this.solids = [];
    this.fly = []; this.flyFree = [];
    this.gmode = 'collect';
    this.combo = 0; this.comboIdle = 0; this.feverT = 0; this.comboGain = 0; this.loaders = false;
    this.deco = this.L.deco || {};
    for (const o of this.L.objects) this.build(o);
    for (const p of this.procs) p.outObj = p.outTo ? this.objs[p.outTo] : null;
    this.L.tiles.forEach((t, i) => {
      const price = t.effect && t.effect.proc ? Math.max(1, Math.round(t.price * CFG.procUp.price)) : t.price;   // v4.1 cheaper machine upgrades
      this.tiles.push({ ...t, price, order: i, paid: 0, bought: 0, done: false, visible: false, price0: price, payFx: 0, appearT: -9, cool: 0 });
    });
    this.player = makeCollector('player', this.L.start[0], this.L.start[1]);
    // v4.0 B 宠物狗 (opts.pet = 'dog'); the sims never pass it, so their results are unchanged
    this.dog = opts.pet === 'dog' ? { x: this.player.x - 30, y: this.player.y + 20, vx: 0, vy: 0, moving: false, walk: 0, face: 1, dirY: 0, sway: 0, state: 'follow', fetchT: CFG.pet.every * 0.6, carry: null, n: 0, tgt: null, fetched: 0, wag: 0 } : null;
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
    for (const f of this.ponds) f.envMul = this.envMul(f.item);
    for (const c of this.coops) { const m = this.envMul(c.item); if (m !== 1) c.period = CFG.producers[c.producer].period / m; }
  }
  // crops in this level that the season favours (for the HUD)
  seasonCrops() {
    if (this.season === null) return [];
    const S = CFG.seasons[this.season].crops, out = [];
    for (const f of this.fields) if (S.includes(f.item) && !out.includes(f.item)) out.push(f.item);
    for (const c of this.coops) if (S.includes(c.item) && !out.includes(c.item)) out.push(c.item);
    for (const f of this.ponds) if (S.includes(f.item) && !out.includes(f.item)) out.push(f.item);
    return out;
  }

  emit(type, data) { if (!this.quiet) { if (this.events.length < 800) this.events.push({ type, ...data }); } }

  // ---- construction ------------------------------------------------------
  build(o) {
    const base = { ...o, hidden: !!o.hidden, appearT: -9 };
    if (o.type === 'field' && o.crop === 'fish') {   // v4.2 鱼塘
      const pd = new Pond(o, this.rnd); this.ponds.push(pd); this.objs[o.id] = pd;
    } else if (o.type === 'field') {
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
      const c = { ...base, kind: 'counter', stock: [], incoming: 0, everStocked: false, queue: [], cash: 0, cashier: false, clerks: 1, upLv: 0, buyBonus: 0,   // v4.3: every 店员 is a tile (none free)
                  spawnT: 0.5,
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
      if (o.tray) {   // v4.2: the machine's goods heap up here; 搬运工 carry them to the second counter
        p.pile = new Pile(o.out, o.tray[0], o.tray[1], o.tray[2], o.tray[3], CFG.proc.trayCap);
        p.pile.owner = p; this.piles.push(p.pile);
      }
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
    if (kind === 'stack' && ref && isPackableCargo(type)) {
      const packed = ref.stack.reduce((n, item) => n + (isPackableCargo(item) ? 1 : 0), 0);
      const inbound = Object.entries(ref.incomingItems || {}).reduce((n, [item, count]) => n + (isPackableCargo(item) ? count : 0), 0);
      f.crateSlot = packed + inbound;
    }
    // Boxable harvest should visibly settle into the open crate, not burst high above it.
    // Keep a small, lively sideways wobble and a short hop; ordinary drops keep their old arc.
    const crateLoad = kind === 'stack' && isPackableCargo(type) && ref && ref.crate !== false;
    const spread = crateLoad ? Math.min(spray || 0, 18) : spray || 0;
    f.sx = spread ? (this.rnd() - 0.5) * spread : 0;
    f.sy = spread ? (this.rnd() - 0.5) * spread : 0;
    f.arc = crateLoad ? 18 + this.rnd() * 10 : spray ? 50 + this.rnd() * 60 : 34;
    if (kind === 'stack' && ref && ref.incomingItems) ref.incomingItems[type] = (ref.incomingItems[type] || 0) + 1;
    this.fly.push(f);
    return f;
  }
  landFly(f) {
    const r = f.ref;
    switch (f.kind) {
      case 'stack':
        r.incoming = Math.max(0, r.incoming - 1);
        if (r.incomingItems && r.incomingItems[f.type]) { if (--r.incomingItems[f.type] <= 0) delete r.incomingItems[f.type]; }
        r.stack.push(f.type);
        if (isPackableCargo(f.type)) r.packPulse = 0.42;
        break;
      case 'pile': r.pending--; r.add(f.tx, f.ty, this.rnd); break;
      case 'counter': r.incoming--; if (r.incMade && this._made && this._made.has(f.type)) r.incMade--; r.stock.push(f.type); r.everStocked = true; r.bumpT = 1; break;
      case 'cust': r.incoming--; r.bag.push(f.type); break;
      case 'procIn': r.inc--; r.buf++; break;
      case 'procBatch': r.inc = Math.max(0, r.inc - f.count); r.buf += f.count; break;
    }
  }

  // ---- tiles ---------------------------------------------------------------
  tileReady(id) { const t = this.tiles.find((x) => x.id === id); return t && t.bought > 0; }
  updateTileVis(silent) {
    for (const t of this.tiles) {
      const v = !t.done && (!t.req || t.req.every((r) => this.tileReady(r))) && (!t.reqAny || t.reqAny.some((r) => this.tileReady(r)));
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
        if (o.kind === 'pond') o.fill(silent ? 1 : 0.4);
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
      const w = this.addWorker(e.worker.from, e.worker.to, t.x, t.y, t.icon === 'cart' || t.icon === 'milker');
      if (e.worker.porter) w.porter = true;     // v4.3 加工品搬运工 (tray → 加工品 counter)
      if (e.worker.raw) w.rawCarrier = true;    // v4.3 原料搬运工 (fields → raw counter)
      if (e.worker.feeder) w.feedFor = e.worker.feeder;   // v4.5 the machine's own feeder (full loads; v4.7 never anything else)
      if (e.worker.tray) w.trayOf = e.worker.tray;        // v4.7 the porter's own machine tray
    }
    if (e.upgradeWorkers === 'loader') {
      this.loaders = true;
      for (const w of this.workers) if (!w.cart && !w.loader && !w.porter) { w.loader = true; w.appearT = this.t; if (!silent) this.emit('loaderUp', { x: w.x, y: w.y }); }
      this.refreshStats();
    }
    if (e.sprinkler) for (const id of e.sprinkler) { const f = this.objs[id]; if (f && (f.kind === 'field' || f.kind === 'pond')) { f.growMul = CFG.sprinkler.growMul; f.sprinkler = true; f.sprinklerT = this.t; } }
    if (e.vehicle) { this.player.vehicle = true; this.player.appearT = this.t; this.refreshStats(); }
    if (e.cashier) for (const id of e.cashier) { const c = this.objs[id]; c.cashier = true; if (c.cash > 0) { this.money += c.cash; c.cash = 0; } }
    if (e.feeder) { const pd = this.objs[e.feeder]; if (pd && pd.kind === 'pond') { pd.feeder = { x: t.x, y: t.y }; pd.feedT = CFG.pond.feeder.every - 1.5; pd.feederT = this.t; } }
    if (e.proc) for (const pe of e.proc) { const p = this.objs[pe.id]; p.time *= Math.min(pe.mul, CFG.procUp.timeMul); }
    // v4.3 each machine has its own upgrade path: Lv1 = the v4.1 快机器 (×0.42), Lv2 ×0.7 more
    if (e.procUp) { const p = this.objs[e.procUp]; if (p) { p.upLv = (p.upLv || 0) + 1; p.time *= p.upLv === 1 ? CFG.procUp.timeMul : CFG.procUp.time2; } }
    // v4.3 收银升级: faster checkout, customers come more often; Lv2 they also buy more each
    if (e.counterUp) for (const id of e.counterUp) {
      const c = this.objs[id]; if (!c || c.kind !== 'counter') continue;
      const U = CFG.v43.cup; c.upLv++; c.serveRate *= U.serve; c.interval *= U.interval; c.clerks = 2;
      if (c.upLv >= 2) c.buyBonus = U.buy;
    }
  }

  addWorker(from, to, x, y, cart) {
    {
      const t = { x, y };
      const w = makeCollector('worker', t.x, t.y);
      w.from = from; w.to = to; w.state = 'collect'; w.wait = 0; w.tgt = null; w.retarget = 0;
      w.stuck = 0; w.lastX = t.x; w.lastY = t.y; w.appearT = this.t; w.seed = this.workers.length; w.cart = cart;
      w.lumber = w.from.some((id) => this.objs[id] && this.objs[id].item === 'log');
      w.fisher = w.from.some((id) => this.objs[id] && this.objs[id].item === 'fish');   // Fisher look applies to ponds and the valley's winter fish field.
      w.lv = 1; w.trips = 0; w.lvT = -9; w.loader = this.loaders && !w.cart;
      w.done = 0; const cm = this.crew && this.crew[this.workers.length];
      if (cm) { w.crewId = cm.id; w.crewName = cm.name; w.crewMul = cm.mul; }
      this.workers.push(w); this.refreshStats();
      return w;
    }
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
    this._slots = null;
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
    for (const pd of this.ponds) pd.update(dt, this);
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
    if (this.dog) this.updateDog(dt);
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
      const tray = p.pile;
      let room = tray ? tray.total + tray.pending < tray.cap : !out || (chain ? out.buf + out.inc < CFG.proc.chainMax : out.stock.length + out.incoming < CFG.counter.stockMax);
      if (!room && !chain && !tray) { let k = 0; for (const it of out.stock) if (it === p.outItem) k++; room = k + out.incoming < CFG.counter.stockMax * 0.5; }
      if (p.buf >= p.ratio && room) {
        p.timer += dt; p.work = 1;
        if (p.timer >= p.time) {
          p.timer = 0; p.buf -= p.ratio;
          this.stats.produced[p.outItem] = (this.stats.produced[p.outItem] || 0) + 1;
          if (tray) {   // v4.2: onto the output tray (a little heap the 搬运工 carry off)
            const tx = tray.x + 4 + this.rnd() * (tray.w - 8), ty = tray.y + 4 + this.rnd() * (tray.h - 8);
            tray.pending++; this.launch(p.outItem, 'pile', p.x, p.y, 36, tray, tx, ty, 0, CFG.fly.produce);
          } else if (chain) { out.inc++; this.launch(p.outItem, 'procIn', p.x, p.y, 36, out, out.x - 14, out.y, CFG.proc.bodyH + 10, CFG.fly.produce * 1.6, 40); }
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
            this.stats.golden[f.item] = (this.stats.golden[f.item] || 0) + 1;   // v4.0 B 图鉴 金色变种
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
      // v4.2 鱼塘: every fish inside the net is caught while there is room (each species fills its yield)
      for (const pd of this.ponds) {
        if (pd.hidden || !pd.fish.length || (srcs && !srcs.includes(pd)) || !this.hasSink('fish')) continue;
        const hr = c.harvestR;
        if (c.x < pd.x - hr || c.x > pd.x + pd.w + hr || c.y < pd.y - hr || c.y > pd.y + pd.h + hr) continue;
        const hr2 = hr * hr, SP = CFG.pond.species; let got = 0, cx = 0, cy = 0;
        for (let i = pd.fish.length - 1; i >= 0; i--) {
          const f = pd.fish[i]; if (d2(f.x, f.y, c.x, c.y) > hr2) continue;
          const room = space(); if (room <= 0) break;
          pd.remove(i); pd.caught++; got++; cx += f.x; cy += f.y;
          if (f.gold) {   // 金锦鲤: pays straight into the wallet, counts for the 图鉴 金色变种
            const amount = itemPrice('fish') * CFG.golden.mul * CFG.pond.goldMul;
            this.money += amount; this.stats.earned += amount;
            this.stats.golden.fish = (this.stats.golden.fish || 0) + 1;
            this.emit('golden', { x: f.x, y: f.y, amount, who: c.kind, koi: true });
            continue;
          }
          const n = Math.min(SP[f.sp].yield, room);
          for (let k = 0; k < n; k++) { c.incoming++; this.launch('fish', 'stack', f.x, f.y, 4 + k * 8, c, 0, 0, 0, CFG.fly.harvest + k * 0.06, 50); }
          this.stats.collected.fish = (this.stats.collected.fish || 0) + n;
          if (f.sp) this.stats.species = Object.assign(this.stats.species || {}, { [SP[f.sp].id]: ((this.stats.species || {})[SP[f.sp].id] || 0) + 1 });
        }
        if (got) {
          if (isPlayer) this.comboGain += got;
          c.cutT = this.t; c.cutItem = 'fish';
          this.emit('catch', { x: cx / got, y: cy / got, n: got, who: c.kind });
          const L = CFG.pond.levels;
          while (pd.lv < L.length && pd.caught >= L[pd.lv].at) { pd.setLevel(pd.lv + 1); pd.lvT = this.t; this.emit('pondLevel', { x: pd.X + pd.MW / 2, y: pd.Y + pd.MH / 2, lv: pd.lv, id: pd.id }); this.emit('ground', {}); }
        }
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
      if (!sink) for (const p of this.procs) if (!p.hidden && inRect(c.x, c.y, p.inZone) && (!c.toObjs || c.toObjs.includes(p)) && c.stack.includes(p.inItem) && (c.feedFor === p.id ? this.canDropFeederBatch(c, p) : !this.procFull(p))) { sink = p; accepts = (t) => t === p.inItem; break; }
      c.dropping = !!sink;
      if (sink) {
        if (sink.kind === 'proc' && c.feedFor === sink.id) {
          if (this.canDropFeederBatch(c, sink) && (!this.smart || this.sinkOpen(c, sink))) {
            const count = c.stack.length, item = sink.inItem;
            c.stack.length = 0; c.dropAcc = 0;
            sink.inc += count;
            c.done = (c.done || 0) + count;
            const dd = c.drops || (c.drops = {}); dd[sink.id] = (dd[sink.id] || 0) + count;
            const f = this.launch(item, 'procBatch', c.x, c.y, 44 + Math.max(0, count - 1) * CFG.items[item].step, sink, sink.x - 14, sink.y, CFG.proc.bodyH + 10, CFG.fly.drop);
            f.count = count; f.batchCap = c.batchCap || c.cap;
          }
        } else {
          c.dropAcc = Math.min(c.dropAcc + c.dropRate * dt, Math.max(1, c.dropRate * 0.1));
          while (c.dropAcc >= 1) {
            let idx = -1; for (let j = c.stack.length - 1; j >= 0; j--) if (accepts(c.stack[j])) { idx = j; break; }
            if (idx < 0 || (sink.kind === 'proc' && this.procFull(sink))) break;
            if (this.smart && !isPlayer && !this.sinkOpen(c, sink)) break;   // v4.6: staff never overfill a counter / machine
            const item = c.stack[idx];
            c.stack.splice(idx, 1); c.dropAcc--;
            if (!isPlayer) { c.done = (c.done || 0) + 1; const dd = c.drops || (c.drops = {}); dd[sink.id] = (dd[sink.id] || 0) + 1; }   // 雇工 XP (+ v4.3 where it went)
            const z = 44 + idx * CFG.items[item].step;
            if (sink.kind === 'counter') { sink.incoming++; if ((this._made || (this._made = new Set(this.procs.map((q) => q.outItem)))).has(item)) sink.incMade = (sink.incMade || 0) + 1; this.launch(item, 'counter', c.x, c.y, z, sink, sink.x, sink.y, CFG.counter.deskH + 4, CFG.fly.drop); }
            else { sink.inc++; this.launch(item, 'procIn', c.x, c.y, z, sink, sink.x - 14, sink.y, CFG.proc.bodyH + 10, CFG.fly.drop); }
            if (isPlayer) this.emit('drop', { item });
          }
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

  counterSupplyInTransit(c) {
    // Goods already launched toward the counter no longer belong to a worker's stack;
    // keep buyers waiting for that final flight as well.
    if (c.incoming > 0) return true;
    for (const w of this.workers) {
      if (!w.to || !w.to.includes(c.id)) continue;
      const cargo = w.stack.slice();
      for (const f of this.fly) if (f.active && f.kind === 'stack' && f.ref === w) cargo.push(f.type);
      if (cargo.some((item) => c.items.includes(item))) return true;
      // A worker on its collection leg is committed supply when its assigned source
      // already has sellable stock; without this, buyers can time out while the worker
      // is visibly harvesting a crop that will go to this counter.
      if (w.state === 'collect') {
        const sources = w.sources || (w.from || []).map((id) => this.objs[id]).filter(Boolean);
        if (sources.some((o) => !o.hidden && c.items.includes(o.item) &&
          ((o.ripe || 0) > 0 || (o.pile && o.pile.total + o.pile.pending > 0) ||
           (o.kind === 'field' && o.ripe < o.n) || (o.kind === 'pond' && o.ripe < o.N)))) return true;
      }
    }
    // Direct-to-counter machines can have an active/ready batch before it becomes c.incoming.
    for (const p of this.procs) if (!p.hidden && p.outObj === c && !p.pile && (p.work > 0 || p.buf >= p.ratio)) return true;
    // A processed-goods counter is supplied in two legs: machine → tray → porter → counter.
    // While the porter is empty, the tray or an active/ready machine output is still real supply
    // in the delivery pipeline. Don't let the front customer time out during that hand-off.
    if (c.sale2) for (const p of this.procs) {
      if (p.hidden || p.outObj !== c || !p.pile) continue;
      const porter = this.workers.some((w) => w.porter && w.trayOf === p.id && w.to && w.to.includes(c.id));
      if (!porter) continue;
      if (p.pile.total + p.pile.pending > 0 || p.work > 0 || p.buf + p.inc >= p.ratio) return true;
      // During startup the machine may still be empty while its feeder is carrying the first
      // batch of raw input. That load is committed supply too; don't abandon buyers mid-handoff.
      const feederCargo = this.workers.some((w) => w.feedFor === p.id && w.to && w.to.includes(p.id) &&
        (w.stack.includes(p.inItem) || this.fly.some((f) => f.active && f.kind === 'stack' && f.ref === w && f.type === p.inItem)));
      if (feederCargo) return true;
      // The feeder's collection leg is part of this same production route. Count its assigned
      // visible source (including normal crop regrowth) so the line does not empty-timeout while
      // the worker is doing the first useful step toward the machine.
      const feederCollecting = this.workers.some((w) => {
        if (w.feedFor !== p.id || !w.to || !w.to.includes(p.id) || w.state !== 'collect') return false;
        const sources = w.sources || (w.from || []).map((id) => this.objs[id]).filter(Boolean);
        return sources.some((o) => !o.hidden && o.item === p.inItem &&
          ((o.ripe || 0) > 0 || (o.pile && o.pile.total + o.pile.pending > 0) ||
           (o.kind === 'field' && o.ripe < o.n) || (o.kind === 'pond' && o.ripe < o.N)));
      });
      if (feederCollecting) return true;
    }
    return false;
  }

  // A customer may arrive before the player buys the counter's configured supplier.
  // Give that upgrade path a finite setup window; counters with no matching hire route
  // must use the short genuine-stockout timeout instead of waiting forever.
  counterHasPlannedSupply(c) {
    return this.tiles.some((t) => {
      const w = t.effect && t.effect.worker;
      if (!w || !w.to || !w.to.includes(c.id)) return false;
      if (w.porter) {
        const p = this.objs[w.tray];
        return !!p && c.items.includes(p.outItem);
      }
      return (w.from || []).some((id) => {
        const o = this.objs[id];
        return !!o && c.items.includes(o.item || o.crop);
      });
    });
  }

  updateCounter(c, dt) {
    const C = CFG.customer;
    c.bumpT = Math.max(0, c.bumpT - dt * 4);
    c.spawnT -= dt;
    // v4.9 排队不断: a customer walks up whenever the line has room (the walk takes time, so the line never looks empty);
    // the desk staying stocked once its staff are hired (v4.7) is what keeps the front customer from waiting.
    // A front customer who finds the desk empty leaves after patience × 2 (see below), the next one steps up.
    if (c.spawnT <= 0 && c.queue.length < C.queue) {
      c.spawnT = c.interval * (0.7 + this.rnd() * 0.6);
      const cu = { x: c.spawn.x + this.rnd() * 30, y: c.spawn.y + (this.rnd() - 0.5) * 20, counter: c, state: 'in',
                   want: C.buyMin + Math.floor(this.rnd() * (C.buyMax - C.buyMin + 1)) + (c.buyBonus || 0),
                   bag: [], incoming: 0, wait: 0, dry: 0, stockoutWait: 0, t0: this.t, hue: Math.floor(this.rnd() * 8), walk: this.rnd() * 6, face: -1, vx: 0, vy: 0, leg: 0 };
      if (this.rnd() < CFG.vip.chance * this.vipMul) { cu.vip = true; cu.wish = c.items.reduce((a, b) => (itemPrice(b) > itemPrice(a) ? b : a), c.items[0]); }
      c.queue.push(cu); this.customers.push(cu);
    }
    if (this.quiet) { const k = Math.floor(this.t), q = c.qEmpty || (c.qEmpty = []); q[k] = (q[k] || 0) + (c.queue.some((x) => x.tArr !== undefined) ? 0 : dt); }   // v4.9 metric: nobody standing in line
    const front = c.queue[0];
    if (front && front.state === 'wait') {
      c.buyAcc = Math.min(c.buyAcc + c.serveRate * dt, 2);
      const previousGot = front.stockoutGot ?? front.bag.length;
      while (c.buyAcc >= 1 && c.stock.length > 0 && front.bag.length + front.incoming < front.want) {
        c.buyAcc--;
        const it = c.stock.pop(); front.incoming++;
        this.launch(it, 'cust', c.x, c.y, CFG.counter.deskH + 4, front, 0, 0, 0, CFG.fly.serve);
      }
      if (c.stock.length <= 0) c.buyAcc = 0;
      const got = front.bag.length;
      // A real delivery or active production route keeps an empty-counter buyer waiting. If staff
      // have not been hired yet, a matching configured hire gets a finite setup window;
      // with no feasible route, the ordinary empty-counter patience applies even on first use.
      const inbound = c.stock.length <= 0 && front.incoming === 0 && this.counterSupplyInTransit(c);
      const plannedSupply = !inbound && this.counterHasPlannedSupply(c);
      const short = got < front.want && c.stock.length <= 0 && front.incoming === 0;
      if (inbound) { front.dry = 0; }
      // Measure the partial order's time between actual replenishments, including travel
      // time; a stalled delivery must not keep a customer indefinitely. Progress resets it.
      if (got > previousGot) front.stockoutWait = 0;
      else if (got > 0 && got < front.want) front.stockoutWait = (front.stockoutWait || 0) + dt;
      front.stockoutGot = got;
      if (!inbound && short) front.dry += dt;   // empty desk with no carrier on the way
      const emptyLimit = plannedSupply ? (C.unstaffedPatience || C.emptyPatience || C.patience * 2) : (C.emptyPatience || C.patience * 2);
      // A partially served buyer gets a bounded restock window if goods are in stock,
      // in transit or still have a real/configured supply route; no route keeps normal patience.
      const partialSupply = inbound || plannedSupply || c.stock.length > 0 || c.incoming > 0 || front.incoming > 0;
      const partialLimit = partialSupply ? (C.partialPatience || C.emptyPatience || C.patience * 2) : C.patience;
      const done = got >= front.want || (short && got > 0 && front.incoming === 0 && front.stockoutWait > partialLimit)
        || (got === 0 && front.incoming === 0 && c.stock.length <= 0 && !inbound && front.dry > emptyLimit);   // no stock for a full supply cycle: they leave
      if (done && front.incoming === 0 && this.quiet) (this.waitLog || (this.waitLog = [])).push({ c: c.id, t: this.t, arrived: front.tArr ?? front.t0, frontAt: front.tFront ?? this.t, wait: this.t - (front.tArr ?? front.t0), svc: this.t - (front.tFront ?? this.t), dry: front.dry, got, want: front.want });
      if (done && front.incoming === 0 && got === 0) { front.state = 'out'; front.leg = 0; c.queue.shift(); }
      else if (done && front.incoming === 0) {
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
        if (cu.state === 'in' && cu.tArr === undefined) cu.tArr = this.t;   // v4.7 metric: queue wait starts when it reaches the line
        if (cu.state === 'in' && c.queue[0] === cu) { cu.state = 'wait'; cu.face = -1; cu.tFront = this.t; }   // (v4.9 metric: front service wait)
        if (cu.state === 'out') { if (cu.leg === 0) cu.leg = 1; else this.customers.splice(i, 1); }
      }
    }
  }

  // ---- gardeners ---------------------------------------------------------------------
  // ---- v4.6 分工 -------------------------------------------------------------------------
  // raw items on a counter (machine goods on a one-counter level do not count)
  rawStock(c) {
    if (!this._made) this._made = new Set(this.procs.map((p) => p.outItem));
    let n = c.incoming - (c.incMade || 0); for (const it of c.stock) if (!this._made.has(it)) n++;   // (v4.7: goods in flight are not raw)
    return n;
  }
  // a raw counter wants staff deliveries: in a machine level only to top it up (below rawLow → until rawFull)
  rawNeedsTopUp() { return this.counters.some((c) => !c.hidden && !c.sale2 && this.rawStock(c) < CFG.v46.rawLow); }
  sinkOpen(w, s) {
    if (s.kind === 'proc') return w.feedFor === s.id ? this.procBatchRoom(s, w.stack.length || w.cap) : !this.procFull(s) && s.buf + s.inc < CFG.proc.inMax;
    if (s.sale2 || w.porter) return s.stock.length + s.incoming < CFG.counter.stockMax;
    const n = this.rawStock(s);
    if (!this.procs.length) return n < CFG.counter.stockMax;
    const top = w.top || (w.top = {});
    if (n < CFG.v46.rawLow) top[s.id] = true; else if (n >= CFG.v46.rawFull) top[s.id] = false;
    return !!top[s.id];
  }
  // a spot in a drop zone of its own (up to 6 slots per zone, then they repeat)
  slot(z, w) {
    const m = this._slots || (this._slots = new Map()), k = m.get(z) || 0; m.set(z, k + 1);
    const c = k % 6, dx = (c % 3 - 1) * 14, dy = (c < 3 ? -1 : 1) * 10;
    return { x: z.cx + dx, y: z.cy + dy };
  }
  // where a worker waits with its load: a feeder beside its machine, others along the east edge of their field
  post(w, srcs) {
    const i = this.workers.indexOf(w);
    if (w.feedFor) { const z = this.objs[w.feedFor].inZone; return { x: z.cx - 34 + (i % 3) * 16, y: z.cy + 38 + (i % 2) * 14 }; }
    const o = srcs[0] || this.objs[w.from[0]];
    if (!o) return { x: w.x, y: w.y };
    const x = o.x + o.w + 22, y = o.y + 24 + ((i * 37) % Math.max(1, o.h - 48));
    return { x: Math.min(this.W - 30, x), y };
  }
  // v4.7 where a worker with nothing to pick up waits: porters spread round their tray, others along their field's edge
  idlePost(w, srcs) {
    if (w.porter) {
      const p = this.objs[w.trayOf] || srcs[0], tr = p && p.pile; if (!tr) return { x: w.x, y: w.y };
      const mates = this.workers.filter((o) => o.porter && o.trayOf === w.trayOf), k = Math.max(0, mates.indexOf(w));
      return { x: tr.x + tr.w / 2 + (k % 2 ? 14 : -14), y: tr.y + tr.h / 2 + (k < 2 ? 0 : 14) };
    }
    return this.post({ ...w, feedFor: null }, srcs.filter((o) => o.kind === 'field').concat(srcs));
  }
  // v4.8 a machine with 3 专员: when it runs dry only one of them rushes over with a part load (the others keep harvesting)
  mateBrings(w) {
    const mates = this.workers.filter((o) => o.feedFor === w.feedFor);
    return mates.length >= 3 && mates.some((o) => o !== w && o.state === 'deliver' && o.stack.length + o.incoming > 0);
  }
  workerAI(w, dt) {
    const T = this.t;
    // v4.7 fixed roles: everyone only ever works its own sources → its own sinks (no farm help, no assisting machines)
    let srcs = w.from.map((id) => this.objs[id]).filter((o) => o && !o.hidden);
    // a porter works its own tray; when that one is empty and another tray of the same counter is heaping up, it fetches
    // from there (still tray → goods counter, sticky until that load is delivered)
    if (w.porter && w.trayOf && this.smart) {
      const own = this.objs[w.trayOf], tot = (o) => (o.pile ? o.pile.total : 0);
      if (w.state === 'collect' && !w.otherTray && own && tot(own) === 0) {
        let best = null; for (const o of srcs) if (o !== own && tot(o) >= CFG.v47.trayHelp && (!best || tot(o) > tot(best))) best = o;
        if (best) w.otherTray = best;
      }
      if (w.otherTray && (w.otherTray.hidden || (w.state === 'collect' && tot(w.otherTray) === 0 && w.stack.length === 0))) w.otherTray = null;
      srcs = w.otherTray ? [w.otherTray] : own && !own.hidden ? [own] : srcs;
    }
    const sinks = w.to.map((id) => this.objs[id]).filter((o) => o && !o.hidden);
    w.sources = srcs; w.toObjs = sinks;
    w.holding = false;
    const space = w.cap - w.stack.length - w.incoming;
    if (w.state === 'collect' && space <= 0) {
      w.state = 'deliver';
      // Freeze a feeder's batch size when it leaves full. A later worker-capacity upgrade
      // must not turn an already-full load into a permanently partial-looking delivery.
      if (w.feedFor) { w.batch = w.stack.length + w.incoming; w.batchCap = w.cap; }
    }
    // Feeders collect a full carrying load before starting a machine trip. If the input is full,
    // they keep that load and wait at the machine until it can accept the next items.
    if (w.state === 'collect' && w.feedFor) {
      const batch = Math.ceil(w.cap * CFG.v45.batch);
      let have = w.incoming; for (const t of w.stack) if (t === this.objs[w.feedFor].inItem) have++;
      if (have >= batch) { w.state = 'deliver'; w.batch = batch; w.batchCap = w.cap; }
    }
    // v4.7 porter: leave the tray with a fair batch, or at once when the goods counter is running low
    if (w.state === 'collect' && w.porter && this.smart) {
      // it keeps loading while its tray has goods (a full stack goes anyway), and leaves an emptied tray with a fair batch,
      // or with a few as soon as the goods counter runs low
      const have = w.stack.length + w.incoming, sale = sinks[0], left = srcs.reduce((n, o) => n + (o.pile ? o.pile.total : 0), 0);
      const low = sale && sale.stock.length + sale.incoming < CFG.v47.porterLow;
      if (left === 0 && w.incoming === 0 && (have >= Math.ceil(w.cap * CFG.v47.porterGo) || (low && have >= CFG.v47.porterMin))) w.state = 'deliver';
    }
    if (w.state === 'deliver' && w.stack.length === 0 && w.incoming === 0) {
      w.state = 'collect'; w.wait = 0; w.otherTray = null; w.batch = 0; w.batchCap = 0;
      // 园丁成长: level up every few delivery trips
      w.trips++;
      const Lv = CFG.workerLv, nl = Math.min(Lv.max, 1 + Math.floor(w.trips / Lv.per));
      if (nl > w.lv) { w.lv = nl; w.lvT = T; this.refreshStats(); this.emit('workerLevel', { x: w.x, y: w.y, lv: nl }); }
    }
    // v4.6 分工: nobody fills up for a sink that has no room (full counter / machine) — collect a fair batch, then wait at a post
    if (this.smart && !w.feedFor && w.state === 'collect' && w.stack.length >= Math.ceil(w.cap * CFG.v46.holdAt)) {
      const items = new Set(srcs.map((o) => o.item));
      if (!sinks.some((k) => this.sinkOpen(w, k) && (k.kind === 'counter' ? [...items].some((t) => k.items.includes(t)) : items.has(k.inItem)))) w.state = 'deliver';
    }
    w.canPick = w.state === 'collect';
    let tx = w.x, ty = w.y;
    if (w.state === 'collect') {
      let best = null, bv = 0;
      for (const s of srcs) {
        const v = s.kind === 'coop' ? s.pile.total : (s.pile ? s.pile.total : 0) + (s.ripe || 0);
        if (v > bv) { bv = v; best = s; }
      }
      if (!best) {
        w.wait += dt; w.idleT = (w.idleT || 0) + dt;
        const collectWait = collectWaitLimit(w, srcs, CFG);
        if (w.stack.length > 0 && w.wait > collectWait && !w.feedFor) w.state = 'deliver';
        // v4.7 nothing to pick up: wait at its own post (porter by its tray, others at the edge of their field)
        else if (this.smart && w.idleT > CFG.v47.idleWait) { const o = this.idlePost(w, srcs); tx = o.x; ty = o.y; }
      } else {
        w.idleT = 0; w.wait = 0;
        w.retarget -= dt;
        if (best.kind === 'pond') {   // 渔夫 chase the nearest school (re-aimed often: fish move)
          if (w.retarget <= 0 || !w.tgt) {
            w.retarget = 0.2; w.tgt = best.bestSchool(w.x, w.y, 0.3);
            if (this.smart && w.tgt) { const k = this.workers.indexOf(w) % 4; w.tgt = { x: w.tgt.x + (k % 2 ? 16 : -16), y: w.tgt.y + (k < 2 ? -12 : 12) }; }   // v4.6: fishers fan out round a school
          }
        } else if (w.retarget <= 0 || !w.tgt) {
          w.retarget = 0.4;
          const pl = best.pile;
          let lane = null;
          if (this.smart && pl) {
            const crew = this.workers.filter((o) => o.sources && o.sources.includes(best));
            if (crew.length > 1) lane = { index: Math.max(0, crew.indexOf(w)), count: crew.length };
          }
          const i = pl && pl.total > 0 ? pl.hottest(w.x, w.y, T, lane) : -1;
          if (i >= 0) w.tgt = pl.safe(i);
          else if (best.kind === 'field') {
            // v4.6: each worker works its own lane of the field (no crowding on one corner)
            let qx = w.x, qy = w.y;
            if (this.smart) { const n = Math.max(1, this.workers.filter((o) => o.sources && o.sources.includes(best)).length), k = this.workers.indexOf(w) % n; qx = (w.x + best.x + best.w * (k + 0.5) / n) / 2; qy = (w.y + best.y + best.h / 2) / 2; }
            const j = best.nearestRipe(qx, qy); if (j >= 0) w.tgt = { x: best.px(j), y: best.py(j) };
          }
        }
        if (w.tgt) { tx = w.tgt.x; ty = w.tgt.y; }
        // Machine feeders never leave with a partial load just because a field is temporarily bare;
        // they wait for regrowth and only deliver a complete, frozen batch.
        if (bv === 0 && w.stack.length > 0 && !w.feedFor) w.state = 'deliver';
      }
    }
    if (w.state === 'deliver') {
      let bs = null, bd = 1e18, bo = null;
      let anyTakes = false;
      for (const s of sinks) {
        const ok = s.kind === 'counter' ? w.stack.some((t) => s.items.includes(t)) : w.stack.includes(s.inItem);
        if (!ok) continue;
        anyTakes = true;
        if (s.kind === 'proc' && (w.feedFor === s.id ? !this.procBatchRoom(s, w.batchCap || w.cap) : this.procFull(s))) { w.blocked = s; continue; }   // feeders wait until the whole frozen load fits
        if (this.smart && !this.sinkOpen(w, s)) { if (s.kind === 'proc') w.blocked = s; continue; }
        const z = s.kind === 'counter' ? s.zone : s.inZone; let dd = d2(z.cx, z.cy, w.x, w.y);
        // v4.6: a raw counter that is being topped up (it ran low) comes first, then a machine that needs crops
        // order: a raw counter that ran low → a starving machine → a counter being topped up / a machine with input
        if (this.smart) dd *= s.kind === 'counter' && !s.sale2 && !w.porter && this.rawStock(s) < CFG.v46.rawLow ? 0.004   // (weights on squared distance)
          : s.kind === 'proc' && s.buf + s.inc < CFG.proc.inMax * CFG.v46.starve ? 0.02 : 1;
        if (this.smart && w.pick === s) dd *= 0.05;   // v4.6: stick with the sink already chosen (no dithering between two)
        if (dd < bd) { bd = dd; bs = z; bo = s; }
      }
      if (this.smart) w.pick = bo;
      if (bs && this.smart) { const o = this.slot(bs, w); tx = o.x; ty = o.y; w.blocked = null; }
      else if (bs) { const k = (w.seed + (w.sinkRot || 0)) | 0; tx = bs.cx + ((k % 3) - 1) * 8; ty = bs.cy + ((k % 2) ? 6 : -6); w.blocked = null; }
      else if (this.smart && anyTakes && w.feedFor && w.stack.includes(this.objs[w.feedFor].inItem) && !this.objs[w.feedFor].hidden) {
        const o = this.slot(this.objs[w.feedFor].inZone, w); tx = o.x; ty = o.y; w.holding = true; w.blocked = null;   // its machine is full: wait in its input zone, topping it up
      }
      else if (this.smart && anyTakes) { const o = this.post(w, srcs); tx = o.x; ty = o.y; w.holding = true; w.blocked = null; }
      else if (w.blocked && !w.blocked.hidden) { const z = w.blocked.inZone, k = w.seed | 0; tx = z.cx - 30 + (k % 3) * 8; ty = z.cy + 34 + (k % 2) * 8; w.blocked = null; }
      else if (w.stack.length) { const o = this.post(w, srcs); tx = o.x; ty = o.y; w.holding = true; w.blocked = null; } // preserve cargo until a compatible sink is available
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

  // v4.3 bot / debug walker: the workers' A* path toward the guide target. navigate's straight-line test skips the
  // cells round the start, so with no progress for 0.6 s it follows a fresh A* path for 1.5 s (the old corner-steer
  // could wedge on a desk corner, e.g. between a machine and the 加工品 counter)
  botWay(p, target) {
    const b = p._bot || (p._bot = { x: p.x, y: p.y, t: this.t, until: -1 });
    if (Math.hypot(p.x - b.x, p.y - b.y) > 6) { b.x = p.x; b.y = p.y; b.t = this.t; }
    else if (this.t - b.t > 0.6) { b.until = this.t + 1.5; b.t = this.t; p.path = null; return this.navigate(p, target.x, target.y, 12, true); }
    if (this.t < b.until && p.path && Math.hypot(p.pathGoal.x - target.x, p.pathGoal.y - target.y) < 30) {
      const P = p.path; while (p.pathI < P.length - 1 && Math.hypot(P[p.pathI].x - p.x, P[p.pathI].y - p.y) < 7) p.pathI++;
      return P[p.pathI];
    }
    return this.navigate(p, target.x, target.y, 12, false);
  }

  // ---- guide: what should the player do next (arrow + sim bot) -----------------------
  // machines first (they turn raw flowers into pricier goods), then counters
  // produce nobody buys yet (no counter or machine takes it) is left in the field
  // v4.3: a machine whose goods can't be sold yet (no 加工品 counter) stops eating the crop at inMax
  procFull(p) { return p.buf + p.inc >= CFG.proc.inMax && !this.procSells(p); }
  procSells(p) { const o = p.outObj; return !o || (o.kind === 'proc' ? !o.hidden && this.procSells(o) : !o.hidden); }
  procBatchRoom(p, count) {
    const held = p.buf + p.inc;
    // A full worker load may exceed the legacy no-sales buffer; allow one such batch into an empty machine,
    // then hold the next feeder trip until enough input has been processed to accept another whole load.
    return this.procSells(p) || held + count <= CFG.proc.inMax || (held === 0 && count > CFG.proc.inMax);
  }
  canDropFeederBatch(worker, processor) {
    const batchCap = worker.batchCap || worker.cap;
    return worker.feedFor === processor.id && worker.incoming === 0 && worker.stack.length === batchCap &&
      worker.stack.every((item) => item === processor.inItem) && this.procBatchRoom(processor, worker.stack.length);
  }
  hasSink(item) {
    for (const p of this.procs) if (!p.hidden && p.inItem === item && !this.procFull(p)) return true;
    for (const k of this.counters) if (!k.hidden && k.items.includes(item)) return true;
    return false;
  }
  sinksFor(item) {
    const out = [];
    // v4.3: the arrow sends a load to a machine only while it has real room, and prefers the counter while the
    // machine's goods can't be sold yet (no 加工品 counter bought)
    for (const p of this.procs) if (!p.hidden && p.inItem === item && (this.procSells(p) || p.buf + p.inc < CFG.proc.inMax * 0.5)) out.push({ z: p.inZone, w: this.procSells(p) ? 0.5 : 1.5 });
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
    // v4.3: the arrow works down a short shopping list — the first affordable tile among the next 3 visible ones in
    // the level's order — so it saves up for an important tile instead of always grabbing the cheapest upgrade
    { let k = 0; for (const t of this.tiles) { if (!t.visible) continue; if (t.price - t.paid <= this.money + 0.01) { tile = t; break; } if (++k >= CFG.guideWindow) break; } }
    if (tile) return { x: tile.x, y: tile.y, kind: 'tile', obj: tile };
    if (cashPos) { let k = 0; for (const t of this.tiles) { if (!t.visible) continue; if (t.price - t.paid <= this.money + cash) return { x: cashPos.x, y: cashPos.y, kind: 'cash' }; if (++k >= CFG.guideWindow) break; } }
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
    const value = (item) => { let v = 0; for (const pr of this.procs) if (!pr.hidden && pr.inItem === item && !this.procFull(pr)) v = Math.max(v, this.procSells(pr) ? itemPrice(pr.outItem) / pr.ratio : 0.3); for (const k of this.counters) if (!k.hidden && k.items.includes(item)) v = Math.max(v, itemPrice(item)); return v; };
    for (const pl of this.piles) if (!pl.owner.hidden && pl.total > 0) {
      const val = value(pl.type); if (!val) continue;
      const i = pl.hottest(p.x, p.y, this.t); if (i < 0) continue;
      const { x, y } = pl.safe(i);
      const s = Math.min(free, pl.total) * val / (Math.sqrt(d2(x, y, p.x, p.y)) + 80);
      if (s > bs) { bs = s; best = { x, y, kind: 'pile' }; }
    }
    for (const pd of this.ponds) if (!pd.hidden && pd.fish.length) {
      const val = value('fish'); if (!val) continue;
      const sc = pd.bestSchool(p.x, p.y, 0.35); if (!sc) continue;
      const s = Math.min(free, sc.n * 1.6) * val / (Math.sqrt(d2(sc.x, sc.y, p.x, p.y)) + 80);
      if (s > bs) { bs = s; best = { x: sc.x, y: sc.y, kind: 'pond' }; }
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


  // ---- v4.0 B 宠物狗 ------------------------------------------------------------
  // follow: trots a little behind the farmer. Every CFG.pet.every s (when the stack has room) it looks for a
  // ripe, non-golden plant (or a pile item) within range, runs to it, takes up to CFG.pet.carry in its mouth
  // and brings them back: they hop onto the farmer's stack. A small help, never a second harvester.
  dogFind() {
    const d = this.dog, P = CFG.pet, R2 = P.range * P.range; let best = null, bd = R2;
    for (const f of this.fields) {
      if (f.hidden || f.spill || f.ripe <= 0 || !this.hasSink(f.item)) continue;
      if (d.x < f.x - P.range || d.x > f.x + f.w + P.range || d.y < f.y - P.range || d.y > f.y + f.h + P.range) continue;
      const i = f.nearestRipe(d.x, d.y); if (i < 0 || f.gold[i]) continue;
      const dd = d2(f.px(i), f.py(i), d.x, d.y); if (dd < bd) { bd = dd; best = { f, i, x: f.px(i), y: f.py(i) }; }
    }
    for (const pl of this.piles) {
      if (pl.owner.hidden || pl.total <= 0 || !this.hasSink(pl.type)) continue;
      const i = pl.hottest(d.x, d.y, this.t); if (i < 0) continue;
      const s = pl.safe(i), dd = d2(s.x, s.y, d.x, d.y); if (dd < bd) { bd = dd; best = { pl, x: s.x, y: s.y }; }
    }
    return best;
  }
  dogMove(dt, tx, ty, sp) {
    const d = this.dog, wp = this.steer(d, tx, ty, 8), ex = wp.x - d.x, ey = wp.y - d.y, e = Math.hypot(ex, ey);
    const v = e < 2 ? 0 : Math.min(sp, e * 6), k = Math.min(1, dt * 10);
    d.vx += ((e ? ex / e : 0) * v - d.vx) * k; d.vy += ((e ? ey / e : 0) * v - d.vy) * k;
    this.stepMove(d, dt, 7);
    return Math.hypot(tx - d.x, ty - d.y);
  }
  updateDog(dt) {
    const d = this.dog, p = this.player, P = CFG.pet, room = p.cap - p.stack.length - p.incoming;
    d.wag += dt;
    if (d.state === 'follow') {
      const sp = Math.hypot(p.vx, p.vy), ax = sp > 8 ? -p.vx / sp : -0.7, ay = sp > 8 ? -p.vy / sp : 0.7;
      const tx = p.x + ax * 30 - ay * 16, ty = p.y + ay * 30 + ax * 16, far = Math.hypot(tx - d.x, ty - d.y);
      this.dogMove(dt, tx, ty, far > 70 ? P.speed * P.run : Math.max(P.speed * 0.7, sp));
      if (far > 600) { d.x = tx; d.y = ty; }   // left far behind (a gate, a long detour): catch up
      d.fetchT -= dt;
      if (d.fetchT <= 0 && room >= 1 && !this.won) {
        d.tgt = this.dogFind();
        if (d.tgt) { d.state = 'fetch'; d.fetchT = P.every; } else d.fetchT = 2;
      }
    } else if (d.state === 'fetch') {
      const g = d.tgt;
      if (g.f && g.f.g[g.i] < 1) { d.tgt = this.dogFind(); if (!d.tgt) { d.state = 'follow'; return; } }
      const dist = this.dogMove(dt, d.tgt.x, d.tgt.y, P.speed * P.run);
      if (dist < 12) {
        const t = d.tgt; let item = null, n = 0;
        if (t.f) {
          const f = t.f, cr = CFG.crops[f.item];
          n = Math.min(P.carry, cr.yield || 1); item = f.item;
          f.g[t.i] = 0; f.ripe--; f.cutAt[t.i] = this.t;
          this.emit('harvest', { x: t.x, y: t.y, n: 1, item, who: 'dog' });
        } else {
          for (let k = 0; k < P.carry; k++) { if (t.pl.take(d.x, d.y, 26) < 0) break; n++; }
          item = n ? t.pl.type : null;
        }
        d.carry = item; d.n = n; d.state = item ? 'return' : 'follow'; d.tgt = null;
      } else if (this.t > 0 && dist > P.range * 2.2) { d.state = 'follow'; d.tgt = null; }
    } else if (d.state === 'return') {
      const dist = this.dogMove(dt, p.x, p.y, P.speed * P.run);
      if (dist < 30) {
        const n = Math.min(d.n, Math.max(0, room));
        for (let k = 0; k < n; k++) { p.incoming++; this.launch(d.carry, 'stack', d.x, d.y, 10 + k * 6, p, 0, 0, 0, CFG.fly.pick); }
        if (n) { this.stats.collected[d.carry] = (this.stats.collected[d.carry] || 0) + n; d.fetched += n; this.emit('petFetch', { x: d.x, y: d.y, item: d.carry, n }); }
        d.carry = null; d.n = 0; d.state = 'follow';
      }
    }
  }

  // ---- save/restore of a level in progress ---------
  snapshot() {
    // A pause-save can happen while harvest, fishing, counter or processing items are
    // still in flight. Those animations are transient and aren't serialized, so settle
    // each one into its destination before capturing inventories to avoid losing cargo.
    if (this.fly.length) {
      const pending = this.fly.splice(0);
      for (const f of pending) if (f.active) this.landFly(f);
      this.flyFree.push(...pending);
    }
    return { li: this.li, t: this.t, money: this.money, stats: this.stats, env: { season: this.season, rain: this.rain },
             tiles: this.tiles.map((t) => ({ id: t.id, paid: t.paid, bought: t.bought })),
             stack: this.player.stack.slice(0, 600),
             counterIds: this.counters.map((c) => c.id), counterItems: this.counters.map((c) => c.items.slice()),
             cash: this.counters.map((c) => c.cash), stock: this.counters.map((c) => c.stock.slice(0, 300)),
             buf: this.procs.map((p) => p.buf), ponds: this.ponds.map((p) => p.caught) };
  }
  restore(s) {
    for (const ts of s.tiles || []) {
      const t = this.tiles.find((x) => x.id === ts.id); if (!t) continue;
      for (let k = 0; k < ts.bought && !t.done; k++) this.completeTile(t, true);
      t.paid = Math.min(ts.paid || 0, t.price - 1);
    }
    this.t = s.t || 0; this.money = s.money || 0;
    if (s.stats) this.stats = { collected: {}, sold: {}, produced: {}, golden: {}, earned: 0, unlocks: 0, ...s.stats };
    if (!this.stats.golden) this.stats.golden = {};
    if (Array.isArray(s.stack)) this.player.stack = s.stack.filter((x) => CFG.items[x]).slice(0, this.player.cap);
    // Counter inventories were historically saved by array position. As levels move to one
    // ordinary counter plus a separately unlocked processed counter, map each saved item by
    // its current destination so older saves keep both raw and processed stock.
    const oldIds = Array.isArray(s.counterIds) ? s.counterIds : [];
    const oldItems = Array.isArray(s.counterItems) ? s.counterItems : [];
    (s.cash || []).forEach((v, i) => {
      if (!v) return;
      const target = this.counters.find((c) => c.id === oldIds[i]) ||
        this.counters.find((c) => oldItems[i] && oldItems[i].some((it) => c.items.includes(it))) ||
        this.counters[0];
      if (target) target.cash += v;
    });
    for (let i = 0; i < (s.stock || []).length; i++) {
      const saved = s.stock[i]; if (!Array.isArray(saved)) continue;
      for (const item of saved) {
        if (!CFG.items[item]) continue;
        const target = this.counters.find((c) => c.id === oldIds[i] && c.items.includes(item)) ||
          this.counters.find((c) => c.items.includes(item));
        if (target && target.stock.length < CFG.counter.stockMax) { target.stock.push(item); target.everStocked = true; }
      }
    }
    (s.buf || []).forEach((v, i) => { if (this.procs[i]) this.procs[i].buf = v || 0; });
    (s.ponds || []).forEach((v, i) => { const pd = this.ponds[i]; if (!pd) return; pd.caught = v || 0; const L = CFG.pond.levels; while (pd.lv < L.length && pd.caught >= L[pd.lv].at) pd.setLevel(pd.lv + 1); if (!pd.hidden) pd.fill(1); });
    this.updateTileVis(true);
  }
}
