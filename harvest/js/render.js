// Canvas renderer: isometric (2:1) camera that follows the player.
// World (x,y) is the ground plane, h is height. Screen:
//   X = ((x-cx) - (y-cy)) * IX * z + W/2
//   Y = ((x-cx) + (y-cy)) * IY * z + H/2 - h * z
// The flat ground (lawn, paths, beds, far walls) is pre-rendered once per level; everything
// upright is depth-sorted by x+y. Dense fields are drawn one diagonal at a time (constant depth).
import { CFG } from './config.js';
import { Sprites, makeCanvas, COL, plantStage } from './sprites.js';
import { person, HERO, BOY, customerStyle, hen, bush, mower, cart } from './chars.js';
import { drawIcon } from './icons.js';

const TAU = Math.PI * 2;
export const IX = 0.7071, IY = 0.3536;
export const FONT = (px, w = 900) => `${w} ${px}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Micro Hei", system-ui, -apple-system, sans-serif`;
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
export function elastic(t) { if (t <= 0) return 0; if (t >= 1) return 1; return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * TAU / 0.3) + 1; }
const PROC_COL = { bouquet: ['#FFE16B', '#E8B21E', '#C08A10'], basket: ['#F2C08A', '#C98A4B', '#9C6331'], perfume: ['#FFB8D8', '#E86AA6', '#B83E7C'],
                   crate: ['#F0C48A', '#C98A4B', '#9C6331'], ketchup: ['#FF8A6E', '#E8452C', '#B02A1A'] };

// ---- iso drawing helpers. `pr` = { g, P(x,y,h)->[sx,sy], s: px per unit } -------------------
function quad(g, a, b, c, d, fill) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fillStyle = fill; g.fill(); }
// box: world rect [x,x+w]×[y,y+d], heights z0..z0+h. Draws the two camera-facing sides (+y, +x) and the top.
function box(pr, x, y, w, d, h, z0, top, south, east) {
  const P = pr.P, g = pr.g, z1 = z0 + h;
  quad(g, P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x, y + d, z1), south);
  quad(g, P(x + w, y + d, z0), P(x + w, y, z0), P(x + w, y, z1), P(x + w, y + d, z1), east);
  quad(g, P(x, y, z1), P(x + w, y, z1), P(x + w, y + d, z1), P(x, y + d, z1), top);
}
function flatRect(pr, x, y, w, d, fill, z = 0) { const P = pr.P; quad(pr.g, P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z), fill); }
function flatShadow(pr, x, y, rx, a = 0.22) { const [sx, sy] = pr.P(x, y, 0); const g = pr.g; g.fillStyle = `rgba(30,60,15,${a})`; g.beginPath(); g.ellipse(sx, sy, rx * pr.s, rx * pr.s * 0.5, 0, 0, TAU); g.fill(); }

// low stone balustrade along one axis (vertical: along y). from a to b.
function stoneWall(pr, x0, y0, x1, y1, pillarA, pillarB) {
  const alongX = y0 === y1, L = alongX ? x1 - x0 : y1 - y0, T = 9;
  const bx = (t, w) => alongX ? [x0 + t, y0 - T / 2, w, T] : [x0 - T / 2, y0 + t, T, w];
  { const [x, y, w, d] = bx(0, L); box(pr, x, y, w, d, 5, 0, '#DCD2BC', '#BFB295', '#A89A7E'); }
  for (let t = 4; t < L - 2; t += 6.5) { const [x, y, w, d] = alongX ? [x0 + t, y0 - 1.6, 3, 3.2] : [x0 - 1.6, y0 + t, 3.2, 3]; box(pr, x, y, w, d, 8, 5, '#EFE7D4', '#D6CAAE', '#BCAE90'); }
  { const [x, y, w, d] = bx(-1, L + 2); box(pr, x - (alongX ? 0 : 1), y - (alongX ? 1 : 0), w + (alongX ? 0 : 2), d + (alongX ? 2 : 0), 4, 13, '#F4EEDF', '#D9CDB2', '#C1B394'); }
  if (pillarA) pillar(pr, x0, y0, 24);
  if (pillarB) pillar(pr, x1, y1, 24);
}
function pillar(pr, x, y, h) {
  box(pr, x - 8, y - 8, 16, 16, h, 0, '#EFE7D4', '#D3C6A8', '#B5A687');
  box(pr, x - 9.5, y - 9.5, 19, 19, 3.5, h, '#F8F3E8', '#DDD1B6', '#C4B697');
  box(pr, x - 5, y - 5, 10, 10, 3, h + 3.5, '#F8F3E8', '#DDD1B6', '#C4B697');
}
// wooden farm fence
function woodFence(pr, x0, y0, x1, y1, posts = true) {
  const alongX = y0 === y1, L = alongX ? x1 - x0 : y1 - y0;
  for (const hh of [5.5, 11]) { if (alongX) box(pr, x0, y0 - 1, L, 2, 2.6, hh, '#F0C890', '#C9925A', '#A9733F'); else box(pr, x0 - 1, y0, 2, L, 2.6, hh, '#F0C890', '#C9925A', '#A9733F'); }
  if (posts) for (let t = 0; t <= L + 0.1; t += 15) { const x = alongX ? x0 + t : x0, y = alongX ? y0 : y0 + t; box(pr, x - 1.8, y - 1.8, 3.6, 3.6, 16, 0, '#F7D7A8', '#D69C62', '#B57A42'); }
}
function ironGate(pr, x0, y0, x1, y1, open, t = 0) {
  const g = pr.g, P = pr.P; g.strokeStyle = '#3E4048'; g.lineWidth = Math.max(1, 1.2 * pr.s); g.lineCap = 'round';
  const leaf = (ax, ay, bx, by) => {
    const n = 6;
    for (let i = 0; i <= n; i++) { const u = i / n; const x = ax + (bx - ax) * u, y = ay + (by - ay) * u; const top = 24 + Math.sin(u * Math.PI) * 5; const a = P(x, y, 0), b = P(x, y, top); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    for (const hh of [3, 14]) { const a = P(ax, ay, hh), b = P(bx, by, hh); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    g.beginPath(); for (let i = 0; i <= 10; i++) { const u = i / 10; const p = P(ax + (bx - ax) * u, ay + (by - ay) * u, 24 + Math.sin(u * Math.PI) * 5); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); } g.stroke();
  };
  const alongX = y0 === y1, L = alongX ? x1 - x0 : y1 - y0, half = L / 2;
  if (!open) { if (alongX) { leaf(x0, y0, x0 + half, y0); leaf(x0 + half, y0, x1, y0); } else { leaf(x0, y0, x0, y0 + half); leaf(x0, y0 + half, x0, y1); } }
  else if (!alongX) { leaf(x0, y0, x0 + half * 0.8, y0 + half * 0.55); leaf(x0, y1, x0 + half * 0.8, y1 - half * 0.55); }
  pillar(pr, x0, y0, 28); pillar(pr, x1, y1, 28);
}
function hedgeBox(pr, x, y, w, d, h = 14) {
  box(pr, x, y, w, d, h, 0, COL.hedgeTop, COL.hedge, COL.hedgeSide);
  // bumpy leafy top
  const g = pr.g; const n = Math.max(2, Math.round((w + d) / 9));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n; const px = w > d ? x + u * w : x + w / 2, py = w > d ? y + d / 2 : y + u * d;
    const [sx, sy] = pr.P(px, py, h); g.fillStyle = i % 2 ? '#9BE460' : '#7FD246'; g.beginPath(); g.ellipse(sx, sy, 4.2 * pr.s, 2.2 * pr.s, 0, 0, TAU); g.fill();
  }
}
function tree(pr, x, y, kind, s = 1, t = 0) {
  const g = pr.g, [sx, sy] = pr.P(x, y, 0), k = pr.s * s;
  flatShadow(pr, x + 6, y + 6, kind === 'cone' ? 12 * s : 20 * s, 0.25);
  if (kind === 'cone') {
    g.fillStyle = '#7A4A22'; g.fillRect(sx - 2 * k, sy - 8 * k, 4 * k, 8 * k);
    const gr = g.createLinearGradient(sx - 12 * k, 0, sx + 12 * k, 0); gr.addColorStop(0, '#5CC23D'); gr.addColorStop(0.6, '#3E9A2A'); gr.addColorStop(1, '#2A7420');
    g.fillStyle = gr; g.beginPath(); g.moveTo(sx, sy - 70 * k); g.quadraticCurveTo(sx + 14 * k, sy - 30 * k, sx + 11 * k, sy - 8 * k); g.quadraticCurveTo(sx, sy - 2 * k, sx - 11 * k, sy - 8 * k); g.quadraticCurveTo(sx - 14 * k, sy - 30 * k, sx, sy - 70 * k); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(sx - 4 * k, sy - 38 * k, 3 * k, 18 * k, 0.1, 0, TAU); g.fill();
    return;
  }
  g.fillStyle = '#7A4A22'; g.beginPath(); g.roundRect(sx - 3 * k, sy - 22 * k, 6 * k, 22 * k, 2 * k); g.fill();
  const sw = Math.sin(t * 1.2 + x) * 0.6 * k;
  for (const [cx, cy, r, c] of [[-11, -30, 14, '#3E9A2A'], [11, -30, 14, '#378E26'], [0, -44, 17, '#4FB233'], [-7, -36, 12, '#5CC23D'], [8, -48, 9, '#7BD655'], [-4, -50, 6, '#93E26A']]) {
    g.fillStyle = c; g.beginPath(); g.arc(sx + cx * k + sw, sy + cy * k, r * k, 0, TAU); g.fill();
  }
}
function shrub(pr, x, y, s = 1, flowers = '#FFFFFF') {
  const g = pr.g, [sx, sy] = pr.P(x, y, 0), k = pr.s * s;
  flatShadow(pr, x + 3, y + 3, 11 * s, 0.22);
  for (const [cx, cy, r, c] of [[-6, -7, 8, '#3E9A2A'], [6, -7, 8, '#3A9026'], [0, -12, 9.5, '#58BD3A'], [3, -15, 4.5, '#86DA5E']]) { g.fillStyle = c; g.beginPath(); g.arc(sx + cx * k, sy + cy * k, r * k, 0, TAU); g.fill(); }
  if (flowers) for (let i = 0; i < 6; i++) { g.fillStyle = flowers; g.beginPath(); g.arc(sx + (-8 + (i * 37 % 16)) * k, sy + (-6 - (i * 13 % 12)) * k, 1.9 * k, 0, TAU); g.fill(); }
}
function barn(pr, x, y) {
  const w = 76, d = 56, h = 34, X = x - w / 2, Y = y - d / 2, P = pr.P, g = pr.g;
  flatShadow(pr, x + 10, y + 10, 46, 0.2);
  box(pr, X, Y, w, d, h, 0, '#C8402A', '#D9482E', '#A8331F');
  // roof (ridge along x)
  const r1 = P(X - 3, Y + d / 2, h + 22), r2 = P(X + w + 3, Y + d / 2, h + 22);
  quad(g, P(X - 3, Y + d + 4, h - 2), P(X + w + 3, Y + d + 4, h - 2), r2, r1, '#8E3A26');
  quad(g, P(X + w + 3, Y + d + 4, h - 2), P(X + w + 3, Y - 4, h - 2), r2, r2, '#6E2C1C');
  g.beginPath(); const a = P(X + w, Y + d, h), b = P(X + w, Y, h), c = P(X + w, Y + d / 2, h + 20); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.fillStyle = '#B5391F'; g.fill();
  // white trimmed door on the south face
  const dl = P(X + 24, Y + d, 0), dr = P(X + 52, Y + d, 0), tl = P(X + 24, Y + d, 24), tr = P(X + 52, Y + d, 24);
  quad(g, dl, dr, tr, tl, '#8E2A18'); g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.6 * pr.s; g.beginPath(); g.moveTo(dl[0], dl[1]); g.lineTo(tr[0], tr[1]); g.moveTo(dr[0], dr[1]); g.lineTo(tl[0], tl[1]); g.moveTo(dl[0], dl[1]); g.lineTo(dr[0], dr[1]); g.lineTo(tr[0], tr[1]); g.lineTo(tl[0], tl[1]); g.closePath(); g.stroke();
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.sp = new Sprites();
    this.W = 1; this.H = 1; this.dpr = 1; this.z = 1;
    this.cam = { x: 0, y: 0 }; this.ox = 0; this.oy = 0;
    this.ground = null; this.groundDirty = true; this.world = null; this.time = 0;
    this.D = []; this.plantCount = 0;
    this.pr = { g: this.g, P: (x, y, h = 0) => [this.X(x, y), this.Y(x, y, h)], s: 1 };
  }
  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = Math.min(dpr || 1, CFG.view.dprCap);
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    const V = CFG.view;
    this.z = w >= h ? Math.min(h / V.landH, w / V.landW) : Math.min(w / V.portW, h / V.portH);
    this.pr.s = this.z;
    this.sp.setScale(this.z * this.dpr);
    this.groundDirty = true;
  }
  setWorld(w) { this.world = w; this.groundDirty = true; const t = this.camTarget(w); this.cam.x = t.x; this.cam.y = t.y; this.clampCam(); }
  camTarget(w = this.world) {
    const p = w.player, off = (this.H * 0.07) / (2 * IY * this.z);   // keep the player a bit below centre (tall stacks go up)
    return { x: p.x - off, y: p.y - off };
  }
  clampCam() { const w = this.world, m = 90; this.cam.x = Math.min(w.W - m, Math.max(m, this.cam.x)); this.cam.y = Math.min(w.H - m, Math.max(m, this.cam.y)); }
  follow(dt, snap) {
    const t = this.camTarget(), k = snap ? 1 : Math.min(1, dt * CFG.view.camLerp);
    this.cam.x += (t.x - this.cam.x) * k; this.cam.y += (t.y - this.cam.y) * k;
    this.clampCam();
  }
  X(x, y) { return ((x - this.cam.x) - (y - this.cam.y)) * IX * this.z + this.W / 2 + this.ox; }
  Y(x, y, h = 0) { return ((x - this.cam.x) + (y - this.cam.y)) * IY * this.z + this.H / 2 - h * this.z + this.oy; }
  // screen → world direction (for the joystick)
  static screenToWorld(ix, iy) {
    const m = Math.hypot(ix, iy); if (m < 1e-6) return [0, 0];
    const a = ix / IX, b = iy / IY; let dx = (a + b) / 2, dy = (b - a) / 2; const n = Math.hypot(dx, dy) || 1;
    return [dx / n * m, dy / n * m];
  }

  // ---------------------------------------------------------------- ground (pre-rendered)
  buildGround() {
    const w = this.world, M = 170, theme = w.deco.theme || 'garden';
    const minX = -(w.H + 2 * M) * IX, maxX = (w.W + 2 * M) * IX, minY = -2 * M * IY, maxY = (w.W + w.H + 2 * M) * IY;
    let gs = this.z * Math.min(this.dpr, 1.5);
    gs = Math.min(gs, 4096 / (maxX - minX), 4096 / (maxY - minY));
    const c = makeCanvas((maxX - minX) * gs, (maxY - minY) * gs), g = c.getContext('2d');
    const R = (seed) => hash(seed * 7919 + w.li * 131);
    const pr = { g, P: (x, y, h = 0) => [((x - y) * IX - minX) * gs, ((x + y) * IY - minY - h) * gs], s: gs };
    // --- flat layer in world coordinates
    g.save(); g.setTransform(gs * IX, gs * IY, -gs * IX, gs * IY, -minX * gs, -minY * gs);
    g.fillStyle = COL.lawn2; g.fillRect(-M, -M, w.W + 2 * M, w.H + 2 * M);
    g.fillStyle = COL.lawn; g.fillRect(0, 0, w.W, w.H);
    for (let x = 0; x < w.W; x += 36) { g.fillStyle = (x / 36) % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(40,110,20,0.06)'; g.fillRect(x, 0, 36, w.H); }
    for (let i = 0; i < 160; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(40,100,20,0.07)'; g.beginPath(); g.ellipse(R(i) * w.W, R(i + 500) * w.H, 14 + R(i + 900) * 30, 8 + R(i + 1300) * 16, 0, 0, TAU); g.fill(); }
    // shade along the far walls
    let gr = g.createLinearGradient(0, 0, 0, 40); gr.addColorStop(0, 'rgba(20,60,10,0.28)'); gr.addColorStop(1, 'rgba(20,60,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, w.W, 40);
    gr = g.createLinearGradient(0, 0, 40, 0); gr.addColorStop(0, 'rgba(20,60,10,0.28)'); gr.addColorStop(1, 'rgba(20,60,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 40, w.H);
    // paths
    const pave = (x, y, pw, ph) => {
      if (theme === 'garden') {
        g.fillStyle = COL.paving2; g.fillRect(x - 2, y - 2, pw + 4, ph + 4); g.fillStyle = COL.paving; g.fillRect(x, y, pw, ph);
        g.strokeStyle = 'rgba(140,130,110,0.45)'; g.lineWidth = 1;
        for (let yy = y; yy <= y + ph; yy += 18) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + pw, yy); g.stroke(); }
        for (let yy = y, row = 0; yy < y + ph; yy += 18, row++) for (let xx = x + (row % 2) * 9; xx < x + pw; xx += 18) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, Math.min(y + ph, yy + 18)); g.stroke(); }
        for (let i = 0; i < pw * ph / 900; i++) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + R(i + x) * (pw - 14), y + R(i + y + 7) * (ph - 14), 14, 14); }
      } else {
        g.fillStyle = '#D9C48E'; g.fillRect(x - 3, y - 3, pw + 6, ph + 6); g.fillStyle = '#E8D7A6'; g.fillRect(x, y, pw, ph);
        for (let i = 0; i < pw * ph / 260; i++) { g.fillStyle = i % 3 ? 'rgba(160,130,70,0.28)' : 'rgba(255,255,240,0.4)'; g.beginPath(); g.ellipse(x + R(i * 3 + x) * pw, y + R(i * 5 + y) * ph, 1.4 + R(i) * 2, 1 + R(i + 1) * 1.4, 0, 0, TAU); g.fill(); }
        for (let i = 0; i < pw * ph / 2400; i++) { g.fillStyle = '#CFC4AE'; g.strokeStyle = '#A99F8A'; g.lineWidth = 1; g.beginPath(); g.ellipse(x + 10 + R(i * 7 + x) * (pw - 20), y + 10 + R(i * 11 + y) * (ph - 20), 7, 5, R(i) * 3, 0, TAU); g.fill(); g.stroke(); }
      }
    };
    for (const p of w.deco.paths || []) pave(...p);
    for (const k of w.counters) pave(k.cashPos.x - 28, k.y - 40, w.W - k.cashPos.x + 28, 132);            // plaza + customer lane to the gate
    for (const p of w.procs) pave(p.inZone.x - 8, p.y - 34, p.body.x + p.body.w - p.inZone.x + 18, 68);
    // field beds
    for (const f of w.fields) {
      const bedCol = f.hidden ? COL.soil : { tulip: '#3F8A2C', rose: '#3A7A28', gold: '#5FAE2E', wheat: '#C7A15A', potato: COL.soil }[f.item];
      const edge = f.hidden ? COL.soil2 : { tulip: '#2E6A1E', rose: '#2A5E1C', gold: '#4F9A26', wheat: '#A9853E', potato: COL.soil2 }[f.item];
      g.fillStyle = edge; g.fillRect(f.x - 6, f.y - 6, f.w + 12, f.h + 12);
      g.fillStyle = bedCol; g.fillRect(f.x - 3, f.y - 3, f.w + 6, f.h + 6);
      if (f.hidden || f.item === 'potato' || f.item === 'wheat') { g.strokeStyle = 'rgba(70,35,15,0.28)'; g.lineWidth = 2; for (let yy = f.y + f.gap / 2; yy < f.y + f.h; yy += Math.max(12, f.gap)) { g.beginPath(); g.moveTo(f.x, yy); g.lineTo(f.x + f.w, yy); g.stroke(); } }
      else { g.fillStyle = 'rgba(0,0,0,0.08)'; for (let yy = f.y; yy < f.y + f.h; yy += f.gap * 2) g.fillRect(f.x, yy, f.w, f.gap); }
    }
    // coop yards
    for (const k of w.coops) {
      g.fillStyle = k.producer === 'hen' ? '#E9D08A' : '#B98A55'; g.fillRect(k.x - 26, k.y - 26, k.w + 26, k.h + 26);
      g.fillStyle = k.producer === 'hen' ? '#F4E2A8' : COL.soil; g.fillRect(k.x, k.y, k.w, k.h);
      for (let i = 0; i < 90; i++) { g.fillStyle = k.producer === 'hen' ? 'rgba(200,150,60,0.25)' : 'rgba(80,40,15,0.25)'; g.fillRect(k.x + R(i + 5000) * k.w, k.y + R(i + 5100) * k.h, 4, 1.4); }
    }
    g.restore();
    // --- far-side uprights: north & west border, outer decoration (always behind everything inside)
    const outer = this.outerDeco(w);
    for (const o of outer) if (o.far) this.drawUpright(pr, o);
    this.ground = { img: c, minX, minY, gs, w: (maxX - minX), h: (maxY - minY) };
    this.nearDeco = outer.filter((o) => !o.far);
    this.groundDirty = false;
  }
  // border walls/fences, gates and the planting outside them, as a list of upright pieces
  outerDeco(w) {
    const out = [], theme = w.deco.theme || 'garden', R = (s) => hash(s * 7919 + w.li * 131), SEG = 40;
    const gates = w.gates();
    const runX = (y, far) => { for (let x = 0; x < w.W; x += SEG) out.push({ k: 'wall', x0: x, y0: y, x1: Math.min(w.W, x + SEG), y1: y, pa: x % 120 === 0, pb: x + SEG >= w.W, far, key: x + SEG / 2 + y }); };
    const runY = (x, far, holes) => {
      let y = 0;
      while (y < w.H) {
        const hole = holes.find(([a, b]) => y >= a - 0.1 && y < b);
        if (hole) { out.push({ k: 'gate', x0: x, y0: hole[0], x1: x, y1: hole[1], open: true, far, key: x + (hole[0] + hole[1]) / 2 + 2 }); y = hole[1]; continue; }
        const nextHole = holes.filter(([a]) => a > y).reduce((m, [a]) => Math.min(m, a), w.H);
        const y1 = Math.min(nextHole, y + SEG, w.H);
        out.push({ k: 'wall', x0: x, y0: y, x1: x, y1, pa: y % 120 === 0, pb: y1 === nextHole || y1 >= w.H, far, key: x + (y + y1) / 2 });
        y = y1;
      }
    };
    runX(0, true); runY(0, true, []);
    // south wall with a decorative iron gate in the middle
    const gx = Math.round(w.W * 0.42 / 10) * 10;
    for (let x = 0; x < w.W; x += SEG) {
      if (x + SEG > gx && x < gx + 50) { if (x <= gx && x + SEG > gx) out.push({ k: 'gate', x0: gx, y0: w.H, x1: gx + 50, y1: w.H, open: false, far: false, key: gx + 25 + w.H }); continue; }
      out.push({ k: 'wall', x0: x, y0: w.H, x1: Math.min(w.W, x + SEG), y1: w.H, pa: x % 120 === 0, pb: x + SEG >= w.W, far: false, key: x + SEG / 2 + w.H });
    }
    runY(w.W, false, gates);
    for (const o of out) o.theme = theme;
    // outside planting: hedge rows and trees
    const hedgeRun = (x, y, alongX, L, far) => { for (let t = 0; t < L; t += 60) out.push({ k: 'hedge', x: alongX ? x + t : x, y: alongX ? y : y + t, w: alongX ? Math.min(56, L - t) : 16, d: alongX ? 16 : Math.min(56, L - t), far, key: (alongX ? x + t + 28 : x + 8) + (alongX ? y + 8 : y + t + 28) }); };
    hedgeRun(-20, -48, true, w.W + 20, true); hedgeRun(-48, -20, false, w.H + 20, true);
    hedgeRun(-20, w.H + 32, true, w.W + 40, false);
    // east side: hedges between the gates
    let y = -20; const gs = gates.slice().sort((a, b) => a[0] - b[0]);
    for (const [a, b] of gs) { if (a - 40 > y) hedgeRun(w.W + 32, y, false, a - 40 - y, false); y = b + 40; }
    if (y < w.H + 40) hedgeRun(w.W + 32, y, false, w.H + 40 - y, false);
    for (let i = 0; i < 60; i++) {
      const side = i % 4, u = R(i + 40), far2 = i >= 26 ? 110 + R(i + 5) * 120 : 0;
      let x, yy;
      if (side === 0) { x = u * w.W; yy = -90 - R(i + 9) * 60 - far2; } else if (side === 1) { x = -90 - R(i + 9) * 60 - far2; yy = u * w.H; }
      else if (side === 2) { x = u * w.W; yy = w.H + 80 + R(i + 9) * 50 + far2; } else { x = w.W + 80 + R(i + 9) * 50 + far2; yy = u * w.H; if (gs.some(([a, b]) => yy > a - 60 && yy < b + 60)) continue; }
      out.push({ k: 'tree', x, y: yy, kind: R(i + 77) > 0.6 ? 'cone' : 'round', s: 0.9 + R(i + 3) * 0.4, far: side < 2, key: x + yy });
    }
    out.sort((a, b) => a.key - b.key);
    return out;
  }
  drawUpright(pr, o) {
    if (o.k === 'wall') { if (o.theme === 'farm') woodFence(pr, o.x0, o.y0, o.x1, o.y1); else stoneWall(pr, o.x0, o.y0, o.x1, o.y1, o.pa, o.pb); }
    else if (o.k === 'gate') ironGate(pr, o.x0, o.y0, o.x1, o.y1, o.open, this.time);
    else if (o.k === 'hedge') hedgeBox(pr, o.x, o.y, o.w, o.d, 16);
    else if (o.k === 'tree') tree(pr, o.x, o.y, o.kind, o.s, this.time);
  }

  // -------------------------------------------------------------- helpers
  item(type, v, x, y, h, s = 1) {
    const e = this.sp.item(type, v), z = this.z * s;
    this.g.drawImage(e.img, this.X(x, y) - e.w * z / 2, this.Y(x, y, h) - e.h * z / 2, e.w * z, e.h * z);
  }
  local(x, y, h, s = 1, flip = 1) { const g = this.g; g.save(); g.translate(this.X(x, y), this.Y(x, y, h)); g.scale(this.z * s * flip, this.z * s); return g; }
  label(text, x, y, px, fill = '#FFFFFF', stroke = '#3A2A14', align = 'center') {
    const g = this.g; g.font = FONT(px); g.textAlign = align; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = Math.max(2.5, px * 0.28); g.strokeStyle = stroke; g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y);
  }
  onScreen(x, y, m = 80, up = 120) { const sx = this.X(x, y), sy = this.Y(x, y); return sx > -m && sx < this.W + m && sy > -m && sy < this.H + up; }
  // iso transform so flat things (zones, tiles, ground arrows, painted text) lie on the ground
  groundXf(h = 0) {
    const z = this.z * this.dpr, ox = (this.W / 2 + this.ox - (this.cam.x - this.cam.y) * IX * this.z) * this.dpr, oy = (this.H / 2 + this.oy - (this.cam.x + this.cam.y) * IY * this.z - h * this.z) * this.dpr;
    this.g.setTransform(z * IX, z * IY, -z * IX, z * IY, ox, oy);
  }
  screenXf() { this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
  stackBase(c) {
    if (c.kind === 'player' && c.vehicle) return { x: c.x, y: c.y, z: 22, sx: -c.face * 26, cols: 3, spread: 7 };
    if (c.kind === 'worker' && c.cart) return { x: c.x, y: c.y, z: 18, sx: -c.face * 4, cols: 2, spread: 7 };
    return { x: c.x, y: c.y, z: 34, sx: -c.face * 8, cols: 1, spread: 0 };
  }
  stackTop(c) {
    const b = this.stackBase(c), n = c.stack.length, step = n ? CFG.items[c.stack[n - 1]].step : 5;
    return { x: b.x, y: b.y, z: b.z + (n / b.cols) * step, sx: b.sx };
  }

  // ----------------------------------------------------------------- frame
  draw(world, fx, guide, time, extra = {}) {
    this.time = time; this.world = world; this.wt = world.t;
    if (this.groundDirty || !this.ground) this.buildGround();
    const g = this.g, z = this.z;
    [this.ox, this.oy] = fx ? fx.shakeOffset() : [0, 0];
    this.screenXf();
    g.fillStyle = COL.lawn2; g.fillRect(0, 0, this.W, this.H);
    const G = this.ground, k = z / G.gs;
    g.imageSmoothingEnabled = true;
    const gx = this.W / 2 + this.ox - (this.cam.x - this.cam.y) * IX * z + G.minX * z, gy = this.H / 2 + this.oy - (this.cam.x + this.cam.y) * IY * z + G.minY * z;
    g.drawImage(G.img, gx, gy, G.w * z, G.h * z);
    void k;

    // flat things on the ground
    for (const pl of world.piles) if (!pl.owner.hidden) this.pileShadow(pl);
    for (const c of world.counters) if (!c.hidden) { this.zone(c.zone, '出售', null, c.appearT); this.cashTile(c); }
    for (const p of world.procs) if (!p.hidden) this.zone(p.inZone, null, p.inItem, p.appearT);
    this.screenXf();
    for (const t of world.tiles) if (t.visible) this.tile(t, world);
    this.screenXf();

    // depth-sorted uprights
    const D = this.D; D.length = 0;
    const push = (key, type, a, b) => D.push([key, type, a, b]);
    this.queueFields(world, push);
    for (const pl of world.piles) if (!pl.owner.hidden) { const C = pl.cols, R = pl.rows; for (let d = 0; d < C + R - 1; d++) { const kx = pl.x + pl.y + (d + 1) * pl.cw; const sy = this.Y(pl.x + (d + 1) * pl.cw * 0.5, pl.y + (d + 1) * pl.cw * 0.5); if (sy > -200 && sy < this.H + 40) push(kx, 5, pl, d); } }
    for (const k of world.coops) if (!k.hidden) {
      for (let x = k.x - 26; x < k.x + k.w; x += 40) push(x + 20 + k.y - 26, 3, k, x);
      for (let y = k.y - 26 + 0.01; y < k.y + k.h; y += 40) push(k.x - 26 + y + 20, 4, k, y);
      for (let i = 0; i < k.n; i++) push(k.hens[i].x + k.hens[i].y + 1, 2, k, i);
    }
    for (const c of world.counters) if (!c.hidden) { push(c.x + c.y + 6, 6, c, 0); push(c.cashPos.x + c.cashPos.y, 8, c, 0); }
    for (const p of world.procs) if (!p.hidden) push(p.x + p.y + 10, 7, p, 0);
    for (const cu of world.customers) push(cu.x + cu.y, 10, cu, 0);
    for (const w of world.workers) push(w.x + w.y, 11, w, 0);
    push(world.player.x + world.player.y, 12, world.player, 0);
    for (const o of this.nearDeco) if (this.onScreen((o.x0 ?? o.x), (o.y0 ?? o.y), 160, 200)) push(o.key, 13, o, 0);
    const dc = world.deco;
    for (const h of dc.hedges || []) push(h[0] + h[1] + (h[2] + h[3]) / 2, 14, h, 0);
    for (const t of dc.trees || []) if (this.onScreen(t[0], t[1], 80, 220)) push(t[0] + t[1], 15, t, 0);
    for (const b of dc.bushes || []) if (this.onScreen(b[0], b[1])) push(b[0] + b[1], 16, b, 0);
    if (dc.barn && this.onScreen(dc.barn[0], dc.barn[1], 160, 200)) push(dc.barn[0] + dc.barn[1], 17, dc.barn, 0);
    D.sort((a, b) => a[0] - b[0]);
    for (const d of D) {
      switch (d[1]) {
        case 1: this.fieldDiag(d[2], d[3]); break;
        case 2: this.henAt(d[2], d[3]); break;
        case 3: this.coopFenceN(d[2], d[3]); break;
        case 4: this.coopFenceW(d[2], d[3]); break;
        case 5: this.pileDiag(d[2], d[3]); break;
        case 6: this.counter(d[2]); break;
        case 7: this.proc(d[2]); break;
        case 8: this.cashPile(d[2], world); break;
        case 10: this.customer(d[2]); break;
        case 11: case 12: this.collector(d[2]); break;
        case 13: this.drawUpright(this.pr, d[2]); break;
        case 14: hedgeBox(this.pr, d[2][0], d[2][1], d[2][2], d[2][3], 16); break;
        case 15: tree(this.pr, d[2][0], d[2][1], d[2][2], 1, time); break;
        case 16: shrub(this.pr, d[2][0], d[2][1], 1, (d[2][0] + d[2][1]) % 3 ? '#FFFFFF' : '#FF8FB0'); break;
        case 17: barn(this.pr, d[2][0], d[2][1]); break;
      }
    }
    // stacks on top so tall towers read clearly
    for (const w of world.workers) this.stack(w);
    this.stack(world.player, true);
    for (const f of world.fly) this.flyItem(f);
    if (fx) this.fxWorld(fx);
    if (guide) this.arrow(guide);
    this.screenXf();
    if (fx) this.fxScreen(fx);
    if (extra.hand) this.hand(time);
  }

  // ---------------------------------------------------------------- fields
  queueFields(world, push) {
    const z = this.z, W = this.W, H = this.H, cx = this.cam.x, cy = this.cam.y;
    let count = 0; const vis = [];
    for (const f of world.fields) {
      if (f.hidden) continue;
      const gp = f.gap, A = ((f.x - f.y) - (cx - cy)) * IX * z + W / 2 + this.ox, step = gp * IX * z;
      for (let d = 0; d < f.cols + f.rows - 1; d++) {
        const sy = ((f.x + f.y + (d + 1) * gp) - (cx + cy)) * IY * z + H / 2 + this.oy;
        if (sy < -10 || sy > H + 30 * z) continue;
        let cLo = Math.max(0, d - f.rows + 1), cHi = Math.min(f.cols - 1, d);
        const lo = Math.ceil((d + (-24 - A) / step) / 2), hi = Math.floor((d + (W + 24 - A) / step) / 2);
        cLo = Math.max(cLo, lo); cHi = Math.min(cHi, hi);
        if (cHi < cLo) continue;
        count += cHi - cLo + 1;
        vis.push([f, d, cLo, cHi, A, sy]);
      }
    }
    this.plantCount = count;
    this.lod = Math.max(1, Math.ceil(count / CFG.view.plantCap));
    for (const v of vis) push(v[0].x + v[0].y + (v[1] + 1) * v[0].gap, 1, v, 0);
  }
  fieldDiag(v) {
    const [f, d, cLo, cHi, A, sy] = v, g = this.g, z = this.z, sp = this.sp, gp = f.gap, C = f.cols, lod = this.lod;
    const step = gp * IX * z, jxs = gp / 300 * IX * z, jys = gp / 300 * IY * z;
    const sc = lod > 1 ? 1 + (lod - 1) * 0.35 : 1, dp = this.dpr, idp = 1 / dp;
    for (let c = cLo; c <= cHi; c++) {
      const r = d - c; if (lod > 1 && (c % lod)) continue;
      const i = r * C + c, gv = f.g[i];
      const e = sp.plant(f.item, plantStage(gv), f.v[i]);
      const jx = f.jx[i], jy = f.jy[i];
      const x = A + (2 * c - d) * step + (jx - jy) * jxs, y = sy + (jx + jy) * jys;
      const pop = f.pop[i];
      if (pop > 0 || sc !== 1) { const s = (pop > 0 ? 1 + Math.sin(pop * Math.PI) * 0.35 : 1) * sc * z; g.drawImage(e.img, x - e.ax * s, y - e.ay * s, e.w * s, e.h * s); }
      else g.drawImage(e.img, Math.round((x - e.ax * z) * dp) * idp, Math.round((y - e.ay * z) * dp) * idp, e.img.width * idp, e.img.height * idp);   // 1:1 device pixels: no resampling
    }
  }

  // ---------------------------------------------------------------- piles
  pileShadow(pl) {
    this.groundXf();
    const g = this.g, C = pl.cols, hs = pl.hs;
    g.fillStyle = 'rgba(120,80,20,0.22)'; g.beginPath();
    for (let r = 0; r < pl.rows; r++) {
      let run = -1;
      for (let c = 0; c <= C; c++) {
        const on = c < C && hs[r * C + c] > 0;
        if (on && run < 0) run = c;
        if (!on && run >= 0) { g.rect(pl.x + run * pl.cw - 2, pl.y + r * pl.ch - 1, (c - run) * pl.cw + 4, pl.ch + 2); run = -1; }
      }
    }
    g.fill();
    this.screenXf();
  }
  pileDiag(pl, d) {
    const C = pl.cols, R = pl.rows, hs = pl.hs, L = CFG.pile.layer, type = pl.type, sp = this.sp, z = this.z, g = this.g;
    const e = [sp.item(type, 1), sp.item(type, 2), sp.item(type, 3), sp.item(type, 4)];
    const es = [sp.item(type, 1, 1), sp.item(type, 2, 1), sp.item(type, 3, 1), sp.item(type, 4, 1)];
    const ew = e[0].w * z, eh = e[0].h * z;
    const cLo = Math.max(0, d - R + 1), cHi = Math.min(C - 1, d);
    for (let c = cLo; c <= cHi; c++) {
      const r = d - c, i = r * C + c, h = hs[i]; if (!h) continue;
      const wx = pl.x + (c + 0.5) * pl.cw, wy = pl.y + (r + 0.5) * pl.ch;
      const sx0 = this.X(wx, wy); if (sx0 < -20 || sx0 > this.W + 20) continue;
      const hR = c < C - 1 ? hs[i + 1] : 0, hD = r < R - 1 ? hs[i + C] : 0;
      let k0 = Math.max(0, Math.min(hR, hD) - 2); if (k0 > h - 1) k0 = h - 1;
      const sy0 = this.Y(wx, wy), b = pl.bump[i];
      for (let k = k0; k < h; k++) {
        const hv = hash(i * 64 + k), jx = (hv - 0.5) * pl.cw * 0.8, jy = (hash(i * 64 + k + 31) - 0.5) * pl.ch * 0.8;
        const hz = k * L + 2.5 + (k === h - 1 ? b * 3 : 0);
        const sx = sx0 + (jx - jy) * IX * z, sy = sy0 + (jx + jy) * IY * z - hz * z;
        g.drawImage((k < h - 1 ? es : e)[(hv * 4) | 0].img, sx - ew / 2, sy - eh / 2, ew, eh);
      }
    }
  }

  // ---------------------------------------------------------------- coops
  henAt(k, i) {
    const h = k.hens[i], t = this.time;
    const a = elastic((this.wt - h.appearT) / 0.6); if (a <= 0) return;
    const flip = (i % 2 ? -1 : 1);
    if (k.producer === 'bush') { const g = this.local(h.x, h.y, 0, a * 1.2, flip); bush(g, t, h.lay, i, 6); g.restore(); return; }
    const g = this.local(h.x, h.y, 12, a * 1.15, flip); hen(g, t, h.lay, i); g.restore();
  }
  coopFenceN(k, x) {
    const x1 = Math.min(x + 40, k.x + k.w), y = k.y - 26;
    if (k.producer === 'hen') box(this.pr, x, k.y - 24, x1 - x, 16, 12, 0, '#D9773F', '#B5562A', '#94431F');   // nest shelf
    woodFence(this.pr, x, y, x1, y);
  }
  coopFenceW(k, y) {
    const y1 = Math.min(y + 40, k.y + k.h), x = k.x - 26;
    if (k.producer === 'hen') box(this.pr, k.x - 24, Math.max(y, k.y - 8), 16, y1 - Math.max(y, k.y - 8), 12, 0, '#D9773F', '#B5562A', '#94431F');
    woodFence(this.pr, x, y, x, y1);
  }

  // ---------------------------------------------------------------- zones, tiles
  dashedRect(x, y, w, d, fill, stroke, lw) {
    const g = this.g; g.beginPath(); g.roundRect(x, y, w, d, 6);
    if (fill) { g.fillStyle = fill; g.fill(); }
    g.setLineDash([7, 5]); g.lineDashOffset = -this.time * 14; g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); g.setLineDash([]);
  }
  zone(z0, text, item, appearT) {
    const a = elastic((this.wt - appearT) / 0.6); if (a <= 0) return;
    this.groundXf();
    const g = this.g, w = z0.w * a, d = z0.h * a;
    this.dashedRect(z0.cx - w / 2, z0.cy - d / 2, w, d, 'rgba(160,240,255,0.30)', '#E9FDFF', 3);
    if (text) {   // painted on the ground, rotated to read along the iso axis
      g.save(); g.translate(z0.cx, z0.cy); g.rotate(-Math.PI / 2);
      g.font = FONT(19); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = '#1E5AA8'; g.strokeText(text, 0, 0); g.fillStyle = '#FFFFFF'; g.fillText(text, 0, 0);
      g.restore();
    }
    this.screenXf();
    if (item) { const l = this.local(z0.cx, z0.cy, 2, 0.85 * a); l.globalAlpha = 0.85; drawIcon(l, item, this.time); l.restore(); }
  }
  cashTile(c) {
    this.groundXf();
    const p = c.cashPos;
    this.g.fillStyle = 'rgba(40,52,60,0.55)'; this.g.beginPath(); this.g.roundRect(p.x - 21, p.y - 21, 42, 42, 6); this.g.fill();
    this.dashedRect(p.x - 21, p.y - 21, 42, 42, null, 'rgba(120,230,240,0.85)', 2);
    this.screenXf();
  }
  tile(t, world) {
    const S = CFG.tile.size, a = elastic((this.wt - t.appearT) / 0.6); if (a <= 0) return;
    if (!this.onScreen(t.x, t.y, 60, 60)) return;
    const afford = world.money >= t.price - t.paid;
    const pulse = afford ? 1 + Math.sin(this.time * 6) * 0.04 : 1, s = S * a * pulse;
    this.groundXf();
    const g = this.g;
    g.fillStyle = 'rgba(20,40,40,0.25)'; g.beginPath(); g.roundRect(t.x - s / 2 + 3, t.y - s / 2 + 3, s, s, 7); g.fill();
    g.beginPath(); g.roundRect(t.x - s / 2, t.y - s / 2, s, s, 7); g.fillStyle = afford ? 'rgba(63,208,218,0.82)' : 'rgba(54,66,76,0.55)'; g.fill();
    const f = t.paid / t.price;
    if (f > 0) { g.save(); g.beginPath(); g.roundRect(t.x - s / 2, t.y - s / 2, s, s, 7); g.clip(); g.fillStyle = 'rgba(120,255,200,0.75)'; const fs = s * f; g.fillRect(t.x + s / 2 - fs, t.y + s / 2 - fs, s * 2, s * 2); g.restore(); }
    this.dashedRect(t.x - s / 2 + 3, t.y - s / 2 + 3, s - 6, s - 6, null, '#FFFFFF', 2.4);
    this.screenXf();
    const bob = Math.sin(this.time * 3 + t.order) * 1.2;
    const l = this.local(t.x - 3, t.y - 3, 9 + bob, 0.95 * a); if (!afford) l.globalAlpha = 0.85; drawIcon(l, t.icon, this.time); l.restore();
    // price: bill + number on the near corner
    const z = this.z, px = this.X(t.x + 8, t.y + 8), py = this.Y(t.x + 8, t.y + 8);
    const rem = Math.ceil(t.price - t.paid), txt = `${rem}`, fs = 11 * z * a;
    g.font = FONT(fs); const tw = g.measureText(txt).width;
    const bl = this.sp.item('bill', 0), bw = bl.w * z * 0.8 * a, bh = bl.h * z * 0.8 * a, total = bw + 3 * z + tw;
    g.drawImage(bl.img, px - total / 2, py - bh / 2, bw, bh);
    this.label(txt, px - total / 2 + bw + 3 * z, py, fs, afford ? '#FFFFFF' : '#E8F4F6', afford ? '#0E6A78' : '#2A3440', 'left');
    const p = world.player, near = Math.hypot(p.x - t.x, p.y - t.y) < 130;
    if (near || afford) { const lab = t.buy ? `${t.label} +${t.buy}` : t.label; this.label(lab, this.X(t.x, t.y), this.Y(t.x - S / 2, t.y - S / 2, 4), 10 * z * a, '#FFFFFF', '#1E3A44'); }
  }

  // ---------------------------------------------------------------- counter, machine, cash
  counter(c) {
    const t = this.time, a = elastic((this.wt - c.appearT) / 0.6); if (a <= 0) return;
    if (!this.onScreen(c.x, c.y, 120, 200)) return;
    const K = CFG.counter, pr = this.pr, dsk = c.desk, sq = 1 + c.bumpT * 0.04;
    const H = K.deskH * a * sq;
    flatShadow(pr, c.x + 6, c.y + 8, 36, 0.2);
    box(pr, dsk.x, dsk.y, dsk.w, dsk.h, H - 3, 0, '#5B8FE8', '#3E6FCC', '#2C559E');
    box(pr, dsk.x - 2, dsk.y - 2, dsk.w + 4, dsk.h + 4, 3, H - 3, '#8DB6FF', '#5F8FE0', '#4572BE');
    // register
    box(pr, dsk.x + 4, dsk.y + 6, 14, 12, 5, H, '#E6EAF2', '#B9C0CE', '#9AA2B2');
    { const g = this.g, P = pr.P; quad(g, P(dsk.x + 6, dsk.y + 8, H + 5), P(dsk.x + 16, dsk.y + 8, H + 5), P(dsk.x + 16, dsk.y + 8, H + 13), P(dsk.x + 6, dsk.y + 8, H + 13), '#3BB8F0'); }
    // stock stacked on the counter top in columns
    const n = Math.min(c.stock.length, 96);
    for (let k = 0; k < n; k++) {
      const col = k % 8, lay = (k / 8) | 0, type = c.stock[k];
      const ix = col % 2, iy = (col / 2) | 0;
      this.item(type, 1 + (k % 4), dsk.x + 8 + ix * 14, dsk.y + 26 + iy * 10, H + 3 + lay * CFG.items[type].step * 0.75, 0.9);
    }
    if (c.cashier) { const l = this.local(c.x + 8, c.y - 22, 0, 1.1, -1); person(l, t, 0, false, { shirt: '#4CD08A', vest: '#2E8A5A', hair: '#3A2210', seed: 3 }); l.restore(); }
  }
  proc(p) {
    const t = this.time, a = elastic((this.wt - p.appearT) / 0.6); if (a <= 0) return;
    if (!this.onScreen(p.x, p.y, 120, 200)) return;
    const pr = this.pr, b = p.body, cols = PROC_COL[p.outItem] || PROC_COL.bouquet, sh = p.work ? Math.sin(t * 40) * 0.6 : 0;
    const H = CFG.proc.bodyH * a;
    flatShadow(pr, p.x + 6, p.y + 8, 40, 0.2);
    box(pr, b.x - 3, b.y - 3, b.w + 6, b.h + 6, 5, 0, '#C9CED8', '#A9AEB8', '#8E939E');
    box(pr, b.x + sh, b.y, b.w, b.h, H - 5, 5, cols[0], cols[1], cols[2]);
    box(pr, b.x + 4 + sh, b.y + 4, b.w - 8, b.h - 8, 3, H, '#FFFFFF', '#E6E6EE', '#CFCFD8');
    // hopper on the input (west) side
    const P = pr.P, g = this.g;
    quad(g, P(b.x - 4, b.y + 6, H + 14), P(b.x + 18, b.y + 6, H + 14), P(b.x + 18, b.y + b.h - 6, H + 14), P(b.x - 4, b.y + b.h - 6, H + 14), '#D8DCE6');
    quad(g, P(b.x - 4, b.y + b.h - 6, H + 14), P(b.x + 18, b.y + b.h - 6, H + 14), P(b.x + 14, b.y + b.h - 10, H + 3), P(b.x, b.y + b.h - 10, H + 3), '#B8BCC8');
    // chimney + puffs
    box(pr, b.x + b.w - 16, b.y + 6, 9, 9, 16, H, '#8A8E9A', '#767A86', '#62666F');
    if (p.work) for (let i = 0; i < 3; i++) { const u = ((t * 0.8 + i / 3) % 1); const [sx, sy] = P(b.x + b.w - 11.5, b.y + 10.5, H + 18 + u * 26); g.fillStyle = `rgba(255,255,255,${0.7 * (1 - u)})`; g.beginPath(); g.arc(sx + u * 8 * this.z, sy, (3 + u * 5) * this.z, 0, TAU); g.fill(); }
    // product sign on the south face + spinning gear on the east face
    const l = this.local(p.x - 6, p.y + b.h / 2, H * 0.55, 0.9 * a); drawIcon(l, p.outItem, t); l.restore();
    const [gx, gy] = P(b.x + b.w, p.y + 4, H * 0.5); g.save(); g.translate(gx, gy); g.scale(this.z * 0.7, this.z * 0.7); g.rotate(p.work ? t * 4 : 0);
    g.fillStyle = '#FFD23F'; g.strokeStyle = '#7A5A10'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 16; i++) { const an = i * Math.PI / 8, r = i % 2 ? 6 : 8; g.lineTo(Math.cos(an) * r, Math.sin(an) * r * 0.8); } g.closePath(); g.fill(); g.stroke(); g.restore();
    if (p.buf > 0) {
      const z = this.z, sx = this.X(b.x, p.y), sy = this.Y(b.x, p.y, H + 28);
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect(sx - 13 * z, sy - 7 * z, 26 * z, 14 * z, 7 * z); g.fill();
      this.label(`${p.buf}`, sx, sy, 9 * z, '#5A3414', '#FFFFFF');
    }
  }
  cashPile(c, world) {
    if (c.cash <= 0.01) return;
    const bv = world.L.bill || 5, n = Math.min(60, Math.ceil(c.cash / bv)), p = c.cashPos;
    for (let k = 0; k < n; k++) {
      const s = k % 6, lay = (k / 6) | 0;
      this.item('cash', 0, p.x - 10 + (s % 2) * 14, p.y - 12 + ((s / 2) | 0) * 11, 2 + lay * 3.2, 0.85);
    }
  }

  // ---------------------------------------------------------------- characters
  customer(cu) {
    if (!this.onScreen(cu.x, cu.y, 40, 80)) return;
    const g = this.local(cu.x, cu.y, 0, 1.1, cu.face);
    person(g, this.time, cu.walk, cu.moving, { ...customerStyle(cu.hue), carry: cu.bag.length > 0 });
    g.restore();
    const n = Math.min(cu.bag.length, 10);
    for (let k = 0; k < n; k++) { const it = cu.bag[k]; this.item(it, 0, cu.x, cu.y, 38 + k * CFG.items[it].step * 0.8, 0.85); }
  }
  collector(c) {
    const t = this.time;
    const app = c.appearT !== undefined ? elastic((this.wt - c.appearT) / 0.6) : 1;
    if (app <= 0) return;
    const cutting = t - 0 >= 0 && this.world.t - c.cutT < 0.25;
    const g = this.local(c.x, c.y, 0, app * 1.15, c.face);
    const back = c.moving && c.dirY < -Math.abs(c.vx - c.vy) * 0.6;
    if (c.kind === 'player') {
      if (c.vehicle) mower(g, t, c.moving, c.walk);
      else person(g, t, c.walk, c.moving, { ...HERO, back, carry: c.stack.length + c.incoming > 0 });
    } else if (c.cart) cart(g, t, c.moving, c.walk);
    else person(g, t, c.walk, c.moving, { ...BOY, back, cutting, carry: c.stack.length > 0 && !cutting, seed: c.seed });
    g.restore();
  }
  stack(c, isPlayer) {
    const n = c.stack.length; if (!n && !isPlayer) return;
    const z = this.z, t = this.time, cull = -CFG.view.stackCull, b = this.stackBase(c);
    const bz = (c.moving && b.cols === 1) ? b.z - Math.abs(Math.sin(c.walk)) * 2.4 : b.z;
    const hts = [0, 0, 0], S = b.cols === 1 ? 1.3 : 1.1;
    const baseX = this.X(b.x, b.y) + b.sx * z, baseY = this.Y(b.x, b.y);
    let topY = this.H, topX = baseX;
    const g = this.g;
    for (let i = 0; i < n; i++) {
      const col = i % b.cols, type = c.stack[i], step = CFG.items[type].step;
      const h = hts[col]; hts[col] += step;
      const sway = c.sway * Math.pow(h, 1.3) * 0.07 + Math.sin(t * 2.4 + h * 0.02) * h * 0.012;
      const sx = baseX + ((col - (b.cols - 1) / 2) * b.spread + sway) * z;
      const sy = baseY - (bz + h) * z;
      if (sy < cull) { if (sy < topY) { topY = sy; topX = sx; } continue; }
      if (sy > this.H + 40) continue;
      const e = this.sp.item(type, i % 3 === 0 ? 0 : 1 + (i % 4)), es = z * S;
      g.drawImage(e.img, sx - e.w * es / 2, sy - e.h * es / 2, e.w * es, e.h * es);
      if (sy < topY) { topY = sy; topX = sx; }
    }
    if (n > 0 && (isPlayer || n >= 5)) {
      const full = c.stack.length + c.incoming >= c.cap;
      const ly = Math.max(isPlayer ? 96 : 70, topY - 14 * z);
      const txt = full ? 'MAX' : `${n}`;
      const px = (isPlayer ? 12 : 8.5) * z;
      g.font = FONT(px); const tw = g.measureText(txt).width;
      g.fillStyle = full ? '#FF4D3A' : 'rgba(30,30,30,0.55)';
      g.beginPath(); g.roundRect(topX - tw / 2 - 6 * z, ly - px * 0.7, tw + 12 * z, px * 1.4, px * 0.7); g.fill();
      this.label(txt, topX, ly, px, '#FFFFFF', full ? '#9E1B10' : '#1A1A1A');
    }
  }
  flyItem(f) {
    const p = Math.min(1, f.t / f.dur), e = p * p * (3 - 2 * p);
    let tx = f.tx, ty = f.ty, tz = f.tz, tsx = 0;
    if (f.kind === 'stack') { const s = this.stackTop(f.ref); tx = s.x; ty = s.y; tz = s.z; tsx = s.sx * e; }
    else if (f.kind === 'cust') { tx = f.ref.x; ty = f.ref.y; tz = 38 + f.ref.bag.length * 4; }
    // quadratic bezier with a sideways spray control point
    const mx = (f.x0 + tx) / 2 + f.sx, my = (f.y0 + ty) / 2 + f.sy, u = 1 - e;
    const x = u * u * f.x0 + 2 * u * e * mx + e * e * tx, y = u * u * f.y0 + 2 * u * e * my + e * e * ty;
    const h = f.z0 + (tz - f.z0) * e + f.arc * 4 * p * (1 - p);
    const e2 = this.sp.item(f.type, f.kind === 'pile' ? 1 + ((f.t * 10) | 0) % 4 : ((f.t * 12) | 0) % 5), z = this.z;
    this.g.drawImage(e2.img, this.X(x, y) + tsx * z - e2.w * z / 2, this.Y(x, y, h) - e2.h * z / 2, e2.w * z, e2.h * z);
  }

  // ---------------------------------------------------------------- fx
  fxWorld(fx) {
    const g = this.g, z = this.z;
    for (const o of fx.p) if (o.on) {
      const a = Math.min(1, o.life / o.max * 2);
      const sx = this.X(o.x, o.y), sy = this.Y(o.x, o.y, o.z);
      if (o.type === 'ring') {
        const k = 1 - o.life / o.max;
        g.strokeStyle = o.color; g.globalAlpha = 1 - k; g.lineWidth = 4 * z * (1 - k) + 1;
        g.beginPath(); g.ellipse(sx, sy, o.size * z * (0.3 + k) * 1.2, o.size * z * (0.3 + k) * 0.6, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; continue;
      }
      g.globalAlpha = a; g.fillStyle = o.color;
      if (o.type === 'leaf' || o.type === 'conf' || o.type === 'petal') { g.save(); g.translate(sx, sy); g.rotate(o.rot); g.beginPath(); g.ellipse(0, 0, o.size * z, o.size * z * 0.5, 0, 0, TAU); g.fill(); g.restore(); }
      else if (o.type === 'star') { g.save(); g.translate(sx, sy); g.rotate(o.rot); g.beginPath(); for (let i = 0; i < 8; i++) { const r = (i % 2 ? 0.4 : 1) * o.size * z; g.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } g.closePath(); g.fill(); g.restore(); }
      else { g.beginPath(); g.arc(sx, sy, o.size * z, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    }
    for (const o of fx.wbills) if (o.on && o.t >= 0) {
      const p = o.t / o.dur, x = o.x0 + (o.x1 - o.x0) * p, y = o.y0 + (o.y1 - o.y0) * p, h = 20 + 30 * 4 * p * (1 - p);
      this.item('bill', 1 + ((o.rot * 2) | 0) % 4, x, y, h);
    }
    for (const o of fx.txt) if (o.on) {
      const k = o.life / o.max, sx = this.X(o.x, o.y), sy = this.Y(o.x, o.y, o.z);
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      g.globalAlpha = Math.min(1, k * 3);
      this.label(o.s, sx, sy, (o.big ? 20 : 13) * z * pop, o.color, '#2A2210');
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
  // guide: a flat white arrow on the ground next to the player, a bouncing arrow over the target,
  // and an arrow pinned to the screen edge when the target is off-screen
  arrow(tg) {
    const g = this.g, z = this.z, p = this.world.player, t = this.time;
    const dx = tg.x - p.x, dy = tg.y - p.y, dist = Math.hypot(dx, dy);
    if (dist > 70) {
      const ux = dx / dist, uy = dy / dist, r = 34 + Math.sin(t * 6) * 3, cx = p.x + ux * r, cy = p.y + uy * r;
      this.groundXf(0.5);
      g.save(); g.translate(cx, cy); g.rotate(Math.atan2(uy, ux));
      g.beginPath(); g.moveTo(12, 0); g.lineTo(-2, -11); g.lineTo(-2, -5); g.lineTo(-12, -5); g.lineTo(-12, 5); g.lineTo(-2, 5); g.lineTo(-2, 11); g.closePath();
      g.fillStyle = 'rgba(0,40,0,0.18)'; g.translate(2, 2); g.fill(); g.translate(-2, -2);
      g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(160,190,200,0.9)'; g.stroke();
      g.restore();
      this.screenXf();
    }
    const bob = Math.abs(Math.sin(t * 5)) * 9;
    const sx = this.X(tg.x, tg.y), sy = this.Y(tg.x, tg.y, 44 + bob);
    const mL = 30, mR = this.W - 30, mT = 90, mB = this.H - 40;
    const s = z * 1.05;
    const drawArrow = (x, y, ang) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.beginPath(); g.moveTo(14 * s, 0); g.lineTo(-2 * s, -12 * s); g.lineTo(-2 * s, -5 * s); g.lineTo(-14 * s, -5 * s); g.lineTo(-14 * s, 5 * s); g.lineTo(-2 * s, 5 * s); g.lineTo(-2 * s, 12 * s); g.closePath();
      g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 6 * s; g.shadowOffsetY = 3 * s;
      g.lineJoin = 'round'; g.fillStyle = '#FFFFFF'; g.fill(); g.shadowColor = 'transparent';
      g.lineWidth = 1.4 * s; g.strokeStyle = '#B8D4DE'; g.stroke();
      g.restore();
    };
    if (sx < mL || sx > mR || sy < mT || sy > mB) {
      const px = this.X(p.x, p.y), py = this.Y(p.x, p.y, 20), ddx = sx - px, ddy = sy - py;
      let k = 1;
      if (sx < mL) k = Math.min(k, (mL - px) / ddx); if (sx > mR) k = Math.min(k, (mR - px) / ddx);
      if (sy < mT) k = Math.min(k, (mT - py) / ddy); if (sy > mB) k = Math.min(k, (mB - py) / ddy);
      const pulse = 1 + Math.sin(t * 8) * 0.06;
      g.save(); g.translate(px + ddx * k, py + ddy * k); g.scale(pulse, pulse); drawArrow(0, 0, Math.atan2(ddy, ddx)); g.restore();
    } else drawArrow(sx, sy, Math.PI / 2);
  }
  hand(t) {
    const g = this.g, z = Math.max(1, this.z * 0.8);
    const bx = Math.min(this.W * 0.18, 110), by = this.H - Math.min(this.H * 0.22, 100);
    const cx = bx + Math.cos(t * 2.4) * 26 * z, cy = by + Math.sin(t * 2.4) * 14 * z;
    g.save(); g.translate(cx, cy + 18 * z); g.scale(z, z); g.rotate(-0.35);
    g.fillStyle = '#FFFFFF'; g.strokeStyle = '#3A2210'; g.lineWidth = 2.2; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-4, 0); g.lineTo(-4, -22); g.quadraticCurveTo(0, -27, 4, -22); g.lineTo(4, -8);
    g.quadraticCurveTo(8, -12, 11, -8); g.quadraticCurveTo(15, -11, 17, -6); g.quadraticCurveTo(21, -8, 22, -2);
    g.lineTo(21, 12); g.quadraticCurveTo(18, 22, 6, 22); g.lineTo(-2, 22); g.quadraticCurveTo(-10, 18, -13, 6); g.lineTo(-15, -2); g.quadraticCurveTo(-12, -6, -6, 0); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
}
