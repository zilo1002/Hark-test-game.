// 动效：粒子、飞行图标、计数器弹跳、浮字、放射光、全屏升级（Web Animations API，只动 transform/opacity）

export const fmt = n => Math.round(n).toLocaleString('en-US');

export const motion = { full: true };
export function setMotion(mode) {
  const os = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  motion.full = mode === 'full' ? true : mode === 'reduced' ? false : !os;
  document.documentElement.classList.toggle('reduced', !motion.full);
}

let layer = null;
let live = 0;
const MAX_LIVE = 160;
export function initFx(el) { layer = el; }

function spawn(cls, html, x, y) {
  if (!layer || live >= MAX_LIVE) return null;
  const el = document.createElement('div');
  el.className = 'fxi ' + cls;
  if (html) el.innerHTML = html;
  el.style.transform = `translate3d(${x}px,${y}px,0)`;
  layer.appendChild(el);
  live++;
  return el;
}
function done(el) { el.remove(); live--; }
function play(el, frames, opts) {
  const a = el.animate(frames, { fill: 'forwards', ...opts });
  a.onfinish = () => done(el);
  a.oncancel = () => done(el);
  return a;
}
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// 计数器：被打到时弹一下
export function bump(el, k = 1.22) {
  if (!el) return;
  if (!motion.full) return;
  el.animate([{ transform: 'scale(1)' }, { transform: `scale(${k})`, offset: 0.35 }, { transform: 'scale(.96)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out' });
}

// 挤压拉伸的“蹦一下”（底部为支点）
export function squash(el, big = false) {
  if (!el || !motion.full) return;
  const a = big ? 1.35 : 1.18;
  el.animate([
    { transform: 'scale(1,1)' },
    { transform: `scale(${a},${2 - a})`, offset: 0.2 },
    { transform: `scale(${2 - a + 0.1},${a})`, offset: 0.45 },
    { transform: 'scale(1.06,.95)', offset: 0.7 },
    { transform: 'scale(1,1)' },
  ], { duration: big ? 520 : 420, easing: 'ease-out' });
}

export function shake(el) {
  if (!el || !motion.full) return;
  el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px) rotate(-.6deg)' }, { transform: 'translateX(4px) rotate(.6deg)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }], { duration: 360 });
}

// 粒子迸散
export function particles(x, y, color = '#E8E1D2', n = 10, spread = 46, cls = 'dot') {
  if (!motion.full) return;
  for (let i = 0; i < n; i++) {
    const el = spawn('p ' + cls, '', x, y);
    if (!el) return;
    el.style.background = color;
    const ang = Math.random() * Math.PI * 2;
    const d = spread * (0.45 + Math.random() * 0.7);
    const dx = Math.cos(ang) * d, dy = Math.sin(ang) * d - spread * 0.35;
    const sc = 0.6 + Math.random() * 0.8;
    play(el, [
      { transform: `translate3d(${x}px,${y}px,0) scale(${sc})`, opacity: 1 },
      { transform: `translate3d(${x + dx}px,${y + dy}px,0) scale(${sc})`, opacity: 0.9, offset: 0.6 },
      { transform: `translate3d(${x + dx * 1.1}px,${y + dy + 14}px,0) scale(0)`, opacity: 0 },
    ], { duration: 520 + Math.random() * 260, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
}

// 泥土小烟
export function puff(x, y) {
  if (!motion.full) return;
  for (let i = 0; i < 6; i++) {
    const el = spawn('p puff', '', x, y);
    if (!el) return;
    const dx = (i - 2.5) * 7 + (Math.random() - 0.5) * 6;
    play(el, [
      { transform: `translate3d(${x}px,${y}px,0) scale(.4)`, opacity: 0.8 },
      { transform: `translate3d(${x + dx}px,${y - 6 - Math.random() * 8}px,0) scale(1.4)`, opacity: 0 },
    ], { duration: 500 + Math.random() * 200, easing: 'ease-out' });
  }
}

// 沿弧线飞到目标，落地回调
export function fly(html, from, to, { delay = 0, dur = 650, lift = 70, cls = 'flyer', onArrive, scale = 1 } = {}) {
  if (!motion.full) { onArrive && onArrive(); return; }
  const el = spawn(cls, html, from.x, from.y);
  if (!el) { onArrive && onArrive(); return; }
  const frames = [];
  const N = 10;
  const cx = (from.x + to.x) / 2 + (Math.random() - 0.5) * 40;
  const cy = Math.min(from.y, to.y) - lift;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x;
    const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y;
    const sc = (i === 0 ? 0.4 : i === 1 ? 1.25 : 1 - t * 0.45) * scale;
    frames.push({ transform: `translate3d(${x}px,${y}px,0) scale(${sc})`, opacity: i === N ? 0.6 : 1 });
  }
  const a = el.animate(frames, { duration: dur, delay, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
  a.onfinish = () => { done(el); onArrive && onArrive(); };
  a.oncancel = () => done(el);
}

// 原地蹦出（挤压拉伸），随后由 fly 接力
export function popAt(html, x, y, delay = 0) {
  if (!motion.full) return;
  const el = spawn('flyer cropf', html, x, y);
  if (!el) return;
  const T = (sx, sy, dy = 0) => `translate3d(${x}px,${y + dy}px,0) scale(${sx},${sy})`;
  play(el, [
    { transform: T(0.2, 0.2), opacity: 0 },
    { transform: T(1.45, 0.6, 4), opacity: 1, offset: 0.25 },
    { transform: T(0.8, 1.35, -14), opacity: 1, offset: 0.55 },
    { transform: T(1.1, 0.92, -10), opacity: 1, offset: 0.85 },
    { transform: T(1, 1, -12), opacity: 0 },
  ], { duration: 260, delay, easing: 'ease-out', fill: 'both' });
}

// 浮字：+1,240
export function floatText(text, x, y, cls = '') {
  if (!layer) return;
  const el = spawn('ftext ' + cls, '', x, y);
  if (!el) return;
  el.textContent = text;
  if (!motion.full) { play(el, [{ transform: `translate3d(${x}px,${y}px,0)`, opacity: 1 }, { transform: `translate3d(${x}px,${y}px,0)`, opacity: 0 }], { duration: 900 }); return; }
  play(el, [
    { transform: `translate3d(${x}px,${y + 10}px,0) scale(.5)`, opacity: 0 },
    { transform: `translate3d(${x}px,${y - 8}px,0) scale(1.25)`, opacity: 1, offset: 0.18 },
    { transform: `translate3d(${x}px,${y - 18}px,0) scale(1)`, opacity: 1, offset: 0.55 },
    { transform: `translate3d(${x}px,${y - 54}px,0) scale(.95)`, opacity: 0 },
  ], { duration: 1300, easing: 'ease-out' });
}

// 放射金线
export function burst(x, y, { n = 14, r = 60, color = '#BFA57A', dur = 600 } = {}) {
  if (!motion.full) return;
  for (let i = 0; i < n; i++) {
    const el = spawn('ray', '', x, y);
    if (!el) return;
    el.style.background = color;
    const ang = i / n * 360 + Math.random() * 8;
    const len = r * (0.7 + Math.random() * 0.5);
    play(el, [
      { transform: `translate3d(${x}px,${y}px,0) rotate(${ang}deg) translateX(6px) scaleX(.1)`, opacity: 1 },
      { transform: `translate3d(${x}px,${y}px,0) rotate(${ang}deg) translateX(${len * 0.5}px) scaleX(1)`, opacity: 1, offset: 0.4 },
      { transform: `translate3d(${x}px,${y}px,0) rotate(${ang}deg) translateX(${len}px) scaleX(.2)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  const ring = spawn('ringfx', '', x, y);
  if (ring) play(ring, [{ transform: `translate3d(${x}px,${y}px,0) scale(.2)`, opacity: 0.9 }, { transform: `translate3d(${x}px,${y}px,0) scale(${r / 20})`, opacity: 0 }], { duration: dur, easing: 'ease-out' });
}

// 小火花（雇工收菜时）
export function sparkle(x, y) {
  if (!motion.full) return;
  const el = spawn('spark', '<svg viewBox="-10 -10 20 20"><path d="M0 -8 L1.6 -1.6 L8 0 L1.6 1.6 L0 8 L-1.6 1.6 L-8 0 L-1.6 -1.6 Z" fill="#BFA57A"/></svg>', x, y);
  if (!el) return;
  play(el, [
    { transform: `translate3d(${x}px,${y}px,0) scale(0) rotate(0)`, opacity: 1 },
    { transform: `translate3d(${x}px,${y - 10}px,0) scale(1.2) rotate(90deg)`, opacity: 1, offset: 0.4 },
    { transform: `translate3d(${x}px,${y - 18}px,0) scale(0) rotate(180deg)`, opacity: 0 },
  ], { duration: 620, easing: 'ease-out' });
}

// 全屏金线升级
export function levelBurst(container, title, sub) {
  const el = document.createElement('div');
  el.className = 'lvburst';
  const rays = motion.full ? Array.from({ length: 28 }, (_, i) => `<i style="--a:${(i / 28 * 360).toFixed(1)}deg;--d:${(Math.random() * 0.2).toFixed(2)}s;--l:${(60 + Math.random() * 40).toFixed(0)}vmax"></i>`).join('') : '';
  el.innerHTML = `<div class="rays">${rays}</div><div class="lvcard"><div class="lvt">${title}</div><div class="lvl"></div><div class="lvs">${sub}</div></div>`;
  container.appendChild(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 500); };
  el.addEventListener('click', close);
  setTimeout(close, 2600);
}

// 数字缓动：每帧逼近目标，大跳快滚
export class Counter {
  constructor(el, v = 0, format = fmt) { this.el = el; this.v = v; this.target = v; this.format = format; this.shown = null; }
  set(t) { this.target = t; }
  snap(t) { this.v = this.target = t; this.render(); }
  step(dt) {
    if (!motion.full) this.v = this.target;
    else if (this.v !== this.target) {
      const d = this.target - this.v;
      const k = Math.min(1, dt * 9);
      let nv = this.v + d * k;
      if (Math.abs(this.target - nv) < 0.5) nv = this.target;
      this.v = nv;
    }
    this.render();
  }
  render() {
    const s = this.format(this.v);
    if (s !== this.shown) { this.el.textContent = s; this.shown = s; }
  }
}

// 萤火虫
export function fireflies(container, n = 14) {
  let html = '';
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 100, y = 20 + Math.random() * 75;
    html += `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--dx:${(Math.random() * 80 - 40).toFixed(0)}px;--dy:${(Math.random() * 60 - 40).toFixed(0)}px;--t:${(9 + Math.random() * 10).toFixed(1)}s;--f:${(2 + Math.random() * 3).toFixed(1)}s;--dl:-${(Math.random() * 10).toFixed(1)}s"></i>`;
  }
  container.innerHTML = html;
}
