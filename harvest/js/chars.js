// Cartoon characters & props drawn with primitives in a local frame:
// (0,0) is the ground point under the figure, -y is up, 1 unit = 1 world unit.
import { COL } from './sprites.js';

function shadow(g, rx, ry) { g.fillStyle = COL.shadow; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 6.2832); g.fill(); }
function rr(g, x, y, w, h, r, fill, stroke, lw = 1.2) {
  g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function circ(g, x, y, r, fill, stroke, lw = 1.2) {
  g.beginPath(); g.arc(x, y, r, 0, 6.2832); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

// generic little person. opts: dress, shirt, pants, hair, hat, pigtails, back, carry
export function person(g, t, walk, moving, o) {
  shadow(g, 9, 3.4);
  const sw = moving ? Math.sin(walk) : 0;
  const bob = moving ? Math.abs(Math.sin(walk)) * 2.2 : Math.sin(t * 3 + (o.seed || 0)) * 0.4;
  const OL = COL.outline;
  // legs
  const l1 = Math.max(0, sw) * 2.6, l2 = Math.max(0, -sw) * 2.6;
  rr(g, -4, -11 - l1, 3.2, 10, 1.4, o.pants || '#6B4A2E', OL, 1);
  rr(g, 0.8, -11 - l2, 3.2, 10, 1.4, o.pants || '#6B4A2E', OL, 1);
  rr(g, -4.6, -2.4 - l1, 4.2, 2.6, 1.2, '#5A3414');
  rr(g, 0.4, -2.4 - l2, 4.2, 2.6, 1.2, '#5A3414');
  g.save(); g.translate(0, -bob);
  // arms
  const up = o.carry;
  g.strokeStyle = OL; g.lineWidth = 4.4; g.lineCap = 'round';
  const armC = o.dress || o.shirt;
  const drawArm = (side) => {
    g.beginPath(); g.moveTo(side * 5, -20);
    if (up) g.lineTo(side * 6.5, -34); else g.lineTo(side * 7 + (side > 0 ? sw : -sw) * 2.2, -12);
    g.strokeStyle = OL; g.lineWidth = 4.6; g.stroke(); g.strokeStyle = COL.skin; g.lineWidth = 2.8; g.stroke();
  };
  if (o.back) { drawArm(-1); drawArm(1); }
  // body
  g.beginPath();
  if (o.dress) { g.moveTo(-4.8, -22); g.lineTo(4.8, -22); g.lineTo(7.4, -9); g.quadraticCurveTo(0, -7, -7.4, -9); g.closePath(); }
  else { g.roundRect(-5.4, -22, 10.8, 12.5, 3); }
  g.fillStyle = armC; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke();
  if (o.apron && !o.back) { rr(g, -3.2, -18, 6.4, 8, 2, '#FFFFFF', null); }
  if (o.overalls) { rr(g, -4.2, -17, 8.4, 7.5, 1.5, o.overalls, OL, 0.9); g.fillStyle = '#FFE07A'; g.beginPath(); g.arc(-2.6, -16, 0.9, 0, 6.3); g.arc(2.6, -16, 0.9, 0, 6.3); g.fill(); }
  if (!o.back) { drawArm(-1); drawArm(1); }
  // head
  circ(g, 0, -29, 7.4, COL.skin, OL);
  g.fillStyle = o.hair || COL.hair;
  if (o.back) { g.beginPath(); g.arc(0, -29.5, 7.6, 0, 6.2832); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); }
  else {
    g.beginPath(); g.arc(0, -30, 7.6, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(4, -31, 1.5, -33.5); g.quadraticCurveTo(-3, -30.5, -7.4, -29); g.closePath(); g.fill();
    // face looks toward +x (callers flip with scale)
    g.fillStyle = '#3A2210'; g.beginPath(); g.ellipse(1.2, -28.6, 0.95, 1.3, 0, 0, 6.3); g.ellipse(4.6, -28.6, 0.95, 1.3, 0, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,120,110,0.55)'; g.beginPath(); g.ellipse(0, -25.8, 1.6, 1, 0, 0, 6.3); g.ellipse(6, -25.8, 1.2, 0.9, 0, 0, 6.3); g.fill();
    g.strokeStyle = '#7A2E14'; g.lineWidth = 0.8; g.beginPath(); g.arc(3.2, -26, 1.3, 0.2, Math.PI - 0.2); g.stroke();
  }
  if (o.pigtails) {
    for (const s of [-1, 1]) { circ(g, s * 7.6, -27.5, 3, o.hair || COL.hair, OL, 1); circ(g, s * 6.2, -29.5, 1.2, COL.red, null); }
    rr(g, -6.8, -36.2, 13.6, 2.2, 1.1, COL.red, null);
  }
  if (o.hat) {
    g.fillStyle = '#F4D06F'; g.strokeStyle = '#B88A2E'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, -34, 11, 3, 0, 0, 6.3); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(0, -36.5, 6, 4.5, 0, Math.PI, 0); g.fill(); g.stroke();
    rr(g, -6, -36, 12, 1.6, 0.6, COL.red, null);
  }
  g.restore();
  return 38 - bob;   // z where a carried stack sits
}

export const GIRL = { dress: '#F2553A', apron: true, pigtails: true, hair: '#7A3E1D' };
export const BOY = { shirt: '#F7F1E1', overalls: '#3D7FD9', pants: '#3D7FD9', hat: true, hair: '#5A3414' };
const CUST_SHIRTS = ['#6BC4FF', '#FF9F43', '#A77BFF', '#FF6FA8', '#4CD08A', '#FFD23F'];
const CUST_HAIR = ['#3A2210', '#7A3E1D', '#C58B3C', '#222222', '#9B5A2A', '#5B3A1A'];
export function customerStyle(h) { return { shirt: CUST_SHIRTS[h % 6], hair: CUST_HAIR[(h * 5) % 6], pants: h % 2 ? '#4A5A8A' : '#6B4A2E', seed: h }; }

export function hen(g, t, lay, seed) {
  shadow(g, 10, 3.6);
  // nest
  g.fillStyle = '#E8B34E'; g.strokeStyle = '#B07F25'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(0, -2, 11, 4.4, 0, 0, 6.3); g.fill(); g.stroke();
  g.strokeStyle = '#C99335'; g.lineWidth = 0.8;
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 3 - 2, -3.5); g.lineTo(i * 3 + 2, -0.5); g.stroke(); }
  const sq = 1 - lay * 0.18, bob = Math.sin(t * 2.2 + seed) * 0.5;
  g.save(); g.translate(0, -3 + bob); g.scale(1 + lay * 0.12, sq);
  // tail
  g.fillStyle = '#C8451D'; g.beginPath(); g.moveTo(-6, -8); g.quadraticCurveTo(-12, -16, -9, -18); g.quadraticCurveTo(-6, -13, -3, -10); g.fill();
  const gr = g.createRadialGradient(-1, -10, 1, 0, -7, 11); gr.addColorStop(0, '#FF9A52'); gr.addColorStop(1, '#D9541F');
  g.fillStyle = gr; g.strokeStyle = COL.outline; g.lineWidth = 1.1;
  g.beginPath(); g.ellipse(0, -7, 8.6, 6.8, 0, 0, 6.3); g.fill(); g.stroke();
  g.fillStyle = '#C8451D'; g.beginPath(); g.ellipse(-1.5, -6.5, 4.4, 2.8, 0.3, 0, 6.3); g.fill();
  // head
  circ(g, 6, -13.5, 4.3, '#F07A36', COL.outline, 1);
  g.fillStyle = COL.red; g.beginPath(); g.arc(4.8, -17.6, 1.6, 0, 6.3); g.arc(6.8, -18.2, 1.7, 0, 6.3); g.arc(8.4, -17.2, 1.3, 0, 6.3); g.fill();
  g.fillStyle = '#FFC93C'; g.beginPath(); g.moveTo(9.8, -14.4); g.lineTo(13, -13.2); g.lineTo(9.8, -12.2); g.fill();
  g.fillStyle = COL.red; g.beginPath(); g.ellipse(9.4, -11, 1, 1.6, 0, 0, 6.3); g.fill();
  g.fillStyle = '#2A1708'; g.beginPath(); g.arc(7.3, -14.4, 0.9, 0, 6.3); g.fill();
  g.restore();
}

export function bush(g, t, lay, seed, ripe = 5) {
  shadow(g, 12, 4);
  g.fillStyle = COL.soil; g.beginPath(); g.ellipse(0, -1, 11, 4, 0, 0, 6.3); g.fill();
  const sh = Math.sin(t * 20) * lay * 1.6;
  g.save(); g.translate(sh, 0);
  g.strokeStyle = COL.leafDark; g.lineWidth = 1;
  for (const [x, y, r] of [[-6, -9, 6], [6, -9, 6], [0, -14, 7.5], [-3, -6, 5.5], [4, -6, 5.5]]) {
    const gr = g.createRadialGradient(x - 2, y - 2, 1, x, y, r); gr.addColorStop(0, '#8EDB5C'); gr.addColorStop(1, '#46A12C');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.stroke();
  }
  const ts = [[-6, -11], [5, -12], [0, -7], [-2, -16], [7, -6], [-8, -5]];
  for (let i = 0; i < Math.min(ripe, ts.length); i++) { const [x, y] = ts[i]; circ(g, x, y, 2.4, COL.tomato, '#8E1E12', 0.7); }
  g.restore();
}

function wheel(g, x, y, r) { circ(g, x, y, r, '#3B3B46', '#1F1F26', 1); circ(g, x, y, r * 0.42, '#D9D9E0', null); }

// little red ride-on mower with a trailer. Returns [trailer x offset, stack base z]
export function mower(g, t, moving, walk) {
  const jig = moving ? Math.sin(walk * 2) * 0.6 : 0;
  shadow(g, 30, 6);
  // trailer (behind, -x)
  g.save(); g.translate(-27, 0);
  wheel(g, -2, -4, 4.4);
  rr(g, -14, -16, 26, 11, 2.5, '#5BB0F0', COL.outline, 1.2);
  rr(g, -14, -18, 26, 3.6, 1.6, '#8CCBFA', COL.outline, 1);
  g.strokeStyle = COL.outline; g.lineWidth = 1.2; g.beginPath(); g.moveTo(12, -9); g.lineTo(17, -9); g.stroke();
  g.restore();
  g.save(); g.translate(0, jig);
  wheel(g, -6, -6, 6.2); wheel(g, 11, -4, 4);
  // body
  g.beginPath(); g.moveTo(-10, -9); g.lineTo(14, -9); g.quadraticCurveTo(18, -9, 17, -14); g.lineTo(13, -19); g.lineTo(-6, -19); g.quadraticCurveTo(-11, -19, -11, -14); g.closePath();
  const gr = g.createLinearGradient(0, -19, 0, -9); gr.addColorStop(0, '#FF6A4D'); gr.addColorStop(1, '#D8331E');
  g.fillStyle = gr; g.fill(); g.strokeStyle = COL.outline; g.lineWidth = 1.2; g.stroke();
  rr(g, 8, -17, 7, 3, 1, '#FFE07A', null);
  // steering column + wheel
  g.strokeStyle = '#333'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(6, -19); g.lineTo(9, -27); g.stroke();
  g.fillStyle = '#333'; g.beginPath(); g.ellipse(9, -27.5, 3.4, 1.3, 0, 0, 6.3); g.fill();
  // seat
  rr(g, -8, -24, 9, 5, 2, '#3B3B46', null);
  g.restore();
  // seated girl (upper body)
  g.save(); g.translate(-3, -19 + jig);
  rr(g, -4.6, -12, 9.2, 11, 3, '#F2553A', COL.outline, 1.1);
  g.strokeStyle = COL.outline; g.lineWidth = 4.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(3, -9); g.lineTo(11, -8); g.stroke();
  g.strokeStyle = COL.skin; g.lineWidth = 2.8; g.stroke();
  circ(g, 0, -18, 6.8, COL.skin, COL.outline, 1.1);
  g.fillStyle = COL.hair; g.beginPath(); g.arc(0, -19, 7, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(3, -20, 1, -22.5); g.quadraticCurveTo(-3, -19.5, -6.8, -18); g.closePath(); g.fill();
  for (const s of [-1, 1]) { circ(g, s * 7, -16.5, 2.6, COL.hair, COL.outline, 0.9); }
  g.fillStyle = '#3A2210'; g.beginPath(); g.ellipse(1.5, -17.6, 0.9, 1.2, 0, 0, 6.3); g.ellipse(4.6, -17.6, 0.9, 1.2, 0, 0, 6.3); g.fill();
  g.restore();
  return [-27, 18];
}

// worker cart (blue) with a farmer boy driving. Returns stack base [x offset, z].
export function cart(g, t, moving, walk) {
  const jig = moving ? Math.sin(walk * 2) * 0.5 : 0;
  shadow(g, 18, 5);
  g.save(); g.translate(0, jig);
  wheel(g, -8, -4, 4.4); wheel(g, 9, -4, 4.4);
  rr(g, -15, -15, 22, 10, 2.5, '#FFB21E', COL.outline, 1.2);
  rr(g, 6, -14, 9, 9, 2, '#3D7FD9', COL.outline, 1.2);
  g.restore();
  g.save(); g.translate(10, -14 + jig);
  rr(g, -4, -10, 8, 9, 2.5, '#3D7FD9', COL.outline, 1);
  circ(g, 0, -15, 5.8, COL.skin, COL.outline, 1);
  g.fillStyle = '#F4D06F'; g.strokeStyle = '#B88A2E'; g.lineWidth = 0.9; g.beginPath(); g.ellipse(0, -19.5, 8.5, 2.4, 0, 0, 6.3); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(0, -21, 4.6, 3.4, 0, Math.PI, 0); g.fill(); g.stroke();
  g.fillStyle = '#3A2210'; g.beginPath(); g.arc(2.4, -15, 0.8, 0, 6.3); g.fill();
  g.restore();
  return [-4, 15];
}

export function stall(g, t, item, bump, flip) {
  // wooden stand with striped awning; drawn facing the camera
  shadow(g, 44, 9);
  g.fillStyle = COL.woodDark; for (const x of [-36, 36]) g.fillRect(x - 1.6, -50, 3.2, 50);
  rr(g, -40, -22, 80, 22, 3, '#D08B4C', COL.outline, 1.4);
  g.fillStyle = '#B87536'; for (let i = -3; i <= 3; i++) g.fillRect(i * 11 - 0.6, -21, 1.2, 20);
  rr(g, -42, -26, 84, 6, 2.5, '#E7A866', COL.outline, 1.2);
  // awning
  const sq = 1 + bump * 0.06;
  g.save(); g.translate(0, -50); g.scale(sq, 1 / sq);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#FFFFFF' : COL.red;
    g.beginPath(); g.moveTo(-44 + i * 11, -8); g.lineTo(-33 + i * 11, -8); g.lineTo(-33 + i * 11, 4); g.quadraticCurveTo(-38.5 + i * 11, 9, -44 + i * 11, 4); g.closePath(); g.fill();
  }
  g.strokeStyle = COL.outline; g.lineWidth = 1.3; g.strokeRect(-44, -12, 88, 4);
  g.fillStyle = '#C93A22'; g.fillRect(-44, -12, 88, 4);
  g.restore();
}

export function machine(g, t, work, kind) {
  shadow(g, 42, 10);
  const shake = work ? Math.sin(t * 40) * 0.8 : 0;
  g.save(); g.translate(shake, 0);
  const body = kind === 'ketchup' ? ['#FF7A5C', '#D93A22'] : ['#7FD0FF', '#2F8EDB'];
  const gr = g.createLinearGradient(0, -46, 0, 0); gr.addColorStop(0, body[0]); gr.addColorStop(1, body[1]);
  rr(g, -36, -42, 72, 42, 6, gr, COL.outline, 1.5);
  rr(g, -30, -36, 26, 18, 4, '#FFFFFF', COL.outline, 1);
  // chimney
  rr(g, 18, -58, 10, 18, 2, '#8A8A99', COL.outline, 1.2);
  // hopper on the input side
  g.fillStyle = '#B5B5C6'; g.strokeStyle = COL.outline; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-44, -54); g.lineTo(-22, -54); g.lineTo(-27, -40); g.lineTo(-39, -40); g.closePath(); g.fill(); g.stroke();
  // gear
  g.save(); g.translate(14, -22); g.rotate(work ? t * 4 : 0);
  g.fillStyle = '#FFD23F'; g.strokeStyle = COL.outline; g.lineWidth = 1;
  g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 6 : 8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
  circ(g, 0, 0, 2.4, '#8A6A10', null);
  g.restore();
  g.restore();
}
