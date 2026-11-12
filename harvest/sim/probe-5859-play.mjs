// Probe: play L58/L59 with the balance bot and sample counter stocks + player stack.
// Uses the same playLevel bot as balance.mjs but samples stocks along the way.
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import { levelCrew, crewDefaults } from '../js/crew.js';
import { botWay } from './balance.mjs';

const DT = 1 / 30, LIMIT = 900;
const prof = { stick: 1.0, think: 0.1 };

function play(li, seed = 1) {
  const w = new World(li, { quiet: true, seed, crew: null });
  const p = w.player;
  let target = null, think = 0;
  const counts = {};
  const sample = (t) => {
    const c1 = w.counters.find((c) => c.id === 'C1');
    const ps = w.counters.find((c) => c.id === 'PS');
    const cnt = (arr) => { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return JSON.stringify(m); };
    console.log(`  t=${t}s money=${Math.round(w.money)} C1.stock=${cnt(c1 ? c1.stock : [])} PS.stock=${cnt(ps ? ps.stock : [])} playerStack=${cnt(p.stack)} won=${w.won}`);
  };
  console.log(`\n===== L${li + 1} ${w.L.name} =====`);
  console.log('  t=0:'); sample(0);
  while (!w.won && w.t < LIMIT) {
    think -= DT;
    if (think <= 0) { target = w.guide(); think = prof.think; }
    if (target && (target.kind === 'pile' || target.kind === 'field' || target.kind === 'pond')) target = w.guide() || target;
    let ix = 0, iy = 0;
    if (target) {
      const stop = target.kind === 'tile' ? 4 : target.kind === 'pile' || target.kind === 'field' || target.kind === 'pond' ? 2 : 6;
      if (Math.hypot(target.x - p.x, target.y - p.y) > stop) {
        const wp = botWay(w, p, target);
        const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy) || 1;
        ix = dx / d * prof.stick; iy = dy / d * prof.stick;
      }
    }
    w.update(DT, ix, iy);
    const t = Math.round(w.t);
    if (t > 0 && t % 60 === 0 && Math.abs(w.t - t) < DT) sample(t);
  }
  console.log(`  END t=${Math.round(w.t)} won=${w.won} money=${Math.round(w.money)}`);
  const c1 = w.counters.find((c) => c.id === 'C1');
  const ps = w.counters.find((c) => c.id === 'PS');
  const cnt = (arr) => { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return JSON.stringify(m); };
  console.log(`  final C1.stock=${cnt(c1 ? c1.stock : [])} PS.stock=${cnt(ps ? ps.stock : [])}`);
  console.log(`  stands: ${(w.stands || []).map((s) => `${s.id}(${s.item}):${s.pile ? s.pile.total : '?'}`).join(' ')}`);
  console.log(`  stats sold: ${JSON.stringify(w.stats.sold || {})}`);
}
play(57);
play(58);
