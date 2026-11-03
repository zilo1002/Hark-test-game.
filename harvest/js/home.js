// Home screen between levels: a farm-and-manor estate you restore with stars.
// Drawn on the main canvas in a 360×440 design space (front 3/4 view).
import { CFG } from './config.js';
import { COL } from './sprites.js';
import { person, HERO } from './chars.js';
import { elastic, FONT } from './render.js';

const TAU = Math.PI * 2;
export const SPOTS = {
  barn: [55, 140], windmill: [318, 116], manor: [180, 150], well: [62, 238], tree: [304, 232], greenhouse: [112, 392],
  fountain: [180, 258], hedge: [180, 312], gazebo: [298, 328], pond: [60, 330], arch: [180, 356], bench: [252, 394],
  path: [180, 300], gate: [180, 428],
};
const OL = '#4A3A20';
function shadow(g, x, y, rx, ry) { g.fillStyle = 'rgba(30,70,15,0.25)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
function rr(g, x, y, w, h, r, fill, stroke, lw = 1.4) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
function roundTree(g, t, blossom) {
  shadow(g, 0, 0, 30, 9);
  g.fillStyle = '#7A4A22'; g.fillRect(-5, -30, 10, 30);
  const cols = blossom ? ['#F7A8C8', '#F48DB6', '#FFC4DA', '#FFD9E8', '#FFFFFF'] : ['#3E9A2A', '#378E26', '#4FB233', '#5CC23D', '#7BD655'];
  for (const [x, y, r, i] of [[-16, -42, 18, 0], [16, -42, 18, 1], [0, -60, 22, 2], [-8, -48, 14, 3], [9, -64, 10, 4]]) { g.fillStyle = cols[i]; g.beginPath(); g.arc(x + Math.sin(t + i) * 0.5, y, r, 0, TAU); g.fill(); }
  if (blossom) for (let i = 0; i < 6; i++) { const u = (t * 0.25 + i / 6) % 1; g.fillStyle = 'rgba(255,170,200,0.9)'; g.beginPath(); g.ellipse(-24 + i * 9 + Math.sin(t + i) * 6, -40 + u * 44, 2, 1.2, u * 6, 0, TAU); g.fill(); }
}
function hedgeBlock(g, w, h) {
  rr(g, -w / 2, -h, w, h, 6, COL.hedge, '#3E8E22', 1.2);
  rr(g, -w / 2, -h, w, 6, 5, COL.hedgeTop, null);
  for (let x = -w / 2 + 5; x < w / 2; x += 9) { g.fillStyle = '#9BE460'; g.beginPath(); g.arc(x, -h + 2, 3.4, 0, TAU); g.fill(); }
}
function stonePillar(g, x) { rr(g, x - 6, -34, 12, 34, 2, '#EFE7D4', '#B5A687', 1.2); rr(g, x - 8, -38, 16, 5, 1.5, '#F8F3E8', '#B5A687', 1.2); }

const DRAW = {
  barn(g) {
    shadow(g, 0, 0, 40, 10);
    g.fillStyle = '#C8402A'; g.strokeStyle = OL; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-32, 0); g.lineTo(-32, -34); g.lineTo(-20, -50); g.lineTo(20, -50); g.lineTo(32, -34); g.lineTo(32, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8E3A26'; g.beginPath(); g.moveTo(-36, -32); g.lineTo(-21, -54); g.lineTo(21, -54); g.lineTo(36, -32); g.lineTo(30, -32); g.lineTo(18, -48); g.lineTo(-18, -48); g.lineTo(-30, -32); g.closePath(); g.fill();
    g.fillStyle = '#FFFFFF'; g.fillRect(-12, -26, 24, 26); g.fillStyle = '#A8331F'; g.fillRect(-10, -24, 20, 24);
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, -24); g.lineTo(10, 0); g.moveTo(10, -24); g.lineTo(-10, 0); g.stroke();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(0, -38, 4, 0, TAU); g.fill();
  },
  windmill(g, t) {
    shadow(g, 0, 0, 24, 7);
    g.fillStyle = '#FFF3DC'; g.strokeStyle = OL; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-14, 0); g.lineTo(-9, -58); g.lineTo(9, -58); g.lineTo(14, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#3E6FCC'; g.beginPath(); g.moveTo(-13, -56); g.lineTo(0, -72); g.lineTo(13, -56); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8E5627'; g.beginPath(); g.roundRect(-5, -14, 10, 14, 4); g.fill();
    g.save(); g.translate(0, -60); g.rotate(t * 1.4);
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillStyle = '#FFFFFF'; g.strokeStyle = OL; g.beginPath(); g.rect(3, -4, 32, 8); g.fill(); g.stroke(); g.fillStyle = '#7FB0FF'; g.fillRect(8, -3, 24, 2); }
    g.fillStyle = '#5A3414'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
    g.restore();
  },
  well(g) {
    shadow(g, 0, 0, 22, 7);
    g.fillStyle = '#D9D2C2'; g.strokeStyle = OL; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(0, -8, 16, 6, 0, 0, TAU); g.fill(); g.stroke(); g.fillRect(-16, -8, 32, 9); g.strokeRect(-16, -8, 32, 9);
    g.fillStyle = '#3B7BD9'; g.beginPath(); g.ellipse(0, -9, 12, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#8E5627'; g.fillRect(-15, -34, 3, 26); g.fillRect(12, -34, 3, 26);
    g.fillStyle = '#3E6FCC'; g.beginPath(); g.moveTo(-20, -32); g.lineTo(0, -44); g.lineTo(20, -32); g.closePath(); g.fill(); g.stroke();
  },
  tree(g, t) { roundTree(g, t, true); },
  greenhouse(g, t) {
    shadow(g, 0, 0, 34, 8);
    g.fillStyle = 'rgba(200,240,255,0.75)'; g.strokeStyle = '#F4F4F4'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-30, 0); g.lineTo(-30, -22); g.quadraticCurveTo(0, -48, 30, -22); g.lineTo(30, 0); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.4; for (const x of [-15, 0, 15]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, x === 0 ? -35 : -30); g.stroke(); } g.beginPath(); g.moveTo(-30, -12); g.lineTo(30, -12); g.stroke();
    for (let i = 0; i < 7; i++) { g.fillStyle = ['#F2486E', '#FFC21A', '#E0283C', '#FF8FB0'][i % 4]; g.beginPath(); g.arc(-24 + i * 8, -5 - (i % 2) * 3, 2.6, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-12, -26, 6, 3, -0.5, 0, TAU); g.fill();
  },
  fountain(g, t) {
    shadow(g, 0, 2, 34, 10);
    g.fillStyle = '#E9E0CC'; g.strokeStyle = '#A89A7E'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, -6, 30, 10, 0, 0, TAU); g.fill(); g.stroke(); g.fillRect(-30, -6, 60, 7); g.beginPath(); g.ellipse(0, 1, 30, 10, 0, 0, Math.PI); g.fill(); g.stroke();
    g.fillStyle = '#5DB8F0'; g.beginPath(); g.ellipse(0, -7, 25, 7.5, 0, 0, TAU); g.fill();
    rr(g, -4, -30, 8, 24, 2, '#EFE7D4', '#A89A7E', 1.2);
    g.fillStyle = '#E9E0CC'; g.beginPath(); g.ellipse(0, -30, 11, 4, 0, 0, TAU); g.fill(); g.stroke();
    for (let i = 0; i < 8; i++) { const u = (t * 1.6 + i / 8) % 1, a = i / 8 * TAU; g.fillStyle = `rgba(200,240,255,${1 - u})`; g.beginPath(); g.arc(Math.cos(a) * u * 16, -34 - Math.sin(u * Math.PI) * 10 + u * 22 + Math.sin(a) * u * 4, 2, 0, TAU); g.fill(); }
  },
  hedge(g) { for (const x of [-34, 34]) { g.save(); g.translate(x, 0); hedgeBlock(g, 26, 20); g.restore(); } },
  gazebo(g) {
    shadow(g, 0, 0, 30, 9);
    g.fillStyle = '#F4F0E6'; g.strokeStyle = '#B5A687'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(0, -3, 26, 8, 0, 0, TAU); g.fill(); g.stroke();
    for (const x of [-20, -7, 7, 20]) rr(g, x - 2, -40, 4, 37, 1, '#FFFFFF', '#B5A687', 1);
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(-28, -38); g.quadraticCurveTo(0, -66, 28, -38); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#7FB0FF'; g.beginPath(); g.arc(0, -58, 4, 0, TAU); g.fill();
  },
  pond(g, t) {
    g.fillStyle = '#7FC6E8'; g.strokeStyle = '#D9D2C2'; g.lineWidth = 4; g.beginPath(); g.ellipse(0, 0, 40, 16, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-12, -4, 12, 3, 0, 0, TAU); g.fill();
    for (const [x, y] of [[14, 2], [-20, 6], [22, -6]]) { g.fillStyle = '#5DBB3A'; g.beginPath(); g.arc(x, y + Math.sin(t + x) * 0.6, 4.4, 0.4, TAU - 0.4); g.lineTo(x, y); g.fill(); }
    g.fillStyle = '#FF8FB0'; g.beginPath(); g.arc(14, 1, 2.2, 0, TAU); g.fill(); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(-20, 5, 1.8, 0, TAU); g.fill();
  },
  arch(g) {
    g.strokeStyle = '#3E8F25'; g.lineWidth = 6; g.beginPath(); g.moveTo(-18, 0); g.lineTo(-18, -30); g.arc(0, -30, 18, Math.PI, 0); g.lineTo(18, 0); g.stroke();
    for (let i = 0; i < 12; i++) { const a = Math.PI + i / 11 * Math.PI; const x = i < 1 ? -18 : Math.cos(a) * 18, y = -30 + Math.sin(a) * 18; g.fillStyle = i % 2 ? '#E0283C' : '#FF5A78'; g.beginPath(); g.arc(x, y, 3.4, 0, TAU); g.fill(); }
    for (const x of [-18, 18]) for (let y = -26; y < 0; y += 8) { g.fillStyle = '#E0283C'; g.beginPath(); g.arc(x + (y % 16 ? 2 : -2), y, 3, 0, TAU); g.fill(); }
  },
  bench(g) {
    shadow(g, 0, 0, 22, 5);
    g.fillStyle = '#4A4A55'; g.fillRect(-18, -10, 3, 10); g.fillRect(15, -10, 3, 10);
    rr(g, -20, -13, 40, 4, 1.5, '#C8874A', '#8E5627', 1); rr(g, -20, -24, 40, 4, 1.5, '#C8874A', '#8E5627', 1); rr(g, -20, -19, 40, 4, 1.5, '#D99A5A', '#8E5627', 1);
  },
  path(g) {
    for (let i = 0; i < 12; i++) { const y = -128 + i * 21, x = (i % 2 ? 5 : -5); if (Math.abs(y + 42) < 18) continue; g.fillStyle = '#E3DCCB'; g.strokeStyle = '#B0A68F'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, 14, 6, 0, 0, TAU); g.fill(); g.stroke(); }
  },
  gate(g) {
    g.strokeStyle = '#C9925A'; g.lineWidth = 3;
    for (const [a, b] of [[-172, -26], [26, 172]]) { for (const hh of [-8, -16]) { g.beginPath(); g.moveTo(a, hh); g.lineTo(b, hh); g.stroke(); } for (let x = a; x <= b; x += 14) rr(g, x - 2, -22, 4, 22, 1, '#F7D7A8', '#B57A42', 1); }
    stonePillar(g, -26); stonePillar(g, 26);
    g.strokeStyle = '#3E4048'; g.lineWidth = 1.6;
    for (let x = -18; x <= 18; x += 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -26 - Math.cos(x / 18 * 1.57) * 6); g.stroke(); }
    g.beginPath(); g.moveTo(-20, -12); g.lineTo(20, -12); g.moveTo(-20, -3); g.lineTo(20, -3); g.stroke();
  },
};

function manor(g, painted) {
  shadow(g, 0, 0, 90, 14);
  g.strokeStyle = OL; g.lineWidth = 1.8;
  const wall = painted ? '#FFF4DE' : '#BFB29A', roof = painted ? '#4A6FB5' : '#7E7468';
  rr(g, -72, -70, 144, 70, 2, wall, OL);
  rr(g, -26, -96, 52, 96, 2, painted ? '#FFF9EC' : '#C9BCA4', OL);
  g.fillStyle = roof; g.beginPath(); g.moveTo(-80, -68); g.lineTo(-58, -94); g.lineTo(58, -94); g.lineTo(80, -68); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-32, -94); g.lineTo(0, -124); g.lineTo(32, -94); g.closePath(); g.fill(); g.stroke();
  if (!painted) { g.strokeStyle = 'rgba(70,50,30,0.35)'; g.lineWidth = 1; for (let y = -62; y < 0; y += 8) { g.beginPath(); g.moveTo(-72, y); g.lineTo(72, y + (y % 16 ? 1 : -1)); g.stroke(); } g.strokeStyle = OL; g.lineWidth = 1.8; }
  g.fillStyle = painted ? '#7A4A22' : '#5E4A36'; g.beginPath(); g.roundRect(-11, -34, 22, 34, [11, 11, 0, 0]); g.fill(); g.stroke();
  g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(6, -16, 1.8, 0, TAU); g.fill();
  g.fillStyle = painted ? '#A8DCFF' : '#6E6255'; g.beginPath(); g.arc(0, -66, 8, 0, TAU); g.fill(); g.stroke();
  for (const x of [-54, -36, 36, 54]) for (const y of [-58, -30]) {
    g.fillStyle = painted ? '#A8DCFF' : '#6E6255'; g.beginPath(); g.rect(x - 6, y, 12, 16); g.fill(); g.stroke();
    if (painted) { g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); g.strokeStyle = OL; g.lineWidth = 1.8; g.fillStyle = '#F2486E'; g.fillRect(x - 7, y + 16, 14, 3); }
    else { g.fillStyle = '#9C7A55'; g.save(); g.translate(x, y + 8); g.rotate(0.4); g.fillRect(-8, -1.5, 16, 3); g.restore(); }
  }
  if (painted) for (const x of [-64, 64]) { g.save(); g.translate(x, 0); g.scale(0.5, 0.5); hedgeBlock(g, 30, 22); g.restore(); }
}

export function homeLayout(W, H, land) {
  const top = 56, panelW = land ? Math.min(330, W * 0.42) : 0, bottom = land ? 8 : Math.min(250, H * 0.38);
  const aw = W - panelW, ah = H - top - bottom;
  const s = Math.min(aw / 380, ah / 450);
  return { s, ox: (aw - 360 * s) / 2, oy: top + Math.max(0, (ah - 450 * s) / 2) };
}

export function drawHome(g, W, H, save, t, dpr, land) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9BDB6A'); gr.addColorStop(1, '#6CBF45');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(40,110,20,0.07)'; g.beginPath(); g.ellipse((i * 137) % W, (i * 89) % H, 40, 18, 0, 0, TAU); g.fill(); }
  const { s, ox, oy } = homeLayout(W, H, land);
  g.save(); g.translate(ox, oy); g.scale(s, s);
  for (const [x, y, k] of [[-14, 70, 1], [378, 50, 0.9], [-24, 300, 0.9], [386, 270, 1.1], [10, 470, 0.8], [360, 470, 0.9], [110, 40, 0.7], [250, 34, 0.8]]) { g.save(); g.translate(x, y); g.scale(k, k); roundTree(g, t, false); g.restore(); }
  // the estate lawn with a gravel yard in front of the manor
  g.fillStyle = '#86D14C'; g.beginPath(); g.ellipse(180, 270, 200, 170, 0, 0, TAU); g.fill();
  g.fillStyle = '#E8D7A6'; g.beginPath(); g.ellipse(180, 190, 110, 34, 0, 0, TAU); g.fill();
  const restored = new Set(save.restored);
  const flat = ['path', 'pond'];
  const items = Object.entries(SPOTS).sort((a, b) => (flat.includes(b[0]) - flat.includes(a[0])) || a[1][1] - b[1][1]);
  for (const [id, [x, y]] of items) {
    g.save(); g.translate(x, y);
    const done = restored.has(id), a = done ? elastic((t - (save.restoredAt?.[id] || -9)) / 0.7) : 1;
    if (id === 'manor') { g.scale(0.92 + 0.08 * a, 0.92 + 0.08 * a); manor(g, done); }
    else if (done) { g.scale(a, a); DRAW[id](g, t); }
    if (!done) {   // empty spot: a teal dashed ring with the star price
      const m = CFG.meta.find((q) => q.id === id);
      const ry = id === 'manor' ? 30 : 0;
      g.setLineDash([5, 4]); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.fillStyle = 'rgba(63,208,218,0.45)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, -2 + ry, 22, 9, 0, 0, TAU); g.fill(); g.stroke(); g.setLineDash([]);
      g.font = FONT(11); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#1E5A68'; g.fillStyle = '#FFE14D';
      g.strokeText(`★${m ? m.cost : ''}`, 0, -3 + ry); g.fillText(`★${m ? m.cost : ''}`, 0, -3 + ry);
    }
    g.restore();
  }
  g.save(); g.translate(214, 216); g.scale(1.05, 1.05); person(g, t, 0, false, { ...HERO, carry: Math.sin(t * 3) > 0.3 }); g.restore();
  g.restore();
}
