// Canvas renderer: 2.5D tilted top-down view. World (x,y) on the ground plane,
// z is height. Screen: X = (x-cam.x)*z + W/2, Y = (y-cam.y)*z*tilt + H/2 - height*z.
import { CFG } from './config.js';
import { Sprites, makeCanvas, COL } from './sprites.js';
import { person, GIRL, BOY, customerStyle, hen, bush, mower, cart, stall, machine } from './chars.js';
import { drawIcon } from './icons.js';

const TAU = Math.PI * 2;
export const FONT = (px, w = 900) => `${w} ${px}px system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
export function elastic(t) { if (t <= 0) return 0; if (t >= 1) return 1; return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * TAU / 0.3) + 1; }

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.sp = new Sprites();
    this.W = 1; this.H = 1; this.dpr = 1; this.z = 1;
    this.cam = { x: 0, y: 0 }; this.ox = 0; this.oy = 0;
    this.ground = null; this.groundDirty = true; this.world = null;
    this.T = CFG.view.tilt; this.time = 0;
    this.coinTarget = { x: 40, y: 30 };
  }
  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = Math.min(dpr || 1, CFG.view.dprCap);
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    this.z = Math.min(w, h * 0.62) / CFG.view.viewWidth;
    this.sp.setScale(this.z * this.dpr);
    this.groundDirty = true;
  }
  setWorld(w) { this.world = w; this.groundDirty = true; this.cam.x = w.player.x; this.cam.y = w.player.y; this.clampCam(); }
  camTarget() {
    const p = this.world.player;
    return { x: p.x, y: p.y - (this.H * 0.1) / (this.z * this.T) };
  }
  clampCam() {
    const w = this.world, hw = this.W / 2 / this.z, hh = this.H / 2 / (this.z * this.T);
    const pad = 30;
    if (w.W + pad * 2 <= hw * 2) this.cam.x = w.W / 2; else this.cam.x = Math.min(w.W + pad - hw, Math.max(hw - pad, this.cam.x));
    if (w.H + pad * 2 <= hh * 2) this.cam.y = w.H / 2; else this.cam.y = Math.min(w.H + pad - hh, Math.max(hh - pad - 40, this.cam.y));
  }
  follow(dt, snap) {
    const t = this.camTarget(), k = snap ? 1 : Math.min(1, dt * CFG.view.camLerp);
    this.cam.x += (t.x - this.cam.x) * k; this.cam.y += (t.y - this.cam.y) * k;
    this.clampCam();
  }
  X(x) { return (x - this.cam.x) * this.z + this.W / 2 + this.ox; }
  Y(y, h = 0) { return (y - this.cam.y) * this.z * this.T + this.H / 2 - h * this.z + this.oy; }

  // ---------------------------------------------------------------- ground
  buildGround() {
    const w = this.world, M = 180, T = this.T;
    const gs = this.z * Math.min(this.dpr, 1.5);
    const cw = (w.W + 2 * M) * gs, ch = (w.H + 2 * M) * T * gs;
    const c = makeCanvas(cw, ch), g = c.getContext('2d');
    const R = (seed) => hash(seed * 7919 + w.li * 131);
    // flat layer in world coordinates (squashed by tilt)
    g.save(); g.scale(gs, gs * T); g.translate(M, M);
    g.fillStyle = COL.grass; g.fillRect(-M, -M, w.W + 2 * M, w.H + 2 * M);
    for (let i = 0; i < 140; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(40,110,20,0.10)'; g.beginPath(); g.ellipse(-M + R(i) * (w.W + 2 * M), -M + R(i + 500) * (w.H + 2 * M), 20 + R(i + 900) * 50, 12 + R(i + 1300) * 30, 0, 0, TAU); g.fill(); }
    const A = { x: 14, y: 50, w: w.W - 28, h: w.H - 64 };
    g.fillStyle = COL.groundEdge; g.beginPath(); g.roundRect(A.x - 6, A.y - 4, A.w + 12, A.h + 14, 46); g.fill();
    const gr = g.createLinearGradient(0, A.y, 0, A.y + A.h); gr.addColorStop(0, '#F7CF62'); gr.addColorStop(1, '#F0B848');
    g.fillStyle = gr; g.beginPath(); g.roundRect(A.x, A.y, A.w, A.h, 40); g.fill();
    for (let i = 0; i < 380; i++) { g.fillStyle = i % 3 ? 'rgba(214,150,40,0.25)' : 'rgba(255,240,180,0.35)'; g.beginPath(); g.ellipse(A.x + 10 + R(i + 77) * (A.w - 20), A.y + 10 + R(i + 177) * (A.h - 20), 1.5 + R(i + 277) * 3, 1 + R(i + 377) * 2, 0, 0, TAU); g.fill(); }
    // occupied rects (to keep decoration off gameplay areas)
    const occ = [];
    for (const f of w.fields) occ.push([f.x - 30, f.y - 30, f.w + 60, f.h + 60]);
    for (const k of w.coops) occ.push([k.x - 50, k.y - 50, k.w + 100, k.h + 80]);
    for (const k of w.counters) occ.push([k.x - 110, k.y - 60, 300, 140]);
    for (const p of w.procs) occ.push([p.x - 110, p.y - 60, 220, 110]);
    for (const t of w.tiles) occ.push([t.x - 40, t.y - 40, 80, 80]);
    occ.push([w.L.start[0] - 40, w.L.start[1] - 40, 80, 80]);
    const free = (x, y, r) => x > A.x + r && x < A.x + A.w - r && y > A.y + r && y < A.y + A.h - r && !occ.some(([ox, oy, ow, oh]) => x + r > ox && x - r < ox + ow && y + r > oy && y - r < oy + oh);
    const patches = [];
    for (let i = 0; i < 60 && patches.length < 7; i++) {
      const x = A.x + R(i + 3000) * A.w, y = A.y + R(i + 3100) * A.h, r = 24 + R(i + 3200) * 26;
      if (free(x, y, r)) { patches.push([x, y, r]); }
    }
    for (const [x, y, r] of patches) {
      g.fillStyle = COL.grass2; g.beginPath(); g.ellipse(x, y + 3, r + 3, r * 0.8 + 3, 0, 0, TAU); g.fill();
      g.fillStyle = COL.grass; g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.fill();
    }
    // fields: tilled soil
    for (const f of w.fields) {
      if (f.hidden) continue;
      g.fillStyle = COL.soil2; g.beginPath(); g.roundRect(f.x - 9, f.y - 7, f.w + 18, f.h + 18, 14); g.fill();
      g.fillStyle = COL.soil; g.beginPath(); g.roundRect(f.x - 9, f.y - 9, f.w + 18, f.h + 16, 14); g.fill();
      g.strokeStyle = 'rgba(110,60,25,0.35)'; g.lineWidth = 3;
      for (let r = 0; r < f.rows; r++) { const y = f.y + (r + 0.5) * f.gap + 5; g.beginPath(); g.moveTo(f.x - 2, y); g.lineTo(f.x + f.w + 2, y); g.stroke(); }
    }
    // coop yards
    for (const k of w.coops) {
      if (k.hidden) continue;
      g.fillStyle = k.item === 'egg' ? '#FBE3A2' : '#E9D49A'; g.beginPath(); g.roundRect(k.x - 2, k.y - 6, k.w + 4, k.h + 8, 10); g.fill();
      g.fillStyle = 'rgba(200,140,50,0.18)'; for (let i = 0; i < 60; i++) { g.beginPath(); g.ellipse(k.x + R(i + 5000) * k.w, k.y + R(i + 5100) * k.h, 2 + R(i) * 3, 1.5, 0, 0, TAU); g.fill(); }
      if (k.producer === 'bush') { g.fillStyle = COL.soil; g.beginPath(); g.roundRect(k.x - 30, k.y - 34, k.w + 60, 26, 10); g.fill(); }
    }
    g.restore();
    // upright decoration (unsquashed)
    const P = (x, y) => [(x + M) * gs, (y + M) * T * gs];
    const tree = (x, y, s) => {
      const [px, py] = P(x, y); g.save(); g.translate(px, py); g.scale(gs * s, gs * s);
      g.fillStyle = 'rgba(60,90,20,0.25)'; g.beginPath(); g.ellipse(0, 0, 22, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#8E5627'; g.fillRect(-3.5, -18, 7, 18);
      for (const [cx, cy, r, col] of [[-10, -26, 13, '#3E9A2A'], [10, -26, 13, '#3E9A2A'], [0, -38, 16, '#4FB233'], [-6, -30, 11, '#5CC23D'], [7, -42, 8, '#7BD655']]) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); }
      g.restore();
    };
    const shrub = (x, y, s) => {
      const [px, py] = P(x, y); g.save(); g.translate(px, py); g.scale(gs * s, gs * s);
      g.fillStyle = 'rgba(60,90,20,0.25)'; g.beginPath(); g.ellipse(0, 0, 14, 5, 0, 0, TAU); g.fill();
      for (const [cx, cy, r, col] of [[-6, -7, 8, '#3E9A2A'], [6, -7, 8, '#3E9A2A'], [0, -11, 9, '#58BD3A'], [3, -14, 4, '#86DA5E']]) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); }
      if (s > 0.9) for (let i = 0; i < 4; i++) { g.fillStyle = ['#FF6FA8', '#FFFFFF', '#FFD23F'][i % 3]; g.beginPath(); g.arc(-8 + i * 5, -6 - (i % 2) * 6, 1.6, 0, TAU); g.fill(); }
      g.restore();
    };
    const tuft = (x, y) => {
      const [px, py] = P(x, y); g.save(); g.translate(px, py); g.scale(gs, gs);
      g.strokeStyle = COL.grassDark; g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-3, 0); g.lineTo(-4, -5); g.moveTo(0, 0); g.lineTo(0, -7); g.moveTo(3, 0); g.lineTo(4, -5); g.stroke(); g.restore();
    };
    const deco = [];
    for (let x = -M + 30; x < w.W + M; x += 46 + R(x) * 30) { deco.push([x, -M * 0.55 + R(x + 1) * 70, 0.9 + R(x + 2) * 0.4]); deco.push([x, w.H + 30 + R(x + 3) * 90, 0.9 + R(x + 4) * 0.4]); }
    for (let y = -40; y < w.H + 60; y += 50 + R(y) * 40) { deco.push([-M * 0.45 + R(y + 5) * 60, y, 0.9 + R(y + 6) * 0.4]); deco.push([w.W + 20 + R(y + 7) * 80, y, 0.9 + R(y + 8) * 0.4]); }
    deco.sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < 260; i++) { const x = -M + R(i + 7000) * (w.W + 2 * M), y = -M + R(i + 7100) * (w.H + 2 * M); if (x < A.x - 4 || x > A.x + A.w + 4 || y < A.y - 4 || y > A.y + A.h + 8) tuft(x, y); }
    for (const [x, y] of patches) { tuft(x - 8, y); tuft(x + 10, y + 6); shrub(x + 4, y - 4, 0.8); }
    for (const [x, y, s] of deco) (hash(Math.round(x * 13 + y)) > 0.45 ? tree : shrub)(x, y, s);
    this.ground = { img: c, M };
    this.groundDirty = false;
  }

  // -------------------------------------------------------------- helpers
  item(type, v, x, y, h) {
    const e = this.sp.item(type, v), z = this.z;
    this.g.drawImage(e.img, this.X(x) - e.w * z / 2, this.Y(y, h) - e.h * z / 2, e.w * z, e.h * z);
  }
  local(x, y, h, s = 1, flip = 1) { const g = this.g; g.save(); g.translate(this.X(x), this.Y(y, h)); g.scale(this.z * s * flip, this.z * s); return g; }
  label(text, x, y, px, fill = '#FFFFFF', stroke = '#5A3414', align = 'center') {
    const g = this.g; g.font = FONT(px); g.textAlign = align; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = Math.max(2.5, px * 0.28); g.strokeStyle = stroke; g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y);
  }
  stackTop(c) {
    const n = c.stack.length, step = n ? CFG.items[c.stack[n - 1]].step : 5;
    if (c.kind === 'player' && c.vehicle) return { x: c.x - c.face * 32, y: c.y, z: 22 + (n / 3) * step };
    if (c.kind === 'worker' && c.cart) return { x: c.x - c.face * 5, y: c.y, z: 18 + (n / 2) * step };
    return { x: c.x, y: c.y - 1, z: 46 + n * step };
  }

  // ----------------------------------------------------------------- frame
  draw(world, fx, guide, time, extra = {}) {
    this.time = time; this.world = world;
    if (this.groundDirty || !this.ground) this.buildGround();
    const g = this.g, z = this.z;
    [this.ox, this.oy] = fx ? fx.shakeOffset() : [0, 0];
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = COL.grass; g.fillRect(0, 0, this.W, this.H);
    const G = this.ground, M = G.M;
    g.imageSmoothingEnabled = true;
    g.drawImage(G.img, this.X(-M), this.Y(-M), (world.W + 2 * M) * z, (world.H + 2 * M) * this.T * z);

    // flat things
    for (const pl of world.piles) if (!pl.owner.hidden) this.pileShadow(pl);
    for (const c of world.counters) if (!c.hidden) this.zone(c.zone, c.item, 'in', c.appearT);
    for (const p of world.procs) if (!p.hidden) { this.zone(p.inZone, p.inItem, 'in', p.appearT); this.zone(p.outZone, p.outItem, 'out', p.appearT); }
    for (const t of world.tiles) if (t.visible) this.tile(t, world);

    // depth-sorted things
    const D = [];
    const vis = (y) => { const sy = this.Y(y); return sy > -120 && sy < this.H + 400; };
    for (const f of world.fields) if (!f.hidden) for (const p of f.plants) if (vis(p.y)) D.push([p.y, 1, p, f]);
    for (const k of world.coops) if (!k.hidden) {
      D.push([k.y - 38, 3, k, 0]);
      for (let y = k.y - 10; y < k.y + k.h; y += 24) { const y1 = Math.min(k.y + k.h, y + 24); D.push([y1, 4, k, y]); }
      for (let i = 0; i < k.n; i++) D.push([k.hens[i].y, 2, k, i]);
    }
    for (const pl of world.piles) if (!pl.owner.hidden) for (let r = 0; r < pl.rows; r++) { const y = pl.y + (r + 1) * pl.ch; if (vis(y)) D.push([y - 0.5, 5, pl, r]); }
    for (const c of world.counters) if (!c.hidden) { D.push([c.y, 6, c, 0]); D.push([c.cashPos.y, 8, c, 0]); }
    for (const p of world.procs) if (!p.hidden) { D.push([p.y, 7, p, 0]); D.push([p.outZone.cy + 4, 9, p, 0]); }
    for (const cu of world.customers) D.push([cu.y, 10, cu, 0]);
    for (const w of world.workers) D.push([w.y, 11, w, 0]);
    D.push([world.player.y, 12, world.player, 0]);
    D.sort((a, b) => a[0] - b[0]);
    for (const d of D) {
      switch (d[1]) {
        case 1: this.plant(d[2], d[3]); break;
        case 2: this.henAt(d[2], d[3]); break;
        case 3: this.fenceTop(d[2]); break;
        case 4: this.fenceSide(d[2], d[3]); break;
        case 5: this.pileRow(d[2], d[3]); break;
        case 6: this.counter(d[2]); break;
        case 7: this.proc(d[2]); break;
        case 8: this.cashPile(d[2], world); break;
        case 9: this.outPad(d[2]); break;
        case 10: this.customer(d[2]); break;
        case 11: this.collector(d[2]); break;
        case 12: this.collector(d[2]); break;
      }
    }
    // stacks on top so tall towers read clearly
    for (const w of world.workers) this.stack(w);
    this.stack(world.player, true);
    // flying items
    for (const f of world.fly) this.flyItem(f, world);
    if (fx) this.fxWorld(fx);
    if (guide) this.arrow(guide);
    if (fx) this.fxScreen(fx);
    if (extra.hand) this.hand(time);
  }

  // ----------------------------------------------------------- pieces
  pileShadow(pl) {
    const g = this.g, z = this.z, T = this.T;
    g.fillStyle = 'rgba(150,95,30,0.20)';
    g.beginPath();
    const C = pl.cols, hs = pl.hs;
    for (let r = 0; r < pl.rows; r++) {
      let run = -1;
      for (let c = 0; c <= C; c++) {
        const on = c < C && hs[r * C + c] > 0;
        if (on && run < 0) run = c;
        if (!on && run >= 0) { const x0 = this.X(pl.x + run * pl.cw - 2), y0 = this.Y(pl.y + r * pl.ch); g.rect(x0, y0, (c - run) * pl.cw * z + 4 * z, pl.ch * z * T + 1); run = -1; }
      }
    }
    g.fill();
  }
  pileRow(pl, r) {
    const C = pl.cols, hs = pl.hs, L = CFG.pile.layer, type = pl.type, sp = this.sp, z = this.z, g = this.g;
    const e = [sp.item(type, 1), sp.item(type, 2), sp.item(type, 3), sp.item(type, 4)];
    const es = [sp.item(type, 1, 1), sp.item(type, 2, 1), sp.item(type, 3, 1), sp.item(type, 4, 1)];
    const ew = e[0].w * z, eh = e[0].h * z;
    const camx = this.cam.x, camy = this.cam.y, ZT = z * this.T, W2 = this.W / 2 + this.ox, H2 = this.H / 2 + this.oy;
    const last = r === pl.rows - 1;
    const rowY = pl.y + (r + 0.5) * pl.ch;
    for (let c = 0; c < C; c++) {
      const i = r * C + c, h = hs[i]; if (!h) continue;
      const hf = last ? 0 : hs[i + C];
      let k0 = Math.max(0, hf - 2); if (k0 > h - 1) k0 = h - 1;
      const cx = pl.x + (c + 0.5) * pl.cw, b = pl.bump[i];
      const sx0 = (cx - camx) * z + W2;
      if (sx0 < -20 || sx0 > this.W + 20) continue;
      for (let k = k0; k < h; k++) {
        const hv = hash(i * 64 + k), jx = (hv - 0.5) * pl.cw * 0.8, jy = (hash(i * 64 + k + 31) - 0.5) * pl.ch * 0.6;
        const hz = k * L + 2.5 + (k === h - 1 ? b * 3 : 0);
        const sx = sx0 + jx * z, sy = (rowY + jy - camy) * ZT + H2 - hz * z;
        g.drawImage((k < h - 1 ? es : e)[(hv * 4) | 0].img, sx - ew / 2, sy - eh / 2, ew, eh);
      }
    }
  }
  plant(p, f) {
    const g = this.local(p.x, p.y, 0, 1);
    const t = this.time, sw = Math.sin(t * 2 + p.ph) * 1.2;
    if (f.crop === 'wheat') {
      if (p.g < 1) {
        const s = 0.35 + p.g * 0.65;
        g.fillStyle = COL.leaf; g.strokeStyle = COL.leafDark; g.lineWidth = 0.8;
        for (const a of [-0.6, 0, 0.6]) { g.save(); g.rotate(a + sw * 0.03); g.beginPath(); g.ellipse(0, -5 * s, 1.6, 5 * s, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
      } else {
        const s = 1 + p.pop * 0.35 * Math.sin(p.pop * 9);
        g.scale(s, s);
        g.fillStyle = COL.shadow; g.beginPath(); g.ellipse(0, 0, 8, 3, 0, 0, TAU); g.fill();
        for (let i = -2; i <= 2; i++) {
          const x = i * 2.6, top = -15 - Math.abs(i) * -1.5 + (i % 2) * 1.5, bend = sw + i * 0.8;
          g.strokeStyle = '#C9962A'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x * 0.5, 0); g.quadraticCurveTo(x, top * 0.5, x + bend, top); g.stroke();
          g.fillStyle = i % 2 ? COL.wheat : '#FFE27E'; g.strokeStyle = COL.wheatDark; g.lineWidth = 0.7;
          g.beginPath(); g.ellipse(x + bend, top - 3, 1.9, 4.2, bend * 0.05, 0, TAU); g.fill(); g.stroke();
        }
      }
    } else {
      // potato plant
      const s = p.g < 1 ? 0.35 + p.g * 0.5 : 1 + p.pop * 0.3 * Math.sin(p.pop * 9);
      g.scale(s, s);
      g.fillStyle = COL.soil2; g.beginPath(); g.ellipse(0, -1, 9, 3.4, 0, 0, TAU); g.fill();
      g.strokeStyle = COL.leafDark; g.lineWidth = 0.9;
      for (const [x, y, r] of [[-5, -6, 4.6], [5, -6, 4.6], [0, -10, 5.4], [-2, -4, 4], [3, -4, 4]]) {
        g.fillStyle = p.g < 1 ? '#7FD05A' : '#58B83A'; g.beginPath(); g.ellipse(x + sw * 0.4, y, r, r * 0.8, 0, 0, TAU); g.fill(); g.stroke();
      }
      if (p.g >= 1) for (const [x, y] of [[-3, -12], [3, -11], [0, -14]]) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x + sw * 0.4, y, 1.5, 0, TAU); g.fill(); g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(x + sw * 0.4, y, 0.6, 0, TAU); g.fill(); }
    }
    g.restore();
  }
  henAt(k, i) {
    const h = k.hens[i], t = this.time;
    const a = elastic((t - h.appearT) / 0.6); if (a <= 0) return;
    const flip = h.side === 0 ? (i % 2 ? -1 : 1) : (h.side < 0 ? 1 : -1);
    const lift = k.producer === 'bush' || h.side !== 0 ? 0 : 16;
    const g = this.local(h.x, h.y, lift, a * 1.25, flip);
    if (k.producer === 'bush') bush(g, t, h.lay, i, 6); else hen(g, t, h.lay, i);
    g.restore();
  }
  fenceSeg(x0, y0, x1, y1) {
    const g = this.g, z = this.z;
    const ax = this.X(x0), ay = this.Y(y0), bx = this.X(x1), by = this.Y(y1);
    // rails
    for (const hh of [6, 12]) {
      g.fillStyle = COL.fence; g.strokeStyle = COL.fenceDark; g.lineWidth = Math.max(1, z * 0.9);
      g.beginPath(); g.moveTo(ax, ay - hh * z); g.lineTo(bx, by - hh * z); g.lineTo(bx, by - (hh + 3.4) * z); g.lineTo(ax, ay - (hh + 3.4) * z); g.closePath(); g.fill(); g.stroke();
    }
    for (const [px, py] of [[ax, ay], [bx, by]]) {
      g.fillStyle = COL.fence; g.beginPath(); g.roundRect(px - 2.4 * z, py - 18 * z, 4.8 * z, 18 * z, 1.5 * z); g.fill(); g.stroke();
      g.fillStyle = COL.fenceLight; g.fillRect(px - 1.6 * z, py - 17 * z, 1.4 * z, 14 * z);
    }
  }
  fenceTop(k) {
    const y = k.y - 38;
    for (let x = k.x - 8; x < k.x + k.w + 8; x += 30) this.fenceSeg(x, y, Math.min(x + 30, k.x + k.w + 8), y);
    if (k.producer !== 'hen') return;
    // raised nesting shelf so hens sit above the pile
    const g = this.g, z = this.z, x0 = this.X(k.x - 4), x1 = this.X(k.x + k.w + 4), yb = this.Y(k.y - 22), yt = this.Y(k.y - 22, 16);
    g.fillStyle = '#B5562A'; g.strokeStyle = COL.outline; g.lineWidth = 1.2 * z;
    g.beginPath(); g.roundRect(x0, yt, x1 - x0, yb - yt + 2 * z, 3 * z); g.fill(); g.stroke();
    g.fillStyle = '#D9773F'; g.beginPath(); g.roundRect(x0, yt - 5 * z, x1 - x0, 7 * z, 3 * z); g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = k.x + 20; x < k.x + k.w; x += 36) g.fillRect(this.X(x), yt + 3 * z, 2 * z, yb - yt - 3 * z);
  }
  fenceSide(k, y) {
    const y1 = Math.min(k.y + k.h, y + 24);
    this.fenceSeg(k.x - 6, y, k.x - 6, y1); this.fenceSeg(k.x + k.w + 6, y, k.x + k.w + 6, y1);
  }
  zone(z0, item, dir, appearT) {
    const g = this.g, z = this.z, a = elastic((this.time - appearT) / 0.6); if (a <= 0) return;
    const cx = this.X(z0.cx), cy = this.Y(z0.cy), w = z0.w * z * a, h = z0.h * z * this.T * a;
    g.fillStyle = dir === 'in' ? 'rgba(255,255,255,0.32)' : 'rgba(120,220,255,0.30)';
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 2.5 * z;
    g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, 8 * z); g.fill(); g.stroke();
    const l = this.local(z0.cx, z0.cy, 0, 0.75 * a); l.globalAlpha = 0.75; drawIcon(l, item, this.time); l.restore();
    // little arrow pointing into / out of the zone
    const bob = Math.sin(this.time * 5) * 2 * z;
    g.fillStyle = '#FFFFFF'; g.beginPath();
    const ay = cy + h / 2 + 2 * z + (dir === 'in' ? bob : -bob);
    g.moveTo(cx - 5 * z, ay); g.lineTo(cx + 5 * z, ay); g.lineTo(cx, ay + (dir === 'in' ? -5 : 5) * z); g.closePath(); g.fill();
  }
  tile(t, world) {
    const g = this.g, z = this.z, S = CFG.tile.size;
    const a = elastic((this.time - t.appearT) / 0.6); if (a <= 0) return;
    const afford = world.money >= t.price - t.paid;
    const pulse = afford ? 1 + Math.sin(this.time * 6) * 0.04 : 1;
    const cx = this.X(t.x), cy = this.Y(t.y), w = S * z * a * pulse, h = S * z * this.T * a * pulse;
    g.fillStyle = 'rgba(90,52,20,0.22)'; g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, 9 * z); g.fill();
    const f = t.paid / t.price;
    if (f > 0) { g.save(); g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, 9 * z); g.clip(); g.fillStyle = 'rgba(76,208,90,0.75)'; g.fillRect(cx - w / 2, cy + h / 2 - h * f, w, h * f); g.restore(); }
    g.setLineDash([7 * z, 5 * z]); g.lineDashOffset = -this.time * 20 * z;
    g.strokeStyle = afford ? '#FFF27A' : '#FFFFFF'; g.lineWidth = 3 * z;
    g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, 9 * z); g.stroke(); g.setLineDash([]);
    // icon (lifted, bobbing)
    const bob = Math.sin(this.time * 3 + t.order) * 1.5;
    const l = this.local(t.x, t.y - 4, 12 + bob, 0.95 * a); drawIcon(l, t.icon, this.time); l.restore();
    // label + price
    const lab = t.buy ? `${t.label} +${t.buy}` : t.label;
    this.label(lab, cx, cy - h / 2 - 11 * z, 10.5 * z * a);
    const rem = Math.ceil(t.price - t.paid);
    const py = cy + h / 2 - 7 * z * a;
    const txt = `${rem}`;
    g.font = FONT(11 * z * a); const tw = g.measureText(txt).width;
    const bl = this.sp.item('bill', 0), bw = bl.w * z * 0.9 * a, bh = bl.h * z * 0.9 * a;
    const total = bw + 3 * z + tw;
    g.drawImage(bl.img, cx - total / 2, py - bh / 2, bw, bh);
    this.label(txt, cx - total / 2 + bw + 3 * z, py, 11 * z * a, afford ? '#FFF27A' : '#FFFFFF', '#3A6B1E', 'left');
  }
  counter(c) {
    const t = this.time, a = elastic((t - c.appearT) / 0.6); if (a <= 0) return;
    const g = this.local(c.x, c.y, 0, a);
    stall(g, t, c.item, c.bumpT, c.f);
    g.restore();
    // stock on the table
    const n = Math.min(c.stock, 36), step = CFG.items[c.item].step;
    for (let k = 0; k < n; k++) {
      const col = k % 9, lay = (k / 9) | 0;
      this.item(c.item, 1 + (k % 4), c.x - 32 + col * 8 + (lay % 2) * 3, c.y + 2 - (lay % 2) * 4, 28 + lay * step * 0.7);
    }
    // sign board above the awning
    const sx = this.X(c.x), sy = this.Y(c.y, 78 * a), z = this.z;
    const G = this.g;
    G.fillStyle = '#FFF6DE'; G.strokeStyle = COL.outline; G.lineWidth = 1.6 * z;
    G.beginPath(); G.roundRect(sx - 22 * z, sy - 10 * z, 44 * z, 20 * z, 6 * z); G.fill(); G.stroke();
    const l = this.local(c.x - 9, c.y, 78 * a + 0.5, 0.62); drawIcon(l, c.item, t); l.restore();
    this.label(`$${c.price}`, sx + 8 * z, sy, 10 * z, '#3BAA3F', '#FFFFFF');
    if (c.cashier) { const l2 = this.local(c.x + c.f * 30, c.y - 14, 0, 0.9, -c.f); person(l2, t, 0, false, { shirt: '#4CD08A', hair: '#3A2210', seed: 3 }); l2.restore(); }
  }
  proc(p) {
    const t = this.time, a = elastic((t - p.appearT) / 0.6); if (a <= 0) return;
    const g = this.local(p.x, p.y, 0, a);
    machine(g, t, p.work, p.outItem);
    g.restore();
    const l = this.local(p.x - 17, p.y, 27, 0.7 * a); drawIcon(l, p.outItem, t); l.restore();
    if (p.buf > 0) {
      const z = this.z, sx = this.X(p.x - 33), sy = this.Y(p.y, 62);
      this.g.fillStyle = '#FFFFFF'; this.g.beginPath(); this.g.roundRect(sx - 12 * z, sy - 7 * z, 24 * z, 14 * z, 7 * z); this.g.fill();
      this.label(`${p.buf}`, sx, sy, 9 * z, '#5A3414', '#FFFFFF');
    }
  }
  outPad(p) {
    const n = Math.min(p.out, 72), step = CFG.items[p.outItem].step;
    for (let k = 0; k < n; k++) {
      const slot = k % 9, lay = (k / 9) | 0;
      this.item(p.outItem, 0, p.outZone.cx + ((slot % 3) - 1) * 13, p.outZone.cy + (((slot / 3) | 0) - 1) * 10, 3 + lay * step * 0.8);
    }
  }
  cashPile(c, world) {
    if (c.cash <= 0.01) return;
    const bv = world.L.bill || 5;
    const n = Math.min(54, Math.ceil(c.cash / bv));
    for (let k = 0; k < n; k++) {
      const s = k % 6, lay = (k / 6) | 0;
      this.item('bill', 1 + ((s + lay) % 4 === 0 ? 1 : 2) + (s % 2), c.cashPos.x + ((s % 3) - 1) * 13, c.cashPos.y + (((s / 3) | 0) - 0.5) * 10, 1 + lay * 2.4);
    }
  }
  customer(cu) {
    const g = this.local(cu.x, cu.y, 0, 1.1, cu.face);
    person(g, this.time, cu.walk, cu.moving, { ...customerStyle(cu.hue), carry: cu.got > 0 });
    g.restore();
    const n = Math.min(cu.got, 10), step = CFG.items[cu.item].step;
    for (let k = 0; k < n; k++) this.item(cu.item, 0, cu.x, cu.y - 1, 42 + k * step);
  }
  collector(c) {
    const t = this.time;
    const app = c.appearT !== undefined ? elastic((t - c.appearT) / 0.6) : 1;
    if (app <= 0) return;
    const g = this.local(c.x, c.y, 0, app * 1.2, c.face);
    const back = c.moving && c.dirY < -Math.abs(c.vx) * 1.2;
    if (c.kind === 'player') {
      if (c.vehicle) mower(g, t, c.moving, c.walk);
      else person(g, t, c.walk, c.moving, { ...GIRL, back, carry: c.stack.length + c.incoming > 0 });
    } else {
      if (c.cart) cart(g, t, c.moving, c.walk);
      else person(g, t, c.walk, c.moving, { ...BOY, back, carry: c.stack.length > 0 });
    }
    g.restore();
  }
  stack(c, isPlayer) {
    const n = c.stack.length; if (!n && !isPlayer) return;
    const z = this.z, t = this.time, cull = -CFG.view.stackCull;
    let cols = 1, bx = c.x, bz = 46, spread = 0;
    if (c.kind === 'player' && c.vehicle) { cols = 3; bx = c.x - c.face * 32; bz = 22; spread = 8; }
    else if (c.kind === 'worker' && c.cart) { cols = 2; bx = c.x - c.face * 5; bz = 18; spread = 7; }
    else if (c.moving) bz = 46 - Math.abs(Math.sin(c.walk)) * 2.6;
    const hts = [0, 0, 0];
    let topY = this.H, topX = this.X(bx);
    const g = this.g;
    for (let i = 0; i < n; i++) {
      const col = i % cols, type = c.stack[i], step = CFG.items[type].step;
      const h = hts[col]; hts[col] += step;
      const lift = h;
      const sway = c.sway * Math.pow(lift, 1.3) * 0.07 + Math.sin(t * 2.4 + lift * 0.02) * lift * 0.012;
      const x = bx + (col - (cols - 1) / 2) * spread + sway;
      const sy = this.Y(c.y - 1, bz + lift);
      if (sy < cull) { if (sy < topY) { topY = sy; topX = this.X(x); } continue; }
      const e = this.sp.item(type, i % 3 === 0 ? 0 : 1 + (i % 4));
      g.drawImage(e.img, this.X(x) - e.w * z / 2, sy - e.h * z / 2, e.w * z, e.h * z);
      if (sy < topY) { topY = sy; topX = this.X(x); }
    }
    if (n > 0 && (isPlayer || n >= 5)) {
      const full = c.stack.length + c.incoming >= c.cap;
      const ly = Math.max(isPlayer ? 96 : 70, topY - 16 * z);
      const txt = full ? 'MAX' : `${n}`;
      const px = (isPlayer ? 13 : 9) * z;
      g.font = FONT(px); const tw = g.measureText(txt).width;
      g.fillStyle = full ? '#FF4D3A' : 'rgba(40,24,8,0.55)';
      g.beginPath(); g.roundRect(topX - tw / 2 - 6 * z, ly - px * 0.7, tw + 12 * z, px * 1.4, px * 0.7); g.fill();
      this.label(txt, topX, ly, px, '#FFFFFF', full ? '#9E1B10' : '#2A1708');
    }
  }
  flyItem(f, world) {
    const p = Math.min(1, f.t / f.dur), e = p * p * (3 - 2 * p);
    let tx = f.tx, ty = f.ty, tz = f.tz;
    if (f.kind === 'stack') { const s = this.stackTop(f.ref); tx = s.x; ty = s.y; tz = s.z; }
    else if (f.kind === 'cust') { tx = f.ref.x; ty = f.ref.y; tz = 42 + f.ref.got * 4; }
    const x = f.x0 + (tx - f.x0) * e, y = f.y0 + (ty - f.y0) * e;
    const arc = f.kind === 'pile' ? 26 : 34;
    const h = f.z0 + (tz - f.z0) * e + arc * 4 * p * (1 - p);
    this.item(f.type, f.kind === 'pile' ? 1 + ((f.t * 10) | 0) % 4 : 0, x, y, h);
  }
  fxWorld(fx) {
    const g = this.g, z = this.z;
    for (const o of fx.p) if (o.on) {
      const a = Math.min(1, o.life / o.max * 2);
      const sx = this.X(o.x), sy = this.Y(o.y, o.z);
      if (o.type === 'ring') {
        const k = 1 - o.life / o.max;
        g.strokeStyle = o.color; g.globalAlpha = 1 - k; g.lineWidth = 4 * z * (1 - k) + 1;
        g.beginPath(); g.ellipse(sx, sy, o.size * z * (0.3 + k), o.size * z * this.T * (0.3 + k), 0, 0, TAU); g.stroke(); g.globalAlpha = 1; continue;
      }
      g.globalAlpha = a; g.fillStyle = o.color;
      if (o.type === 'leaf' || o.type === 'conf') { g.save(); g.translate(sx, sy); g.rotate(o.rot); g.fillRect(-o.size * z, -o.size * z * 0.45, o.size * 2 * z, o.size * 0.9 * z); g.restore(); }
      else if (o.type === 'star') { g.save(); g.translate(sx, sy); g.rotate(o.rot); g.beginPath(); for (let i = 0; i < 8; i++) { const r = (i % 2 ? 0.4 : 1) * o.size * z; g.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } g.closePath(); g.fill(); g.restore(); }
      else { g.beginPath(); g.arc(sx, sy, o.size * z, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    }
    for (const o of fx.wbills) if (o.on && o.t >= 0) {
      const p = o.t / o.dur, x = o.x0 + (o.x1 - o.x0) * p, y = o.y0 + (o.y1 - o.y0) * p, h = 20 + 30 * 4 * p * (1 - p);
      this.item('bill', 1 + ((o.rot * 2) | 0) % 4, x, y, h);
    }
    for (const o of fx.txt) if (o.on) {
      const k = o.life / o.max, sx = this.X(o.x), sy = this.Y(o.y, o.z);
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      g.globalAlpha = Math.min(1, k * 3);
      this.label(o.s, sx, sy, (o.big ? 20 : 13) * z * pop, o.color, '#3A2210');
      g.globalAlpha = 1;
    }
  }
  fxScreen(fx) {
    const g = this.g, z = this.z;
    const bl = this.sp.item('bill', 0);
    for (const o of fx.bills) if (o.on && o.t >= 0) {
      const p = o.t / o.dur, e = p * p;
      const x = o.x0 + (o.tx - o.x0) * e + o.cx * Math.sin(p * Math.PI) * 0.5, y = o.y0 + (o.ty - o.y0) * e - Math.sin(p * Math.PI) * 40;
      g.save(); g.translate(x, y); g.rotate(o.rot + p * 6); const s = 1.3 - p * 0.5; g.drawImage(bl.img, -bl.w * z * s / 2, -bl.h * z * s / 2, bl.w * z * s, bl.h * z * s); g.restore();
    }
    for (const o of fx.conf) if (o.on) {
      g.save(); g.translate(o.x, o.y); g.rotate(o.rot); g.scale(1, Math.abs(Math.cos(o.rot * 1.7)) * 0.8 + 0.2);
      g.globalAlpha = Math.min(1, o.life); g.fillStyle = o.c; g.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); g.restore();
    }
    g.globalAlpha = 1;
    if (fx.flash > 0) { g.fillStyle = `rgba(255,255,230,${fx.flash * 0.35})`; g.fillRect(0, 0, this.W, this.H); }
  }
  arrow(tg) {
    const g = this.g, z = this.z, bob = Math.abs(Math.sin(this.time * 5)) * 9;
    let sx = this.X(tg.x), sy = this.Y(tg.y, 46 + bob);
    const mL = 34, mR = this.W - 34, mT = 120, mB = this.H - 60;
    let ang = Math.PI / 2;
    const off = sx < mL || sx > mR || sy < mT || sy > mB;
    if (off) {
      const px = this.X(this.world.player.x), py = this.Y(this.world.player.y, 20);
      const dx = sx - px, dy = sy - py; ang = Math.atan2(dy, dx);
      // clamp along the ray to the margin rect
      let k = 1;
      if (sx < mL) k = Math.min(k, (mL - px) / (sx - px)); if (sx > mR) k = Math.min(k, (mR - px) / (sx - px));
      if (sy < mT) k = Math.min(k, (mT - py) / (sy - py)); if (sy > mB) k = Math.min(k, (mB - py) / (sy - py));
      sx = px + dx * k; sy = py + dy * k;
      const pulse = 1 + Math.sin(this.time * 8) * 0.08;
      g.save(); g.translate(sx, sy); g.rotate(ang); g.scale(pulse, pulse);
    } else { g.save(); g.translate(sx, sy); g.rotate(ang); }
    const s = z * 1.1;
    g.beginPath();
    g.moveTo(14 * s, 0); g.lineTo(-2 * s, -12 * s); g.lineTo(-2 * s, -5 * s); g.lineTo(-14 * s, -5 * s); g.lineTo(-14 * s, 5 * s); g.lineTo(-2 * s, 5 * s); g.lineTo(-2 * s, 12 * s); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 6 * s; g.strokeStyle = '#FFFFFF'; g.stroke();
    const gr = g.createLinearGradient(0, -12 * s, 0, 12 * s); gr.addColorStop(0, '#6CC6FF'); gr.addColorStop(1, '#1E7FE0');
    g.fillStyle = gr; g.fill(); g.lineWidth = 1.5 * s; g.strokeStyle = '#155BA8'; g.stroke();
    g.restore();
  }
  hand(t) {
    // tutorial: a white cartoon hand drags in a little circle near the bottom
    const g = this.g, z = Math.max(1, this.z);
    const cx = this.W / 2 + Math.cos(t * 2.4) * 34 * z, cy = this.H * 0.78 + Math.sin(t * 2.4) * 18 * z;
    g.globalAlpha = 0.5; g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(this.W / 2, this.H * 0.78, 34 * z, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.save(); g.translate(cx, cy); g.scale(z, z); g.rotate(-0.35);
    g.fillStyle = '#FFFFFF'; g.strokeStyle = '#3A2210'; g.lineWidth = 2.2; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-4, 0); g.lineTo(-4, -22); g.quadraticCurveTo(0, -27, 4, -22); g.lineTo(4, -8);
    g.quadraticCurveTo(8, -12, 11, -8); g.quadraticCurveTo(15, -11, 17, -6); g.quadraticCurveTo(21, -8, 22, -2);
    g.lineTo(21, 12); g.quadraticCurveTo(18, 22, 6, 22); g.lineTo(-2, 22); g.quadraticCurveTo(-10, 18, -13, 6); g.lineTo(-15, -2); g.quadraticCurveTo(-12, -6, -6, 0); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
}
