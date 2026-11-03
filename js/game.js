// 每帧推进：生长、雇工、集市、订单、庄园等级（纯逻辑）
import { growPlots } from './crops.js';
import { tickWorkers } from './workers.js';
import { driftPrices, fillOrders } from './market.js';
import { manorLevel, emit } from './state.js';

export function tick(s, dt, rng = Math.random) {
  s.t += dt;
  growPlots(s, dt);
  tickWorkers(s, dt, rng);
  driftPrices(s, rng);
  fillOrders(s, rng);
  const lv = manorLevel(s);
  if (lv > s.manorSeen) {
    for (let l = s.manorSeen + 1; l <= lv; l++) emit(s, { type: 'manor', lv: l });
    s.manorSeen = lv;
  }
}

// 离线：按小步长快进，返回总结
export function simulate(s, seconds, rng = Math.random, step = 0.5) {
  const before = { lifetime: s.lifetime, harvested: s.stats.byWorker.harvested, coins: s.coins };
  let left = seconds;
  while (left > 0) {
    const dt = Math.min(step, left);
    tick(s, dt, rng);
    left -= dt;
  }
  return {
    seconds,
    earned: s.lifetime - before.lifetime,
    harvested: s.stats.byWorker.harvested - before.harvested,
    net: s.coins - before.coins,
  };
}
