// 雇工：雇佣、升级、走路干活的 AI（纯逻辑，渲染在 field.js）
import { WORKERS, WORKER_LEVEL, WORKER_MAX_BONUS_MANOR, BARN_POS, BOARD_POS, MARKET_POS, PATH_Y, PORTER_THRESHOLD } from './config.js';
import { manorLevel, spend, emit, barnUsed, barnCap, barnFree, seedCost } from './state.js';
import { isEmpty, isRipe, plantOne, harvestOne, plotStand } from './crops.js';
import { sellGoods, canFulfil, fulfilOrder, reservedForOrders } from './market.js';

export const countOf = (s, type) => s.workers.filter(w => w.type === type).length;
export function maxOf(s, type) {
  return WORKERS[type].max + (manorLevel(s) >= WORKER_MAX_BONUS_MANOR ? 1 : 0);
}
export function hireCost(s, type) {
  return Math.round(WORKERS[type].base * Math.pow(WORKERS[type].growth, countOf(s, type)) / 5) * 5;
}
export function levelCost(s, type) {
  const lv = s.wlv[type];
  if (lv >= 5) return Infinity;
  return Math.round(WORKERS[type].base * WORKER_LEVEL.costMult[lv - 1] / 5) * 5;
}
export const isUnlocked = (s, type) => manorLevel(s) >= WORKERS[type].manor;

function homeOf(s, w) {
  const same = s.workers.filter(x => x.type === w.type);
  const k = same.indexOf(w);
  const base = { planter: 0.75, harvester: 1.15, porter: 0.55, butler: 1.85 }[w.type];
  const x = base + k * 0.2 + (w.type === 'harvester' ? 0.5 : 0) * (k % 2);
  return { x: Math.min(2.7, x), y: PATH_Y + (k % 2 ? 0.08 : 0) };
}

export function hireWorker(s, type) {
  if (!isUnlocked(s, type) || countOf(s, type) >= maxOf(s, type)) return null;
  if (!spend(s, hireCost(s, type))) return null;
  const w = { id: s.wseq++, type, x: -0.3, y: PATH_Y, dir: 1, st: 'idle', q: [], timer: 0, carry: {}, carryN: 0, think: 0, idleFor: 0, bub: null, walk: 0 };
  s.workers.push(w);
  s.hints.hired = true;
  emit(s, { type: 'hire', wtype: type, id: w.id });
  return w;
}

export function upgradeWorkers(s, type) {
  if (!isUnlocked(s, type) || s.wlv[type] >= 5) return false;
  if (!spend(s, levelCost(s, type))) return false;
  s.wlv[type]++;
  emit(s, { type: 'wlevel', wtype: type, lv: s.wlv[type] });
  return true;
}

export function resetWorkerJobs(s) {
  for (const p of s.plots) p.res = null;
  for (const w of s.workers) { w.q = []; w.st = 'idle'; w.timer = 0; w.order = null; }
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pickSeed(s, p) {
  const id = s.autoSeed === 'last' ? (p.last || s.seed) : s.autoSeed;
  return s.crops.includes(id) ? id : s.seed;
}

function nearest(w, plots) {
  let best = null, bd = 1e9;
  for (const p of plots) {
    const d = dist(w, plotStand(p));
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function bubble(s, w, text) { w.bub = { text, until: s.t + 2.2 }; }

function assign(s, w) {
  const L = s.wlv[w.type] - 1;
  if (w.type === 'planter') {
    const cands = s.plots.filter(p => isEmpty(p) && !p.res && s.coins >= seedCost(s, pickSeed(s, p)));
    const p = nearest(w, cands);
    if (p) { p.res = w.id; w.q = [{ ...plotStand(p), act: 'plant', plot: p.i }]; return true; }
    if (s.plots.some(p => isEmpty(p) && !p.res)) bubble(s, w, '缺钱买种');
    return false;
  }
  if (w.type === 'harvester') {
    const basket = WORKER_LEVEL.basket[L];
    if (w.carryN < basket && barnFree(s) > 0) {
      const p = nearest(w, s.plots.filter(p => isRipe(p) && !p.res));
      if (p) { p.res = w.id; w.q = [{ ...plotStand(p), act: 'harvest', plot: p.i }]; return true; }
    }
    if (w.carryN > 0) { w.q = [{ x: BARN_POS.x + 0.15, y: BARN_POS.y, act: 'deposit' }]; return true; }
    if (barnFree(s) <= 0 && s.plots.some(isRipe)) bubble(s, w, '仓库满了');
    return false;
  }
  if (w.type === 'porter') {
    const used = sellableCount(s);
    const thresholdHit = used >= barnCap(s) * PORTER_THRESHOLD;
    if (used > 0 && (thresholdHit || w.idleFor > 20)) {
      w.q = [{ x: BARN_POS.x, y: BARN_POS.y, act: 'load' }, { ...MARKET_POS, act: 'sell' }];
      return true;
    }
    return false;
  }
  if (w.type === 'butler') {
    const claimed = s.workers.filter(x => x !== w && x.order).map(x => x.order);
    const o = s.orders.find(o => !claimed.includes(o.id) && canFulfil(s, o));
    if (o) {
      w.order = o.id;
      w.q = [{ x: BARN_POS.x + 0.1, y: BARN_POS.y, act: 'gather' }, { x: BOARD_POS.x, y: BOARD_POS.y - 0.02, act: 'fulfil' }];
      return true;
    }
    return false;
  }
  return false;
}

function sellableCount(s) {
  const keep = countOf(s, 'butler') ? reservedForOrders(s) : {};
  let n = 0;
  for (const id in s.barn) n += Math.max(0, s.barn[id] - (keep[id] || 0));
  return n;
}

function doAct(s, w, step, rng) {
  const L = s.wlv[w.type] - 1;
  switch (step.act) {
    case 'plant': {
      const p = s.plots[step.plot];
      if (p.res === w.id) p.res = null;
      if (isEmpty(p)) plantOne(s, p, pickSeed(s, p), w.type);
      return true;
    }
    case 'harvest': {
      const p = s.plots[step.plot];
      if (p.res === w.id) p.res = null;
      if (isRipe(p) && barnFree(s) > 0) {
        const got = harvestOne(s, p, rng, w.type);
        if (got) { w.carry[got.id] = (w.carry[got.id] || 0) + got.n; w.carryN += got.n; emit(s, { type: 'wSpark', id: w.id, plot: p.i, crop: got.id }); }
      }
      return true;
    }
    case 'deposit': {
      const room = barnCap(s) - barnUsed(s);
      let moved = 0;
      for (const id in w.carry) {
        const n = Math.min(w.carry[id], room - moved);
        if (n <= 0) continue;
        s.barn[id] = (s.barn[id] || 0) + n;
        w.carry[id] -= n; w.carryN -= n; moved += n;
        if (!w.carry[id]) delete w.carry[id];
      }
      if (moved) emit(s, { type: 'deposit', n: moved, id: w.id });
      if (w.carryN > 0) { bubble(s, w, '仓库满了'); return false; }
      return true;
    }
    case 'load': {
      const cap = WORKER_LEVEL.porterCap[L];
      const keep = countOf(s, 'butler') ? reservedForOrders(s) : {};
      const ids = Object.keys(s.barn).sort((a, b) => s.barn[b] - s.barn[a]);
      for (const id of ids) {
        const can = Math.max(0, s.barn[id] - (keep[id] || 0));
        const n = Math.min(can, cap - w.carryN);
        if (n <= 0) continue;
        s.barn[id] -= n; if (!s.barn[id]) delete s.barn[id];
        w.carry[id] = (w.carry[id] || 0) + n; w.carryN += n;
      }
      if (!w.carryN) return false;
      emit(s, { type: 'load', id: w.id, n: w.carryN });
      return true;
    }
    case 'sell': {
      if (w.carryN) sellGoods(s, w.carry, 'porter');
      w.carry = {}; w.carryN = 0;
      return true;
    }
    case 'gather': return true;
    case 'fulfil': {
      const oid = w.order; w.order = null;
      const got = fulfilOrder(s, oid, 'butler', rng);
      if (!got) return false;
      return true;
    }
  }
  return true;
}

export function tickWorkers(s, dt, rng = Math.random) {
  for (const w of s.workers) {
    const L = s.wlv[w.type] - 1;
    const speed = WORKER_LEVEL.speed[L];
    const workT = WORKER_LEVEL.work[L];
    let budget = dt;
    let guard = 0;
    while (budget > 1e-6 && guard++ < 6) {
      if (w.st === 'idle') {
        w.think -= budget;
        if (w.think > 0) { w.idleFor += budget; idleDrift(s, w, budget, speed); budget = 0; break; }
        w.think = 0.25;
        if (!assign(s, w)) { w.idleFor += budget; idleDrift(s, w, budget, speed); budget = 0; break; }
        w.idleFor = 0;
        w.st = 'walk';
      }
      if (w.st === 'walk') {
        const step = w.q[0];
        if (!step) { w.st = 'idle'; continue; }
        const dx = step.x - w.x, dy = step.y - w.y;
        const d = Math.hypot(dx, dy);
        const can = speed * budget;
        if (Math.abs(dx) > 0.01) w.dir = dx > 0 ? 1 : -1;
        if (d <= can) {
          w.x = step.x; w.y = step.y; budget -= d / speed;
          w.st = 'work';
          w.timer = workT * (step.act === 'load' || step.act === 'sell' || step.act === 'fulfil' ? 1.5 : 1);
          w.walk += d;
        } else {
          w.x += dx / d * can; w.y += dy / d * can; w.walk += can; budget = 0;
        }
      }
      if (w.st === 'work') {
        if (w.timer > budget) { w.timer -= budget; budget = 0; break; }
        budget -= w.timer; w.timer = 0;
        const step = w.q.shift();
        const ok = doAct(s, w, step, rng);
        if (!ok) { for (const st of w.q) if (st.plot != null && s.plots[st.plot].res === w.id) s.plots[st.plot].res = null; w.q = []; }
        if (w.q.length) w.st = 'walk';
        else { w.st = 'idle'; w.think = 0; }
      }
    }
  }
}

// 没活时慢慢走回自己的位置
function idleDrift(s, w, dt, speed) {
  const h = homeOf(s, w);
  const dx = h.x - w.x, dy = h.y - w.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.02) { w.moving = false; return; }
  const can = speed * 0.7 * dt;
  if (Math.abs(dx) > 0.01) w.dir = dx > 0 ? 1 : -1;
  if (d <= can) { w.x = h.x; w.y = h.y; }
  else { w.x += dx / d * can; w.y += dy / d * can; }
  w.walk += Math.min(d, can);
}

export function workerMoving(w, prev) {
  return w.st === 'walk' || (prev != null && Math.abs(w.walk - prev) > 1e-4);
}
