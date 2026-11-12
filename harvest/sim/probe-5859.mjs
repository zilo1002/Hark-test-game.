// Probe: dump resolved objects/counters/stands/tiles for L58 and L59 after splitSales,
// and simulate briefly to see what the player can harvest and what the counter stocks.
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';

for (const li of [57, 58]) {
  const w = new World(li, { quiet: true, seed: 1 });
  const L = w.L;
  console.log(`\n===== L${li + 1} ${L.name} (valley=${L.valley}) =====`);
  console.log('OBJECTS:');
  for (const o of L.objects) {
    console.log(`  ${o.id} type=${o.type} crop=${o.crop || ''} item=${o.item || ''} in=${o.in || ''} out=${o.out || ''} outTo=${o.outTo || ''} items=${o.items ? JSON.stringify(o.items) : ''} hidden=${!!o.hidden} role=${o.role || ''} foodManualSupply=${!!o.foodManualSupply}`);
  }
  console.log('COUNTERS (world):');
  for (const c of w.counters) {
    console.log(`  ${c.id} items=${JSON.stringify(c.items)} stock=${JSON.stringify(c.stock)} hidden=${!!c.hidden} sale2=${!!c.sale2}`);
  }
  console.log('FIELDS:');
  for (const f of (w.fields || [])) console.log(`  ${f.id} item=${f.item} crop=${f.crop} hidden=${!!f.hidden} ripe=${f.ripe} total=${f.pile ? f.pile.total : '?'}`);
  console.log('TILES (visible at start):');
  for (const t of w.tiles) {
    if (t.visible) console.log(`  ${t.id} label=${t.label} price=${t.price} effect=${JSON.stringify(t.effect)} req=${JSON.stringify(t.req)}`);
  }
  console.log('GUIDE at t=0:', JSON.stringify(w.guide()));
  // step 30s with no input: do fields grow / anything stock?
  for (let i = 0; i < 900; i++) w.update(1 / 30, 0, 0);
  console.log('AFTER 30s idle:');
  for (const f of (w.fields || [])) console.log(`  field ${f.id} item=${f.item} ripe=${f.ripe} pileTotal=${f.pile ? f.pile.total : '?'}`);
  for (const c of w.counters) console.log(`  counter ${c.id} stock=${JSON.stringify(c.stock)}`);
  console.log('  stands:', (w.stands || []).map((s) => `${s.id}(${s.item},${s.role},${s.pile ? s.pile.total : '?'}/${s.cap})`).join(' '));
  console.log('  player stack:', JSON.stringify(w.player.stack), 'cap:', w.player.cap);
}
