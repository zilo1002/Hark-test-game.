// Tiny WebAudio blips + navigator.vibrate ticks. Both are optional and toggleable.
export class Sound {
  constructor() { this.on = true; this.ctx = null; this.last = {}; this.combo = 0; this.comboT = 0; }
  unlock() {
    if (!this.on) return;
    try {
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination); }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (_) { this.ctx = null; }
  }
  blip(f, d = 0.07, type = 'sine', v = 0.15, f2 = null, delay = 0) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.02);
    } catch (_) { /* ignore */ }
  }
  gate(name, ms) { const now = performance.now(); if (now - (this.last[name] || 0) < ms) return false; this.last[name] = now; return true; }
  play(name) {
    if (!this.on || !this.ctx) return;
    const now = performance.now();
    switch (name) {
      case 'pick': {
        if (!this.gate(name, 45)) return;
        if (now - this.comboT > 500) this.combo = 0; this.comboT = now; this.combo = Math.min(this.combo + 1, 24);
        this.blip(520 + this.combo * 28, 0.05, 'sine', 0.09, 900 + this.combo * 30); break;
      }
      case 'harvest': if (this.gate(name, 60)) this.blip(380, 0.08, 'triangle', 0.12, 760); break;
      case 'drop': if (this.gate(name, 55)) this.blip(660, 0.04, 'square', 0.035, 500); break;
      case 'coin': if (this.gate(name, 70)) { this.blip(1320, 0.05, 'square', 0.04); this.blip(1760, 0.08, 'square', 0.035, null, 0.05); } break;
      case 'sale': if (this.gate(name, 120)) this.blip(990, 0.06, 'triangle', 0.08, 1320); break;
      case 'pay': if (this.gate(name, 60)) this.blip(880, 0.04, 'square', 0.03, 1100); break;
      case 'unlock': [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.14, 'triangle', 0.16, null, i * 0.07)); break;
      case 'full': if (this.gate(name, 500)) { this.blip(330, 0.09, 'square', 0.05); this.blip(262, 0.12, 'square', 0.05, null, 0.09); } break;
      case 'appear': if (this.gate(name, 150)) this.blip(700, 0.1, 'sine', 0.09, 1400); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.18, null, i * 0.11)); break;
      case 'tap': this.blip(800, 0.05, 'sine', 0.08, 1000); break;
      case 'restore': [784, 988, 1175, 1568].forEach((f, i) => this.blip(f, 0.16, 'sine', 0.15, null, i * 0.06)); break;
    }
  }
}

export class Haptics {
  constructor() { this.on = true; this.last = 0; this.ok = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'; }
  tick(ms = 12, gap = 70) {
    if (!this.on || !this.ok) return;
    const now = performance.now(); if (now - this.last < gap) return; this.last = now;
    try { navigator.vibrate(ms); } catch (_) { this.ok = false; }
  }
  pattern(p) { if (!this.on || !this.ok) return; try { navigator.vibrate(p); } catch (_) { this.ok = false; } }
}
