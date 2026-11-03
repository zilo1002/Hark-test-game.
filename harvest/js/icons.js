// Small icons for unlock tiles, zone markers and the HUD (drawn centred at 0,0, ~20 units wide).
import { COL, ITEM_DRAW } from './sprites.js';
import { hen, bush, mower, cart, person, BOY } from './chars.js';

function arrowUp(g, x, y, s, c) {
  g.fillStyle = c; g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(x, y - 6 * s); g.lineTo(x + 5 * s, y); g.lineTo(x + 2 * s, y); g.lineTo(x + 2 * s, y + 5 * s); g.lineTo(x - 2 * s, y + 5 * s); g.lineTo(x - 2 * s, y); g.lineTo(x - 5 * s, y); g.closePath(); g.fill(); g.stroke();
}
const ITEMS = new Set(['egg', 'potato', 'tomato', 'wheat', 'crate', 'ketchup', 'bill', 'cash', 'tulip', 'rose', 'gold', 'bouquet', 'basket', 'perfume']);

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
