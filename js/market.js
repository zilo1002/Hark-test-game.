// 集市与订单（纯逻辑）
import { CROPS, PRICE_DRIFT_SEC, PRICE_DRIFT, ORDER_COUNT, ORDER_CLIENTS, ORDER_REWARD_MULT, ORDER_SWAP_COOLDOWN, WORKER_LEVEL } from './config.js';
import { cropById, unitPrice, earn, emit } from './state.js';

export function driftPrices(s, rng = Math.random) {
  while (s.t >= s.market.next) {
    for (const c of CROPS) {
      s.market.prev[c.id] = s.market.mult[c.id];
      s.market.mult[c.id] = +(1 - PRICE_DRIFT + rng() * PRICE_DRIFT * 2).toFixed(3);
    }
    s.market.next += PRICE_DRIFT_SEC;
    emit(s, { type: 'drift' });
  }
}
export function priceTrend(s, id) {
  const d = s.market.mult[id] - s.market.prev[id];
  return d > 0.005 ? 1 : d < -0.005 ? -1 : 0;
}

// 卖出若干件，返回所得金币
export function sellItems(s, id, n, by = 'player') {
  const have = s.barn[id] || 0;
  n = Math.min(n, have);
  if (n <= 0) return 0;
  s.barn[id] = have - n;
  if (!s.barn[id]) delete s.barn[id];
  return sellGoods(s, { [id]: n }, by);
}
// 已离开仓库的货（挑夫担子里的）卖出
export function sellGoods(s, goods, by = 'player') {
  let total = 0, count = 0;
  for (const id in goods) { total += unitPrice(s, id) * goods[id]; count += goods[id]; }
  const got = earn(s, total, 'sell');
  if (got) {
    s.stats.sold += count;
    if (by !== 'player') s.stats.byWorker.sold += count;
    s.hints.sold = true;
    emit(s, { type: 'sell', amt: got, n: count, by });
  }
  return got;
}
export function sellAll(s, by = 'player') {
  const goods = { ...s.barn };
  s.barn = {};
  return sellGoods(s, goods, by);
}
export function barnValue(s) {
  let v = 0;
  for (const id in s.barn) v += unitPrice(s, id) * s.barn[id];
  return Math.round(v);
}

// —— 订单 ——
function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

export function makeOrder(s, rng = Math.random) {
  const open = s.plots.filter(p => p.open).length;
  const pool = s.crops.slice(-4); // 偏向最近解锁的几种
  const kinds = Math.min(pool.length, s.crops.length >= 3 && rng() < 0.4 ? 3 : (pool.length >= 2 && rng() < 0.75 ? 2 : 1));
  const chosen = [];
  while (chosen.length < kinds) {
    const id = pick(pool, rng);
    if (!chosen.includes(id)) chosen.push(id);
  }
  const scale = Math.pow(open / 4, 0.7);
  const items = {};
  let value = 0;
  for (const id of chosen) {
    const c = cropById[id];
    const secs = (50 + rng() * 60) / kinds;
    const q = Math.max(2, Math.round(secs / c.time * 2 * scale));
    items[id] = q;
    value += c.price * q;
  }
  const m = ORDER_REWARD_MULT[0] + rng() * (ORDER_REWARD_MULT[1] - ORDER_REWARD_MULT[0]);
  const used = s.orders.map(o => o.who);
  const who = pick(ORDER_CLIENTS.filter(w => !used.includes(w)), rng);
  return { id: s.oseq++, who, items, reward: Math.round(value * m / 5) * 5 };
}

export function fillOrders(s, rng = Math.random) {
  while (s.orders.length < ORDER_COUNT) {
    const o = makeOrder(s, rng);
    s.orders.push(o);
    emit(s, { type: 'orderNew', id: o.id });
  }
}

export function canFulfil(s, o) {
  for (const id in o.items) if ((s.barn[id] || 0) < o.items[id]) return false;
  return true;
}

export function fulfilOrder(s, oid, by = 'player', rng = Math.random) {
  const idx = s.orders.findIndex(o => o.id === oid);
  if (idx < 0) return 0;
  const o = s.orders[idx];
  if (!canFulfil(s, o)) return 0;
  for (const id in o.items) {
    s.barn[id] -= o.items[id];
    if (!s.barn[id]) delete s.barn[id];
  }
  const bonus = by === 'butler' ? WORKER_LEVEL.butlerBonus[s.wlv.butler - 1] : 0;
  const got = earn(s, o.reward * (1 + bonus), 'order');
  s.orders.splice(idx, 1);
  s.stats.orders++;
  emit(s, { type: 'order', amt: got, who: o.who, by });
  fillOrders(s, rng);
  return got;
}

export function swapOrder(s, oid, rng = Math.random) {
  if (s.t < s.swapAt) return false;
  const idx = s.orders.findIndex(o => o.id === oid);
  if (idx < 0) return false;
  s.orders.splice(idx, 1);
  s.swapAt = s.t + ORDER_SWAP_COOLDOWN;
  fillOrders(s, rng);
  return true;
}

// 订单所需的货（挑夫会留着不卖）
export function reservedForOrders(s) {
  const r = {};
  for (const o of s.orders) for (const id in o.items) r[id] = (r[id] || 0) + o.items[id];
  return r;
}
