// Fine-grained C1 stock sampling for L58: how often is potato actually
// sitting on the raw counter, vs corn? Samples every 2s. Same bot as balance.
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import { botWay } from './balance.mjs';

const DT = 1 / 30, LIMIT = 700;
const prof = { stick: 1.0, think: 0.1 };

function play(li) {
  const w = new World(li, { quiet: true, seed: 1, crew: null });
  const p = w.player;
  let target = null, think = 0;
  const c1 = w.counters.find((c) => c.id === 'C1');
  let potSamples = 0, cornSamples = 0, bothSamples = 0, emptySamples = 0, total = 0;
  let potMax = 0, cornMax = 0, lastT = -2;
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
    if (w.t - lastT >= 2) {
      lastT = w.t; total++;
      const st = {};
      for (const it of c1.stock) st[it] = (st[it] || 0) + 1;
      const pp = st.potato || 0, co = st.corn || 0;
      if (pp > 0) potSamples++;
      if (co > 0) cornSamples++;
      if (pp > 0 && co > 0) bothSamples++;
      if (pp === 0 && co === 0) emptySamples++;
      potMax = Math.max(potMax, pp); cornMax = Math.max(cornMax, co);
    }
  }
  console.log(`L${li + 1} ${w.L.name} over ${Math.round(w.t)}s, ${total} samples (every 2s):`);
  console.log(`  potato present: ${potSamples}/${total} (${(100 * potSamples / total).toFixed(0)}%), max ${potMax}`);
  console.log(`  corn present:   ${cornSamples}/${total} (${(100 * cornSamples / total).toFixed(0)}%), max ${cornMax}`);
  console.log(`  both: ${bothSamples}, empty: ${emptySamples} (${(100 * emptySamples / total).toFixed(0)}%)`);
  console.log(`  won=${w.won} money=${Math.round(w.money)} sold=${JSON.stringify(w.stats.sold)}`);
}
play(57);
