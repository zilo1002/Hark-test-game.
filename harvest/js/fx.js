// Juice: pooled particles (world space), number popups, bills flying to the HUD,
// screen shake and confetti. No allocation per frame once the pools are warm.
const MAXP = 900, MAXT = 48, MAXB = 70, MAXC = 220;

export class FX {
  constructor() {
    this.p = Array.from({ length: MAXP }, () => ({ on: false }));
    this.txt = Array.from({ length: MAXT }, () => ({ on: false }));
    this.bills = Array.from({ length: MAXB }, () => ({ on: false }));      // screen space → coin counter
    this.wbills = Array.from({ length: MAXB }, () => ({ on: false }));     // world space arcs (customer → cash pile)
    this.conf = Array.from({ length: MAXC }, () => ({ on: false }));       // screen-space confetti
    this.pi = 0; this.shakeT = 0; this.shakeA = 0; this.flash = 0;
  }
  clear() { for (const a of [this.p, this.txt, this.bills, this.wbills, this.conf]) for (const o of a) o.on = false; this.shakeT = 0; this.flash = 0; }
  _get(arr) { for (let k = 0; k < arr.length; k++) { this.pi = (this.pi + 1) % arr.length; const o = arr[this.pi]; if (!o.on) return o; } return arr[this.pi]; }
  part(x, y, z, vx, vy, vz, life, size, color, type = 'dot') {
    const o = this._get(this.p);
    o.on = true; o.x = x; o.y = y; o.z = z; o.vx = vx; o.vy = vy; o.vz = vz; o.life = life; o.max = life; o.size = size; o.color = color; o.type = type; o.rot = Math.random() * 6; o.vr = (Math.random() - 0.5) * 12;
  }
  burst(x, y, z, n, colors, speed = 60, up = 80, size = 3, type = 'dot', life = 0.7) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = speed * (0.4 + Math.random() * 0.8);
      this.part(x, y, z, Math.cos(a) * s, Math.sin(a) * s * 0.7, up * (0.5 + Math.random()), life * (0.7 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), colors[i % colors.length], type);
    }
  }
  ring(x, y, color = '#FFFFFF', size = 40) { const o = this._get(this.p); o.on = true; o.x = x; o.y = y; o.z = 0; o.vx = o.vy = o.vz = 0; o.life = o.max = 0.5; o.size = size; o.color = color; o.type = 'ring'; }
  text(x, y, z, str, color = '#FFFFFF', big = false) {
    let o = null; for (const t of this.txt) if (!t.on) { o = t; break; } if (!o) o = this.txt[0];
    o.on = true; o.x = x; o.y = y; o.z = z; o.s = str; o.color = color; o.life = o.max = big ? 1.4 : 0.9; o.big = big;
  }
  bill(sx, sy, tx, ty, delay = 0) {
    let o = null; for (const b of this.bills) if (!b.on) { o = b; break; } if (!o) return;
    o.on = true; o.x0 = sx; o.y0 = sy; o.tx = tx; o.ty = ty; o.t = -delay; o.dur = 0.45 + Math.random() * 0.15; o.rot = Math.random() * 6; o.cx = (Math.random() - 0.5) * 120;
  }
  wbill(x0, y0, x1, y1, delay = 0) {
    let o = null; for (const b of this.wbills) if (!b.on) { o = b; break; } if (!o) return;
    o.on = true; o.x0 = x0; o.y0 = y0; o.x1 = x1; o.y1 = y1; o.t = -delay; o.dur = 0.4; o.rot = Math.random() * 6;
  }
  confetti(W, H, n = 160) {
    const cols = ['#FF4D4D', '#FFD23F', '#3BA7FF', '#4CD08A', '#FF6FA8', '#A77BFF', '#FFFFFF'];
    for (let i = 0; i < n; i++) {
      let o = null; for (const c of this.conf) if (!c.on) { o = c; break; } if (!o) break;
      const left = i % 2 === 0;
      o.on = true; o.x = left ? -10 : W + 10; o.y = H * (0.55 + Math.random() * 0.3);
      o.vx = (left ? 1 : -1) * (180 + Math.random() * 380); o.vy = -(500 + Math.random() * 520);
      o.life = o.max = 2.6 + Math.random() * 1.2; o.c = cols[i % cols.length]; o.rot = Math.random() * 6; o.vr = (Math.random() - 0.5) * 14; o.w = 5 + Math.random() * 5; o.h = 3 + Math.random() * 4;
    }
  }
  shake(a, t = 0.25) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }
  update(dt) {
    for (const o of this.p) if (o.on) {
      o.life -= dt; if (o.life <= 0) { o.on = false; continue; }
      if (o.type === 'ring') continue;
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt; o.vz -= 260 * dt; o.rot += o.vr * dt;
      if (o.z < 0) { o.z = 0; o.vz *= -0.35; o.vx *= 0.6; o.vy *= 0.6; }
    }
    for (const o of this.txt) if (o.on) { o.life -= dt; o.z += dt * (o.big ? 24 : 36); if (o.life <= 0) o.on = false; }
    for (const o of this.bills) if (o.on) { o.t += dt; if (o.t >= o.dur) o.on = false; }
    for (const o of this.wbills) if (o.on) { o.t += dt; if (o.t >= o.dur) o.on = false; }
    for (const o of this.conf) if (o.on) { o.life -= dt; o.vy += 900 * dt; o.vx *= 1 - dt * 1.2; o.vy = Math.min(o.vy, 160 + Math.sin(o.life * 6) * 40); o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt; if (o.life <= 0) o.on = false; }
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }
    this.flash = Math.max(0, this.flash - dt * 3);
  }
  shakeOffset() { if (this.shakeT <= 0) return [0, 0]; const a = this.shakeA * Math.min(1, this.shakeT * 4); return [(Math.random() - 0.5) * a, (Math.random() - 0.5) * a]; }
}
