// 村民订单板 (v3.6): 3 villager orders a day (real local date). Each asks for an amount of a product
// the player has already met, counted across any level runs (卖出 / 做出), or money earned in levels.
// Reward: 金币 (bigger for harder), and the hard order sometimes carries a 兑换券 for a shop item.
// One order can be swapped per day. DOM-free (shared with the tests).
import { CFG } from './config.js';
import { OUTFITS, DECOS, UNIFORMS } from './shop.js';

export const ORD = {
  sellValue: [600, 1500, 3500],     // level money worth of the product, per tier (easy / normal / hard)
  earn: [3000, 8000, 18000],
  coins: [60, 120, 240],
  ticketChance: 0.35, ticketMin: 300,
};
export const TIER_NAME = ['简单', '普通', '困难'];
const VILLAGERS = ['王奶奶', '李大叔', '小芳', '张婶', '老刘', '阿杰', '陈阿姨', '小胖', '周爷爷', '林老师'];

export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function nice(n) { const m = n >= 1000 ? 100 : n >= 200 ? 50 : n >= 50 ? 10 : 5; return Math.max(m, Math.round(n / m) * m); }

// products the player has met: sold at a counter (卖出) or made by a machine (做出), in levels ≤ unlocked
export function productPool(unlocked) {
  const sell = new Set(), make = new Set(), n = Math.min(CFG.levels.length - 1, Math.max(0, unlocked));
  for (let i = 0; i <= n; i++) for (const o of CFG.levels[i].objects) {
    if (o.type === 'counter') for (const it of o.items) sell.add(it);
    if (o.type === 'proc') make.add(o.out);
  }
  return { sell: [...sell], make: [...make] };
}

function makeOrder(tier, r, pool, taken, data) {
  // early on (few levels open, smaller farms) orders are smaller: ×0.3 at level 1 → ×1 from level 16
  const f = 0.3 + 0.7 * Math.min(1, (data.unlocked || 0) / 15);
  const kinds = ['sell', 'sell', 'make', 'earn'].filter((k) => k === 'earn' || pool[k].some((it) => !taken.has(it)));
  let kind = kinds[Math.floor(r() * kinds.length)] || 'earn';
  const o = { kind, tier, item: null, n: 0, prog: 0, coins: ORD.coins[tier], ticket: null, claimed: false, who: VILLAGERS[Math.floor(r() * VILLAGERS.length)] };
  if (kind === 'earn') o.n = nice(ORD.earn[tier] * f);
  else {
    const list = pool[kind].filter((it) => !taken.has(it)); o.item = list[Math.floor(r() * list.length)]; taken.add(o.item);
    o.n = nice(ORD.sellValue[tier] * f / CFG.items[o.item].price * (kind === 'make' ? 0.6 : 1));
  }
  if (tier === 2 && r() < ORD.ticketChance) {
    const owned = new Set((data.shop && data.shop.owned) || []);
    const cand = [...OUTFITS, ...DECOS, ...UNIFORMS].filter((x) => x.price >= ORD.ticketMin && !x.fest && !x.book && !owned.has(x.id));
    if (cand.length) o.ticket = cand[Math.floor(r() * cand.length)].id;
  }
  return o;
}

export function ordersDefaults() { return { day: '', list: [], swapped: false, done: 0 }; }
export function normOrders(o) {
  const d = ordersDefaults();
  if (!o || typeof o !== 'object') return d;
  d.day = typeof o.day === 'string' ? o.day : ''; d.swapped = !!o.swapped; d.done = Math.max(0, +o.done || 0);
  d.list = Array.isArray(o.list) ? o.list.filter((x) => x && (x.kind === 'earn' || (x.item && CFG.items[x.item]))) : [];
  return d;
}
// new day → 3 fresh orders (one per tier). Returns true when it regenerated.
export function ensureOrders(data, day = today()) {
  const O = data.orders;
  if (O.day === day && O.list.length === 3) return false;
  const r = rng(hashStr(day + ':' + (data.unlocked || 0)));
  const pool = productPool(data.unlocked || 0), taken = new Set();
  O.day = day; O.swapped = false; O.list = [0, 1, 2].map((t) => makeOrder(t, r, pool, taken, data));
  return true;
}
// one swap a day: replace an unclaimed order with a new one of the same tier
export function swapOrder(data, i) {
  const O = data.orders, o = O.list[i];
  if (!o || o.claimed || O.swapped) return false;
  const r = rng(hashStr(O.day + ':swap:' + i + ':' + (data.unlocked || 0)));
  const taken = new Set(O.list.map((x) => x.item).filter(Boolean));
  O.list[i] = makeOrder(o.tier, r, productPool(data.unlocked || 0), taken, data);
  O.swapped = true;
  return true;
}
export const orderDone = (o) => o.prog >= o.n;
export function orderText(o) {
  if (o.kind === 'earn') return `在关卡里赚 ${o.n.toLocaleString('en-US')} 元`;
  const it = CFG.items[o.item];
  return `${o.kind === 'make' ? '做出' : '卖出'} ${o.n.toLocaleString('en-US')} ${it.unit}${it.name}`;
}
export const statOf = (o, stats) => o.kind === 'earn' ? (stats.earned || 0) : ((o.kind === 'make' ? stats.produced : stats.sold)[o.item] || 0);

// add what happened in a level since `base` (a copy of the stats at the last call) to the orders
export function trackOrders(data, stats, base) {
  ensureOrders(data);
  let changed = false;
  for (const o of data.orders.list) {
    if (o.claimed || o.prog >= o.n) continue;
    const d = statOf(o, stats) - statOf(o, base);
    if (d > 0) { o.prog = Math.min(o.n, o.prog + d); changed = true; }
  }
  return changed;
}
export const cloneStats = (s) => ({ earned: s.earned || 0, sold: { ...s.sold }, produced: { ...s.produced } });

// claim a finished order: coins, plus the 兑换券 item (or half its price if already owned)
export function claimOrder(data, i, itemById) {
  const o = data.orders.list[i];
  if (!o || o.claimed || o.prog < o.n) return null;
  o.claimed = true; data.orders.done++;
  let coins = o.coins, item = null;
  if (o.ticket) {
    const it = itemById(o.ticket);
    if (it && !data.shop.owned.includes(it.id)) { data.shop.owned.push(it.id); item = it; }
    else if (it) coins += Math.round(it.price / 2);
  }
  data.coins = (data.coins || 0) + coins;
  return { coins, item };
}
// the order to show in a level's HUD: the first open one this level can advance
export function hudOrder(data, levelItems) {
  const list = (data.orders && data.orders.list) || [];
  return list.find((o) => !o.claimed && o.prog < o.n && (o.kind === 'earn' ? false : levelItems.has(o.item)))
      || list.find((o) => !o.claimed && o.prog < o.n && o.kind === 'earn') || null;
}
export function levelItems(li) {
  const s = new Set(), L = CFG.levels[li];
  for (const o of L.objects) { if (o.type === 'counter') for (const it of o.items) s.add(it); if (o.type === 'proc') s.add(o.out); }
  return s;
}
