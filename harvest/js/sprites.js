// Procedural sprites: everything is drawn with shapes and gradients, then cached
// into small offscreen canvases at the current zoom × devicePixelRatio.
// roundRect polyfill for older Safari / Chromium (draws the same path).
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    const a = Array.isArray(r) ? r : [r];
    const m = Math.min(w, h) / 2, c = (v) => Math.max(0, Math.min(m, v || 0));
    const tl = c(a[0]), tr = c(a.length > 1 ? a[1] : a[0]), br = c(a.length > 2 ? a[2] : a[0]), bl = c(a.length > 3 ? a[3] : (a.length > 1 ? a[1] : a[0]));
    this.moveTo(x + tl, y); this.lineTo(x + w - tr, y); this.arcTo(x + w, y, x + w, y + tr, tr);
    this.lineTo(x + w, y + h - br); this.arcTo(x + w, y + h, x + w - br, y + h, br);
    this.lineTo(x + bl, y + h); this.arcTo(x, y + h, x, y + h - bl, bl);
    this.lineTo(x, y + tl); this.arcTo(x, y, x + tl, y, tl); this.closePath();
    return this;
  };
}

let factory = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function setCanvasFactory(f) { factory = f; }
export function makeCanvas(w, h) { return factory(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); }

export const COL = {
  ground: '#F4C553', ground2: '#EDB443', groundEdge: '#D99A2B', grass: '#7CC84B', grass2: '#5FAE36', grassDark: '#4C9A2C',
  soil: '#B8763E', soil2: '#9E6232', yard: '#F7D77E', fence: '#E0632E', fenceDark: '#A9431C', fenceLight: '#F59056',
  outline: '#5A3414', shadow: 'rgba(90,52,20,0.22)', white: '#FFFFFF',
  egg: '#FFF3D6', eggShade: '#EBCB93', potato: '#C98A4B', potatoDark: '#9C6331', tomato: '#EE4630', tomatoDark: '#B92A1C',
  wheat: '#F6CB4A', wheatDark: '#CF9A22', leaf: '#5DBB3A', leafDark: '#3E8F25', bill: '#57C35A', billDark: '#2F8F3A',
  wood: '#C8874A', woodDark: '#8E5627', blue: '#3BA7FF', blueDark: '#1E6FC2', red: '#E8452C', skin: '#FFD7AE', hair: '#7A3E1D',
};

// ---- item drawers (unit space, centred at 0,0) -------------------------------
function egg(g) {
  const gr = g.createRadialGradient(-1.6, -2.2, 0.5, 0, 0, 6.5);
  gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.55, COL.egg); gr.addColorStop(1, COL.eggShade);
  g.fillStyle = gr; g.strokeStyle = '#C9A066'; g.lineWidth = 0.7;
  g.beginPath(); g.ellipse(0, 0, 4.4, 5.4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(-1.5, -2.2, 1.1, 1.6, -0.4, 0, Math.PI * 2); g.fill();
}
function potato(g) {
  const gr = g.createRadialGradient(-1.5, -1.8, 0.5, 0, 0, 7);
  gr.addColorStop(0, '#E6AE6C'); gr.addColorStop(0.6, COL.potato); gr.addColorStop(1, COL.potatoDark);
  g.fillStyle = gr; g.strokeStyle = '#7A4A22'; g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(-5.6, 0.4); g.bezierCurveTo(-6, -3.6, -1.5, -4.8, 1.5, -4.2); g.bezierCurveTo(5.6, -3.6, 6.2, 0.2, 5.2, 2.2);
  g.bezierCurveTo(4, 4.6, -1, 4.8, -3.4, 3.8); g.bezierCurveTo(-5, 3.2, -5.4, 2, -5.6, 0.4); g.fill(); g.stroke();
  g.fillStyle = '#8A5428'; for (const [x, y] of [[-2.4, -1], [1.2, 0.8], [3, -1.8], [-0.6, 2.4]]) { g.beginPath(); g.arc(x, y, 0.5, 0, 6.3); g.fill(); }
}
function tomato(g) {
  const gr = g.createRadialGradient(-1.6, -1.8, 0.4, 0, 0, 6.5);
  gr.addColorStop(0, '#FF8A6E'); gr.addColorStop(0.55, COL.tomato); gr.addColorStop(1, COL.tomatoDark);
  g.fillStyle = gr; g.strokeStyle = '#8E1E12'; g.lineWidth = 0.7;
  g.beginPath(); g.ellipse(0, 0.5, 5.2, 4.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = COL.leaf; g.strokeStyle = COL.leafDark; g.lineWidth = 0.5;
  g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.2566; g.lineTo(Math.cos(a) * 2.8, -3.4 + Math.sin(a) * 1.4); g.lineTo(Math.cos(a + 0.63) * 0.9, -3.6 + Math.sin(a + 0.63) * 0.5); }
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(-2, -1, 1, 1.4, -0.5, 0, 6.3); g.fill();
}
function wheat(g) {
  g.strokeStyle = COL.wheatDark; g.lineWidth = 0.8;
  for (let i = -2; i <= 2; i++) {
    g.fillStyle = i % 2 ? COL.wheat : '#FFE07A';
    g.beginPath(); g.ellipse(i * 1.6, -2.6 - Math.abs(i) * -0.4, 1.4, 3.8, i * 0.18, 0, 6.3); g.fill(); g.stroke();
  }
  g.fillStyle = '#E2B13A'; g.fillRect(-2.6, 0.4, 5.2, 5); g.strokeRect(-2.6, 0.4, 5.2, 5);
  g.fillStyle = COL.red; g.fillRect(-3, 1.6, 6, 1.6);
}
function crate(g) {
  g.fillStyle = '#D79A55'; g.strokeStyle = COL.woodDark; g.lineWidth = 0.8;
  g.beginPath(); g.roundRect(-7.5, -3, 15, 8.5, 1.4); g.fill(); g.stroke();
  g.fillStyle = '#B9783C'; g.fillRect(-7.5, 0.6, 15, 1.2);
  g.fillStyle = '#E9B672'; g.beginPath(); g.roundRect(-7.5, -6, 15, 3.6, 1.2); g.fill(); g.stroke();
  for (let i = -2; i <= 2; i++) { g.fillStyle = COL.egg; g.strokeStyle = '#C9A066'; g.lineWidth = 0.5; g.beginPath(); g.ellipse(i * 2.8, -5.2, 1.3, 1.6, 0, 0, 6.3); g.fill(); g.stroke(); }
}
function ketchup(g) {
  g.fillStyle = COL.tomato; g.strokeStyle = '#8E1E12'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(-3.8, 7); g.lineTo(-3.8, -1.5); g.quadraticCurveTo(-3.8, -4, -1.6, -5); g.lineTo(-1.6, -7); g.lineTo(1.6, -7); g.lineTo(1.6, -5);
  g.quadraticCurveTo(3.8, -4, 3.8, -1.5); g.lineTo(3.8, 7); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#FFFFFF'; g.fillRect(-3.8, 0, 7.6, 3.6);
  g.fillStyle = COL.leaf; g.fillRect(-1.6, -8.6, 3.2, 1.8);
  g.fillStyle = COL.tomato; g.beginPath(); g.arc(0, 1.8, 1.2, 0, 6.3); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-3, -2.4, 1, 1.8);
}
function bill(g) {
  g.fillStyle = COL.bill; g.strokeStyle = COL.billDark; g.lineWidth = 0.8;
  g.beginPath(); g.roundRect(-7, -4, 14, 8, 1.2); g.fill(); g.stroke();
  g.strokeStyle = '#B9F0A8'; g.lineWidth = 0.6; g.strokeRect(-5.6, -2.7, 11.2, 5.4);
  g.fillStyle = '#E9FFE0'; g.beginPath(); g.arc(0, 0, 2.2, 0, 6.3); g.fill();
  g.fillStyle = COL.billDark; g.font = 'bold 3.6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 0.2);
}

export const ITEM_DRAW = { egg, potato, tomato, wheat, crate, ketchup, bill };
const ITEM_SIZE = { egg: [12, 13], potato: [14, 12], tomato: [13, 13], wheat: [12, 16], crate: [18, 15], ketchup: [11, 20], bill: [16, 10] };

// cache: key -> {img, w, h} in units
export class Sprites {
  constructor() { this.cache = new Map(); this.scale = 1; }
  setScale(s) { if (Math.abs(s - this.scale) > 1e-3) { this.scale = s; this.cache.clear(); } }
  item(type, variant = 0, shade = 0) {
    const key = type + variant + (shade ? 's' : '');
    let e = this.cache.get(key);
    if (!e) {
      const [w, h] = ITEM_SIZE[type]; const s = this.scale;
      const c = makeCanvas(w * s + 2, h * s + 2), g = c.getContext('2d');
      g.translate(c.width / 2, c.height / 2); g.scale(s, s);
      if (variant) g.rotate((variant - 2.5) * 0.4);
      ITEM_DRAW[type](g);
      if (shade) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(150,80,10,0.26)'; g.fillRect(0, 0, c.width, c.height); }
      e = { img: c, w: c.width / s, h: c.height / s };
      this.cache.set(key, e);
    }
    return e;
  }
}
