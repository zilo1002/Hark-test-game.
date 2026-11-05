// Home screen between levels: a farm-and-manor estate you restore with stars.
// Drawn on the main canvas in a 360×440 design space (front 3/4 view).
import { CFG } from './config.js';
import { COL } from './sprites.js';
import { person, HERO } from './chars.js';
import { elastic, FONT } from './util.js';
import { heroStyle } from './shop.js';

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

// 商店 decorations on the estate (both pages): free spots round the edge of the lawn
export const DECO_SPOTS = {
  rainbow: [180, 80], statue: [22, 72], balloon: [352, 64], lanterns: [18, 196], scarecrow: [350, 178], arch: [130, 214],
  fountain: [116, 262], bench: [250, 266], windmill: [-2, 292], flowerbed: [350, 300], pond: [22, 408], swing: [334, 410],
};
const DECO2D = {
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
};
function decoHat(g, o) {   // the farmer's 商店 hat in the 2D estate view
  const h = o.hat;
  if (h === 'cowboy') { g.fillStyle = '#A0622D'; g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.ellipse(0, -34, 12, 3, 0, 0, TAU); g.fill(); g.stroke(); rr(g, -6, -42, 12, 8, 3, '#B87436', OL, 1); g.fillStyle = '#5A3414'; g.fillRect(-6, -36.5, 12, 2); }
  else if (h === 'chef') { rr(g, -6, -38, 12, 5, 1, '#FFFFFF', OL, 1); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(-4, -42, 4.4, 0, TAU); g.arc(4, -42, 4.4, 0, TAU); g.arc(0, -45, 5, 0, TAU); g.fill(); }
  else if (h === 'flower') { for (let k = 0; k < 7; k++) { g.fillStyle = ['#FF6F92', '#FFE16B', '#FFFFFF', '#B07ACC'][k % 4]; g.beginPath(); g.arc(-7 + k * 2.3, -35 - Math.sin(k / 6 * Math.PI) * 1.6, 1.8, 0, TAU); g.fill(); } }
  else if (h === 'bow') { g.fillStyle = '#FF4D6D'; g.beginPath(); g.ellipse(-4, -37, 4, 2.6, -0.3, 0, TAU); g.ellipse(4, -37, 4, 2.6, 0.3, 0, TAU); g.fill(); g.fillStyle = '#E8283C'; g.beginPath(); g.arc(0, -37, 1.6, 0, TAU); g.fill(); }
  else if (h === 'crown') { g.fillStyle = '#FFC21A'; g.strokeStyle = '#A8740A'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6, -35); g.lineTo(-6, -41); g.lineTo(-3, -38); g.lineTo(0, -42); g.lineTo(3, -38); g.lineTo(6, -41); g.lineTo(6, -35); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#E8283C'; g.fillRect(-1, -37.5, 2, 2); }
  else if (h === 'beanie') { g.fillStyle = o.capColor || '#3BA7FF'; g.beginPath(); g.arc(0, -33, 7.6, Math.PI, 0); g.fill(); g.fillStyle = '#FFFFFF'; g.fillRect(-7.6, -34, 15.2, 2.4); g.beginPath(); g.arc(0, -41, 2.2, 0, TAU); g.fill(); }
  if (o.scarf) { g.fillStyle = o.scarf === 'rainbow' ? '#FFD23F' : o.scarf; rr(g, -5.6, -23.4, 11.2, 3, 1.4, g.fillStyle, null); g.fillRect(1, -21, 2.6, 6); }
}

export function homeLayout(W, H, land) {
  const top = 56, panelW = land ? Math.min(330, W * 0.42) : 0, bottom = land ? 8 : Math.min(250, H * 0.38);
  const aw = W - panelW, ah = H - top - bottom;
  const s = Math.min(aw / 380, ah / 450);
  return { s, ox: (aw - 360 * s) / 2, oy: top + Math.max(0, (ah - 450 * s) / 2) };
}

export function drawHome(g, W, H, save, t, dpr, land, page = 1) {
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
  const flat = ['path', 'pond', 'fence2'];
  const P2 = page === 2, spots = P2 ? SPOTS2 : SPOTS, draw = P2 ? DRAW2 : DRAW, center = P2 ? 'lodge' : 'manor';
  if (P2) { g.fillStyle = '#C9A86A'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(180 + (i % 2 ? 4 : -4), 200 + i * 26, 12, 5, 0, 0, TAU); g.fill(); } }
  const decos = (save.shop && save.shop.deco) || [];
  const items = [...Object.entries(spots), ...decos.filter((id) => DECO_SPOTS[id]).map((id) => ['deco:' + id, DECO_SPOTS[id]])]
    .sort((a, b) => (flat.includes(b[0]) - flat.includes(a[0])) || ((b[0] === 'deco:pond') - (a[0] === 'deco:pond')) || a[1][1] - b[1][1]);
  for (const [id, [x, y]] of items) {
    if (id.startsWith('deco:')) { g.save(); g.translate(x, y); g.scale(0.9, 0.9); DECO2D[id.slice(5)](g, t); g.restore(); continue; }
    g.save(); g.translate(x, y);
    const done = restored.has(id), a = done ? elastic((t - (save.restoredAt?.[id] || -9)) / 0.7) : 1;
    if (id === center) { g.scale(0.92 + 0.08 * a, 0.92 + 0.08 * a); if (P2) lodge(g, done, t); else manor(g, done); }
    else if (done) { g.scale(a, a); draw[id](g, t); }
    if (!done) {   // empty spot: a teal dashed ring with the star price
      const m = CFG.meta.find((q) => q.id === id);
      const ry = id === center ? 30 : 0;
      g.setLineDash([5, 4]); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.fillStyle = 'rgba(63,208,218,0.45)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, -2 + ry, 22, 9, 0, 0, TAU); g.fill(); g.stroke(); g.setLineDash([]);
      g.font = FONT(11); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#1E5A68'; g.fillStyle = '#FFE14D';
      g.strokeText(`★${m ? m.cost : ''}`, 0, -3 + ry); g.fillText(`★${m ? m.cost : ''}`, 0, -3 + ry);
    }
    g.restore();
  }
  const look = save.shop ? heroStyle(save.shop.eq) : HERO, hat = look.hat;
  g.save(); g.translate(214, 216); g.scale(1.05, 1.05);
  person(g, t, 0, false, { ...look, hat: hat === 'straw', sleeve: undefined, carry: Math.sin(t * 3) > 0.3 });
  if (hat && hat !== 'straw') decoHat(g, look); else if (look.scarf) decoHat(g, { scarf: look.scarf });
  g.restore();
  g.restore();
}
