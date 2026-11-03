// Small icons for unlock tiles, signs and the HUD (drawn centred at 0,0, ~20 units wide).
import { COL, ITEM_DRAW } from './sprites.js';
import { hen, bush, mower, cart, person, BOY } from './chars.js';

function arrowUp(g, x, y, s, c) {
  g.fillStyle = c; g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(x, y - 6 * s); g.lineTo(x + 5 * s, y); g.lineTo(x + 2 * s, y); g.lineTo(x + 2 * s, y + 5 * s); g.lineTo(x - 2 * s, y + 5 * s); g.lineTo(x - 2 * s, y); g.lineTo(x - 5 * s, y); g.closePath(); g.fill(); g.stroke();
}

export function drawIcon(g, kind, t = 0) {
  g.save();
  switch (kind) {
    case 'egg': case 'potato': case 'tomato': case 'wheat': case 'crate': case 'ketchup': case 'bill':
      g.scale(1.5, 1.5); ITEM_DRAW[kind](g); break;
    case 'field':
      g.strokeStyle = COL.leafDark; g.lineWidth = 1.6;
      for (const x of [-6, 0, 6]) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, -2); g.stroke(); g.save(); g.translate(x, -5); g.scale(0.8, 0.8); ITEM_DRAW.wheat(g); g.restore(); }
      break;
    case 'cap':
      g.save(); g.translate(-3, 4); for (let i = 0; i < 3; i++) { g.save(); g.translate(0, -i * 6); ITEM_DRAW.egg(g); g.restore(); } g.restore();
      arrowUp(g, 7, -2, 1, '#3BC14A'); break;
    case 'speed':
      g.fillStyle = '#3BA7FF'; g.strokeStyle = COL.outline; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(-6, -9); g.lineTo(1, -9); g.lineTo(2, 0); g.lineTo(10, 3); g.quadraticCurveTo(11, 8, 8, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#FFFFFF'; g.fillRect(-7, 5, 17, 3);
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.6; for (const y of [-5, -1, 3]) { g.beginPath(); g.moveTo(-14, y); g.lineTo(-9, y); g.stroke(); }
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
    case 'counter':
      g.fillStyle = '#D08B4C'; g.strokeStyle = COL.outline; g.lineWidth = 1.2; g.beginPath(); g.roundRect(-10, 0, 20, 8, 2); g.fill(); g.stroke();
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#FFFFFF' : COL.red; g.fillRect(-11 + i * 5.5, -9, 5.5, 5); }
      g.strokeRect(-11, -9, 22, 5); g.fillStyle = COL.woodDark; g.fillRect(-10, -4, 1.5, 4); g.fillRect(8.5, -4, 1.5, 4);
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
