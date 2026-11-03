// Home screen between levels: a little farmhouse you restore with stars.
// Drawn on the main canvas in a 360×440 design space.
import { CFG } from './config.js';
import { COL } from './sprites.js';
import { person, GIRL } from './chars.js';
import { elastic, FONT } from './render.js';

const TAU = Math.PI * 2;
export const SPOTS = {
  tree: [44, 130], windmill: [312, 118], barn: [300, 215], well: [56, 250], flowers: [180, 248],
  paint: [180, 172], path: [180, 330], fence: [180, 292], scarecrow: [300, 360], pond: [74, 372],
};

function shadow(g, x, y, rx, ry) { g.fillStyle = 'rgba(60,90,20,0.25)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }

const DRAW = {
  tree(g, t, plain) {
    shadow(g, 0, 0, 30, 9);
    g.fillStyle = '#8E5627'; g.fillRect(-5, -30, 10, 30);
    for (const [x, y, r, c] of [[-16, -42, 18, '#3E9A2A'], [16, -42, 18, '#3E9A2A'], [0, -60, 22, '#4FB233'], [-8, -48, 14, '#5CC23D'], [9, -64, 10, '#7BD655']]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    if (!plain) for (const [x, y] of [[-14, -46], [10, -52], [2, -38], [-4, -66], [18, -40]]) { g.fillStyle = COL.red; g.beginPath(); g.arc(x, y, 3.4, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 1, y - 1, 1, 0, TAU); g.fill(); }
  },
  windmill(g, t) {
    shadow(g, 0, 0, 24, 7);
    g.fillStyle = '#FFF3DC'; g.strokeStyle = COL.outline; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-14, 0); g.lineTo(-9, -58); g.lineTo(9, -58); g.lineTo(14, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = COL.red; g.beginPath(); g.moveTo(-13, -56); g.lineTo(0, -72); g.lineTo(13, -56); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8E5627'; g.beginPath(); g.roundRect(-5, -14, 10, 14, 4); g.fill();
    g.save(); g.translate(0, -60); g.rotate(t * 1.4);
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillStyle = '#FFFFFF'; g.strokeStyle = COL.outline; g.beginPath(); g.rect(3, -4, 32, 8); g.fill(); g.stroke(); g.fillStyle = '#F2C14E'; g.fillRect(8, -3, 24, 2); }
    g.fillStyle = '#5A3414'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
    g.restore();
  },
  barn(g) {
    shadow(g, 0, 0, 34, 9);
    g.fillStyle = '#D93A22'; g.strokeStyle = COL.outline; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-30, 0); g.lineTo(-30, -32); g.lineTo(-18, -48); g.lineTo(18, -48); g.lineTo(30, -32); g.lineTo(30, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#FFFFFF'; g.fillRect(-12, -26, 24, 26); g.fillStyle = '#B92A1C'; g.fillRect(-10, -24, 20, 24);
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, -24); g.lineTo(10, 0); g.moveTo(10, -24); g.lineTo(-10, 0); g.stroke();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(0, -36, 4, 0, TAU); g.fill();
  },
  well(g) {
    shadow(g, 0, 0, 22, 7);
    g.fillStyle = '#A9A9B8'; g.strokeStyle = COL.outline; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(0, -8, 16, 6, 0, 0, TAU); g.fill(); g.stroke(); g.fillRect(-16, -8, 32, 9); g.strokeRect(-16, -8, 32, 9);
    g.fillStyle = '#3B7BD9'; g.beginPath(); g.ellipse(0, -9, 12, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#8E5627'; g.fillRect(-15, -34, 3, 26); g.fillRect(12, -34, 3, 26);
    g.fillStyle = COL.red; g.beginPath(); g.moveTo(-20, -32); g.lineTo(0, -44); g.lineTo(20, -32); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8E5627'; g.fillRect(-2, -30, 4, 8);
  },
  flowers(g, t) {
    for (const sx of [-52, 52]) {
      g.fillStyle = COL.soil; g.beginPath(); g.ellipse(sx, 0, 26, 7, 0, 0, TAU); g.fill();
      for (let i = 0; i < 7; i++) {
        const x = sx - 20 + i * 6.6, y = -3 - (i % 2) * 3, sw = Math.sin(t * 2 + i) * 1;
        g.strokeStyle = COL.leafDark; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + sw, y - 6); g.stroke();
        g.fillStyle = ['#FF6FA8', '#FFD23F', '#FFFFFF', '#A77BFF'][i % 4]; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + sw + Math.cos(p * 1.256) * 2.4, y - 6 + Math.sin(p * 1.256) * 2.4, 1.8, 0, TAU); g.fill(); }
        g.fillStyle = '#FF9F1C'; g.beginPath(); g.arc(x + sw, y - 6, 1.3, 0, TAU); g.fill();
      }
    }
  },
  path(g) {
    for (let i = 0; i < 7; i++) { const y = -62 + i * 19, x = (i % 2 ? 6 : -6); g.fillStyle = '#D9D2C2'; g.strokeStyle = '#A99F8A'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, 13, 6, 0, 0, TAU); g.fill(); g.stroke(); }
  },
  fence(g) {
    for (const [a, b] of [[-170, -40], [40, 170]]) {
      g.fillStyle = COL.fence; g.strokeStyle = COL.fenceDark; g.lineWidth = 1.2;
      g.fillRect(a, -16, b - a, 4); g.strokeRect(a, -16, b - a, 4); g.fillRect(a, -8, b - a, 4); g.strokeRect(a, -8, b - a, 4);
      for (let x = a; x <= b; x += 16) { g.beginPath(); g.roundRect(x - 2.5, -22, 5, 22, 2); g.fill(); g.stroke(); }
    }
  },
  scarecrow(g, t) {
    shadow(g, 0, 0, 14, 5);
    const sw = Math.sin(t * 1.5) * 0.06;
    g.save(); g.rotate(sw);
    g.fillStyle = '#8E5627'; g.fillRect(-1.5, -44, 3, 44); g.fillRect(-18, -34, 36, 3);
    g.fillStyle = '#3D7FD9'; g.strokeStyle = COL.outline; g.lineWidth = 1.2; g.beginPath(); g.roundRect(-9, -38, 18, 18, 3); g.fill(); g.stroke();
    g.fillStyle = '#F4D06F'; g.beginPath(); g.arc(0, -46, 7, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(0, -52, 12, 3, 0, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.ellipse(0, -54, 6, 5, 0, Math.PI, 0); g.fill(); g.stroke();
    g.fillStyle = '#3A2210'; g.fillRect(-3, -47, 2, 2); g.fillRect(2, -47, 2, 2);
    g.restore();
  },
  pond(g, t) {
    g.fillStyle = '#7FC6E8'; g.strokeStyle = '#4FA0C8'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 44, 18, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-12, -4, 12, 3, 0, 0, TAU); g.fill();
    for (const [x, y] of [[14, 2], [-20, 6], [24, -6]]) { g.fillStyle = '#5DBB3A'; g.beginPath(); g.arc(x, y + Math.sin(t + x) * 0.6, 4.4, 0.4, TAU - 0.4); g.lineTo(x, y); g.fill(); }
    g.fillStyle = '#FF6FA8'; g.beginPath(); g.arc(14, 1, 1.8, 0, TAU); g.fill();
  },
};

function house(g, painted) {
  shadow(g, 0, 0, 72, 14);
  g.strokeStyle = COL.outline; g.lineWidth = 1.8;
  g.fillStyle = painted ? '#FFF3DC' : '#C9B79C'; g.beginPath(); g.rect(-56, -62, 112, 62); g.fill(); g.stroke();
  if (!painted) { g.strokeStyle = 'rgba(90,60,30,0.35)'; g.lineWidth = 1; for (let y = -54; y < 0; y += 8) { g.beginPath(); g.moveTo(-56, y); g.lineTo(56, y + (y % 16 ? 1 : -1)); g.stroke(); } g.strokeStyle = COL.outline; g.lineWidth = 1.8; }
  g.fillStyle = painted ? '#E8452C' : '#8E7A66'; g.beginPath(); g.moveTo(-66, -60); g.lineTo(0, -104); g.lineTo(66, -60); g.closePath(); g.fill(); g.stroke();
  if (painted) { g.fillStyle = '#C93A22'; for (let i = 0; i < 4; i++) g.fillRect(-50 + i * 8, -66 + i * -5, 100 - i * 16, 2); }
  g.fillStyle = painted ? '#8E5627' : '#6E5A46'; g.beginPath(); g.roundRect(-11, -36, 22, 36, [8, 8, 0, 0]); g.fill(); g.stroke();
  g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(6, -18, 1.8, 0, TAU); g.fill();
  for (const x of [-38, 38]) {
    g.fillStyle = painted ? '#8FD3FF' : '#6E6255'; g.beginPath(); g.rect(x - 11, -48, 22, 18); g.fill(); g.stroke();
    if (painted) { g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, -48); g.lineTo(x, -30); g.moveTo(x - 11, -39); g.lineTo(x + 11, -39); g.stroke(); g.strokeStyle = COL.outline; g.lineWidth = 1.8; g.fillStyle = '#FF6FA8'; g.fillRect(x - 12, -30, 24, 4); }
    else { g.fillStyle = '#9C7A55'; g.save(); g.translate(x, -39); g.rotate(0.3); g.fillRect(-13, -2.5, 26, 5); g.rotate(-0.6); g.fillRect(-13, -2.5, 26, 5); g.restore(); }
  }
  g.fillStyle = painted ? '#B5562A' : '#7A6A5A'; g.fillRect(28, -98, 12, 22); g.strokeRect(28, -98, 12, 22);
}

export function homeLayout(W, H) {
  const top = 64, bottom = Math.min(260, H * 0.38);
  const s = Math.min(W / 360, (H - top - bottom) / 420);
  return { s, ox: (W - 360 * s) / 2, oy: top + Math.max(0, (H - top - bottom - 420 * s) / 2) - 10 * s };
}

export function drawHome(g, W, H, save, t, dpr) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9BDB6A'); gr.addColorStop(1, '#6CBF45');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const { s, ox, oy } = homeLayout(W, H);
  g.save(); g.translate(ox, oy); g.scale(s, s);
  // trees around the yard (always there)
  for (const [x, y, k] of [[-10, 70, 1], [372, 60, 0.9], [-20, 330, 0.9], [380, 300, 1.1], [20, 470, 0.8], [350, 460, 0.9], [150, 40, 0.7], [240, 30, 0.8]]) {
    g.save(); g.translate(x, y); g.scale(k, k); DRAW.tree(g, t, true); g.restore();
  }
  // yard
  g.fillStyle = '#F4C553'; g.beginPath(); g.ellipse(180, 250, 190, 150, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(214,150,40,0.25)'; for (let i = 0; i < 80; i++) { g.beginPath(); g.arc(30 + ((i * 97) % 300), 130 + ((i * 53) % 230), 1.6, 0, TAU); g.fill(); }
  const restored = new Set(save.restored);
  const order = Object.entries(SPOTS).sort((a, b) => a[1][1] - b[1][1]);
  const items = [...order.filter(([k]) => k === 'path' || k === 'pond'), ['__house', SPOTS.paint], ...order.filter(([k]) => k !== 'path' && k !== 'pond' && k !== 'paint')];
  for (const [id, [x, y]] of items) {
    g.save(); g.translate(x, y);
    if (id === '__house') { const a = restored.has('paint') ? elastic((t - (save.restoredAt?.paint || -9)) / 0.7) : 1; g.scale(0.9 + 0.1 * a, 0.9 + 0.1 * a); house(g, restored.has('paint')); g.restore(); continue; }
    if (restored.has(id)) {
      const a = elastic((t - (save.restoredAt?.[id] || -9)) / 0.7);
      g.scale(a, a); DRAW[id](g, t);
    } else if (id !== 'paint') {
      // empty spot: dashed ring with a star price
      const m = CFG.meta.find((x) => x.id === id);
      g.setLineDash([5, 4]); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, -2, 22, 9, 0, 0, TAU); g.stroke(); g.setLineDash([]);
      if (id === 'fence') { g.strokeStyle = COL.fenceDark; g.lineWidth = 3; for (const [a, b] of [[-150, 0.4], [-110, -0.5], [70, 0.6], [130, -0.3]]) { g.save(); g.translate(a, 0); g.rotate(b); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -18); g.stroke(); g.restore(); } }
      g.font = FONT(11); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#5A3414'; g.fillStyle = '#FFE14D';
      g.strokeText(`★${m ? m.cost : ''}`, 0, -3); g.fillText(`★${m ? m.cost : ''}`, 0, -3);
    }
    g.restore();
  }
  // the farmer girl waves by the door
  g.save(); g.translate(206, 236); g.scale(1.05, 1.05); person(g, t, 0, false, { ...GIRL, carry: Math.sin(t * 3) > 0.3 }); g.restore();
  g.restore();
}
