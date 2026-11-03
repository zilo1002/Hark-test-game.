// 田地渲染：地块、作物、雇工走动（DOM + transform，逐帧更新）
import { FIELD_COLS, FIELD_ROWS, FIELD_H, WORKER_LEVEL, BARN_POS, BOARD_POS, MARKET_POS } from './config.js';
import { cropSVG, workerSVG, groundSVG } from './art.js';
import { stageOf, nextPlotIndex, nextPlotPrice, remainingSec } from './crops.js';
import { fmt } from './fx.js';

export class FieldView {
  constructor(root, onPlotTap) {
    this.root = root;
    this.plotEls = [];
    this.wEls = new Map();
    this.keys = [];
    this.W = 300; this.H = 460;
    root.innerHTML = groundSVG() + '<div class="plots"></div><div class="wlayer"></div>';
    const plotsEl = root.querySelector('.plots');
    for (let i = 0; i < FIELD_COLS * FIELD_ROWS; i++) {
      const c = i % FIELD_COLS, r = Math.floor(i / FIELD_COLS);
      const el = document.createElement('button');
      el.className = 'plot';
      el.dataset.i = i;
      el.style.left = ((c + 0.05) / FIELD_COLS * 100) + '%';
      el.style.top = ((r + 0.05) / FIELD_H * 100) + '%';
      el.style.width = (0.9 / FIELD_COLS * 100) + '%';
      el.style.height = (0.9 / FIELD_H * 100) + '%';
      el.style.setProperty('--d', (Math.random() * 2.4).toFixed(2) + 's');
      el.innerHTML = '<span class="ring"></span><span class="cw"></span><span class="bar"><i></i></span><span class="tag"></span>';
      el.addEventListener('click', () => onPlotTap(i, el));
      plotsEl.appendChild(el);
      this.plotEls.push(el);
      this.keys.push('');
    }
    this.wlayer = root.querySelector('.wlayer');
    const ro = new ResizeObserver(() => this.measure());
    ro.observe(root);
    this.measure();
  }
  measure() {
    const r = this.root.getBoundingClientRect();
    this.W = r.width || 300; this.H = r.height || 460;
  }
  // 场地单位 → 屏幕坐标（给飞行特效用）
  toScreen(x, y) {
    const r = this.root.getBoundingClientRect();
    return { x: r.left + x / FIELD_COLS * r.width, y: r.top + y / FIELD_H * r.height };
  }
  plotScreen(i, dy = 0.5) {
    const c = i % FIELD_COLS, r = Math.floor(i / FIELD_COLS);
    return this.toScreen(c + 0.5, r + dy);
  }
  barnScreen() { return this.toScreen(BARN_POS.x + 0.05, BARN_POS.y - 0.12); }
  boardScreen() { return this.toScreen(BOARD_POS.x, BOARD_POS.y - 0.12); }
  stallScreen() { return this.toScreen(Math.min(2.9, MARKET_POS.x - 0.4), MARKET_POS.y - 0.15); }

  update(s) {
    const nextI = nextPlotIndex(s);
    const price = nextPlotPrice(s);
    for (const p of s.plots) {
      const el = this.plotEls[p.i];
      const st = stageOf(p);
      const key = (p.open ? 'o' : (p.i === nextI ? 'n' : 'l')) + (p.crop || '') + st;
      if (key !== this.keys[p.i]) {
        this.keys[p.i] = key;
        el.classList.toggle('locked', !p.open);
        el.classList.toggle('next', !p.open && p.i === nextI);
        el.classList.toggle('ripe', st === 2);
        el.classList.toggle('growing', st === 0 || st === 1);
        el.querySelector('.cw').innerHTML = p.crop ? cropSVG(p.crop, st) : '';
        el.querySelector('.tag').innerHTML = !p.open && p.i === nextI ? `开垦<br><b>${fmt(price)}</b>` : (!p.open ? '' : '');
      }
      if (!p.open && p.i === nextI) el.classList.toggle('can', s.coins >= price);
      if (st === 0 || st === 1) el.querySelector('.bar i').style.transform = `scaleX(${p.prog.toFixed(3)})`;
    }
    // 雇工
    const seen = new Set();
    for (const w of s.workers) {
      seen.add(w.id);
      let v = this.wEls.get(w.id);
      if (!v) {
        const el = document.createElement('div');
        el.className = 'worker ' + w.type;
        el.innerHTML = `<div class="flip"><div class="bob">${workerSVG(w.type)}</div></div><div class="bub"></div>`;
        this.wlayer.appendChild(el);
        v = { el, flip: el.querySelector('.flip'), bub: el.querySelector('.bub'), lastWalk: w.walk, state: '', fill: -1, dir: 0, bubText: '' };
        this.wEls.set(w.id, v);
      }
      const px = w.x / FIELD_COLS * this.W, py = w.y / FIELD_H * this.H;
      v.el.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0)`;
      v.el.style.zIndex = String(Math.round(w.y * 10));
      const moving = Math.abs(w.walk - v.lastWalk) > 1e-4;
      v.lastWalk = w.walk;
      const state = moving ? 'walk' : (w.st === 'work' ? 'work' : 'rest');
      if (state !== v.state) { v.el.classList.remove('walk', 'work', 'rest'); v.el.classList.add(state); v.state = state; }
      if (w.dir !== v.dir) { v.flip.style.transform = `scaleX(${w.dir < 0 ? -1 : 1})`; v.dir = w.dir; }
      // 筐里的货
      let fill = 0;
      if (w.type === 'harvester') fill = Math.ceil(w.carryN / WORKER_LEVEL.basket[s.wlv.harvester - 1] * 5);
      else if (w.type === 'porter') fill = w.carryN > 0 ? 5 : 0;
      else fill = 5;
      if (fill !== v.fill) { v.el.dataset.fill = fill; v.fill = fill; }
      const bt = w.bub && w.bub.until > s.t ? w.bub.text : '';
      if (bt !== v.bubText) { v.bub.textContent = bt; v.el.classList.toggle('talk', !!bt); v.bubText = bt; }
    }
    for (const [id, v] of this.wEls) if (!seen.has(id)) { v.el.remove(); this.wEls.delete(id); }
  }
  workerEl(id) { const v = this.wEls.get(id); return v && v.el; }
  plotEl(i) { return this.plotEls[i]; }
}

export function plotInfoText(s, p) {
  const sec = Math.ceil(remainingSec(s, p));
  return sec > 0 ? `还要 ${sec} 秒` : '';
}
