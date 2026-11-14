// Home screen between levels: a farm-and-manor estate you restore with stars.
// Drawn on the main canvas in a 360×440 design space (front 3/4 view).
import { CFG } from './config.js';
import { COL } from './sprites.js';
import { person, HERO } from './chars.js';
import { elastic, FONT } from './util.js';
import { heroStyle, petById } from './shop.js';

const TAU = Math.PI * 2;
export const SPOTS = {
  barn: [55, 140], windmill: [318, 116], manor: [180, 150], well: [62, 238], tree: [304, 232], greenhouse: [112, 392],
  fountain: [180, 258], hedge: [180, 312], gazebo: [298, 328], pond: [60, 330], arch: [180, 356], bench: [252, 394],
  path: [180, 300], gate: [180, 428],
};
// page 2 (v3.3): the timber & dairy farm
export const SPOTS2 = {
  dairy: [58, 146], silo: [318, 120], lodge: [180, 150], watertower: [56, 246], orchard: [306, 236], sheepfold: [100, 396],
  cows: [180, 262], cornrow: [180, 338], sawmill: [296, 330], hives: [52, 330], scarecrow: [124, 300], pumpkins: [244, 398],
  fence2: [180, 300], logpile: [244, 290], tractor: [176, 420],
};
const OL = '#4A3A20';
// v4.1 soft contact shadow: a radial fade instead of a hard disc
function shadow(g, x, y, rx, ry) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx * 1.15);
  gr.addColorStop(0, 'rgba(25,60,10,0.34)'); gr.addColorStop(0.6, 'rgba(25,60,10,0.18)'); gr.addColorStop(1, 'rgba(25,60,10,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx * 1.15, 0, TAU); g.fill(); g.restore();
}
function rr(g, x, y, w, h, r, fill, stroke, lw = 1.4) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
// v4.0 四季: the estate follows the season of the real week (border trees, lawn, drifting petals / leaves / snow)
let HSEASON = null;
// v5.0.9 夜市地图: the estate at night — dark ground, lanterns, a market stall, fireflies.
// HNIGHT is set by drawHome from save.night (the frame loop passes it); like HSEASON it
// only affects the estate's look, never gameplay.
let HNIGHT = false;
const NIGHT_GROUND = ['#33523E', '#2A4536', '#3A5A44', '#314E3B', '#6B4A30', '#7A8A4A']; // [grass light, grass dark, plot lawn, plot lawn stripe, soil lip, field crop]
const HS = {
  bg: [['#A8E27A', '#76C84C'], null, ['#C9CC6A', '#A3AE48'], ['#D6E6EF', '#B4CCD9']],
  lawn: ['#92D958', null, '#B9C25A', '#EAF2F6'],
  tree: [['#F7A8C8', '#F48DB6', '#FFC4DA', '#F9B6D0', '#FFFFFF'], null, ['#E8871E', '#C8551E', '#F6C343', '#D9662A', '#FFD86B'], ['#E3EDF2', '#D2E2EA', '#FFFFFF', '#C6D8E2', '#FFFFFF']],
};
function roundTree(g, t, blossom) {
  shadow(g, 4, 0, 32, 10);
  // trunk with a lit side
  g.fillStyle = '#7A4A22'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-4, -32); g.lineTo(4, -32); g.lineTo(6, 0); g.closePath(); g.fill();
  g.fillStyle = '#9A6232'; g.fillRect(-3.5, -30, 3, 28);
  const cols = blossom ? ['#F7A8C8', '#F48DB6', '#FFC4DA', '#FFD9E8', '#FFFFFF'] : (HSEASON !== null && HS.tree[HSEASON]) || ['#3E9A2A', '#378E26', '#4FB233', '#5CC23D', '#7BD655'];
  const sw = Math.sin(t * 0.9) * 0.6;
  // dark under-canopy, main puffs, then light top puffs and a highlight
  g.fillStyle = 'rgba(20,60,10,0.28)'; g.beginPath(); g.ellipse(sw, -36, 27, 10, 0, 0, TAU); g.fill();
  for (const [x, y, r, i] of [[-17, -44, 17, 1], [17, -44, 17, 1], [0, -48, 20, 0], [-10, -62, 17, 2], [11, -62, 16, 2], [0, -74, 13, 3]]) { g.fillStyle = cols[i]; g.beginPath(); g.arc(x + sw * (1 + i * 0.3), y, r, 0, TAU); g.fill(); }
  g.fillStyle = cols[4]; g.globalAlpha = 0.75;
  for (const [x, y, r] of [[-12, -68, 6], [-4, -78, 4.5], [8, -70, 4], [-20, -50, 4]]) { g.beginPath(); g.arc(x + sw * 1.6, y, r, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  if (blossom) for (let i = 0; i < 6; i++) { const u = (t * 0.25 + i / 6) % 1; g.fillStyle = 'rgba(255,170,200,0.9)'; g.beginPath(); g.ellipse(-24 + i * 9 + Math.sin(t + i) * 6, -40 + u * 44, 2, 1.2, u * 6, 0, TAU); g.fill(); }
}
// a little pine for the woods around the farm (page 2 / variety)
function pine(g, k = 1) {
  shadow(g, 3, 0, 20 * k, 7 * k);
  g.fillStyle = '#6E4320'; g.fillRect(-3 * k, -12 * k, 6 * k, 12 * k);
  const c = HSEASON === 3 ? ['#5E8C6A', '#FFFFFF'] : ['#2F7A3A', '#3E9A48'];
  for (let i = 0; i < 3; i++) { const y = -10 * k - i * 13 * k, w = (20 - i * 5) * k; g.fillStyle = c[0]; g.beginPath(); g.moveTo(-w, y); g.lineTo(0, y - 22 * k); g.lineTo(w, y); g.closePath(); g.fill(); g.fillStyle = c[1]; g.beginPath(); g.moveTo(-w * 0.2, y - 2 * k); g.lineTo(0, y - 22 * k); g.lineTo(w * 0.75, y - 2 * k); g.closePath(); g.globalAlpha = HSEASON === 3 ? 0.9 : 0.55; g.fill(); g.globalAlpha = 1; }
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

function cowSide(g, t, k = 1, flip = 1) {   // a small black-and-white cow, side view, grazing
  g.save(); g.scale(k * flip, k);
  shadow(g, 0, 0, 16, 4);
  g.fillStyle = '#FFFFFF'; g.strokeStyle = OL; g.lineWidth = 1.2;
  for (const x of [-9, -5, 5, 9]) { g.fillRect(x - 1.4, -8, 2.8, 8); g.strokeRect(x - 1.4, -8, 2.8, 8); }
  rr(g, -13, -20, 26, 13, 6, '#FFFFFF', OL, 1.2);
  g.fillStyle = '#2A2A30'; g.beginPath(); g.ellipse(-5, -15, 4, 3, 0.3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(5, -12, 3, 2.4, 0, 0, TAU); g.fill();
  const nod = Math.sin(t * 1.4) * 2;
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(15, -15 + nod, 5.4, 4.6, 0.3, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#FFB3B8'; g.beginPath(); g.ellipse(18.6, -12.6 + nod, 3, 2.4, 0.3, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#2A2A30'; g.beginPath(); g.arc(14.6, -17 + nod, 0.9, 0, TAU); g.fill();
  g.fillStyle = '#FFC21A'; g.beginPath(); g.arc(11.6, -9.6, 1.8, 0, TAU); g.fill();
  g.restore();
}
function sheepSide(g, t, k = 1) {
  g.save(); g.scale(k, k); shadow(g, 0, 0, 12, 3.4);
  g.fillStyle = '#3A3036'; for (const x of [-6, -2, 3, 7]) g.fillRect(x - 1, -6, 2, 6);
  for (const [x, y, r] of [[-6, -12, 5], [0, -14, 6], [6, -12, 5], [-3, -9, 4.6], [3, -9, 4.6]]) { g.fillStyle = '#FFFFFF'; g.strokeStyle = '#B8B0A8'; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); }
  g.fillStyle = '#3A3036'; g.beginPath(); g.ellipse(11, -13 + Math.sin(t * 2) * 0.8, 3.4, 4, 0.3, 0, TAU); g.fill();
  g.restore();
}
const DRAW2 = {
  dairy(g) {   // white-trim blue dairy barn with a milk-bottle sign
    shadow(g, 0, 0, 42, 10);
    g.strokeStyle = OL; g.lineWidth = 1.5;
    g.fillStyle = '#5B8FE8'; g.beginPath(); g.moveTo(-34, 0); g.lineTo(-34, -32); g.lineTo(0, -54); g.lineTo(34, -32); g.lineTo(34, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2C559E'; g.beginPath(); g.moveTo(-38, -30); g.lineTo(0, -58); g.lineTo(38, -30); g.lineTo(32, -30); g.lineTo(0, -52); g.lineTo(-32, -30); g.closePath(); g.fill();
    g.fillStyle = '#FFFFFF'; g.fillRect(-12, -26, 24, 26); g.fillStyle = '#3E6FCC'; g.fillRect(-10, -24, 20, 24);
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, -24); g.lineTo(10, 0); g.moveTo(10, -24); g.lineTo(-10, 0); g.stroke();
    rr(g, -5, -46, 10, 13, 3, '#FFFFFF', OL, 1); g.fillStyle = '#E8452C'; g.fillRect(-3, -48, 6, 3);
  },
  silo(g) {
    shadow(g, 0, 0, 22, 7);
    g.strokeStyle = OL; g.lineWidth = 1.5;
    rr(g, -15, -66, 30, 66, 4, '#E9E0CC', OL);
    g.strokeStyle = 'rgba(120,100,70,0.45)'; g.lineWidth = 1; for (let y = -58; y < 0; y += 8) { g.beginPath(); g.moveTo(-15, y); g.lineTo(15, y); g.stroke(); }
    g.strokeStyle = OL; g.lineWidth = 1.5; g.fillStyle = '#E8452C'; g.beginPath(); g.ellipse(0, -66, 15, 6, 0, Math.PI, 0); g.lineTo(15, -66); g.quadraticCurveTo(0, -92, -15, -66); g.fill(); g.stroke();
    g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(0, -40, 5, 0, TAU); g.fill(); g.stroke();
  },
  watertower(g) {
    shadow(g, 0, 0, 20, 6);
    g.strokeStyle = '#8E5627'; g.lineWidth = 3; for (const x of [-12, 12]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x * 0.6, -34); g.stroke(); }
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(-11, -8); g.lineTo(9, -26); g.moveTo(11, -8); g.lineTo(-9, -26); g.stroke();
    rr(g, -14, -58, 28, 26, 4, '#C8874A', OL, 1.5);
    g.strokeStyle = '#8E5627'; g.lineWidth = 1.4; for (const y of [-50, -40]) { g.beginPath(); g.moveTo(-14, y); g.lineTo(14, y); g.stroke(); }
    g.fillStyle = '#3E6FCC'; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-17, -58); g.lineTo(0, -72); g.lineTo(17, -58); g.closePath(); g.fill(); g.stroke();
  },
  orchard(g, t) {
    for (const [x, y, k] of [[-14, 6, 0.7], [16, 0, 0.8]]) {
      g.save(); g.translate(x, y); g.scale(k, k);
      shadow(g, 0, 0, 26, 8); g.fillStyle = '#7A4A22'; g.fillRect(-4, -26, 8, 26);
      for (const [xx, yy, r, c] of [[-14, -38, 16, '#3E9A2A'], [14, -38, 16, '#378E26'], [0, -54, 20, '#4FB233']]) { g.fillStyle = c; g.beginPath(); g.arc(xx + Math.sin(t + xx) * 0.5, yy, r, 0, TAU); g.fill(); }
      for (const [xx, yy] of [[-12, -40], [8, -34], [14, -48], [-4, -58], [-18, -30], [2, -46]]) { g.fillStyle = '#E8283C'; g.beginPath(); g.arc(xx, yy, 3.2, 0, TAU); g.fill(); }
      g.restore();
    }
  },
  sheepfold(g, t) {
    shadow(g, 0, 2, 40, 10);
    g.fillStyle = '#9BDB6A'; g.beginPath(); g.ellipse(0, -4, 38, 12, 0, 0, TAU); g.fill();
    g.save(); g.translate(-12, 0); sheepSide(g, t, 0.9); g.restore(); g.save(); g.translate(14, -6); sheepSide(g, t + 1, 0.8); g.restore();
    g.strokeStyle = '#C9925A'; g.lineWidth = 2.4; for (const yy of [-6, -12]) { g.beginPath(); g.moveTo(-40, yy + 6); g.lineTo(40, yy + 6); g.stroke(); }
    for (let x = -38; x <= 38; x += 13) rr(g, x - 2, -14, 4, 16, 1, '#F7D7A8', '#B57A42', 1);
  },
  cows(g, t) { g.save(); g.translate(-18, 4); cowSide(g, t, 0.9, 1); g.restore(); g.save(); g.translate(22, -4); cowSide(g, t + 2, 0.75, -1); g.restore(); },
  cornrow(g, t) {
    for (const row of [0, 1]) for (let i = 0; i < 6; i++) {
      const x = -40 + i * 16 + row * 8, y = row * 8 - 4, sw = Math.sin(t * 1.5 + i) * 1.5;
      g.strokeStyle = '#4FAE32'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + sw, y - 26); g.stroke();
      g.fillStyle = '#6CCB3E'; g.beginPath(); g.ellipse(x - 4, y - 14, 5, 1.6, -0.5, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x + 4, y - 18, 5, 1.6, 0.5, 0, TAU); g.fill();
      g.fillStyle = '#FFD23F'; g.strokeStyle = '#C9962A'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x + 2 + sw * 0.5, y - 20, 2.2, 4.4, 0.2, 0, TAU); g.fill(); g.stroke();
    }
  },
  sawmill(g, t) {
    shadow(g, 0, 0, 38, 9);
    g.strokeStyle = OL; g.lineWidth = 1.5;
    rr(g, -32, -30, 64, 30, 2, '#C8874A', OL);
    g.strokeStyle = 'rgba(90,50,20,0.45)'; g.lineWidth = 1; for (let x = -26; x < 32; x += 8) { g.beginPath(); g.moveTo(x, -30); g.lineTo(x, 0); g.stroke(); }
    g.fillStyle = '#6B3A1E'; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-38, -28); g.lineTo(-24, -46); g.lineTo(24, -46); g.lineTo(38, -28); g.closePath(); g.fill(); g.stroke();
    g.save(); g.translate(14, -16); g.rotate(t * 4);
    g.fillStyle = '#D8DEE6'; g.beginPath(); for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10, r = i % 2 ? 9 : 11.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#E8452C'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.restore();
    for (const [x, y] of [[-24, -6], [-12, -6], [-18, -14]]) { rr(g, x - 6, y - 4, 12, 8, 4, '#9A5A2E', OL, 1); g.fillStyle = '#F2CF8A'; g.beginPath(); g.arc(x + 6, y, 3.4, 0, TAU); g.fill(); g.stroke(); }
  },
  hives(g, t) {
    for (const [x, y] of [[-12, 0], [12, -4]]) {
      g.save(); g.translate(x, y); shadow(g, 0, 0, 10, 3);
      rr(g, -8, -9, 16, 9, 1, '#FFF6E0', OL, 1.1); rr(g, -8, -18, 16, 9, 1, '#FFF6E0', OL, 1.1);
      g.fillStyle = '#FFC21A'; g.strokeStyle = OL; g.beginPath(); g.moveTo(-10, -18); g.lineTo(0, -24); g.lineTo(10, -18); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#3A2A10'; g.fillRect(-3, -4, 6, 1.6); g.restore();
    }
    for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.6; const x = Math.cos(a) * 18, y = -22 + Math.sin(a * 1.3) * 7; g.fillStyle = '#FFD23F'; g.beginPath(); g.ellipse(x, y, 2.2, 1.6, 0, 0, TAU); g.fill(); g.fillStyle = '#2A2A30'; g.fillRect(x - 0.4, y - 1.6, 0.9, 3.2); }
  },
  scarecrow(g, t) {
    shadow(g, 0, 0, 12, 4);
    g.fillStyle = '#8E5627'; g.fillRect(-1.5, -40, 3, 40); g.fillRect(-16, -30, 32, 3);
    rr(g, -9, -32, 18, 18, 3, '#E8452C', OL, 1.2);
    g.fillStyle = '#F2CF6B'; for (const x of [-17, 15]) { g.beginPath(); g.moveTo(x, -30); g.lineTo(x + 2 * Math.sign(x) * -1 + 1, -24); g.lineTo(x + 3, -30); g.fill(); }
    g.fillStyle = '#F7E2B0'; g.strokeStyle = OL; g.beginPath(); g.arc(0, -40, 7, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#2A1A10'; g.fillRect(-3.4, -42, 2, 2); g.fillRect(1.6, -42, 2, 2);
    g.fillStyle = '#E8BE4E'; g.beginPath(); g.ellipse(0, -46, 11, 2.6, Math.sin(t) * 0.05, 0, TAU); g.fill(); g.stroke(); rr(g, -5, -53, 10, 7, 2, '#E8BE4E', OL, 1);
  },
  pumpkins(g) {
    for (const [x, y, k] of [[-14, 0, 1], [10, 2, 1.2], [-2, -10, 0.8], [24, -6, 0.7]]) {
      g.save(); g.translate(x, y); g.scale(k, k); shadow(g, 0, 0, 10, 3);
      g.fillStyle = '#F2871E'; g.strokeStyle = '#B5560A'; g.lineWidth = 1.1;
      for (const [xx, rx] of [[-4, 4.4], [4, 4.4], [0, 4.6]]) { g.beginPath(); g.ellipse(xx, -6, rx, 6, 0, 0, TAU); g.fill(); g.stroke(); }
      g.fillStyle = '#6B8E23'; g.fillRect(-1, -14, 2, 3); g.restore();
    }
  },
  fence2(g) {
    g.strokeStyle = '#C9925A'; g.lineWidth = 3;
    for (const [a, b] of [[-172, -60], [60, 172]]) { for (const hh of [-8, -16]) { g.beginPath(); g.moveTo(a, hh); g.lineTo(b, hh); g.stroke(); } for (let x = a; x <= b; x += 14) rr(g, x - 2, -22, 4, 22, 1, '#F7D7A8', '#B57A42', 1); }
  },
  logpile(g) {
    shadow(g, 0, 0, 24, 6);
    for (const [x, y] of [[-14, -5], [0, -5], [14, -5], [-7, -15], [7, -15], [0, -25]]) {
      g.fillStyle = '#9A5A2E'; g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 6.4, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#F2CF8A'; g.beginPath(); g.arc(x, y, 4.6, 0, TAU); g.fill(); g.strokeStyle = '#C99A5E'; g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.stroke();
    }
    g.fillStyle = '#C9D2DC'; g.strokeStyle = OL; g.beginPath(); g.moveTo(18, -30); g.lineTo(26, -32); g.lineTo(25, -24); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#A8741E'; g.fillRect(17, -31, 2, 20);
  },
  tractor(g, t) {
    shadow(g, 0, 0, 30, 7);
    g.strokeStyle = OL; g.lineWidth = 1.4;
    rr(g, -22, -24, 30, 14, 3, '#E8452C', OL); rr(g, 2, -40, 18, 24, 3, '#E8452C', OL);
    g.fillStyle = '#A8DCFF'; g.fillRect(5, -36, 12, 10);
    g.fillStyle = '#3A3A44'; g.fillRect(-18, -34, 3, 10);
    for (const [x, r] of [[-14, 7], [12, 11]]) { g.fillStyle = '#24242A'; g.beginPath(); g.arc(x, -r, r, 0, TAU); g.fill(); g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(x, -r, r * 0.45, 0, TAU); g.fill(); }
    const u = (t * 0.7) % 1; g.fillStyle = `rgba(220,220,220,${0.8 * (1 - u)})`; g.beginPath(); g.arc(-17 - u * 4, -38 - u * 14, 2 + u * 4, 0, TAU); g.fill();
  },
};
function lodge(g, painted, t) {   // the log cabin: grey and saggy until restored, then warm logs, red roof, smoke
  shadow(g, 0, 0, 86, 14);
  g.strokeStyle = OL; g.lineWidth = 1.8;
  const log = painted ? '#B9783C' : '#8C8270', log2 = painted ? '#9A5A2E' : '#776E60', roof = painted ? '#C8352A' : '#6E6458';
  rr(g, -70, -66, 140, 66, 3, log, OL);
  g.lineWidth = 1.2; for (let y = -60; y < 0; y += 9) { g.fillStyle = log2; g.fillRect(-70, y, 140, 3); }
  g.fillStyle = painted ? '#F2CF8A' : '#9C9282'; for (let y = -62; y < 0; y += 9) { g.beginPath(); g.arc(-70, y + 4, 4, 0, TAU); g.arc(70, y + 4, 4, 0, TAU); g.fill(); }
  g.lineWidth = 1.8; g.fillStyle = roof; g.beginPath(); g.moveTo(-82, -62); g.lineTo(0, -116); g.lineTo(82, -62); g.closePath(); g.fill(); g.stroke();
  rr(g, 34, -112, 14, 30, 2, painted ? '#9C9282' : '#7E7468', OL);
  if (painted) for (let i = 0; i < 3; i++) { const u = (t * 0.4 + i / 3) % 1; g.fillStyle = `rgba(240,240,240,${0.8 * (1 - u)})`; g.beginPath(); g.arc(41 + Math.sin(u * 6) * 4, -116 - u * 30, 4 + u * 6, 0, TAU); g.fill(); }
  g.fillStyle = painted ? '#7A4A22' : '#5E4A36'; g.beginPath(); g.roundRect(-11, -36, 22, 36, [4, 4, 0, 0]); g.fill(); g.stroke();
  g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(6, -18, 1.8, 0, TAU); g.fill();
  for (const x of [-46, 46]) {
    g.fillStyle = painted ? '#FFE58A' : '#5E5448'; g.beginPath(); g.rect(x - 10, -44, 20, 16); g.fill(); g.stroke();
    if (painted) { g.strokeStyle = '#7A4A22'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, -44); g.lineTo(x, -28); g.moveTo(x - 10, -36); g.lineTo(x + 10, -36); g.stroke(); g.strokeStyle = OL; g.lineWidth = 1.8; for (let k = 0; k < 4; k++) { g.fillStyle = ['#F2486E', '#FFC21A', '#FFFFFF', '#E8283C'][k]; g.beginPath(); g.arc(x - 8 + k * 5.4, -26, 2.2, 0, TAU); g.fill(); } }
    else { g.fillStyle = '#7E6A50'; g.save(); g.translate(x, -36); g.rotate(-0.5); g.fillRect(-11, -1.5, 22, 3); g.restore(); }
  }
  g.fillStyle = painted ? '#FFFFFF' : '#B0A690'; g.beginPath(); g.roundRect(-22, -82, 44, 12, 3); g.fill(); g.stroke();
  g.font = FONT(9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = painted ? '#7A3E1D' : '#6E6458'; g.fillText('半亩牧场', 0, -76);
}

// page 3 (v3.7): the lakeside winery — a lake at the front-left, vineyard and workshops round a stone winery
export const SPOTS3 = {
  winery: [180, 150], glasshouse: [58, 152], watermill: [316, 126], ovens: [54, 246], vines: [306, 238], barrels: [262, 286],
  picnic: [150, 266], lamps: [196, 318], smokehouse: [306, 344], fishrack: [236, 372], lighthouse: [26, 318],
  dock: [130, 358], rowboat: [92, 392], swans: [58, 356], reeds: [150, 412],
};
const LAKE = [92, 372, 86, 42];   // cx, cy, rx, ry in the 360×440 design space
function lake(g, t) {
  const [x, y, rx, ry] = LAKE;
  g.fillStyle = '#D9C99A'; g.beginPath(); g.ellipse(x, y, rx + 7, ry + 6, -0.08, 0, TAU); g.fill();
  const gr = g.createLinearGradient(0, y - ry, 0, y + ry); gr.addColorStop(0, '#7FD0F2'); gr.addColorStop(1, '#3E9BDB');
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, -0.08, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) { const ox = ((i * 37 + t * 6) % (rx * 1.4)) - rx * 0.7, oy = -ry * 0.5 + (i % 3) * ry * 0.4; g.beginPath(); g.moveTo(x + ox - 8, y + oy); g.quadraticCurveTo(x + ox, y + oy - 2, x + ox + 8, y + oy); g.stroke(); }
}
const DRAW3 = {
  glasshouse(g) {   // a glass tomato greenhouse with red and yellow fruit inside
    shadow(g, 0, 0, 38, 9);
    rr(g, -34, -24, 68, 24, 2, 'rgba(205,240,255,0.8)', '#FFFFFF', 2);
    g.fillStyle = 'rgba(190,232,252,0.85)'; g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.moveTo(-36, -24); g.lineTo(0, -46); g.lineTo(36, -24); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 1.2; for (const x of [-22, -11, 0, 11, 22]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -24); g.stroke(); }
    for (let i = 0; i < 9; i++) { g.fillStyle = '#4FAE32'; g.fillRect(-28 + i * 7, -14, 2, 12); g.fillStyle = i % 3 === 2 ? '#FFC21A' : '#E8283C'; g.beginPath(); g.arc(-27 + i * 7, -12 + (i % 2) * 4, 2.6, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-14, -34, 7, 2.6, -0.5, 0, TAU); g.fill();
  },
  watermill(g, t) {   // a stone mill house with a turning water wheel
    shadow(g, 0, 0, 34, 8);
    rr(g, -24, -40, 40, 40, 2, '#E9E0CC', OL, 1.5);
    for (let y = -34; y < 0; y += 8) { g.strokeStyle = 'rgba(120,100,70,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-24, y); g.lineTo(16, y); g.stroke(); }
    g.fillStyle = '#C8452C'; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-30, -38); g.lineTo(-4, -60); g.lineTo(22, -38); g.closePath(); g.fill(); g.stroke();
    rr(g, -10, -20, 12, 20, 2, '#8E5627', OL, 1.2); g.fillStyle = '#A8DCFF'; g.fillRect(-20, -32, 8, 8); g.strokeRect(-20, -32, 8, 8);
    g.save(); g.translate(22, -18); g.rotate(t * 1.2);
    g.strokeStyle = '#7A4A22'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke();
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); rr(g, -2, -18, 4, 9, 1, '#B87436', OL, 0.8); g.strokeStyle = '#7A4A22'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -15); g.stroke(); }
    g.fillStyle = '#5A3414'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.restore();
    g.fillStyle = '#5DB8F0'; g.beginPath(); g.ellipse(24, 0, 14, 4, 0, 0, TAU); g.fill();
  },
  ovens(g, t) {   // two brick bread ovens with glowing mouths and a loaf on the board
    shadow(g, 0, 0, 30, 8);
    for (const [x, k] of [[-12, 1], [13, 0.85]]) {
      g.save(); g.translate(x, 0); g.scale(k, k);
      g.fillStyle = '#C8553A'; g.strokeStyle = OL; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-14, -8); g.arc(0, -8, 14, Math.PI, 0); g.lineTo(14, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#3A1A10'; g.beginPath(); g.arc(0, -4, 6, Math.PI, 0); g.lineTo(6, 0); g.lineTo(-6, 0); g.fill();
      g.fillStyle = `rgba(255,${170 + Math.sin(t * 5 + x) * 30 | 0},60,0.95)`; g.beginPath(); g.arc(0, -2, 4, Math.PI, 0); g.fill();
      g.restore();
    }
    rr(g, -6, -30, 6, 10, 1, '#8E3A26', OL, 1);
    g.fillStyle = '#D9822E'; g.beginPath(); g.ellipse(-2, 3, 7, 3, 0, 0, TAU); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.stroke();
  },
  vines(g) {   // three trellis rows heavy with purple grapes
    for (let r = 0; r < 3; r++) {
      const y = -r * 12, x0 = -30 + r * 4;
      g.fillStyle = '#8E5627'; for (const x of [x0, x0 + 26, x0 + 52]) g.fillRect(x - 1.2, y - 18, 2.4, 18);
      g.strokeStyle = '#6B4A2A'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y - 15); g.lineTo(x0 + 52, y - 15); g.stroke();
      for (let k = 0; k < 7; k++) { const x = x0 + 4 + k * 7.4; g.fillStyle = '#4FAE32'; g.beginPath(); g.ellipse(x, y - 15, 4.6, 3.4, 0, 0, TAU); g.fill(); if (k % 2 === 0) { g.fillStyle = '#7A3EA8'; for (const [dx, dy] of [[-1.4, -11], [1.4, -11], [0, -8.6]]) { g.beginPath(); g.arc(x + dx, y + dy, 1.8, 0, TAU); g.fill(); } } }
    }
  },
  barrels(g) {   // a little pyramid of oak wine barrels
    shadow(g, 0, 0, 28, 7);
    const one = (x, y) => { rr(g, x - 10, y - 18, 20, 18, 6, '#B8743E', OL, 1.3); g.fillStyle = '#3A3A44'; g.fillRect(x - 10, y - 15, 20, 2); g.fillRect(x - 10, y - 5, 20, 2); g.fillStyle = '#E0A060'; g.beginPath(); g.ellipse(x, y - 9, 4, 6, 0, 0, TAU); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.8; g.stroke(); };
    one(-11, 0); one(11, 0); one(0, -16);
    g.fillStyle = '#2E6B3A'; rr(g, 20, -12, 5, 12, 2, '#2E6B3A', OL, 0.8); g.fillStyle = '#C8283C'; g.fillRect(21, -15, 3, 3);
  },
  picnic(g) {   // red gingham picnic table with a bottle and bread
    shadow(g, 0, 0, 24, 6);
    g.fillStyle = '#8E5627'; g.fillRect(-16, -12, 3, 12); g.fillRect(13, -12, 3, 12);
    rr(g, -20, -16, 40, 6, 2, '#E8452C', OL, 1.2);
    g.fillStyle = '#FFFFFF'; for (let i = 0; i < 5; i++) g.fillRect(-18 + i * 8, -16, 4, 6);
    rr(g, -3, -27, 5, 11, 2, '#2E6B3A', OL, 0.8); g.fillStyle = '#D9822E'; g.beginPath(); g.ellipse(9, -18, 6, 2.6, 0, 0, TAU); g.fill();
    rr(g, -24, -6, 10, 3, 1, '#B87436', OL, 0.8); rr(g, 14, -6, 10, 3, 1, '#B87436', OL, 0.8);
  },
  lamps(g, t) {   // a pair of lakeside street lamps
    for (const x of [-40, 40]) {
      shadow(g, x, 0, 7, 2.4);
      rr(g, x - 1.6, -40, 3.2, 40, 1, '#3E4048', null);
      rr(g, x - 5, -48, 10, 9, 2, '#FFE58A', '#3E4048', 1.4);
      g.fillStyle = '#3E4048'; g.beginPath(); g.moveTo(x - 7, -48); g.lineTo(x, -54); g.lineTo(x + 7, -48); g.closePath(); g.fill();
      g.fillStyle = `rgba(255,230,120,${0.25 + 0.1 * Math.sin(t * 3 + x)})`; g.beginPath(); g.arc(x, -44, 12, 0, TAU); g.fill();
    }
  },
  smokehouse(g, t) {   // a plank smoke shed with a big red roof and a stone chimney puffing grey smoke
    shadow(g, 0, 0, 30, 8);
    rr(g, -22, -26, 44, 26, 2, '#7A4A2A', OL, 1.4);
    g.strokeStyle = '#5A3418'; g.lineWidth = 1; for (let x = -16; x < 22; x += 7) { g.beginPath(); g.moveTo(x, -26); g.lineTo(x, 0); g.stroke(); }
    rr(g, -6, -16, 12, 16, 1, '#2A1A10', OL, 1);
    g.fillStyle = '#D2452E'; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-28, -24); g.lineTo(0, -46); g.lineTo(28, -24); g.closePath(); g.fill(); g.stroke();
    rr(g, 10, -52, 8, 18, 1, '#9AA0AA', OL, 1.2);
    for (let i = 0; i < 3; i++) { const u = (t * 0.5 + i / 3) % 1; g.fillStyle = `rgba(150,150,160,${0.75 * (1 - u)})`; g.beginPath(); g.arc(14 + Math.sin(u * 6) * 3, -56 - u * 24, 3 + u * 5, 0, TAU); g.fill(); }
    for (let k = 0; k < 4; k++) { g.fillStyle = '#C8702A'; g.beginPath(); g.ellipse(-15 + k * 10, -20, 2, 4.4, 0, 0, TAU); g.fill(); }
  },
  fishrack(g) {   // a drying rack with fish hanging in a row
    shadow(g, 0, 0, 22, 5);
    g.fillStyle = '#8E5627'; g.fillRect(-20, -30, 3, 30); g.fillRect(17, -30, 3, 30); g.fillRect(-21, -31, 42, 3);
    for (let k = 0; k < 5; k++) { const x = -14 + k * 7; g.strokeStyle = '#E8E0C8'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, -28); g.lineTo(x, -24); g.stroke(); g.fillStyle = k % 2 ? '#4FA8F0' : '#C8702A'; g.beginPath(); g.ellipse(x, -17, 2.4, 6.4, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x, -10.6); g.lineTo(x - 2.6, -7); g.lineTo(x + 2.6, -7); g.fill(); }
    rr(g, -10, -6, 20, 6, 2, '#B87436', OL, 1);
  },
  lighthouse(g, t) {   // a little red-and-white lighthouse with a turning beam
    shadow(g, 0, 0, 14, 4);
    g.strokeStyle = OL; g.lineWidth = 1.3;
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(-9, 0); g.lineTo(-6, -46); g.lineTo(6, -46); g.lineTo(9, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#E8283C';
    g.fillRect(-8.4, -14, 16.8, 7); g.fillRect(-7.4, -32, 14.8, 7);
    rr(g, -7, -56, 14, 10, 2, '#FFE58A', OL, 1.2);
    g.fillStyle = '#E8283C'; g.beginPath(); g.moveTo(-9, -56); g.lineTo(0, -64); g.lineTo(9, -56); g.closePath(); g.fill(); g.stroke();
    const a = Math.sin(t * 1.5); g.fillStyle = 'rgba(255,240,150,0.35)'; g.beginPath(); g.moveTo(0, -51); g.lineTo(28 * a, -60); g.lineTo(28 * a, -42); g.closePath(); g.fill();
  },
  dock(g) {   // a wooden jetty running out onto the lake
    g.fillStyle = 'rgba(30,60,90,0.25)'; g.fillRect(-26, -2, 52, 6);
    for (let i = 0; i < 9; i++) rr(g, -26 + i * 6, -8, 5, 10, 1, i % 2 ? '#C8874A' : '#B87436', '#7A4A22', 0.8);
    g.fillStyle = '#7A4A22'; for (const x of [-24, -2, 20]) g.fillRect(x, 2, 3, 7);
  },
  rowboat(g, t) {   // a little red rowboat bobbing on the water
    const b = Math.sin(t * 1.6) * 1.2;
    g.save(); g.translate(0, b);
    g.fillStyle = '#E8452C'; g.strokeStyle = OL; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-18, -8); g.lineTo(18, -8); g.quadraticCurveTo(14, 2, 0, 2); g.quadraticCurveTo(-14, 2, -18, -8); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#FFFFFF'; g.fillRect(-16, -8, 32, 2);
    g.strokeStyle = '#8E5627'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -10); g.lineTo(-20, 0); g.moveTo(6, -10); g.lineTo(20, 0); g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 3, 22, 3, 0, 0, Math.PI); g.stroke();
  },
  swans(g, t) {   // two white swans gliding
    for (const [x, y, s] of [[-10, 0, 1], [12, -6, -1]]) {
      g.save(); g.translate(x + Math.sin(t * 0.8 + x) * 2, y); g.scale(s, 1);
      g.fillStyle = '#FFFFFF'; g.strokeStyle = '#9AA8B8'; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(0, -4, 8, 4, 0, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(5, -5); g.quadraticCurveTo(9, -10, 6, -15); g.stroke();
      g.fillStyle = '#FF8A3D'; g.beginPath(); g.moveTo(5, -15); g.lineTo(2, -14); g.lineTo(5, -13.6); g.fill();
      g.restore();
    }
  },
  reeds(g, t) {   // a clump of reeds and cattails at the water's edge
    for (let i = 0; i < 9; i++) {
      const x = -16 + i * 4, h = 16 + (i % 3) * 6, sw = Math.sin(t * 1.4 + i) * 1.4;
      g.strokeStyle = i % 2 ? '#4FAE32' : '#3E9A2A'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x, -h / 2, x + sw, -h); g.stroke();
      if (i % 2 === 0) { g.fillStyle = '#7A4A22'; g.beginPath(); g.ellipse(x + sw, -h + 2, 1.6, 3.6, 0, 0, TAU); g.fill(); }
    }
  },
};
function winery(g, painted, t) {   // the lakeside winery: grey and shuttered until restored, then cream stone, terracotta roof, vines and lanterns
  shadow(g, 0, 0, 92, 14);
  g.strokeStyle = OL; g.lineWidth = 1.8;
  const wall = painted ? '#FFF1D6' : '#BFB29A', stone = painted ? '#E8D4A8' : '#A89C86', roof = painted ? '#D9603A' : '#7E7468';
  rr(g, -74, -64, 148, 64, 2, wall, OL);
  rr(g, -74, -14, 148, 14, 2, stone, OL);
  rr(g, 24, -100, 34, 100, 2, painted ? '#FFF6E4' : '#C9BCA4', OL);   // the tower
  g.fillStyle = roof; g.beginPath(); g.moveTo(-82, -62); g.lineTo(-60, -92); g.lineTo(26, -92); g.lineTo(26, -62); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(18, -100); g.lineTo(41, -130); g.lineTo(64, -100); g.closePath(); g.fill(); g.stroke();
  if (painted) { g.strokeStyle = 'rgba(140,50,20,0.45)'; g.lineWidth = 1; for (let y = -86; y < -62; y += 6) { g.beginPath(); g.moveTo(-76 + (y + 92) * 0.7, y); g.lineTo(26, y); g.stroke(); } g.strokeStyle = OL; g.lineWidth = 1.8; }
  else { g.strokeStyle = 'rgba(70,50,30,0.35)'; g.lineWidth = 1; for (let y = -58; y < -14; y += 8) { g.beginPath(); g.moveTo(-74, y); g.lineTo(24, y + (y % 16 ? 1 : -1)); g.stroke(); } g.strokeStyle = OL; g.lineWidth = 1.8; }
  // arched barrel door
  g.fillStyle = painted ? '#8E5627' : '#5E4A36'; g.beginPath(); g.roundRect(-14, -40, 28, 40, [14, 14, 0, 0]); g.fill(); g.stroke();
  if (painted) { g.strokeStyle = '#5A3414'; g.lineWidth = 1.2; for (const x of [-7, 0, 7]) { g.beginPath(); g.moveTo(x, -38); g.lineTo(x, 0); g.stroke(); } g.strokeStyle = OL; g.lineWidth = 1.8; }
  for (const x of [-52, -32]) {
    g.fillStyle = painted ? '#A8DCFF' : '#6E6255'; g.beginPath(); g.roundRect(x - 7, -50, 14, 20, [7, 7, 0, 0]); g.fill(); g.stroke();
    if (painted) { g.fillStyle = '#4FAE32'; g.fillRect(x - 9, -30, 18, 4); for (let k = 0; k < 3; k++) { g.fillStyle = '#7A3EA8'; g.beginPath(); g.arc(x - 5 + k * 5, -27, 1.8, 0, TAU); g.fill(); } }
    else { g.fillStyle = '#9C7A55'; g.save(); g.translate(x, -40); g.rotate(0.45); g.fillRect(-9, -1.5, 18, 3); g.restore(); }
  }
  g.fillStyle = painted ? '#A8DCFF' : '#6E6255'; g.beginPath(); g.arc(41, -76, 8, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.rect(34, -50, 14, 18); g.fill(); g.stroke();
  if (painted) {   // climbing vine over the door, two wine barrels, hanging lanterns
    g.strokeStyle = '#3E9A2A'; g.lineWidth = 3; g.beginPath(); g.moveTo(-20, 0); g.quadraticCurveTo(-24, -46, 0, -50); g.quadraticCurveTo(24, -46, 20, 0); g.stroke();
    for (let k = 0; k < 9; k++) { const a = Math.PI + k / 8 * Math.PI; g.fillStyle = k % 3 ? '#4FAE32' : '#7A3EA8'; g.beginPath(); g.arc(Math.cos(a) * 21, -30 + Math.sin(a) * 20, 3.2, 0, TAU); g.fill(); }
    g.lineWidth = 1.3; g.strokeStyle = OL; for (const x of [-64, 62]) { rr(g, x - 7, -14, 14, 14, 4, '#B8743E', OL, 1.2); g.fillStyle = '#3A3A44'; g.fillRect(x - 7, -11, 14, 1.6); g.fillRect(x - 7, -4, 14, 1.6); }
    for (const x of [-60, -10, 10]) { const y = -60 + Math.sin(t * 2 + x) * 0.8; rr(g, x - 3, y, 6, 8, 3, '#FFC21A', OL, 0.8); g.fillStyle = 'rgba(255,230,120,0.35)'; g.beginPath(); g.arc(x, y + 4, 7, 0, TAU); g.fill(); }
  }
  g.fillStyle = painted ? '#FFFFFF' : '#B0A690'; g.beginPath(); g.roundRect(-58, -84, 60, 13, 3); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.6; g.stroke();
  g.font = FONT(9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = painted ? '#7A2A3A' : '#6E6458'; g.fillText('湖畔酒庄', -28, -77.5);
}

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


// ---- v4.0 B 节日 / 宠物 on the estate -------------------------------------------------------
function jack(g, s = 1, t = 0) {
  g.save(); g.scale(s, s); shadow(g, 0, 0, 10, 3);
  g.fillStyle = 'rgba(255,200,80,0.25)'; g.beginPath(); g.arc(0, -7, 14 + Math.sin(t * 5) * 1, 0, TAU); g.fill();
  for (const [x, c] of [[-5, '#E8761A'], [5, '#E8761A'], [0, '#F2871E']]) { g.fillStyle = c; g.strokeStyle = OL; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, -7, 6, 7, 0, 0, TAU); g.fill(); g.stroke(); }
  g.fillStyle = '#5A8A2A'; g.fillRect(-1, -16, 2.2, 3.4);
  g.fillStyle = '#FFE14D'; g.beginPath(); g.moveTo(-5, -10); g.lineTo(-2, -10); g.lineTo(-3.5, -7.6); g.closePath(); g.moveTo(2, -10); g.lineTo(5, -10); g.lineTo(3.5, -7.6); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-5, -5); g.quadraticCurveTo(0, -1, 5, -5); g.lineTo(3, -4.6); g.lineTo(2, -3.4); g.lineTo(0, -4.4); g.lineTo(-2, -3.4); g.lineTo(-3, -4.6); g.closePath(); g.fill();
  g.restore();
}
function xtree(g, t, s = 1) {
  g.save(); g.scale(s, s); shadow(g, 0, 0, 22, 6);
  g.fillStyle = '#7A4A22'; g.fillRect(-3, -10, 6, 10);
  for (const [y, w] of [[-10, 24], [-24, 19], [-37, 14], [-49, 9]]) { g.fillStyle = '#2F8A3A'; g.strokeStyle = '#1E5A26'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w, y); g.lineTo(0, y - 20); g.lineTo(w, y); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(0, y, w * 0.9, 2.2, 0, 0, TAU); g.fill(); }
  const bc = ['#E8283C', '#FFC21A', '#3BA7FF', '#FF7FAE'];
  for (let k = 0; k < 14; k++) { const lvl = k % 4, y = [-14, -28, -40, -51][lvl], w = [18, 14, 10, 5][lvl], x = ((k * 37) % 21 - 10) / 10 * w, on = Math.sin(t * 4 + k) > -0.3; g.fillStyle = on ? bc[k % 4] : '#8E8E8E'; g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill(); }
  g.fillStyle = '#FFE14D'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.4 : 6, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, -70 + Math.sin(a) * r); } g.closePath(); g.fill();
  for (const [x, c] of [[-14, '#E8283C'], [12, '#3BA7FF'], [2, '#4CD08A']]) { rr(g, x - 5, -8, 10, 8, 1, c, OL, 0.8); g.fillStyle = '#FFC21A'; g.fillRect(x - 0.8, -8, 1.6, 8); }
  g.restore();
}
function lampString(g, t, len) {
  g.fillStyle = '#8E3A26'; g.fillRect(-1.5, -40, 3, 40); g.fillRect(len - 1.5, -40, 3, 40);
  g.strokeStyle = '#3A2210'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -38); g.quadraticCurveTo(len / 2, -26, len, -38); g.stroke();
  const n = Math.max(3, Math.round(len / 16));
  for (let k = 1; k < n; k++) { const u = k / n, x = u * len, y = -38 + Math.sin(u * Math.PI) * 6 + 6 + Math.sin(t * 2 + k) * 0.6;
    rr(g, x - 4, y - 5, 8, 10, 4, '#E8283C', OL, 0.8); g.fillStyle = '#FFC21A'; g.fillRect(x - 2.5, y - 6.4, 5, 1.6); g.fillRect(x - 2.5, y + 4.8, 5, 1.6); g.fillRect(x - 0.4, y + 6.4, 0.8, 3); }
}
// v5.0.9 夜市地图: a warm radial glow (drawn on top of the night tint, so the light stays bright)
function nightGlow(g, x, y, r) {
  const gr = g.createRadialGradient(x, y, 2, x, y, r);
  gr.addColorStop(0, 'rgba(255,205,90,0.34)'); gr.addColorStop(1, 'rgba(255,205,90,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function nightStall(g, t) {
  // a decorative night-market stall (visual only: no build spot, no interaction).
  // Striped awning, warm light spilling from under it, buns and fruit on the counter, one red lantern.
  shadow(g, 0, 0, 30, 6);
  g.fillStyle = '#5A3414'; g.fillRect(-29, -46, 3, 46); g.fillRect(26, -46, 3, 46);
  rr(g, -32, -58, 64, 12, 3, '#E8452C', OL, 1.2);
  g.fillStyle = '#FFF3DC'; for (let k = 0; k < 4; k++) g.fillRect(-24 + k * 16, -58, 8, 12);
  const gr = g.createRadialGradient(0, -30, 2, 0, -30, 34);
  gr.addColorStop(0, 'rgba(255,210,90,0.5)'); gr.addColorStop(1, 'rgba(255,210,90,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, -30, 34, 0, TAU); g.fill();
  rr(g, -27, -18, 54, 18, 2, '#8E5627', OL, 1.2);
  rr(g, -29, -21, 58, 5, 2, '#C8874A', OL, 1);
  for (const [x, c] of [[-18, '#F2CF8A'], [-10, '#E8283C'], [-2, '#FFC21A'], [6, '#F2CF8A'], [14, '#7A3EA8'], [21, '#E8283C']]) { g.fillStyle = c; g.beginPath(); g.arc(x, -24, 3.4, 0, TAU); g.fill(); }
  const sway = Math.sin(t * 1.8) * 1.2;
  g.fillStyle = `rgba(255,210,90,${0.3 + 0.12 * Math.sin(t * 3)})`; g.beginPath(); g.arc(sway, -36, 10, 0, TAU); g.fill();
  g.fillStyle = '#3A2210'; g.fillRect(sway - 0.6, -46, 1.2, 6);
  rr(g, sway - 4.5, -40, 9, 11, 4, '#E8283C', OL, 0.9); g.fillStyle = '#FFC21A'; g.fillRect(sway - 3, -41.5, 6, 1.6); g.fillRect(sway - 3, -30.5, 6, 1.6);
}
// lounging cat (cosmetic): stretched out on its side, breathing, tail swish, the odd ear flick
function cat2d(g, t, col) {
  const B = col.body, W = col.belly || '#FFFFFF', br = 1 + Math.sin(t * 1.8) * 0.03;
  shadow(g, 0, 0, 16, 4);
  g.save(); g.translate(13, -4); g.rotate(Math.sin(t * 1.3) * 0.35 - 0.2); g.strokeStyle = B; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(8, -2, 11, -9); g.stroke(); g.restore();
  g.fillStyle = B; g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.ellipse(2, -5, 13 * br, 6 * br, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = W; g.beginPath(); g.ellipse(1, -2.6, 9, 2.6, 0, 0, TAU); g.fill();
  if (col.stripe) { g.strokeStyle = col.stripe; g.lineWidth = 1.6; for (const x of [-2, 3, 8]) { g.beginPath(); g.moveTo(x, -10.6); g.lineTo(x + 1, -7); g.stroke(); } }
  g.fillStyle = B; for (const x of [-6, -1]) { g.beginPath(); g.ellipse(x, -0.6, 3, 1.6, 0, 0, TAU); g.fill(); }
  const fl = Math.sin(t * 0.7) > 0.96 ? 0.4 : 0;
  g.save(); g.translate(-11, -8); g.fillStyle = B; g.strokeStyle = OL; g.beginPath(); g.arc(0, 0, 5.6, 0, TAU); g.fill(); g.stroke();
  for (const s of [-1, 1]) { g.save(); g.translate(s * 3.4, -4); g.rotate(s * 0.3 + (s < 0 ? -fl : 0)); g.fillStyle = col.ear || B; g.beginPath(); g.moveTo(-2.2, 1); g.lineTo(0, -4); g.lineTo(2.2, 1); g.closePath(); g.fill(); g.fillStyle = '#FFB3C0'; g.beginPath(); g.moveTo(-1, 0.6); g.lineTo(0, -2.2); g.lineTo(1, 0.6); g.closePath(); g.fill(); g.restore(); }
  g.fillStyle = W; g.beginPath(); g.ellipse(0, 2, 3, 2, 0, 0, TAU); g.fill();
  g.strokeStyle = '#1A1A22'; g.lineWidth = 1; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 2.2, -0.6, 1.3, 0.2, Math.PI - 0.2); g.stroke(); }   // sleepy closed eyes
  g.fillStyle = col.nose || '#FF8FA0'; g.beginPath(); g.arc(0, 1.4, 0.8, 0, TAU); g.fill();
  g.restore();
  const z = (t * 0.6) % 1; g.globalAlpha = 1 - z; g.fillStyle = '#5A6A8A'; g.font = FONT(6 + z * 3); g.textAlign = 'center'; g.fillText('z', -14 + z * 6, -18 - z * 10); g.globalAlpha = 1;
}
// the dog sits by the farmer on the estate, tail wagging
function dog2d(g, t, col) {
  const B = col.body, W = col.belly || '#FFFFFF';
  shadow(g, 0, 0, 10, 3);
  g.save(); g.translate(7, -6); g.rotate(Math.sin(t * 9) * 0.5 - 0.6); g.fillStyle = B; g.beginPath(); g.ellipse(0, -4, 2, 5, 0, 0, TAU); g.fill(); g.restore();
  g.fillStyle = B; g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.ellipse(1, -8, 7, 8, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = W; g.beginPath(); g.ellipse(-1, -7, 4, 6, 0, 0, TAU); g.fill();
  if (col.spot) { g.fillStyle = col.spot; g.beginPath(); g.arc(4, -11, 2.4, 0, TAU); g.fill(); }
  g.fillStyle = B; for (const x of [-4, 1]) { g.beginPath(); g.ellipse(x, -1, 2.4, 1.6, 0, 0, TAU); g.fill(); }
  const hb = Math.sin(t * 2) * 0.6;
  g.save(); g.translate(-2, -19 + hb); g.fillStyle = B; g.strokeStyle = OL; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = col.ear || B; for (const s of [-1, 1]) { g.save(); g.translate(s * 5, -1); g.rotate(s * 0.3); g.beginPath(); g.ellipse(0, 2, 2, 4, 0, 0, TAU); g.fill(); g.restore(); }
  g.fillStyle = W; g.beginPath(); g.ellipse(0, 2.6, 3.6, 2.6, 0, 0, TAU); g.fill();
  g.fillStyle = '#1A1A22'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 2.2, -1, 0.9, 0, TAU); g.fill(); }
  g.fillStyle = col.nose || '#2A1A10'; g.beginPath(); g.arc(0, 1.6, 1.1, 0, TAU); g.fill();
  g.fillStyle = '#E8586A'; g.beginPath(); g.ellipse(0.4, 4.6, 1, 1.6, 0, 0, TAU); g.fill();
  g.fillStyle = '#E8283C'; g.fillRect(-4, 5.4, 8, 1.6);
  g.restore();
}

// 商店 decorations on the estate (both pages): free spots round the edge of the lawn
export const DECO_SPOTS = {
  rainbow: [180, 80], statue: [22, 72], balloon: [352, 64], lanterns: [18, 196], scarecrow: [350, 178], arch: [130, 214],
  fountain: [116, 262], bench: [250, 266], windmill: [-2, 292], flowerbed: [350, 300], pond: [22, 408], swing: [334, 410],
  starLamp: [290, 130], moonGate: [70, 330],
};
const DECO2D = {
  jackLamp(g, t) { jack(g, 1.1, t); g.save(); g.translate(13, 3); jack(g, 0.8, t + 1); g.restore(); },
  xmasTree(g, t) { xtree(g, t, 0.9); },
  redLamps(g, t) { g.save(); g.translate(-30, 0); lampString(g, t, 60); g.restore(); },
  bench(g) { shadow(g, 0, 0, 18, 4); rr(g, -16, -10, 32, 4, 1.5, '#C8874A', OL, 1); rr(g, -16, -18, 32, 5, 1.5, '#B87436', OL, 1); g.fillStyle = '#5A3414'; g.fillRect(-13, -6, 2.4, 6); g.fillRect(11, -6, 2.4, 6); },
  lanterns(g, t) {
    shadow(g, 0, 0, 20, 4); g.fillStyle = '#5A3414'; g.fillRect(-19, -36, 2.4, 36); g.fillRect(17, -36, 2.4, 36);
    g.strokeStyle = '#3A2210'; g.lineWidth = 1; g.beginPath(); g.moveTo(-18, -34); g.quadraticCurveTo(0, -28, 18, -34); g.stroke();
    for (const [x, k] of [[-9, 0], [0, 1], [9, 2]]) { const y = -26 + Math.sin(t * 2 + k) * 0.8; rr(g, x - 4, y - 5, 8, 10, 4, '#E8283C', OL, 1); g.fillStyle = '#FFC21A'; g.fillRect(x - 2.5, y - 6.5, 5, 1.6); g.fillRect(x - 2.5, y + 4.8, 5, 1.6); g.fillStyle = 'rgba(255,230,120,0.5)'; g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill(); }
  },
  scarecrow(g, t) {
    shadow(g, 0, 0, 12, 4); g.fillStyle = '#8E5627'; g.fillRect(-1.5, -40, 3, 40); g.save(); g.rotate(Math.sin(t * 1.5) * 0.04); g.fillRect(-16, -30, 32, 3);
    rr(g, -8, -32, 16, 15, 3, '#3B7FE0', OL, 1); g.fillStyle = '#E8452C'; g.fillRect(-6, -28, 4, 4); g.fillStyle = '#F2CF6B'; g.beginPath(); g.moveTo(-16, -29); g.lineTo(-21, -26); g.lineTo(-16, -26); g.moveTo(16, -29); g.lineTo(21, -26); g.lineTo(16, -26); g.fill();
    g.fillStyle = '#F2CF8A'; g.beginPath(); g.arc(0, -38, 6, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#3A2210'; g.fillRect(-3, -39, 1.6, 1.6); g.fillRect(1.6, -39, 1.6, 1.6);
    g.fillStyle = '#E8BE4E'; g.beginPath(); g.ellipse(0, -43, 11, 3, 0, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.ellipse(0, -46, 6, 4.5, 0, Math.PI, 0); g.fill(); g.stroke(); g.restore();
  },
  flowerbed(g, t) {
    shadow(g, 0, 1, 20, 6); g.fillStyle = '#C9A27A'; g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.ellipse(0, -4, 18, 6, 0, 0, TAU); g.fill(); g.stroke(); g.fillRect(-18, -4, 36, 5); g.fillStyle = '#7A4A22'; g.beginPath(); g.ellipse(0, -5, 15, 4.4, 0, 0, TAU); g.fill();
    const fc = ['#FF6F92', '#FFE16B', '#FFFFFF', '#B07ACC', '#FF8A3D']; for (let k = 0; k < 11; k++) { const x = -13 + k * 2.6, y = -8 - (k % 3) * 3 + Math.sin(t * 2 + k) * 0.5; g.fillStyle = '#4FAE32'; g.fillRect(x - 0.4, y, 0.8, 4); g.fillStyle = fc[k % 5]; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); }
  },
  pond(g, t) { g.fillStyle = '#B9B2A4'; g.beginPath(); g.ellipse(0, -4, 26, 10, 0, 0, TAU); g.fill(); g.fillStyle = '#4FB8F0'; g.beginPath(); g.ellipse(0, -4, 22, 7.5, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-6 + Math.sin(t) * 2, -6, 6, 1.4, 0, 0, TAU); g.fill(); g.fillStyle = '#4FAE32'; g.beginPath(); g.ellipse(9, -3, 4, 1.8, 0, 0, TAU); g.fill(); g.fillStyle = '#FF8FB0'; g.beginPath(); g.arc(9, -4, 1.4, 0, TAU); g.fill(); },
  swing(g, t) {
    shadow(g, 0, 0, 20, 4); g.strokeStyle = '#8E5627'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, 0); g.lineTo(-14, -40); g.lineTo(14, -40); g.lineTo(18, 0); g.stroke();
    const a = Math.sin(t * 2) * 0.3; g.save(); g.translate(0, -40); g.rotate(a); g.strokeStyle = '#E8E0C8'; g.lineWidth = 1; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-5, 28); g.moveTo(5, 0); g.lineTo(5, 28); g.stroke(); rr(g, -7, 27, 14, 3, 1, '#E8452C', OL, 0.8); g.restore();
  },
  arch(g) { g.lineWidth = 5; g.strokeStyle = '#3E9A2A'; g.beginPath(); g.arc(0, -16, 16, Math.PI, 0); g.lineTo(16, 0); g.moveTo(-16, 0); g.lineTo(-16, -16); g.stroke(); for (let k = 0; k <= 8; k++) { const a = Math.PI + k / 8 * Math.PI; g.fillStyle = k % 2 ? '#FF6F92' : '#FFFFFF'; g.beginPath(); g.arc(Math.cos(a) * 16, -16 + Math.sin(a) * 16, 2.4, 0, TAU); g.fill(); } },
  windmill(g, t) {
    shadow(g, 0, 0, 12, 4); g.fillStyle = '#FFF3DC'; g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-9, 0); g.lineTo(-6, -34); g.lineTo(6, -34); g.lineTo(9, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#E8452C'; g.beginPath(); g.moveTo(-8, -33); g.lineTo(0, -44); g.lineTo(8, -33); g.closePath(); g.fill(); g.stroke();
    g.save(); g.translate(0, -35); g.rotate(t * 1.6); const sc = ['#FF6F92', '#FFD23F', '#3BA7FF', '#4CD08A']; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillStyle = sc[i]; g.beginPath(); g.moveTo(0, 0); g.lineTo(18, -4); g.lineTo(18, 4); g.closePath(); g.fill(); g.stroke(); } g.restore();
  },
  fountain(g, t) {
    shadow(g, 0, 2, 24, 7); g.fillStyle = '#E9E0CC'; g.strokeStyle = '#A89A7E'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, -5, 22, 7, 0, 0, TAU); g.fill(); g.stroke(); g.fillRect(-22, -5, 44, 6);
    g.fillStyle = '#5DB8F0'; g.beginPath(); g.ellipse(0, -6, 18, 5, 0, 0, TAU); g.fill(); rr(g, -3, -24, 6, 18, 2, '#EFE7D4', '#A89A7E', 1);
    g.fillStyle = '#E9E0CC'; g.beginPath(); g.ellipse(0, -24, 10, 3, 0, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(160,220,255,0.9)'; g.lineWidth = 1.6; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(s * 10, -40 - Math.sin(t * 4) * 2, s * 15, -8); g.stroke(); }
  },
  balloon(g, t) {
    const y = Math.sin(t * 1.2) * 3; g.save(); g.translate(0, y - 30);
    const cs = ['#E8283C', '#FFD23F', '#3BA7FF', '#4CD08A', '#FF7FAE'];
    for (let i = 0; i < 5; i++) { g.fillStyle = cs[i]; g.beginPath(); g.ellipse(-12 + i * 6, -22, 4, 18, 0, 0, TAU); g.fill(); }
    g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, -22, 15, 18, 0, 0, TAU); g.stroke();
    g.strokeStyle = '#5A3414'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-8, -8); g.lineTo(-5, 6); g.moveTo(8, -8); g.lineTo(5, 6); g.stroke(); rr(g, -6, 5, 12, 8, 2, '#A0622D', OL, 1); g.restore();
  },
  statue(g, t) {
    shadow(g, 0, 0, 14, 4); rr(g, -11, -12, 22, 12, 2, '#EFE7D4', '#A89A7E', 1);
    const gr = g.createLinearGradient(-8, -50, 8, -12); gr.addColorStop(0, '#FFF2A0'); gr.addColorStop(1, '#E8A10E'); g.fillStyle = gr; g.strokeStyle = '#A8740A';
    g.beginPath(); g.roundRect(-6, -34, 12, 22, 5); g.fill(); g.stroke(); g.beginPath(); g.arc(0, -40, 6, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-5, -45); g.lineTo(-5, -50); g.lineTo(-2, -47); g.lineTo(0, -51); g.lineTo(2, -47); g.lineTo(5, -50); g.lineTo(5, -45); g.closePath(); g.fill();
    const k = 0.5 + 0.5 * Math.sin(t * 3); g.fillStyle = `rgba(255,255,220,${k})`; g.beginPath(); g.arc(-3, -42, 1.2, 0, TAU); g.fill();
  },
  rainbow(g) {
    const rc = ['#FF4D4D', '#FF9F43', '#FFD23F', '#4CD08A', '#3BA7FF', '#A77BFF']; g.lineWidth = 4;
    rc.forEach((c, i) => { g.strokeStyle = c; g.beginPath(); g.arc(0, 0, 56 - i * 4, Math.PI, 0); g.stroke(); });
    for (const x of [-52, 52]) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(x, -2, 14, 7, 0, 0, TAU); g.ellipse(x + (x > 0 ? -8 : 8), -6, 9, 7, 0, 0, TAU); g.fill(); }
  },
  starLamp(g, t) {   // v5.0.7 星星灯: a pole topped with a glowing gold star
    shadow(g, 0, 0, 10, 3); g.fillStyle = '#5A3414'; g.fillRect(-1.5, -34, 3, 34); g.fillStyle = '#3A2210'; g.fillRect(-4, -1, 8, 2);
    const k = 0.5 + 0.5 * Math.sin(t * 3); g.fillStyle = `rgba(255,210,63,${0.25 + k * 0.35})`; g.beginPath(); g.arc(0, -40, 9, 0, TAU); g.fill();
    g.fillStyle = '#FFD23F'; g.beginPath();
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? 3 : 7, x = Math.cos(a) * r, y = -40 + Math.sin(a) * r; if (j === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.closePath(); g.fill();
  },
  moonGate(g) {   // v5.0.7 月亮门: a round arch with a gold crescent on top
    g.lineWidth = 4; g.strokeStyle = '#E8E0CC'; g.beginPath(); g.arc(0, -14, 15, Math.PI, 0); g.lineTo(15, 0); g.moveTo(-15, 0); g.lineTo(-15, -14); g.stroke();
    g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(0, -36, 6, Math.PI * 0.5, Math.PI * 1.5); g.arc(2.5, -36, 5, Math.PI * 1.5, Math.PI * 0.5, true); g.closePath(); g.fill();
  },
};
function decoHat(g, o) {   // the farmer's 商店 hat in the 2D estate view
  const h = o.hat;
  if (h === 'cowboy') { g.fillStyle = '#A0622D'; g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.ellipse(0, -34, 12, 3, 0, 0, TAU); g.fill(); g.stroke(); rr(g, -6, -42, 12, 8, 3, '#B87436', OL, 1); g.fillStyle = '#5A3414'; g.fillRect(-6, -36.5, 12, 2); }
  else if (h === 'chef') { rr(g, -6, -38, 12, 5, 1, '#FFFFFF', OL, 1); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(-4, -42, 4.4, 0, TAU); g.arc(4, -42, 4.4, 0, TAU); g.arc(0, -45, 5, 0, TAU); g.fill(); }
  else if (h === 'flower') { for (let k = 0; k < 7; k++) { g.fillStyle = ['#FF6F92', '#FFE16B', '#FFFFFF', '#B07ACC'][k % 4]; g.beginPath(); g.arc(-7 + k * 2.3, -35 - Math.sin(k / 6 * Math.PI) * 1.6, 1.8, 0, TAU); g.fill(); } }
  else if (h === 'bow') { g.fillStyle = '#FF4D6D'; g.beginPath(); g.ellipse(-4, -37, 4, 2.6, -0.3, 0, TAU); g.ellipse(4, -37, 4, 2.6, 0.3, 0, TAU); g.fill(); g.fillStyle = '#E8283C'; g.beginPath(); g.arc(0, -37, 1.6, 0, TAU); g.fill(); }
  else if (h === 'crown') { g.fillStyle = '#FFC21A'; g.strokeStyle = '#A8740A'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6, -35); g.lineTo(-6, -41); g.lineTo(-3, -38); g.lineTo(0, -42); g.lineTo(3, -38); g.lineTo(6, -41); g.lineTo(6, -35); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#E8283C'; g.fillRect(-1, -37.5, 2, 2); }
  else if (h === 'beanie') { g.fillStyle = o.capColor || '#3BA7FF'; g.beginPath(); g.arc(0, -33, 7.6, Math.PI, 0); g.fill(); g.fillStyle = '#FFFFFF'; g.fillRect(-7.6, -34, 15.2, 2.4); g.beginPath(); g.arc(0, -41, 2.2, 0, TAU); g.fill(); }
  else if (h === 'pumpkin') { g.save(); g.translate(0, -26); jack(g, 0.9, 0); g.restore(); }
  else if (h === 'santa') { g.fillStyle = '#E8283C'; g.beginPath(); g.moveTo(-7, -35); g.quadraticCurveTo(0, -50, 9, -44); g.lineTo(7, -35); g.closePath(); g.fill(); rr(g, -8, -37, 16, 3.6, 1.8, '#FFFFFF', null); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(9.5, -44, 2.4, 0, TAU); g.fill(); }
  else if (h === 'lion') { g.fillStyle = '#E8283C'; g.strokeStyle = OL; g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, -36, 10, 7, 0, Math.PI, 0); g.fill(); g.stroke(); for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#FFFFFF' : '#FFE16B'; g.beginPath(); g.arc(-9 + k * 3, -35.5, 1.8, 0, TAU); g.fill(); } g.fillStyle = '#FFFFFF'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 3.4, -39.5, 2, 0, TAU); g.fill(); } g.fillStyle = '#1A1A22'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 3.4, -39.2, 1, 0, TAU); g.fill(); } g.fillStyle = '#FFC21A'; g.beginPath(); g.moveTo(-1.4, -42); g.lineTo(0, -47); g.lineTo(1.4, -42); g.closePath(); g.fill(); }
  else if (h === 'scholar') { rr(g, -6, -38, 12, 4, 1, '#2A2A3A', null); g.fillStyle = '#2A2A3A'; g.beginPath(); g.moveTo(-11, -38); g.lineTo(0, -42); g.lineTo(11, -38); g.lineTo(0, -35); g.closePath(); g.fill(); g.strokeStyle = '#FFC21A'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -39); g.lineTo(8, -37); g.lineTo(8, -32); g.stroke(); }
  else if (h === 'star') { g.fillStyle = '#2A2A5A'; g.beginPath(); g.arc(0, -33, 7.6, Math.PI, 0); g.fill(); g.fillRect(-7.6, -34, 15.2, 2.4); g.fillStyle = '#FFD23F'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 1.2 : 2.8, x = Math.cos(a) * r, y = -37 + Math.sin(a) * r; if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.closePath(); g.fill(); }
  else if (h === 'moon') { g.fillStyle = '#1A1A3A'; g.beginPath(); g.arc(0, -33, 7.6, Math.PI, 0); g.fill(); g.fillRect(-7.6, -34, 15.2, 2.4); g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(0, -37, 3.4, Math.PI * 0.5, Math.PI * 1.5); g.arc(1.4, -37, 2.8, Math.PI * 1.5, Math.PI * 0.5, true); g.closePath(); g.fill(); }
  if (o.scarf) { g.fillStyle = o.scarf === 'rainbow' ? '#FFD23F' : o.scarf; rr(g, -5.6, -23.4, 11.2, 3, 1.4, g.fillStyle, null); g.fillRect(1, -21, 2.6, 6); }
}

// v4.1: the estate sits on a raised lawn "plot" (design space x −16…376, y 92…452) in the middle of a
// farm landscape that fills the whole screen. `area` is the screen rectangle the plot has to fit (the CSS
// places #estateArea per layout mode); everything outside it is scenery.
const PLOT = { x: -16, y: 92, w: 392, h: 360, r: 46 };
export function homeLayout(W, H, area) {
  const A = area || { x: 0, y: 56, w: W, h: H - 64 };
  const s = Math.max(0.2, Math.min(A.w / 410, A.h / 432));
  return { s, ox: A.x + A.w / 2 - 180 * s, oy: A.y + A.h / 2 - 254 * s };
}
const hsh = (k) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SEASON_GROUND = {   // [grass light, grass dark, plot lawn, plot lawn stripe, soil lip, field crop]
  0: ['#A5DE70', '#8ED05A', '#9BDD5E', '#8CD150', '#B9844C', '#F2D34A'],
  1: ['#9FDA62', '#86CC4C', '#90D852', '#80CA43', '#B07A44', '#F6CB4A'],
  2: ['#C8CB6A', '#B4B858', '#BCC65C', '#AEB84E', '#A9733F', '#E8871E'],
  3: ['#DDE9EF', '#CCDDE6', '#EEF5F8', '#E2EDF2', '#9C7A5C', '#FFFFFF'],
};
function inPlot(x, y, m) { return x > PLOT.x - m && x < PLOT.x + PLOT.w + m && y > PLOT.y - m - 30 && y < PLOT.y + PLOT.h + m; }
// static ground layer: grass with mowed stripes and tufts, crop fields and woods around, the raised plot with
// its soil lip, lawn stripes, picket fence and the lane out of the gate. Cached until size / season / page change.
let GROUND = null;
function groundLayer(W, H, dpr, L, page) {
  const key = [W, H, dpr, L.s.toFixed(3), L.ox | 0, L.oy | 0, HSEASON, HNIGHT, page].join('|');
  if (GROUND && GROUND.key === key) return GROUND.cv;
  const cv = GROUND && GROUND.cv || document.createElement('canvas');
  cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
  const g = cv.getContext('2d'), C = HNIGHT ? NIGHT_GROUND : (SEASON_GROUND[HSEASON ?? 1] || SEASON_GROUND[1]);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = C[0]; g.fillRect(0, 0, W, H);
  const { s, ox, oy } = L;
  g.save(); g.translate(ox, oy); g.scale(s, s);
  const x0 = -ox / s - 40, x1 = (W - ox) / s + 40, y0 = -oy / s - 60, y1 = (H - oy) / s + 60;
  // mowed stripes across the whole meadow
  g.fillStyle = C[1];
  for (let k = Math.floor((x0 - y1) / 56) - 1; k * 56 < x1 - y0; k++) { const a = k * 56; g.beginPath(); g.moveTo(a + y0, y0); g.lineTo(a + 28 + y0, y0); g.lineTo(a + 28 + y1, y1); g.lineTo(a + y1, y1); g.closePath(); g.globalAlpha = 0.45; g.fill(); }
  g.globalAlpha = 1;
  // crop fields in the open land left / right / below the plot (rows of little plants)
  const crops = HSEASON === 3 ? ['#FFFFFF', '#E6EEF2'] : HNIGHT ? [C[5], '#4A6B3A', '#8A4A3A', '#5A4A6B'] : [C[5], '#5DBB3A', '#E8453C', '#7A3EA8'];
  for (let gx = Math.floor(x0 / 150) * 150; gx < x1; gx += 150) for (let gy = Math.floor(y0 / 120) * 120; gy < y1; gy += 120) {
    const k = Math.round(gx * 0.7 + gy * 1.3), fx = gx + 14 + (hsh(k + 11) - 0.5) * 16, fy = gy + 16 + (hsh(k + 12) - 0.5) * 12, fw = 120, fh = 88;
    if (inPlot(fx + fw / 2, fy + fh / 2, 150) || hsh(k) < 0.58) continue;
    g.fillStyle = '#A8763E'; g.beginPath(); g.roundRect(fx - 4, fy - 4, fw + 8, fh + 10, 12); g.fill();
    g.fillStyle = '#8E5E2C'; g.beginPath(); g.roundRect(fx, fy, fw, fh, 10); g.fill();
    const col = crops[Math.floor(hsh(k + 3) * crops.length)];
    for (let r = 0; r < 5; r++) { const ry = fy + 10 + r * 17; g.fillStyle = 'rgba(60,35,15,0.35)'; g.fillRect(fx + 6, ry + 6, fw - 12, 3);
      for (let c = 0; c < 9; c++) { const px = fx + 10 + c * 12.5 + (r % 2) * 5; g.fillStyle = '#4E9E2E'; g.beginPath(); g.ellipse(px, ry + 4, 4.2, 3, 0, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(px, ry + 1.5, 2.6, 0, TAU); g.fill(); } }
  }
  // grass tufts and wild flowers
  for (let i = 0; i < 260; i++) {
    const x = x0 + hsh(i) * (x1 - x0), y = y0 + hsh(i + 400) * (y1 - y0);
    if (inPlot(x, y, -6)) continue;
    g.strokeStyle = HSEASON === 3 ? 'rgba(150,180,195,0.6)' : 'rgba(50,120,25,0.5)'; g.lineWidth = 1.3; g.beginPath();
    g.moveTo(x - 3, y); g.lineTo(x - 4, y - 5); g.moveTo(x, y); g.lineTo(x, y - 7); g.moveTo(x + 3, y); g.lineTo(x + 4, y - 5); g.stroke();
    if (i % 5 === 0 && HSEASON !== 3 && !HNIGHT) { g.fillStyle = ['#FFFFFF', '#FFE14D', '#FF8FB0', '#B98CFF'][i % 4]; g.beginPath(); g.arc(x + 6, y - 3, 2, 0, TAU); g.fill(); }
  }
  // woods: trees scattered around the plot (never on it), back ones first
  const trees = [];
  for (let gx = Math.floor(x0 / 70) * 70; gx < x1; gx += 70) for (let gy = Math.floor(y0 / 64) * 64; gy < y1 + 64; gy += 64) {
    const k = Math.round(gx * 3.1 + gy * 7.7), x = gx + hsh(k) * 44, y = gy + hsh(k + 9) * 40;
    if (inPlot(x, y, 26) || hsh(k + 5) < 0.3) continue;
    let nearField = false;   // keep trees off the field patches
    const cx = Math.floor((x - 14) / 150) * 150, cy = Math.floor((y - 16) / 120) * 120, kk = Math.round(cx * 0.7 + cy * 1.3);
    if (!inPlot(cx + 74, cy + 60, 150) && hsh(kk) >= 0.58 && x > cx + 6 && x < cx + 140 && y > cy + 8 && y < cy + 112) nearField = true;
    if (!nearField) trees.push([x, y, 0.75 + hsh(k + 2) * 0.35, hsh(k + 7) < (page === 2 ? 0.55 : 0.25)]);
  }
  // the lane out of the gate, down off the screen
  g.strokeStyle = '#C9A86A'; g.lineWidth = 34; g.lineCap = 'round'; g.beginPath(); g.moveTo(180, PLOT.y + PLOT.h - 4); g.bezierCurveTo(180, PLOT.y + PLOT.h + 60, 230, PLOT.y + PLOT.h + 90, 250, y1 + 20); g.stroke();
  g.strokeStyle = '#E3C98E'; g.lineWidth = 22; g.stroke();
  // the plot: drop shadow, soil lip, lawn with stripes and a lighter rim
  g.fillStyle = 'rgba(30,60,10,0.22)'; g.beginPath(); g.roundRect(PLOT.x + 6, PLOT.y + 18, PLOT.w, PLOT.h, PLOT.r); g.fill();
  g.fillStyle = C[4]; g.beginPath(); g.roundRect(PLOT.x, PLOT.y + 12, PLOT.w, PLOT.h, PLOT.r); g.fill();
  g.fillStyle = 'rgba(80,45,15,0.35)'; for (let i = 0; i < 28; i++) { g.beginPath(); g.ellipse(PLOT.x + 20 + hsh(i + 50) * (PLOT.w - 40), PLOT.y + PLOT.h + 4 + hsh(i + 70) * 6, 3, 1.6, 0, 0, TAU); g.fill(); }
  g.save(); g.beginPath(); g.roundRect(PLOT.x, PLOT.y, PLOT.w, PLOT.h, PLOT.r); g.clip();
  g.fillStyle = C[2]; g.fillRect(PLOT.x, PLOT.y, PLOT.w, PLOT.h);
  g.fillStyle = C[3]; for (let x = PLOT.x; x < PLOT.x + PLOT.w; x += 44) g.fillRect(x, PLOT.y, 22, PLOT.h);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.beginPath(); g.roundRect(PLOT.x + 3, PLOT.y + 3, PLOT.w - 6, PLOT.h - 6, PLOT.r - 3); g.stroke();
  for (let i = 0; i < 70; i++) { const x = PLOT.x + 14 + hsh(i + 900) * (PLOT.w - 28), y = PLOT.y + 14 + hsh(i + 950) * (PLOT.h - 28); g.fillStyle = HSEASON === 3 ? 'rgba(170,200,215,0.5)' : 'rgba(60,140,30,0.35)'; g.beginPath(); g.ellipse(x, y, 3, 1.4, 0, 0, TAU); g.fill(); }
  // page ground details: page 1 gravel forecourt + path, page 2 dirt lane, page 3 cobbled lane (lake is animated, drawn later)
  if (page === 1) {
    g.fillStyle = '#D9C390'; g.beginPath(); g.ellipse(180, 196, 116, 38, 0, 0, TAU); g.fill();
    g.fillStyle = '#EBDDB2'; g.beginPath(); g.ellipse(180, 192, 108, 32, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(160,130,80,0.35)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(90 + hsh(i + 30) * 180, 172 + hsh(i + 60) * 40, 1.3, 0, TAU); g.fill(); }
    g.strokeStyle = '#D9C390'; g.lineWidth = 26; g.beginPath(); g.moveTo(180, 224); g.lineTo(180, PLOT.y + PLOT.h); g.stroke();
    g.strokeStyle = '#EBDDB2'; g.lineWidth = 18; g.stroke();
  } else if (page === 2) {
    g.strokeStyle = '#B98F55'; g.lineWidth = 26; g.beginPath(); g.moveTo(180, 176); g.bezierCurveTo(176, 260, 188, 330, 180, PLOT.y + PLOT.h); g.stroke();
    g.strokeStyle = '#D2AE72'; g.lineWidth = 18; g.stroke();
  } else {
    g.strokeStyle = '#C9B98C'; g.lineWidth = 24; g.beginPath(); g.moveTo(196, 186); g.bezierCurveTo(206, 260, 230, 330, 186, PLOT.y + PLOT.h); g.stroke();
    g.strokeStyle = '#E2D4AA'; g.lineWidth = 16; g.stroke();
  }
  g.restore();
  // picket fence round the plot, gap at the gate
  const fence = (x, y) => { g.fillStyle = 'rgba(40,60,20,0.25)'; g.fillRect(x - 1.6, y - 1, 5, 3); g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(x - 2.4, y); g.lineTo(x - 2.4, y - 11); g.lineTo(x, y - 14); g.lineTo(x + 2.4, y - 11); g.lineTo(x + 2.4, y); g.closePath(); g.fill(); g.strokeStyle = '#B9AE96'; g.lineWidth = 0.8; g.stroke(); };
  const rail = (ax, ay, bx, by) => { g.strokeStyle = '#F4EFE4'; g.lineWidth = 2.2; for (const d of [5, 10]) { g.beginPath(); g.moveTo(ax, ay - d); g.lineTo(bx, by - d); g.stroke(); } };
  const T = PLOT.y + 8, B = PLOT.y + PLOT.h - 4, Lx = PLOT.x + 8, Rx = PLOT.x + PLOT.w - 8;
  rail(Lx + 20, T, Rx - 20, T); for (let x = Lx + 20; x <= Rx - 20; x += 12) fence(x, T);
  rail(Lx, T + 26, Lx, B - 24); rail(Rx, T + 26, Rx, B - 24);
  for (let y = T + 26; y <= B - 24; y += 12) { fence(Lx, y); fence(Rx, y); }
  rail(Lx + 22, B, 156, B); rail(204, B, Rx - 22, B);
  for (let x = Lx + 22; x <= 156; x += 12) fence(x, B); for (let x = 204; x <= Rx - 22; x += 12) fence(x, B);
  // the woods (static, sorted back to front)
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y, k, p] of trees) { g.save(); g.translate(x, y); g.scale(k, k); if (p) pine(g, 1.1); else roundTree(g, 0, false); g.restore(); }
  g.restore();
  GROUND = { key, cv };
  return cv;
}
// which empty spot (of this page) a tap at screen (px, py) lands on, in 装扮 mode
export function hitSpot(W, H, area, page, save, px, py) {
  const { s, ox, oy } = homeLayout(W, H, area), x = (px - ox) / s, y = (py - oy) / s;
  const spots = page === 3 ? SPOTS3 : page === 2 ? SPOTS2 : SPOTS, center = page === 3 ? 'winery' : page === 2 ? 'lodge' : 'manor';
  const done = new Set(save.restored); let best = null, bd = 1.6;
  for (const [id, [sx, sy]] of Object.entries(spots)) {
    if (done.has(id)) continue;
    const d = ((x - sx) / 30) ** 2 + ((y - (sy - 2 + (id === center ? 30 : 0))) / 18) ** 2;
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

// ---- v5.1.7 庄园散步: the farmer on the estate walks where you tap, dog in tow ----
// Pure state + math (no canvas), so the sim probe can drive it in Node. Design space
// is 360x440; the farmer starts by the house, the dog beside him, as before.
export const WALK_HOME = { fx: 214, fy: 216, dx: 240, dy: 224 };
const WALK_SPEED = 82;      // design units / second (a stroll across the lawn takes ~4 s)
const DOG_SPEED = 96;       // a touch faster, so the dog catches up instead of lagging forever
const DOG_GAP = 24;         // the dog stops this far behind the farmer
const WALK_BOUNDS = { x0: 10, x1: 350, y0: 104, y1: 446 };
const WALK = {
  fx: WALK_HOME.fx, fy: WALK_HOME.fy, tx: WALK_HOME.fx, ty: WALK_HOME.fy,
  dx: WALK_HOME.dx, dy: WALK_HOME.dy,
  phase: 0, dphase: 0, face: 1, moving: false, dmoving: false,
};
export function resetWalk() {
  WALK.fx = WALK_HOME.fx; WALK.fy = WALK_HOME.fy; WALK.tx = WALK_HOME.fx; WALK.ty = WALK_HOME.fy;
  WALK.dx = WALK_HOME.dx; WALK.dy = WALK_HOME.dy;
  WALK.phase = 0; WALK.dphase = 0; WALK.face = 1; WALK.moving = false; WALK.dmoving = false;
}
export function walkState() {
  return { fx: WALK.fx, fy: WALK.fy, tx: WALK.tx, ty: WALK.ty, dx: WALK.dx, dy: WALK.dy,
           phase: WALK.phase, dphase: WALK.dphase, face: WALK.face, moving: WALK.moving, dmoving: WALK.dmoving };
}
// obstacle radii for built spots (flat ones — path, gate, fence, dock — are walkable, r 0;
// unbuilt spots are not obstacles at all: nothing stands there yet). Decos use their own table.
const SPOT_R = { manor: 30, lodge: 30, winery: 30, pond: 24, fountain: 22, barn: 26, greenhouse: 26, gazebo: 22,
                 windmill: 20, tree: 18, well: 14, arch: 12, bench: 12, path: 0, gate: 0, fence2: 0, dock: 0 };
const DECO_R = { pond: 22, fountain: 20, windmill: 16, rainbow: 0, balloon: 0 };
export function walkObstacles(page = 1, save = {}, night = false) {
  const spots = page === 3 ? SPOTS3 : page === 2 ? SPOTS2 : SPOTS;
  const restored = new Set(save.restored || []);
  const out = [];
  for (const [id, [x, y]] of Object.entries(spots)) {
    if (!restored.has(id)) continue;
    const r = SPOT_R[id] ?? 22;
    if (r > 0) out.push({ x, y, r });
  }
  for (const id of (save.shop && save.shop.deco) || []) {
    const s = DECO_SPOTS[id]; if (!s) continue;
    const r = DECO_R[id] ?? 14;
    if (r > 0) out.push({ x: s[0], y: s[1], r });
  }
  if (page === 3) out.push({ x: 92, y: 372, r: 46 });   // the lake
  if (night) out.push({ x: 90, y: 420, r: 20 });        // night-market stall
  return out;
}
// push a point out of every obstacle circle (a few passes for overlaps): the farmer
// slides round a building instead of walking through it, and a tap on a building
// lands on the nearest walkable point beside it.
function pushOut(x, y, obs) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of obs) {
      const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy);
      if (d < o.r) {
        if (d < 0.001) { x = o.x + o.r; y = o.y; }
        else { const k = o.r / d; x = o.x + dx * k; y = o.y + dy * k; }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return [x, y];
}
// set where the farmer walks to (design coords): clamped to the lawn, then pushed
// out of any building / pond / stall it landed on.
export function setWalkTarget(x, y, page = 1, save = {}, night = false) {
  x = Math.max(WALK_BOUNDS.x0, Math.min(WALK_BOUNDS.x1, x));
  y = Math.max(WALK_BOUNDS.y0, Math.min(WALK_BOUNDS.y1, y));
  [x, y] = pushOut(x, y, walkObstacles(page, save, night));
  x = Math.max(WALK_BOUNDS.x0, Math.min(WALK_BOUNDS.x1, x));
  y = Math.max(WALK_BOUNDS.y0, Math.min(WALK_BOUNDS.y1, y));
  WALK.tx = x; WALK.ty = y;
  return { x, y };
}
function stepToward(px, py, tx, ty, speed, dt, obs) {
  const dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy);
  if (d < 0.5) return [px, py, 0];
  const s = Math.min(d, speed * dt), nx = px + dx / d * s, ny = py + dy / d * s;
  const [ox, oy] = pushOut(nx, ny, obs);
  return [ox, oy, s];
}
export function updateWalk(dt, page = 1, save = {}, night = false) {
  if (!(dt > 0)) return;
  const obs = walkObstacles(page, save, night);
  if (Math.hypot(WALK.tx - WALK.fx, WALK.ty - WALK.fy) > 1.5) {
    if (Math.abs(WALK.tx - WALK.fx) > 2) WALK.face = WALK.tx > WALK.fx ? 1 : -1;
    const [nx, ny, s] = stepToward(WALK.fx, WALK.fy, WALK.tx, WALK.ty, WALK_SPEED, dt, obs);
    WALK.fx = nx; WALK.fy = ny; WALK.phase += s * 0.085; WALK.moving = true;
    if (Math.hypot(WALK.tx - WALK.fx, WALK.ty - WALK.fy) <= 1.5) { WALK.fx = WALK.tx; WALK.fy = WALK.ty; WALK.moving = false; }
  } else WALK.moving = false;
  // the dog trails the farmer and stops a short gap behind (never on top of him)
  const dd = Math.hypot(WALK.fx - WALK.dx, WALK.fy - WALK.dy);
  if (dd > DOG_GAP) {
    const [nx, ny, s] = stepToward(WALK.dx, WALK.dy, WALK.fx, WALK.fy, DOG_SPEED, dt, obs);
    const nd = Math.hypot(WALK.fx - nx, WALK.fy - ny);
    if (nd < DOG_GAP) {
      const k = DOG_GAP / Math.max(nd, 0.001);
      WALK.dx = WALK.fx - (WALK.fx - nx) * k; WALK.dy = WALK.fy - (WALK.fy - ny) * k;
      const [ox, oy] = pushOut(WALK.dx, WALK.dy, obs);
      WALK.dx = ox; WALK.dy = oy;
    } else { WALK.dx = nx; WALK.dy = ny; }
    WALK.dphase += s * 0.085; WALK.dmoving = true;
  } else WALK.dmoving = false;
}

export function drawHome(g, W, H, save, t, dpr, area, page = 1) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  HSEASON = Number.isInteger(save.season) ? save.season : null;
  HNIGHT = !!save.night;
  const L = homeLayout(W, H, area), { s, ox, oy } = L;
  g.drawImage(groundLayer(W, H, dpr, L, page), 0, 0, W, H);
  g.save(); g.translate(ox, oy); g.scale(s, s);
  const restored = new Set(save.restored);
  const flat = ['path', 'pond', 'fence2', 'dock'];
  const P2 = page === 2, P3 = page === 3;
  const spots = P3 ? SPOTS3 : P2 ? SPOTS2 : SPOTS, draw = P3 ? DRAW3 : P2 ? DRAW2 : DRAW, center = P3 ? 'winery' : P2 ? 'lodge' : 'manor';
  if (P3) {   // the lake, and a cobbled lane up to the winery
    lake(g, t);
  }
  const decos = (save.shop && save.shop.deco) || [];
  const items = [...Object.entries(spots), ...decos.filter((id) => DECO_SPOTS[id]).map((id) => ['deco:' + id, DECO_SPOTS[id]])]
    .sort((a, b) => (flat.includes(b[0]) - flat.includes(a[0])) || ((b[0] === 'deco:pond') - (a[0] === 'deco:pond')) || a[1][1] - b[1][1]);
  for (const [id, [x, y]] of items) {
    if (id.startsWith('deco:')) { g.save(); g.translate(x, y); g.scale(1.12, 1.12); DECO2D[id.slice(5)](g, t); g.restore(); continue; }
    g.save(); g.translate(x, y);
    const done = restored.has(id), a = done ? elastic((t - (save.restoredAt?.[id] || -9)) / 0.7) : 1;
    if (id === center) { g.scale(0.92 + 0.08 * a, 0.92 + 0.08 * a); if (P3) winery(g, done, t); else if (P2) lodge(g, done, t); else manor(g, done); }
    else if (done) { g.scale(a, a); draw[id](g, t); }
    if (!done && save.build) {   // 装扮 mode: an empty spot is a teal dashed ring with the star price (tap to build)
      const m = CFG.meta.find((q) => q.id === id);
      const ry = id === center ? 30 : 0, pu = 1 + Math.sin(t * 3 + x * 0.05) * 0.06;
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(0, -2 + ry, 27 * pu, 12 * pu, 0, 0, TAU); g.fill();
      g.setLineDash([5, 4]); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.fillStyle = 'rgba(63,208,218,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, -2 + ry, 23, 10, 0, 0, TAU); g.fill(); g.stroke(); g.setLineDash([]);
      g.font = FONT(12); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#1E5A68'; g.fillStyle = '#FFE14D';
      g.strokeText(`★${m ? m.cost : ''}`, 0, -3 + ry); g.fillText(`★${m ? m.cost : ''}`, 0, -3 + ry);
    }
    g.restore();
  }
  // v4.0 B 节日 scenery on the estate (every page)
  const fest = save.fest || null;
  if (fest === 'halloween') for (const [x, y, k] of [[44, 262, 1.2], [318, 270, 1.1], [92, 430, 1.0], [272, 432, 1.1], [150, 214, 0.9], [246, 214, 0.9]]) { g.save(); g.translate(x, y); jack(g, k, t + x); g.restore(); }
  if (fest === 'xmas') { g.save(); g.translate(-6, 252); xtree(g, t, 1.0); g.restore(); }
  if (fest === 'cny') for (const [x, y, L] of [[86, 184, 78], [196, 184, 78], [120, 476, 120]]) { g.save(); g.translate(x, y); lampString(g, t, L); g.restore(); }
  // v4.0 B 宠物: the cat lounges in front of the house, the dog sits by the farmer
  const pets = save.shop && save.shop.pet;
  if (pets && pets.cat && petById(pets.cat)) { g.save(); g.translate(150, 238); cat2d(g, t, petById(pets.cat).col); g.restore(); }
  // v5.1.7 庄园散步: the dog walks with the farmer (a little trot bounce while moving)
  if (pets && pets.dog && petById(pets.dog)) {
    g.save();
    g.translate(WALK.dx, WALK.dy - (WALK.dmoving ? Math.abs(Math.sin(WALK.dphase)) * 1.5 : 0));
    dog2d(g, t, petById(pets.dog).col);
    g.restore();
  }
  const look = save.shop ? heroStyle(save.shop.eq) : HERO, hat = look.hat;
  // v5.1.7 庄园散步: the farmer walks where you tap (face flips with the direction)
  g.save(); g.translate(WALK.fx, WALK.fy); g.scale(1.05 * WALK.face, 1.05);
  person(g, t, WALK.phase, WALK.moving, { ...look, hat: hat === 'straw', sleeve: undefined, carry: Math.sin(t * 3) > 0.3 });
  if (hat && hat !== 'straw') decoHat(g, look); else if (look.scarf) decoHat(g, { scarf: look.scarf });
  g.restore();
  g.restore();
  // v5.0.9 夜市地图: a dark-blue tint over the whole estate (the global colour filter the
  // night look needs — it dims the daytime-bright walls and roofs so they sit with the
  // dark ground instead of clashing with it), then the bright night elements on top:
  // lantern strings with warm glows, and one market stall. The stall and strings are
  // drawn after the tint so their light stays bright; the ground itself is already dark
  // (NIGHT_GROUND in groundLayer), so this is a tint, not a second darkening.
  if (HNIGHT) {
    g.fillStyle = 'rgba(10,20,48,0.22)'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(ox, oy); g.scale(s, s);
    nightGlow(g, 95, 105, 80); nightGlow(g, 265, 105, 80); nightGlow(g, 180, 415, 80); nightGlow(g, 90, 395, 70);
    for (const [x, y, L] of [[40, 120, 110], [210, 120, 110], [120, 430, 120]]) { g.save(); g.translate(x, y); lampString(g, t, L); g.restore(); }
    g.save(); g.translate(90, 420); nightStall(g, t); g.restore();
    g.restore();
    // fireflies instead of petals / leaves / snow: slow warm dots hovering with a pulse
    const h = (k) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    for (let k = 0; k < 24; k++) {
      const x = h(k + 90) * W + Math.sin(t * 0.6 + k * 2.1) * 18;
      const y = h(k + 50) * H + Math.sin(t * 0.45 + k * 1.3) * 14;
      const a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + k * 2.4));
      g.fillStyle = '#FFE27A'; g.globalAlpha = a;
      g.beginPath(); g.arc(x, y, 1.6 + h(k + 7) * 1.2, 0, TAU); g.fill();
      g.globalAlpha = a * 0.35;
      g.beginPath(); g.arc(x, y, 4.5 + h(k + 7) * 2, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }
  // drifting petals / leaves / snow over the estate (screen space, a couple of dozen)
  const PSE = fest === 'xmas' ? 3 : HSEASON;   // 圣诞: it snows on the estate too
  if (!HNIGHT && (PSE === 0 || PSE === 2 || PSE === 3)) {
    const n = PSE === 3 ? 40 : 22, h = (k) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    for (let k = 0; k < n; k++) {
      const y = (t * (26 + h(k) * 26) + h(k + 50) * (H + 40)) % (H + 40) - 20, x = ((h(k + 90) * (W + 60) + Math.sin(t * 0.8 + k) * 20 + t * 10) % (W + 60)) - 30;
      const sz = PSE === 3 ? 1.8 + h(k + 7) * 2 : 3.2 + h(k + 7) * 2.4;
      g.globalAlpha = 0.88;
      if (PSE === 3) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, y, sz, 0, TAU); g.fill(); continue; }
      g.fillStyle = PSE === 0 ? (k % 3 ? '#FFB8D0' : '#FFFFFF') : ['#E8871E', '#C8551E', '#F6C343'][k % 3];
      g.save(); g.translate(x, y); g.rotate(t * (1 + h(k + 3)) + k); g.beginPath(); g.ellipse(0, 0, sz, sz * 0.5, 0, 0, TAU); g.fill(); g.restore();
    }
    g.globalAlpha = 1;
  }
}
