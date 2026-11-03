// Floating virtual joystick (touch + mouse) plus WASD / arrow keys.
export class Input {
  constructor(el) {
    this.el = el; this.active = false; this.id = null;
    this.ox = 0; this.oy = 0; this.cx = 0; this.cy = 0; this.R = 54;
    this.keys = new Set(); this.everMoved = false; this.enabled = true;
    this.onFirst = null;
    const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.active) return;
      this.active = true; this.id = e.pointerId;
      [this.ox, this.oy] = pos(e); this.cx = this.ox; this.cy = this.oy;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      if (this.onFirst) this.onFirst();
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('pointermove', (e) => {
      if (!this.active || e.pointerId !== this.id) return;
      [this.cx, this.cy] = pos(e);
      // floating base: follow the finger when it goes past the rim
      const dx = this.cx - this.ox, dy = this.cy - this.oy, d = Math.hypot(dx, dy);
      if (d > this.R) { const k = (d - this.R) / d; this.ox += dx * k; this.oy += dy * k; }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => { if (e.pointerId === this.id) { this.active = false; this.id = null; } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    const map = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    window.addEventListener('keydown', (e) => { const k = map[e.code]; if (k) { this.keys.add(k); if (this.onFirst) this.onFirst(); e.preventDefault(); } });
    window.addEventListener('keyup', (e) => { const k = map[e.code]; if (k) this.keys.delete(k); });
    window.addEventListener('blur', () => { this.keys.clear(); this.active = false; });
  }
  vector() {
    if (!this.enabled) return [0, 0];
    let x = 0, y = 0;
    if (this.active) {
      x = (this.cx - this.ox) / this.R; y = (this.cy - this.oy) / this.R;
      const m = Math.hypot(x, y);
      if (m < 0.12) return [0, 0];
      if (m > 1) { x /= m; y /= m; }
    } else if (this.keys.size) {
      if (this.keys.has('l')) x -= 1; if (this.keys.has('r')) x += 1;
      if (this.keys.has('u')) y -= 1; if (this.keys.has('d')) y += 1;
      const m = Math.hypot(x, y); if (m) { x /= m; y /= m; }
    }
    if (x || y) this.everMoved = true;
    return [x, y];
  }
  draw(g) {
    if (!this.active) return;
    const dx = this.cx - this.ox, dy = this.cy - this.oy, d = Math.hypot(dx, dy), k = d > this.R ? this.R / d : 1;
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3;
    g.beginPath(); g.arc(this.ox, this.oy, this.R, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.arc(this.ox + dx * k, this.oy + dy * k + 3, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(this.ox + dx * k, this.oy + dy * k, 24, 0, Math.PI * 2); g.fill();
  }
}
