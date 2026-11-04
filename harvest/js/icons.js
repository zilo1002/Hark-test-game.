// Small icons for unlock tiles, zone markers and the HUD (drawn centred at 0,0, ~20 units wide).
import { COL, ITEM_DRAW } from './sprites.js';
import { hen, bush, mower, cart, person, BOY } from './chars.js';

function arrowUp(g, x, y, s, c) {
  g.fillStyle = c; g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(x, y - 6 * s); g.lineTo(x + 5 * s, y); g.lineTo(x + 2 * s, y); g.lineTo(x + 2 * s, y + 5 * s); g.lineTo(x - 2 * s, y + 5 * s); g.lineTo(x - 2 * s, y); g.lineTo(x - 5 * s, y); g.closePath(); g.fill(); g.stroke();
}
const ITEMS = new Set(Object.keys(ITEM_DRAW));

export function drawIcon(g, kind, t = 0) {
  g.save();
  if (ITEMS.has(kind)) { g.scale(1.45, 1.45); ITEM_DRAW[kind](g); g.restore(); return; }
  switch (kind) {
    case 'plot':   // a soil bed with a sprout and a plus
      g.fillStyle = COL.soil; g.strokeStyle = COL.soil2; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-11, 2); g.lineTo(0, -4); g.lineTo(11, 2); g.lineTo(0, 8); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(70,35,15,0.5)'; g.lineWidth = 0.8; for (const k of [-4, 0, 4]) { g.beginPath(); g.moveTo(-6 + k, 4.6 - k * 0.5 - 3); g.lineTo(5 + k, 4.6 - k * 0.5 + 2.5); g.stroke(); }
      g.fillStyle = '#6CCB3E'; g.strokeStyle = '#3E8F25'; g.lineWidth = 0.6;
      for (const a of [-0.7, 0.7]) { g.save(); g.translate(0, 0); g.rotate(a); g.beginPath(); g.ellipse(0, -5, 2.2, 5, 0, 0, 6.3); g.fill(); g.stroke(); g.restore(); }
      g.fillStyle = '#FFFFFF'; g.fillRect(6, -11, 7, 2.4); g.fillRect(8.3, -13.3, 2.4, 7);
      break;
    case 'cap':
      g.save(); g.translate(-3, 5); for (let i = 0; i < 3; i++) { g.save(); g.translate(0, -i * 5.5); ITEM_DRAW.tulip(g); g.restore(); } g.restore();
      arrowUp(g, 8, -3, 1, '#3BC14A'); break;
    case 'speed':
      g.fillStyle = '#3BA7FF'; g.strokeStyle = COL.outline; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(-6, -9); g.lineTo(1, -9); g.lineTo(2, 0); g.lineTo(10, 3); g.quadraticCurveTo(11, 8, 8, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#FFFFFF'; g.fillRect(-7, 5, 17, 3);
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.6; for (const y of [-5, -1, 3]) { g.beginPath(); g.moveTo(-14, y); g.lineTo(-9, y); g.stroke(); }
      break;
    case 'shears':
      g.lineCap = 'round';
      for (const s of [-1, 1]) {
        g.save(); g.rotate(s * 0.35);
        g.strokeStyle = '#4A5260'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 2); g.lineTo(0, -12); g.stroke();
        g.strokeStyle = '#E6EAF0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -11.5); g.stroke();
        g.strokeStyle = s < 0 ? '#E8452C' : '#F4A52A'; g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, 7, 3, 4, 0, 0, 6.3); g.stroke();
        g.restore();
      }
      g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(0, 1, 1.6, 0, 6.3); g.fill();
      break;
    case 'magnet':
      g.lineCap = 'butt'; g.strokeStyle = COL.outline; g.lineWidth = 8; g.beginPath(); g.arc(0, -1, 7, Math.PI, 0); g.lineTo(7, 7); g.moveTo(-7, -1); g.lineTo(-7, 7); g.stroke();
      g.strokeStyle = COL.red; g.lineWidth = 5.6; g.stroke();
      g.fillStyle = '#E8E8F0'; g.fillRect(-9.8, 5, 5.6, 4); g.fillRect(4.2, 5, 5.6, 4);
      break;
    case 'hen': g.translate(-2, 8); g.scale(0.9, 0.9); hen(g, t, 0, 0); break;
    case 'bush': g.translate(0, 8); g.scale(0.9, 0.9); bush(g, t, 0, 0, 6); break;
    case 'mower': g.translate(6, 7); g.scale(0.45, 0.45); mower(g, t, false, 0); break;
    case 'cart': g.translate(2, 6); g.scale(0.7, 0.7); cart(g, t, false, 0); break;
    case 'worker': g.translate(0, 12); g.scale(0.62, 0.62); person(g, t, 0, false, BOY); break;
    case 'loader': {   // 园丁换铲车: yellow loader with a front bucket, side view
      const O = COL.outline;
      g.lineJoin = 'round'; g.strokeStyle = O; g.lineWidth = 1.1;
      g.fillStyle = '#FFC21A'; g.beginPath(); g.roundRect(-9, -6, 13, 8, 2); g.fill(); g.stroke();          // body
      g.fillStyle = '#F29C0E'; g.beginPath(); g.roundRect(-11, -10, 7, 5, 1.5); g.fill(); g.stroke();       // load bed
      g.fillStyle = '#3A3A44'; g.fillRect(-3, -12, 2, 6);                                                   // seat back
      g.strokeStyle = '#E8A20E'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(2, -3); g.lineTo(9, 1); g.stroke(); // arm
      g.fillStyle = '#AEB6C2'; g.strokeStyle = O; g.lineWidth = 1.1; g.beginPath(); g.moveTo(8, -2); g.lineTo(14, -2); g.lineTo(13, 5); g.lineTo(7, 5); g.closePath(); g.fill(); g.stroke();   // bucket
      for (const [x, r] of [[-6, 4.4], [4, 3.2]]) { g.fillStyle = '#24242A'; g.beginPath(); g.arc(x, 4, r, 0, 6.3); g.fill(); g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(x, 4, r * 0.45, 0, 6.3); g.fill(); }
      g.fillStyle = '#F2CF6B'; g.beginPath(); g.ellipse(-1, -14, 4.5, 1.4, 0, 0, 6.3); g.fill(); g.fillStyle = '#E8BE4E'; g.fillRect(-3.4, -17, 4.8, 3.2);   // straw hat
      break;
    }
    case 'sprinkler': {   // 洒水器: post + spraying arcs
      g.strokeStyle = '#8C94A0'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 9); g.lineTo(0, -3); g.stroke();
      g.fillStyle = '#3BA7FF'; g.strokeStyle = COL.outline; g.lineWidth = 1; g.beginPath(); g.roundRect(-3, -6, 6, 4, 1.5); g.fill(); g.stroke();
      g.fillStyle = '#7FD0FF';
      for (const s of [-1, 1]) for (let i = 1; i <= 4; i++) { const u = i / 4; g.beginPath(); g.arc(s * u * 12, -6 - 10 * u * (1 - u) * 2.2 + u * 12, 1.2 + u * 0.8, 0, 6.3); g.fill(); }
      g.fillStyle = '#5DBB3A'; g.beginPath(); g.ellipse(0, 9.5, 9, 2.2, 0, 0, 6.3); g.fill();
      break;
    }
    // ---- v3.3 tile icons ----
    case 'cow': {
      const O = COL.outline; g.lineJoin = 'round'; g.strokeStyle = O; g.lineWidth = 1;
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(-11, -6, 17, 10, 4); g.fill(); g.stroke();
      g.fillStyle = '#2A2A30'; g.beginPath(); g.ellipse(-5, -2, 3.4, 2.4, 0.3, 0, 6.3); g.fill(); g.beginPath(); g.ellipse(1, 1, 2.4, 2, 0, 0, 6.3); g.fill();
      for (const x of [-9, -5, 0, 4]) { g.fillStyle = '#FFFFFF'; g.fillRect(x, 3, 2.4, 6); g.strokeRect(x, 3, 2.4, 6); }
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(8, -6, 5, 4.4, 0, 0, 6.3); g.fill(); g.stroke();
      g.fillStyle = '#FFB3B8'; g.beginPath(); g.ellipse(10, -3.6, 3.4, 2.4, 0, 0, 6.3); g.fill(); g.stroke();
      g.fillStyle = '#2A2A30'; g.beginPath(); g.arc(7.4, -7.4, 0.9, 0, 6.3); g.fill();
      g.fillStyle = '#FFF3D6'; g.beginPath(); g.moveTo(5, -9.6); g.lineTo(4, -13); g.lineTo(6.6, -10); g.fill(); g.beginPath(); g.moveTo(10, -9.6); g.lineTo(11.6, -13); g.lineTo(11.4, -9.4); g.fill();
      g.fillStyle = '#FFC21A'; g.beginPath(); g.arc(5.6, 0.6, 1.6, 0, 6.3); g.fill(); g.stroke();
      break;
    }
    case 'sheep': {
      g.strokeStyle = '#B8B0A8'; g.lineWidth = 0.7;
      g.fillStyle = '#3A3036'; for (const x of [-7, -3, 2, 6]) g.fillRect(x, 3, 2, 6);
      for (const [x, y, r] of [[-6, -2, 4.6], [-1, -4, 5], [4, -2, 4.6], [-3, 1, 4.4], [2, 1, 4.4]]) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.stroke(); }
      g.fillStyle = '#3A3036'; g.beginPath(); g.ellipse(9, -3, 3.6, 4.4, 0.2, 0, 6.3); g.fill();
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(8, -7, 2.4, 0, 6.3); g.fill(); g.beginPath(); g.arc(10, -3.4, 0.7, 0, 6.3); g.fill();
      break;
    }
    case 'hive': {
      const O = COL.outline; g.strokeStyle = O; g.lineWidth = 1;
      g.fillStyle = '#C8874A'; g.fillRect(-10, 6, 20, 3); g.strokeRect(-10, 6, 20, 3);
      for (const y of [-1, -8]) { g.fillStyle = '#FFF6E0'; g.fillRect(-8, y, 16, 7); g.strokeRect(-8, y, 16, 7); }
      g.fillStyle = '#FFC21A'; g.beginPath(); g.moveTo(-10, -8); g.lineTo(0, -13); g.lineTo(10, -8); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#3A2A10'; g.fillRect(-3, 3, 6, 1.6);
      g.fillStyle = '#FFD23F'; g.beginPath(); g.ellipse(9, -12, 2.4, 1.8, 0, 0, 6.3); g.fill(); g.stroke(); g.fillStyle = '#2A2A30'; g.fillRect(8.4, -13.6, 1.2, 3.4);
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(8, -15, 1.8, 1, -0.5, 0, 6.3); g.fill();
      break;
    }
    case 'appletree': {
      g.fillStyle = '#8E5627'; g.fillRect(-2, 0, 4, 10);
      for (const [x, y, r, c] of [[0, -6, 9, '#3FA236'], [-5, -3, 6, '#2F8A2A'], [5, -8, 6, '#5DBB3A']]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
      for (const [x, y] of [[-4, -6], [3, -3], [5, -9], [-1, -11], [-6, -1]]) { g.fillStyle = '#E8283C'; g.beginPath(); g.arc(x, y, 1.8, 0, 6.3); g.fill(); }
      break;
    }
    case 'lumber': g.save(); g.translate(-2, 12); g.scale(0.62, 0.62); person(g, t, 0, false, { ...BOY, shirt: '#D9382A', overalls: null, pants: '#4A5A8A', sickle: false }); g.restore(); g.translate(8, -1); g.scale(0.6, 0.6); drawIcon(g, 'axe', t); break;
    case 'axe':
      g.rotate(-0.5); g.fillStyle = '#A8741E'; g.strokeStyle = COL.outline; g.lineWidth = 1; g.beginPath(); g.roundRect(-1.4, -10, 2.8, 20, 1); g.fill(); g.stroke();
      g.fillStyle = '#C9D2DC'; g.beginPath(); g.moveTo(1, -9); g.lineTo(9, -11); g.quadraticCurveTo(11, -5, 9, 0); g.lineTo(1, -3); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#E8452C'; g.fillRect(-1.6, -9, 3.2, 4);
      break;
    case 'saw':
      g.rotate(t * 3); g.fillStyle = '#D8DEE6'; g.strokeStyle = COL.outline; g.lineWidth = 1;
      g.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 8 : 10.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#E8452C'; g.beginPath(); g.arc(0, 0, 3, 0, 6.3); g.fill(); g.stroke();
      break;
    case 'truck': {   // 运木车: green log truck carrying logs
      const O = COL.outline; g.strokeStyle = O; g.lineWidth = 1;
      g.fillStyle = '#4CB24E'; g.beginPath(); g.roundRect(4, -8, 9, 11, 2); g.fill(); g.stroke();
      g.fillStyle = '#A8DCFF'; g.fillRect(6, -6, 5, 4);
      g.fillStyle = '#2F8F3A'; g.beginPath(); g.roundRect(-13, -1, 18, 4, 1); g.fill(); g.stroke();
      for (const [y, x] of [[-4, -10], [-4, -4], [-8, -7]]) { g.fillStyle = '#9A5A2E'; g.beginPath(); g.roundRect(x - 3, y - 2, 11, 4, 2); g.fill(); g.stroke(); g.fillStyle = '#F2CF8A'; g.beginPath(); g.arc(x + 8, y, 1.8, 0, 6.3); g.fill(); }
      for (const x of [-8, 1, 9]) { g.fillStyle = '#24242A'; g.beginPath(); g.arc(x, 5, 3, 0, 6.3); g.fill(); g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(x, 5, 1.2, 0, 6.3); g.fill(); }
      break;
    }
    case 'milker': g.save(); g.translate(2, 6); g.scale(0.7, 0.7); cart(g, t, false, 0); g.restore(); g.translate(-2, -5); g.scale(1.1, 1.1); ITEM_DRAW.milk(g); break;
    case 'counter':
      g.fillStyle = '#4C82DE'; g.strokeStyle = '#21468E'; g.lineWidth = 1.2; g.beginPath(); g.roundRect(-11, -1, 22, 9, 2); g.fill(); g.stroke();
      g.fillStyle = '#7FB0FF'; g.beginPath(); g.roundRect(-12, -4, 24, 4, 1.5); g.fill(); g.stroke();
      g.fillStyle = '#E9EEF6'; g.strokeStyle = '#5A6070'; g.beginPath(); g.roundRect(-8, -10, 8, 6, 1); g.fill(); g.stroke();
      g.fillStyle = '#7FD7FF'; g.fillRect(-7, -9, 6, 3);
      break;
    case 'cashier':
      g.save(); g.translate(-5, 2); ITEM_DRAW.bill(g); g.restore(); g.save(); g.translate(4, -3); ITEM_DRAW.bill(g); g.restore();
      arrowUp(g, 9, 4, 0.8, '#FFD23F'); break;
    case 'gear':
      g.rotate(t * 2);
      g.fillStyle = '#FFD23F'; g.strokeStyle = COL.outline; g.lineWidth = 1.2;
      g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 7 : 10; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#8A6A10'; g.beginPath(); g.arc(0, 0, 3, 0, 6.3); g.fill(); break;
    default:
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 6, 0, 6.3); g.fill();
  }
  g.restore();
}
