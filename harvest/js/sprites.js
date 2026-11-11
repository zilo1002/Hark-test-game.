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
  lawn: '#7CCB3E', lawn2: '#6DBB33', lawnDark: '#4F9A26', bed: '#3F7F2A', soil: '#9A5A32', soil2: '#7D4526',
  stone: '#E9E0CC', stoneSide: '#C9BCA0', stoneDark: '#A89A7E', paving: '#D7D2C4', paving2: '#C8C2B2',
  hedge: '#5DB532', hedgeTop: '#8ADB4E', hedgeSide: '#3E8E22', iron: '#4A4A55',
  outline: '#4A2E14', shadow: 'rgba(40,60,20,0.25)', white: '#FFFFFF',
  egg: '#FFF3D6', eggShade: '#EBCB93', potato: '#C98A4B', potatoDark: '#9C6331', tomato: '#EE4630', tomatoDark: '#B92A1C',
  wheat: '#F6CB4A', wheatDark: '#CF9A22', leaf: '#5DBB3A', leafDark: '#3E8F25', bill: '#57C35A', billDark: '#2F8F3A',
  wood: '#C8874A', woodDark: '#8E5627', blue: '#3B7FE0', blueDark: '#2457A8', red: '#E8452C', skin: '#FFD3A8', hair: '#6B3A1E',
  teal: '#3FD0DA', tealDark: '#1E9AAE',
};
const TAU = Math.PI * 2;
function E(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); }

// ---- stack / pile items (unit space, centred at 0,0) -------------------------------
function egg(g) {
  const gr = g.createRadialGradient(-1.6, -2.2, 0.5, 0, 0, 6.5);
  gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.55, COL.egg); gr.addColorStop(1, COL.eggShade);
  g.fillStyle = gr; g.strokeStyle = '#C9A066'; g.lineWidth = 0.7;
  E(g, 0, 0, 4.4, 5.4); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)'; E(g, -1.5, -2.2, 1.1, 1.6, -0.4); g.fill();
}
function potato(g) {
  const gr = g.createRadialGradient(-1.5, -1.8, 0.5, 0, 0, 7);
  gr.addColorStop(0, '#E6AE6C'); gr.addColorStop(0.6, COL.potato); gr.addColorStop(1, COL.potatoDark);
  g.fillStyle = gr; g.strokeStyle = '#7A4A22'; g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(-5.6, 0.4); g.bezierCurveTo(-6, -3.6, -1.5, -4.8, 1.5, -4.2); g.bezierCurveTo(5.6, -3.6, 6.2, 0.2, 5.2, 2.2);
  g.bezierCurveTo(4, 4.6, -1, 4.8, -3.4, 3.8); g.bezierCurveTo(-5, 3.2, -5.4, 2, -5.6, 0.4); g.fill(); g.stroke();
  g.fillStyle = '#8A5428'; for (const [x, y] of [[-2.4, -1], [1.2, 0.8], [3, -1.8], [-0.6, 2.4]]) { g.beginPath(); g.arc(x, y, 0.5, 0, TAU); g.fill(); }
}
function tomato(g) {
  const gr = g.createRadialGradient(-1.6, -1.8, 0.4, 0, 0, 6.5);
  gr.addColorStop(0, '#FF8A6E'); gr.addColorStop(0.55, COL.tomato); gr.addColorStop(1, COL.tomatoDark);
  g.fillStyle = gr; g.strokeStyle = '#8E1E12'; g.lineWidth = 0.7;
  E(g, 0, 0.5, 5.2, 4.6); g.fill(); g.stroke();
  g.fillStyle = COL.leaf; g.strokeStyle = COL.leafDark; g.lineWidth = 0.5;
  g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.2566; g.lineTo(Math.cos(a) * 2.8, -3.4 + Math.sin(a) * 1.4); g.lineTo(Math.cos(a + 0.63) * 0.9, -3.6 + Math.sin(a + 0.63) * 0.5); }
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.75)'; E(g, -2, -1, 1, 1.4, -0.5); g.fill();
}
function wheat(g) {
  g.strokeStyle = COL.wheatDark; g.lineWidth = 0.7;
  for (let i = -3; i <= 3; i++) { g.fillStyle = i % 2 ? COL.wheat : '#FFE07A'; E(g, -2 + i * 0.4, i * 1.1, 4.2, 1.5, -0.25); g.fill(); g.stroke(); }
  g.fillStyle = '#E2B13A'; g.beginPath(); g.moveTo(0, -2.5); g.lineTo(7, -1.2); g.lineTo(7, 1.8); g.lineTo(0, 3); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = COL.red; g.fillRect(1.6, -2.2, 1.6, 4.8);
}
function crate(g) {
  g.fillStyle = '#D79A55'; g.strokeStyle = COL.woodDark; g.lineWidth = 0.8;
  g.beginPath(); g.roundRect(-7.5, -3, 15, 8.5, 1.4); g.fill(); g.stroke();
  g.fillStyle = '#B9783C'; g.fillRect(-7.5, 0.6, 15, 1.2);
  g.fillStyle = '#E9B672'; g.beginPath(); g.roundRect(-7.5, -6, 15, 3.6, 1.2); g.fill(); g.stroke();
  for (let i = -2; i <= 2; i++) { g.fillStyle = COL.egg; g.strokeStyle = '#C9A066'; g.lineWidth = 0.5; E(g, i * 2.8, -5.2, 1.3, 1.6); g.fill(); g.stroke(); }
}
function ketchup(g) {
  g.fillStyle = COL.tomato; g.strokeStyle = '#8E1E12'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(-3.8, 7); g.lineTo(-3.8, -1.5); g.quadraticCurveTo(-3.8, -4, -1.6, -5); g.lineTo(-1.6, -7); g.lineTo(1.6, -7); g.lineTo(1.6, -5);
  g.quadraticCurveTo(3.8, -4, 3.8, -1.5); g.lineTo(3.8, 7); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#FFFFFF'; g.fillRect(-3.8, 0, 7.6, 3.6);
  g.fillStyle = COL.leaf; g.fillRect(-1.6, -8.6, 3.2, 1.8);
  g.fillStyle = COL.tomato; g.beginPath(); g.arc(0, 1.8, 1.2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-3, -2.4, 1, 1.8);
}
// a wrapped bundle lying on its side: paper cone + three blooms at one end
function bundle(g, paper, paperDark, head, headDark, round) {
  g.strokeStyle = paperDark; g.lineWidth = 0.7;
  g.fillStyle = '#4FA62E'; g.fillRect(-7.5, -0.8, 4, 1.6);
  g.fillStyle = paper; g.beginPath(); g.moveTo(-5, -1.2); g.lineTo(2.5, -4.6); g.lineTo(3.2, 4.2); g.lineTo(-5, 1.4); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(-4, -0.9); g.lineTo(2.2, -3.6); g.lineTo(2.4, -1.6); g.closePath(); g.fill();
  for (const [x, y] of [[4.4, -2.6], [5.4, 0.6], [3.8, 2.6]]) {
    const gr = g.createRadialGradient(x - 0.8, y - 0.8, 0.3, x, y, 2.6); gr.addColorStop(0, round ? '#FF9AA0' : '#FFB3C8'); gr.addColorStop(0.6, head); gr.addColorStop(1, headDark);
    g.fillStyle = gr; g.strokeStyle = headDark; g.lineWidth = 0.5;
    if (round) { E(g, x, y, 2.3, 2.3); g.fill(); g.stroke(); g.strokeStyle = 'rgba(90,0,10,0.5)'; g.beginPath(); g.arc(x, y, 1.1, 0.5, 4.5); g.stroke(); }
    else { g.beginPath(); g.moveTo(x - 1.6, y - 1.8); g.lineTo(x - 0.4, y - 0.6); g.lineTo(x + 0.6, y - 2.2); g.lineTo(x + 1.5, y - 0.4); g.lineTo(x + 2.4, y - 1.4); g.quadraticCurveTo(x + 2.6, y + 2.2, x, y + 2.2); g.quadraticCurveTo(x - 2.4, y + 1.8, x - 1.6, y - 1.8); g.fill(); g.stroke(); }
  }
}
function tulip(g) { bundle(g, '#FFB0CF', '#D9709A', '#F2486E', '#B5183E', false); }
function rose(g) { bundle(g, '#FFF4F0', '#D8C0B8', '#E0283C', '#8E0E1E', true); }
function goldHead(g, s = 1) {
  // a golden flower head in 3/4 view: a short cylinder with a petal rim
  g.save(); g.scale(s, s);
  g.fillStyle = '#E08A12'; g.strokeStyle = '#B5660A'; g.lineWidth = 0.6;
  g.beginPath(); g.ellipse(0, 1.2, 6, 3.2, 0, 0, Math.PI); g.lineTo(-6, -0.6); g.ellipse(0, -0.6, 6, 3.2, 0, Math.PI, 0, true); g.closePath(); g.fill(); g.stroke();
  const gr = g.createRadialGradient(-1.4, -1.6, 0.4, 0, -0.6, 6.2); gr.addColorStop(0, '#FFF27A'); gr.addColorStop(0.6, '#FFC21A'); gr.addColorStop(1, '#F29C0E');
  g.fillStyle = gr; E(g, 0, -0.6, 6, 3.2); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(200,110,10,0.55)'; g.lineWidth = 0.45;
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10; g.beginPath(); g.moveTo(Math.cos(a) * 2.2, -0.6 + Math.sin(a) * 1.2); g.lineTo(Math.cos(a) * 5.4, -0.6 + Math.sin(a) * 2.8); g.stroke(); }
  g.fillStyle = '#E07A0A'; E(g, 0, -0.6, 2, 1.1); g.fill();
  g.restore();
}
function gold(g) { goldHead(g, 1); }
function bouquet(g) {
  g.fillStyle = '#C99A5E'; g.strokeStyle = '#8E6430'; g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(-6.5, -2); g.lineTo(6.5, -2); g.lineTo(1.4, 6.5); g.lineTo(-1.4, 6.5); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#E8452C'; g.fillRect(-2.4, 2.2, 4.8, 1.4);
  for (const [x, y] of [[-4, -3], [0, -4.4], [4, -3], [-2, -1.4], [2, -1.4]]) { g.save(); g.translate(x, y); goldHead(g, 0.42); g.restore(); }
  g.fillStyle = '#5DBB3A'; for (const x of [-5.6, 5.2]) { E(g, x, -1.2, 1.4, 0.8, x > 0 ? -0.5 : 0.5); g.fill(); }
}
function basket(g) {
  g.strokeStyle = '#8E5627'; g.lineWidth = 1.1; g.beginPath(); g.ellipse(0, -2, 6, 6.5, 0, Math.PI, 0); g.stroke();
  for (const [x, y, c] of [[-3.4, -2.4, '#F2486E'], [0, -3.6, '#FF7FA8'], [3.4, -2.4, '#F2486E'], [-1.6, -1.2, '#FFB3C8'], [1.8, -1.2, '#E8334A']]) { g.fillStyle = c; g.strokeStyle = '#B5183E'; g.lineWidth = 0.4; E(g, x, y, 1.9, 1.7); g.fill(); g.stroke(); }
  g.fillStyle = '#D9A05A'; g.strokeStyle = '#8E5627'; g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(-6.5, -1); g.lineTo(6.5, -1); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(120,70,20,0.5)'; g.lineWidth = 0.5; for (let i = -4; i <= 4; i += 2) { g.beginPath(); g.moveTo(i, -1); g.lineTo(i * 0.78, 5); g.stroke(); }
  g.beginPath(); g.moveTo(-6, 1.8); g.lineTo(6, 1.8); g.stroke();
}
function perfume(g) {
  const gr = g.createLinearGradient(-4, 0, 4, 0); gr.addColorStop(0, '#FF9CC8'); gr.addColorStop(0.5, '#FFD0E6'); gr.addColorStop(1, '#E85A9C');
  g.fillStyle = gr; g.strokeStyle = '#B23A78'; g.lineWidth = 0.7;
  g.beginPath(); g.roundRect(-4.6, -2, 9.2, 9, 2.6); g.fill(); g.stroke();
  g.fillStyle = '#F4C24A'; g.strokeStyle = '#B38412'; g.beginPath(); g.roundRect(-2, -6.5, 4, 4.6, 1); g.fill(); g.stroke();
  g.fillStyle = '#FFE58A'; g.fillRect(-1.5, -6, 1, 3.4);
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(-3.4, -0.6, 1.2, 5.6);
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(-2.6, 1.2, 5.2, 3, 0.8); g.fill(); g.fillStyle = '#E0283C'; E(g, 0, 2.7, 0.9, 0.9); g.fill();
}
function bill(g) {
  g.fillStyle = COL.bill; g.strokeStyle = COL.billDark; g.lineWidth = 0.8;
  g.beginPath(); g.roundRect(-7, -4, 14, 8, 1.2); g.fill(); g.stroke();
  g.strokeStyle = '#B9F0A8'; g.lineWidth = 0.6; g.strokeRect(-5.6, -2.7, 11.2, 5.4);
  g.fillStyle = '#E9FFE0'; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill();
  g.fillStyle = COL.billDark; g.beginPath(); g.moveTo(-1.6, -0.2); g.lineTo(0, -1.6); g.lineTo(1.6, -0.2); g.closePath(); g.fill(); g.fillRect(-1.2, 0, 2.4, 1.3);
}
// a thick brick of banknotes (cash piles)
function cash(g) {
  g.fillStyle = '#2F8F3A'; g.beginPath(); g.moveTo(-8, -1); g.lineTo(0, -5); g.lineTo(8, -1); g.lineTo(8, 2); g.lineTo(0, 6); g.lineTo(-8, 2); g.closePath(); g.fill();
  g.fillStyle = '#6AD46A'; g.beginPath(); g.moveTo(-8, -1); g.lineTo(0, -5); g.lineTo(8, -1); g.lineTo(0, 3); g.closePath(); g.fill();
  g.strokeStyle = '#E9FFE0'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(0, -1, 2.6, 1.3, 0, 0, TAU); g.stroke();
  g.fillStyle = '#4CB24E'; g.beginPath(); g.moveTo(-8, -1); g.lineTo(0, 3); g.lineTo(0, 6); g.lineTo(-8, 2); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(-8, 0.5); g.lineTo(0, 4.5); g.lineTo(8, 0.5); g.stroke();
}

// ---- v3.3 item icons (zone markers, VIP bubbles, tile icons) ----
function ol(g, fill, stroke, lw = 0.7) { g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = lw; }
function log(g) {
  ol(g, '#9A5A2E', '#5E3414'); g.beginPath(); g.roundRect(-7, -3, 12, 6, 2); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(60,30,10,0.5)'; g.beginPath(); g.moveTo(-5, -1); g.lineTo(2, -1); g.moveTo(-4, 1.4); g.lineTo(3, 1.4); g.stroke();
  ol(g, '#F2CF8A', '#8E5627'); E(g, 5, 0, 2.6, 3); g.fill(); g.stroke();
  g.strokeStyle = '#C99A5E'; g.lineWidth = 0.5; E(g, 5, 0, 1.4, 1.7); g.stroke();
  g.fillStyle = '#5DBB3A'; E(g, -3, -3.6, 1.6, 0.9, -0.4); g.fill();
}
function plank(g) {
  ol(g, '#E9B672', '#8E5627'); g.beginPath(); g.moveTo(-8, -1); g.lineTo(2, -5); g.lineTo(8, -2); g.lineTo(-2, 2); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#C98A4B'; g.beginPath(); g.moveTo(-8, -1); g.lineTo(-2, 2); g.lineTo(-2, 4); g.lineTo(-8, 1); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#B9783C'; g.beginPath(); g.moveTo(-2, 2); g.lineTo(8, -2); g.lineTo(8, 0); g.lineTo(-2, 4); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(140,80,30,0.5)'; g.beginPath(); g.moveTo(-4, -0.6); g.lineTo(4, -3.6); g.stroke();
}
function chair(g) {
  ol(g, '#C8874A', '#6B3A1E', 0.8);
  g.beginPath(); g.roundRect(-5, -9, 10, 8, 1.5); g.fill(); g.stroke();
  g.fillStyle = '#E8452C'; g.beginPath(); g.roundRect(-6, -1, 12, 3, 1); g.fill(); g.stroke();
  g.fillStyle = '#8E5627'; for (const x of [-5, 3.6]) { g.fillRect(x, 2, 1.6, 6); }
  g.strokeStyle = '#E9B672'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3, -6); g.lineTo(3, -6); g.moveTo(-3, -3.5); g.lineTo(3, -3.5); g.stroke();
}
function milk(g) {
  ol(g, '#FFFFFF', '#7A8AA8', 0.8);
  g.beginPath(); g.moveTo(-3.6, 7); g.lineTo(-3.6, -1); g.quadraticCurveTo(-3.6, -3, -1.6, -4); g.lineTo(-1.6, -6); g.lineTo(1.6, -6); g.lineTo(1.6, -4); g.quadraticCurveTo(3.6, -3, 3.6, -1); g.lineTo(3.6, 7); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#3B7FE0'; g.fillRect(-3.6, 0.5, 7.2, 3.4);
  g.fillStyle = '#E8452C'; g.beginPath(); g.roundRect(-2, -8, 4, 2.4, 0.8); g.fill();
  g.fillStyle = 'rgba(180,200,230,0.6)'; g.fillRect(-2.6, -1.6, 1, 7);
}
function cheese(g) {
  ol(g, '#FFD23F', '#B5860A', 0.8);
  g.beginPath(); g.moveTo(-7, 4); g.lineTo(7, 4); g.lineTo(7, -1); g.lineTo(-7, -4); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#FFE58A'; g.beginPath(); g.moveTo(-7, -4); g.lineTo(7, -1); g.lineTo(4, -3.2); g.closePath(); g.fill();
  g.fillStyle = '#E8A20E'; for (const [x, y, r] of [[-3, 1, 1.2], [2, 2, 0.9], [4.6, 0.2, 0.7], [-0.4, -0.6, 0.6]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
}
function icecream(g) {
  ol(g, '#E3A866', '#9C6331'); g.beginPath(); g.moveTo(-3.6, -1); g.lineTo(3.6, -1); g.lineTo(0, 8); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(140,90,40,0.6)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-2.4, 1); g.lineTo(1.8, 4.4); g.moveTo(2.4, 1); g.lineTo(-1.8, 4.4); g.stroke();
  ol(g, '#FFB3C8', '#D9709A'); E(g, 0, -2.6, 4.2, 3.2); g.fill(); g.stroke();
  ol(g, '#FFF3E0', '#D8C0A8'); E(g, 0, -5.8, 3, 2.4); g.fill(); g.stroke();
  g.fillStyle = '#E0283C'; g.beginPath(); g.arc(0.4, -8.4, 1.2, 0, TAU); g.fill();
}
function corn(g) {
  ol(g, '#6CCB3E', '#3E8F25'); g.beginPath(); g.moveTo(-8, 1); g.quadraticCurveTo(-3, -4, 2, -4); g.lineTo(-2, 1); g.closePath(); g.fill(); g.stroke();
  ol(g, '#FFD23F', '#C9962A'); E(g, 1, -0.6, 6.4, 2.8, -0.2); g.fill(); g.stroke();
  g.fillStyle = '#F2B529'; for (let i = -4; i <= 5; i += 2) for (const yy of [-1.6, 0.4]) { g.beginPath(); g.arc(i + 1, yy - i * 0.2, 0.7, 0, TAU); g.fill(); }
  ol(g, '#4FAE32', '#3E8F25'); g.beginPath(); g.moveTo(-8, 1); g.quadraticCurveTo(-2, 4, 3, 2.6); g.lineTo(-2, 0); g.closePath(); g.fill(); g.stroke();
}
function popcorn(g) {
  for (const [x, y] of [[-3, -5], [0, -6.4], [3, -5], [-1.6, -3.6], [1.8, -3.6]]) { ol(g, '#FFF6D0', '#D9C48E', 0.5); g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); g.stroke(); }
  ol(g, '#FFFFFF', '#8E1E12', 0.8); g.beginPath(); g.moveTo(-5, -3); g.lineTo(5, -3); g.lineTo(3.8, 7); g.lineTo(-3.8, 7); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#E8452C'; for (const x of [-3.2, 0.2]) { g.beginPath(); g.moveTo(x, -3); g.lineTo(x + 1.8, -3); g.lineTo(x + 1.6, 7); g.lineTo(x + 0.2, 7); g.closePath(); g.fill(); }
}
function pumpkin(g) {
  ol(g, '#F2871E', '#B5560A', 0.8);
  for (const [x, rx] of [[-3.4, 3.4], [3.4, 3.4], [0, 3.6]]) { E(g, x, 1, rx, 4.6); g.fill(); g.stroke(); }
  g.fillStyle = '#FFAE58'; E(g, -1, -0.6, 1, 2.6); g.fill();
  g.fillStyle = '#6B8E23'; g.fillRect(-0.8, -6, 1.6, 2.6);
  g.fillStyle = '#5DBB3A'; E(g, 2.6, -4.6, 2, 0.9, -0.4); g.fill();
}
function pie(g) {
  ol(g, '#E3A866', '#9C6331', 0.8); E(g, 0, 1.6, 7.4, 3.6); g.fill(); g.stroke();
  g.fillRect(-7.4, -0.4, 14.8, 2); ol(g, '#E8871E', '#B5560A'); E(g, 0, -0.6, 6.4, 2.8); g.fill(); g.stroke();
  g.strokeStyle = '#F2C08A'; g.lineWidth = 1.2; E(g, 0, -0.6, 6.6, 3); g.stroke();
  g.fillStyle = '#FFFFFF'; E(g, 0, -1, 1.8, 0.9); g.fill();
}
function berry(g) {
  ol(g, '#E8243C', '#8E0E1E', 0.8); g.beginPath(); g.moveTo(-4.6, -2); g.quadraticCurveTo(-5, 3, 0, 6.6); g.quadraticCurveTo(5, 3, 4.6, -2); g.quadraticCurveTo(0, -4, -4.6, -2); g.fill(); g.stroke();
  g.fillStyle = '#FFE58A'; for (const [x, y] of [[-2, 0], [1, -0.6], [2.6, 1.6], [-0.6, 2.4], [1, 4], [-2.6, 2.6]]) { E(g, x, y, 0.4, 0.6); g.fill(); }
  ol(g, '#4FAE32', '#2E7D1E', 0.5); g.beginPath(); for (let i = 0; i < 5; i++) { const a = Math.PI + i * Math.PI / 4; g.lineTo(Math.cos(a) * 3.6, -2.6 + Math.sin(a) * 2); g.lineTo(Math.cos(a + 0.4) * 1, -2.6); } g.closePath(); g.fill(); g.stroke();
}
function jarBody(g, glass, lid, label, labelText) {
  ol(g, glass, '#7A1010', 0.8); g.beginPath(); g.roundRect(-4.6, -3, 9.2, 10, 2.4); g.fill(); g.stroke();
  ol(g, lid, '#8E5627', 0.7); g.beginPath(); g.roundRect(-5, -6, 10, 3.4, 1); g.fill(); g.stroke();
  g.fillStyle = label; g.beginPath(); g.roundRect(-3.4, 0, 6.8, 4, 0.8); g.fill();
  g.fillStyle = labelText; g.beginPath(); g.arc(0, 2, 1.1, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(-3.6, -2, 1, 7);
}
function jam(g) { jarBody(g, '#C8102E', '#FFFFFF', '#FFF3E0', '#E8243C'); g.fillStyle = '#E8452C'; for (let x = -4.6; x < 5; x += 2.3) { g.beginPath(); g.arc(x + 1.1, -5.9, 1.1, Math.PI, 0); g.fill(); } }
function honey(g) { jarBody(g, '#FFB80F', '#E8E0D0', '#5A3414', '#FFD23F'); }
function wool(g) {
  for (const [x, y, r] of [[-3, 1, 3.6], [3, 1, 3.6], [0, -2.4, 4], [0, 2.4, 3.6]]) { ol(g, '#FFFFFF', '#B8B0A8', 0.6); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); }
  g.fillStyle = 'rgba(200,190,180,0.5)'; g.beginPath(); g.arc(1.4, 0.6, 1.4, 0, TAU); g.fill();
}
function yarn(g) {
  ol(g, '#FF6FA8', '#B23A78', 0.8); g.beginPath(); g.arc(0, 0, 5.6, 0, TAU); g.fill(); g.stroke();
  g.strokeStyle = '#E8457E'; g.lineWidth = 0.7; for (const a of [-0.6, 0, 0.6]) { g.beginPath(); g.ellipse(0, 0, 5.4, 2.2, a, 0, TAU); g.stroke(); }
  g.strokeStyle = '#FFB3D8'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(4, 3.6); g.quadraticCurveTo(8, 6, 6, 8); g.stroke();
}
function apple(g) {
  ol(g, '#E8283C', '#8E0E1E', 0.8); g.beginPath(); g.moveTo(0, -3); g.bezierCurveTo(-3, -5.6, -6.4, -2, -5.2, 2); g.bezierCurveTo(-4.2, 5.6, -1.4, 6.4, 0, 5.4); g.bezierCurveTo(1.4, 6.4, 4.2, 5.6, 5.2, 2); g.bezierCurveTo(6.4, -2, 3, -5.6, 0, -3); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.7)'; E(g, -2.4, -0.8, 1, 1.6, -0.4); g.fill();
  g.strokeStyle = '#6B3A1E'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -3); g.lineTo(0.6, -6); g.stroke();
  g.fillStyle = '#5DBB3A'; E(g, 2.4, -5.4, 2, 0.9, -0.4); g.fill();
}
function juice(g) {
  ol(g, '#FFF3E0', '#7A8A5A', 0.8); g.beginPath(); g.moveTo(-4, 8); g.lineTo(-4, -3); g.lineTo(0, -7); g.lineTo(4, -3); g.lineTo(4, 8); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#5DBB3A'; g.fillRect(-4, 0, 8, 5);
  g.fillStyle = '#E8283C'; g.beginPath(); g.arc(0, 2.5, 1.7, 0, TAU); g.fill();
  g.fillStyle = '#E8452C'; g.beginPath(); g.arc(1.6, -5, 1, 0, TAU); g.fill();
}
// ---- v3.7 item icons ----
function flour(g) {
  ol(g, '#F6F0E0', '#9C8A60', 0.8); g.beginPath(); g.moveTo(-5.4, 7); g.quadraticCurveTo(-7, 0, -4, -4); g.lineTo(-2, -6); g.lineTo(2, -6); g.lineTo(4, -4); g.quadraticCurveTo(7, 0, 5.4, 7); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#3B7FE0'; g.fillRect(-5.8, 1, 11.6, 2.4);
  g.fillStyle = '#D9C9A0'; g.beginPath(); g.roundRect(-2.4, -7.6, 4.8, 2.4, 1); g.fill();
  g.fillStyle = '#FFC21A'; E(g, 0, -1.6, 1.4, 2); g.fill(); g.strokeStyle = '#C9962A'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -3.4); g.lineTo(0, 0.4); g.stroke();
}
function xiaolongbao(g) {
  ol(g, '#FFF2DA', '#B99464', 0.7); g.beginPath(); g.ellipse(0, 2, 6.4, 5.8, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#FFF9EA'; g.beginPath(); g.ellipse(0, -0.2, 4.1, 3.4, 0, 0, TAU); g.fill();
  g.strokeStyle = '#D5B47F'; g.lineWidth = 0.8; for (let i=-2;i<=2;i++) { g.beginPath(); g.moveTo(i*1.25,-4); g.lineTo(i*0.7,-6); g.stroke(); }
  g.fillStyle = '#D7A96D'; g.beginPath(); g.arc(0,-6,1.1,0,TAU); g.fill();
}
function teasnack(g) {
  ol(g, '#E8C99A', '#9A7148', 0.8); g.beginPath(); g.moveTo(-6,0); g.lineTo(-4,-5); g.lineTo(4,-5); g.lineTo(6,0); g.lineTo(5,5); g.lineTo(-5,5); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#C9475B'; g.beginPath(); g.arc(0,-1,2.3,0,TAU); g.fill(); g.fillStyle='#5B9C4B'; g.beginPath(); g.ellipse(2.2,-3.8,1.3,0.7,-0.5,0,TAU); g.fill();
}
function bread(g) {
  ol(g, '#D9822E', '#8E4A1E', 0.8); E(g, 0, 1, 7.6, 4.4); g.fill(); g.stroke();
  g.fillStyle = '#F2A64E'; E(g, 0, 0, 6.4, 3.2); g.fill();
  g.strokeStyle = '#FFE0A8'; g.lineWidth = 1.1; g.lineCap = 'round'; for (const x of [-3, 0, 3]) { g.beginPath(); g.moveTo(x - 1, 1.2); g.lineTo(x + 1, -1.6); g.stroke(); }
}
function fishBody(g, c, belly, fin, eye) {
  ol(g, fin, fin, 0.6); g.beginPath(); g.moveTo(-4.6, 0); g.lineTo(-8.6, -3.6); g.lineTo(-8, 0); g.lineTo(-8.6, 3.6); g.closePath(); g.fill();
  ol(g, c, fin, 0.8); E(g, 0.4, 0, 6, 3.4); g.fill(); g.stroke();
  g.fillStyle = belly; E(g, 1, 1.4, 4.2, 1.4); g.fill();
  g.fillStyle = fin; g.beginPath(); g.moveTo(-1.6, -3); g.lineTo(1, -5.2); g.lineTo(2.4, -3); g.closePath(); g.fill();
  g.fillStyle = eye; g.beginPath(); g.arc(3.8, -0.8, 0.9, 0, TAU); g.fill();
}
function fish(g) { fishBody(g, '#4FA8F0', '#E8F6FF', '#2F86D0', '#1A1A1A'); }
function smoked(g) { fishBody(g, '#C8702A', '#E8A050', '#8E4A1E', '#3A1A08'); g.fillStyle = '#F2E2B0'; g.fillRect(-1.6, -3.4, 1.2, 6.8); g.fillRect(1.6, -3.4, 1.2, 6.8); }
function grape(g) {
  g.strokeStyle = '#6B3A1E'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -6); g.lineTo(0.6, -8.4); g.stroke();
  g.fillStyle = '#4FAE32'; E(g, 3, -7, 2.8, 1.4, -0.4); g.fill();
  for (const [x, y] of [[-3.4, -4], [0, -4.4], [3.4, -4], [-1.8, -1], [1.8, -1], [-3.6, -1.4], [3.6, -1.4], [0, 2], [-2, 2.4], [2, 2.4], [0, 5]]) { ol(g, (x + y) % 2 ? '#8E4EC0' : '#7A3EA8', '#4A1E70', 0.5); g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill(); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(-0.6, -5, 0.7, 0, TAU); g.fill();
}
function gjuice(g) {
  ol(g, '#F4EEFF', '#6A4A8A', 0.8); g.beginPath(); g.moveTo(-4, 8); g.lineTo(-4, -3); g.lineTo(0, -7); g.lineTo(4, -3); g.lineTo(4, 8); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#8A3EC8'; g.fillRect(-4, 0, 8, 5);
  g.fillStyle = '#C89AF0'; for (const [x, y] of [[-1, 2], [1, 2], [0, 3.6]]) { g.beginPath(); g.arc(x, y, 1, 0, TAU); g.fill(); }
  g.fillStyle = '#6A2E98'; g.beginPath(); g.arc(1.6, -5, 1, 0, TAU); g.fill();
}
function pepper(g) {
  ol(g, '#FFC21A', '#B5860A', 0.8); g.beginPath(); g.moveTo(0, -3.6); g.bezierCurveTo(-6, -5, -6.4, 3, -3, 6); g.quadraticCurveTo(-1.4, 7, 0, 5.8); g.quadraticCurveTo(1.4, 7, 3, 6); g.bezierCurveTo(6.4, 3, 6, -5, 0, -3.6); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.6)'; E(g, -2.6, -0.6, 0.9, 2, 0.2); g.fill();
  g.fillStyle = '#3E9B2A'; g.beginPath(); g.ellipse(0, -4, 3, 1.2, 0, 0, TAU); g.fill(); g.strokeStyle = '#2F7A1E'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -4.4); g.lineTo(0.8, -7); g.stroke();
}
function wine(g) {   // a dark green wine bottle, cream label with a grape, red foil cap
  ol(g, '#2E6B3A', '#173A20', 0.8); g.beginPath(); g.moveTo(-3.6, 8); g.lineTo(-3.6, -1); g.quadraticCurveTo(-3.6, -3.4, -1.4, -4.4); g.lineTo(-1.4, -8); g.lineTo(1.4, -8); g.lineTo(1.4, -4.4); g.quadraticCurveTo(3.6, -3.4, 3.6, -1); g.lineTo(3.6, 8); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#C8283C'; g.fillRect(-1.6, -9, 3.2, 3);
  g.fillStyle = '#FFF3DC'; g.fillRect(-3.6, 1, 7.2, 4.6);
  g.fillStyle = '#7A3EA8'; for (const [x, y] of [[-0.9, 2.6], [0.9, 2.6], [0, 4]]) { g.beginPath(); g.arc(x, y, 0.9, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-2.6, -1.6, 1, 8);
}
function chips(g) {   // v4.6 薯条: golden fries in a red paper scoop
  for (const [x, h, r] of [[-3, 6, -0.2], [-1.2, 8, -0.06], [0.6, 7, 0.08], [2.4, 6.4, 0.2], [-0.2, 9, 0]]) { g.save(); g.translate(x, -1); g.rotate(r); ol(g, '#FFD23F', '#C9962A', 0.5); g.fillRect(-0.9, -h, 1.8, h); g.strokeRect(-0.9, -h, 1.8, h); g.restore(); }
  ol(g, '#E8302C', '#8E1E12', 0.8); g.beginPath(); g.moveTo(-5, -2); g.lineTo(5, -2); g.lineTo(4, 7); g.lineTo(-4, 7); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(0, 2.6, 1.8, 0, TAU); g.fill();
}
export const ITEM_DRAW = { egg, potato, tomato, wheat, crate, ketchup, bill, cash, tulip, rose, gold, bouquet, basket, perfume,
  log, plank, chair, milk, cheese, icecream, corn, popcorn, pumpkin, pie, berry, jam, wool, yarn, honey, apple, juice,
  flour, bread, xiaolongbao, teasnack, fish, smoked, grape, gjuice, pepper, wine, chips };
const ITEM_SIZE = { egg: [12, 13], potato: [14, 12], tomato: [13, 13], wheat: [18, 12], crate: [18, 15], ketchup: [11, 20], bill: [16, 10], cash: [18, 13],
                    tulip: [18, 12], rose: [18, 12], gold: [14, 10], bouquet: [16, 15], basket: [15, 16], perfume: [12, 16],
                    log: [18, 12], plank: [18, 12], chair: [14, 18], milk: [10, 18], cheese: [16, 12], icecream: [11, 19], corn: [18, 12], popcorn: [13, 17], pumpkin: [16, 14], pie: [17, 11], berry: [12, 14], jam: [12, 16], wool: [16, 15], yarn: [15, 15], honey: [12, 16], apple: [13, 14], juice: [10, 18],
                    flour: [15, 17], bread: [17, 11], xiaolongbao: [14, 13], teasnack: [15, 13], fish: [19, 12], smoked: [19, 12], grape: [12, 17], gjuice: [10, 18], pepper: [14, 15], wine: [9, 19], chips: [13, 17] };

// ---- field plants: (0,0) is the ground point, -y up. stage 0 stubble … 4 in bloom ----------------
const TULIP_C = [['#F2486E', '#B5183E'], ['#FF6F9C', '#C9356A'], ['#E8243C', '#9E0E22'], ['#FF8FB0', '#D0507A']];
const ROSE_C = [['#E0283C', '#8E0E1E'], ['#F03A50', '#A01428'], ['#C81E32', '#7A0A16'], ['#FF5A78', '#B02040']];
function stubble(g, col) {
  g.strokeStyle = col; g.lineWidth = 1.1; g.lineCap = 'round';
  for (const [x, h] of [[-2.4, 2.2], [0, 3], [2.2, 2]]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 0.3, -h); g.stroke(); }
  g.fillStyle = 'rgba(60,40,10,0.18)'; E(g, 0, 0, 4.5, 1.6); g.fill();
}
function sprout(g, s, col = '#6CCB3E', dark = '#3E8F25') {
  g.fillStyle = col; g.strokeStyle = dark; g.lineWidth = 0.5;
  for (const a of [-0.55, 0, 0.55]) { g.save(); g.rotate(a); E(g, 0, -4.2 * s, 1.4, 4.2 * s); g.fill(); g.stroke(); g.restore(); }
}
function plantTulip(g, st, v) {
  if (st === 0) return stubble(g, '#5DA53A');
  if (st < 3) return sprout(g, 0.45 + st * 0.25);
  g.fillStyle = 'rgba(20,50,10,0.25)'; E(g, 0, 0.4, 4.6, 1.8); g.fill();
  g.fillStyle = '#4CAF34'; g.strokeStyle = '#2E7D1E'; g.lineWidth = 0.5;
  g.save(); g.rotate(-0.42); E(g, 0, -4.6, 1.6, 4.8); g.fill(); g.stroke(); g.restore();
  g.save(); g.rotate(0.46); E(g, 0, -4, 1.5, 4.2); g.fill(); g.stroke(); g.restore();
  g.strokeStyle = '#3E9A26'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(0.8, -6, 0.2, -12.5); g.stroke();
  const [c, d] = TULIP_C[v & 3];
  if (st === 3) { g.fillStyle = '#7ACB4A'; E(g, 0.2, -13.5, 1.6, 2.6); g.fill(); g.fillStyle = c; E(g, 0.2, -14.6, 1.2, 1.4); g.fill(); return; }
  const y = -15;
  const gr = g.createLinearGradient(-3, 0, 3, 0); gr.addColorStop(0, c); gr.addColorStop(1, d);
  g.fillStyle = gr; g.strokeStyle = d; g.lineWidth = 0.5;
  g.beginPath(); g.moveTo(-2.9, y - 2.6); g.lineTo(-1.4, y - 1.2); g.lineTo(0.2, y - 3.6); g.lineTo(1.6, y - 1.2); g.lineTo(3, y - 2.6);
  g.quadraticCurveTo(3.4, y + 2.8, 0.2, y + 2.9); g.quadraticCurveTo(-3.2, y + 2.8, -2.9, y - 2.6); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.45)'; E(g, -1.2, y, 0.7, 1.6, 0.2); g.fill();
}
function plantGold(g, st, v) {
  if (st === 0) return stubble(g, '#6BAA32');
  if (st < 3) return sprout(g, 0.4 + st * 0.22);
  g.fillStyle = 'rgba(20,50,10,0.22)'; E(g, 0, 0.4, 5.5, 2); g.fill();
  g.fillStyle = '#56B232'; g.strokeStyle = '#2E7D1E'; g.lineWidth = 0.5;
  for (const a of [-0.9, 0.9]) { g.save(); g.rotate(a); E(g, 0, -2.6, 1.6, 3); g.fill(); g.stroke(); g.restore(); }
  g.strokeStyle = '#3E9A26'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -5); g.stroke();
  if (st === 3) { g.save(); g.translate(0, -6.5); g.fillStyle = '#9ED65A'; E(g, 0, 0, 3, 2); g.fill(); g.fillStyle = '#FFD23F'; E(g, 0, -0.6, 2, 1.1); g.fill(); g.restore(); return; }
  g.save(); g.translate(0, -7.2); g.rotate((v - 1.5) * 0.05); goldHead(g, 1.0 + (v & 1) * 0.06); g.restore();
}
function plantRose(g, st, v) {
  if (st === 0) return stubble(g, '#3E8A2A');
  if (st < 3) return sprout(g, 0.45 + st * 0.22, '#4FA62E', '#2E6E1A');
  g.fillStyle = 'rgba(20,40,10,0.28)'; E(g, 0, 0.4, 5.6, 2.1); g.fill();
  for (const [x, y, r, c] of [[-3, -3.6, 3.4, '#2F7A22'], [3, -3.6, 3.4, '#2F7A22'], [0, -5.6, 3.8, '#3F9A2C'], [-1.4, -3, 2.6, '#4CAF34'], [2, -6.4, 2, '#5CC23D']]) { g.fillStyle = c; E(g, x, y, r, r * 0.9); g.fill(); }
  const [c, d] = ROSE_C[v & 3];
  if (st === 3) { g.fillStyle = c; E(g, 0.4, -8.2, 1.4, 1.8); g.fill(); return; }
  const gr = g.createRadialGradient(-0.8, -9.8, 0.4, 0, -8.6, 3.6); gr.addColorStop(0, '#FF8A90'); gr.addColorStop(0.55, c); gr.addColorStop(1, d);
  g.fillStyle = gr; E(g, 0, -8.8, 3.3, 3); g.fill();
  g.strokeStyle = 'rgba(80,0,10,0.55)'; g.lineWidth = 0.5; g.beginPath(); g.arc(0, -8.8, 1.6, 0.3, 4.6); g.stroke(); g.beginPath(); g.arc(0.2, -9, 0.7, 2, 6); g.stroke();
  if (v & 2) { g.fillStyle = d; E(g, 3.4, -5, 1.5, 1.4); g.fill(); }
}
function plantWheat(g, st, v) {
  if (st === 0) return stubble(g, '#C9A040');
  if (st < 3) return sprout(g, 0.5 + st * 0.25, '#8FD45A', '#4E9A2C');
  g.fillStyle = 'rgba(80,60,10,0.18)'; E(g, 0, 0.3, 5, 1.8); g.fill();
  const ripe = st === 4;
  for (let i = -2; i <= 2; i++) {
    const x = i * 1.9, top = -13 - (i & 1) * 1.6 + Math.abs(i) * 0.8, bend = (v - 1.5) * 0.5 + i * 0.5;
    g.strokeStyle = ripe ? '#C9962A' : '#7FBF3A'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x * 0.4, 0); g.quadraticCurveTo(x, top * 0.5, x + bend, top); g.stroke();
    g.fillStyle = ripe ? (i & 1 ? COL.wheat : '#FFE07A') : '#A8DA5E'; g.strokeStyle = ripe ? COL.wheatDark : '#6EAA30'; g.lineWidth = 0.5;
    E(g, x + bend, top - 2.6, 1.3, 3.4, bend * 0.05); g.fill(); g.stroke();
  }
}
function plantPotato(g, st, v) {
  const s = st === 0 ? 0.35 : st < 3 ? 0.45 + st * 0.15 : 1;
  g.save(); g.scale(s * 1.4, s * 1.4);
  g.fillStyle = COL.soil2; E(g, 0, -0.6, 8, 3); g.fill();
  g.strokeStyle = COL.leafDark; g.lineWidth = 0.7;
  for (const [x, y, r] of [[-4.6, -5, 4], [4.6, -5, 4], [0, -8.6, 4.8], [-1.8, -3.6, 3.6], [2.6, -3.6, 3.6]]) { g.fillStyle = st < 4 ? '#7FD05A' : '#58B83A'; E(g, x, y, r, r * 0.8); g.fill(); g.stroke(); }
  if (st >= 4) for (const [x, y] of [[-3, -10], [3, -9.4], [0, -12]]) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(x, y, 0.5, 0, TAU); g.fill(); }
  g.restore();
}
const PLANT_DRAW = { tulip: plantTulip, gold: plantGold, rose: plantRose, wheat: plantWheat, potato: plantPotato };
const PLANT_SIZE = { tulip: [12, 24], gold: [15, 16], rose: [14, 16], wheat: [16, 22], potato: [26, 22] };
export function plantStage(gv) { return gv >= 1 ? 4 : gv < 0.22 ? 0 : gv < 0.5 ? 1 : gv < 0.8 ? 2 : 3; }

// cache: key -> {img, w, h, ax, ay} in units (ax/ay = anchor offset from top-left)
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
      if (variant) g.rotate((variant - 2.5) * 0.18);
      ITEM_DRAW[type](g);
      if (shade) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(120,70,10,0.24)'; g.fillRect(0, 0, c.width, c.height); }
      e = { img: c, w: c.width / s, h: c.height / s };
      this.cache.set(key, e);
    }
    return e;
  }
  plant(crop, stage, v) {
    const key = 'p' + crop + stage + v;
    let e = this.cache.get(key);
    if (!e) {
      const [w, h] = PLANT_SIZE[crop]; const s = this.scale;
      const c = makeCanvas(w * s + 2, h * s + 2), g = c.getContext('2d');
      g.translate(c.width / 2, c.height - 3 * s); g.scale(s, s);
      PLANT_DRAW[crop](g, stage, v);
      e = { img: c, w: c.width / s, h: c.height / s, ax: c.width / s / 2, ay: c.height / s - 3 };
      this.cache.set(key, e);
    }
    return e;
  }
}
